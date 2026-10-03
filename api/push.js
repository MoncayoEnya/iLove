// Vercel serverless function: /api/push
//
// Delivers a short alert to your partner's phone/computer, even when their
// iLove is closed. Called by the app right after you do something (add a
// song, send a heart...). Free: it uses the browsers' own push services.
//
// Setup (one time):
//   1. In the project folder:   npm install web-push
//                               npx web-push generate-vapid-keys
//   2. Vercel -> Settings -> Environment Variables:
//        VAPID_PUBLIC_KEY      = the Public Key
//        VITE_VAPID_PUBLIC_KEY = the same Public Key (the app needs it too)
//        VAPID_PRIVATE_KEY     = the Private Key   (secret, never in code or .env with VITE_)
//        VAPID_SUBJECT         = mailto:you@example.com
//   3. Redeploy. Check https://<your-site>/api/push?check=1
//
// Security: the caller must send their Firebase login token. We use that
// token to read the couple from Firestore (so Firestore's own rules decide
// access) and only ever send to the OTHER member of that couple.

import webpush from 'web-push'

const hits = new Map()
function rateLimited(key) {
  const now = Date.now()
  const list = (hits.get(key) || []).filter((t) => now - t < 60 * 1000)
  list.push(now)
  hits.set(key, list)
  return list.length > 40
}

function setCors(req, res) {
  const origin = req.headers.origin || ''
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  if (origin && (isLocal || allowed.includes(origin) || allowed.length === 0)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max)
const projectId = () => (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '').trim()
const vapid = () => ({
  publicKey: (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '').trim(),
  privateKey: (process.env.VAPID_PRIVATE_KEY || '').trim(),
  subject: (process.env.VAPID_SUBJECT || 'mailto:hello@example.com').trim(),
})

function uidFromToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return payload.user_id || payload.sub || ''
  } catch {
    return ''
  }
}

async function firestore(path, token, init = {}) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${path}`
  return fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } })
}

const str = (f) => f?.stringValue || ''

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  res.setHeader('Cache-Control', 'no-store')

  const keys = vapid()

  // Self-check: https://<your-site>/api/push?check=1 (never shows the keys)
  if (req.method === 'GET' && 'check' in (req.query || {})) {
    let webpushLoaded = false
    try {
      webpushLoaded = typeof webpush.sendNotification === 'function'
    } catch {
      /* not installed */
    }
    return res.status(200).json({
      webpushLoaded,
      publicKeySet: !!keys.publicKey,
      privateKeySet: !!keys.privateKey,
      subjectSet: !!process.env.VAPID_SUBJECT,
      firebaseProjectIdSet: !!projectId(),
      ready: webpushLoaded && !!keys.publicKey && !!keys.privateKey && !!projectId(),
    })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!keys.publicKey || !keys.privateKey) return res.status(503).json({ error: 'Push is not set up (VAPID keys missing).' })
  if (!projectId()) return res.status(503).json({ error: 'Push is not set up (Firebase project id missing).' })

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const uid = uidFromToken(token)
  if (!token || !uid) return res.status(401).json({ error: 'Sign in first.' })
  if (rateLimited(uid)) return res.status(429).json({ error: 'Too many alerts, slow down.' })

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  const coupleId = clean(body?.coupleId, 128)
  if (!coupleId || /[/]/.test(coupleId)) return res.status(400).json({ error: 'Missing couple.' })

  // Reading the couple with the caller's own token proves the token is real
  // AND that Firestore lets them see this couple.
  const coupleRes = await firestore(`couples/${encodeURIComponent(coupleId)}`, token)
  if (!coupleRes.ok) return res.status(403).json({ error: `Not allowed (${coupleRes.status}).` })
  const couple = await coupleRes.json()
  const members = (couple.fields?.members?.arrayValue?.values || []).map(str)
  if (!members.includes(uid)) return res.status(403).json({ error: 'Not your couple.' })
  const partnerUid = members.find((m) => m && m !== uid)
  if (!partnerUid) return res.status(200).json({ sent: 0, reason: 'no partner yet' })

  const subsRes = await firestore(`couples/${encodeURIComponent(coupleId)}/pushSubs?pageSize=50`, token)
  if (!subsRes.ok) return res.status(502).json({ error: `Could not read devices (${subsRes.status}).` })
  const docs = (await subsRes.json()).documents || []
  const devices = docs
    .map((d) => ({
      name: d.name,
      uid: str(d.fields?.uid),
      sub: { endpoint: str(d.fields?.endpoint), keys: { p256dh: str(d.fields?.p256dh), auth: str(d.fields?.auth) } },
    }))
    .filter((d) => d.uid === partnerUid && d.sub.endpoint)

  if (!devices.length) return res.status(200).json({ sent: 0, reason: 'partner has no devices with alerts on' })

  const url = String(body?.url || '/dashboard')
  const payload = JSON.stringify({
    title: clean(body?.title, 90) || 'iLove',
    body: clean(body?.body, 160),
    url: url.startsWith('/') ? url.slice(0, 200) : '/dashboard',
    tag: clean(body?.tag, 120),
  })

  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey)
  let sent = 0
  await Promise.all(
    devices.map(async (d) => {
      try {
        await webpush.sendNotification(d.sub, payload, { TTL: 60 * 60 * 24, urgency: 'high' })
        sent++
      } catch (e) {
        // 404/410: that device turned alerts off or the address expired.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          const path = d.name.split('/documents/')[1]
          if (path) await firestore(path, token, { method: 'DELETE' }).catch(() => {})
        } else {
          console.error('push failed', e?.statusCode, String(e?.body || e?.message || e).slice(0, 200))
        }
      }
    })
  )
  return res.status(200).json({ sent, devices: devices.length })
}
