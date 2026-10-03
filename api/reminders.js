// Vercel serverless function: /api/reminders
//
// Two jobs, both delivered as push alerts (even when iLove is closed):
//   1. Task reminders: "Reminder: Pay the bill" at the time picked on the task.
//   2. Morning summary: once a day, "Today: 2 tasks · 1 event".
//
// It's woken up every 5 minutes by a free cron-job.org job (see setup). The
// app also calls it once when a task with a reminder is added, to register
// that reminder.
//
// Setup (one time):
//   npm install firebase-admin
//   Vercel -> Settings -> Environment Variables:
//     FIREBASE_SERVICE_ACCOUNT = the whole JSON key file from Firebase   (Secret)
//     CRON_SECRET              = any long random password you make up      (Secret)
//     DIGEST_TZ                = Asia/Singapore   (optional, this is the default)
//     DIGEST_HOUR              = 8                (optional, morning summary hour)
//   (VAPID_* keys are shared with api/push.js.)
//   Check: https://<your-site>/api/reminders?check=1
//
// Data: reminders/{coupleId__taskId} = { coupleId, taskId, at }
// This top-level collection is only touched by this server (admin access),
// never by the app, so it needs no Firestore rules.

// Libraries are loaded on first use, so a missing install shows up as a clear
// message on ?check=1 instead of crashing the whole function.
let webpush
let Timestamp
let libError = ''
async function loadLibs() {
  if (webpush && Timestamp) return true
  try {
    webpush = (await import('web-push')).default
  } catch {
    libError = 'web-push is not installed (run: npm install web-push, then commit package.json)'
    return false
  }
  try {
    const app = await import('firebase-admin/app')
    const auth = await import('firebase-admin/auth')
    const fs = await import('firebase-admin/firestore')
    Timestamp = fs.Timestamp
    libs = { ...app, getAuth: auth.getAuth, getFirestore: fs.getFirestore }
    return true
  } catch {
    libError = 'firebase-admin is not installed (run: npm install firebase-admin, then commit package.json and package-lock.json)'
    return false
  }
}
let libs = null

function serviceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    } catch {
      return null
    }
  }
}

function admin() {
  if (!libs) throw new Error(libError || 'libraries not loaded')
  if (!libs.getApps().length) {
    const sa = serviceAccount()
    if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT missing or not valid JSON')
    libs.initializeApp({ credential: libs.cert(sa) })
  }
  return { db: libs.getFirestore(), auth: libs.getAuth() }
}

const vapid = () => ({
  publicKey: (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '').trim(),
  privateKey: (process.env.VAPID_PRIVATE_KEY || '').trim(),
  subject: (process.env.VAPID_SUBJECT || 'mailto:hello@example.com').trim(),
})

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

function setCors(req, res) {
  const origin = req.headers.origin || ''
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  if (origin && (isLocal || allowed.includes(origin) || allowed.length === 0)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Send one alert to every device of the given people in a couple.
async function pushTo(db, coupleId, uids, message) {
  const keys = vapid()
  if (!keys.publicKey || !keys.privateKey || !uids.length) return 0
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey)
  const subs = await db.collection('couples').doc(coupleId).collection('pushSubs').get()
  const payload = JSON.stringify(message)
  let sent = 0
  await Promise.all(
    subs.docs
      .filter((d) => uids.includes(d.get('uid')) && d.get('endpoint'))
      .map(async (d) => {
        try {
          await webpush.sendNotification(
            { endpoint: d.get('endpoint'), keys: { p256dh: d.get('p256dh'), auth: d.get('auth') } },
            payload,
            { TTL: 60 * 60 * 6, urgency: 'high' }
          )
          sent++
        } catch (e) {
          if (e?.statusCode === 404 || e?.statusCode === 410) await d.ref.delete().catch(() => {})
          else console.error('push failed', e?.statusCode, String(e?.body || e?.message || e).slice(0, 200))
        }
      })
  )
  return sent
}

async function displayName(db, uid, cache) {
  if (!cache.has(uid)) {
    const snap = await db.collection('users').doc(uid).get().catch(() => null)
    cache.set(uid, snap?.get?.('displayName') || 'Your partner')
  }
  return cache.get(uid)
}

// Who a task is for: the private owner, the assignee, or both of you.
function recipientsFor(task, members) {
  if (task.private) return task.ownerId ? [task.ownerId] : []
  if (task.assignedTo) return [task.assignedTo]
  return members
}

// ---- 1. Task reminders that are due now ----
async function sendDueReminders(db) {
  const now = Timestamp.now()
  const due = await db.collection('reminders').where('at', '<=', now).limit(100).get()
  const names = new Map()
  let sent = 0
  for (const r of due.docs) {
    const { coupleId, taskId, at } = r.data()
    try {
      const [taskSnap, coupleSnap] = await Promise.all([
        db.collection('couples').doc(coupleId).collection('tasks').doc(taskId).get(),
        db.collection('couples').doc(coupleId).get(),
      ])
      const task = taskSnap.exists ? taskSnap.data() : null
      const stillWanted =
        task &&
        !task.done &&
        task.remindAt &&
        task.remindAt.toMillis() === at.toMillis() &&
        now.toMillis() - at.toMillis() < 12 * 60 * 60 * 1000 // don't send day-old reminders
      if (stillWanted) {
        const members = coupleSnap.get('members') || []
        const to = recipientsFor(task, members)
        // "Reminder from Enya" when someone set it for their partner.
        for (const uid of to) {
          const fromOther = task.createdBy && task.createdBy !== uid
          const title = fromOther ? `Reminder from ${await displayName(db, task.createdBy, names)}` : 'Reminder'
          sent += await pushTo(db, coupleId, [uid], {
            title,
            body: clip(task.text, 140) || 'You have something to do',
            url: '/tasks',
            tag: `reminder/${taskId}`,
          })
        }
      }
    } catch (e) {
      console.error('reminder failed', coupleId, taskId, e?.message || e)
    }
    await r.ref.delete().catch(() => {})
  }
  return { due: due.size, sent }
}

// ---- 2. Morning summary, once a day ----
function localNow(tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
}

async function sendMorningSummary(db, { force = false } = {}) {
  const tz = process.env.DIGEST_TZ || 'Asia/Singapore'
  const hour = Number(process.env.DIGEST_HOUR || 8)
  const { date: today, hour: nowHour } = localNow(tz)
  if (!force && nowHour < hour) return { skipped: 'too early' }

  // Claim today's summary first so two runs at once can't both send it.
  const marker = db.collection('reminders_meta').doc('digest')
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(marker)
    if (!force && snap.exists && snap.get('lastDate') === today) return false
    tx.set(marker, { lastDate: today, at: Timestamp.now() })
    return true
  })
  if (!claimed) return { skipped: 'already sent today' }

  const couples = await db.collection('couples').get()
  let sent = 0
  for (const c of couples.docs) {
    const members = c.get('members') || []
    if (!members.length) continue
    const [taskSnap, eventSnap] = await Promise.all([
      c.ref.collection('tasks').where('dueDate', '<=', today).limit(300).get(),
      c.ref.collection('events').where('date', '==', today).limit(50).get(),
    ])
    const tasks = taskSnap.docs.map((d) => d.data()).filter((t) => !t.done)
    const events = eventSnap.docs.map((d) => d.data())

    for (const uid of members) {
      const mine = tasks.filter((t) => recipientsFor(t, members).includes(uid))
      const dueToday = mine.filter((t) => t.dueDate === today)
      const overdue = mine.filter((t) => t.dueDate < today)
      const myEvents = events.filter((e) => !e.private || e.ownerId === uid)
      if (!dueToday.length && !overdue.length && !myEvents.length) continue

      const bits = []
      if (dueToday.length) bits.push(`${dueToday.length} task${dueToday.length === 1 ? '' : 's'}`)
      if (myEvents.length) bits.push(`${myEvents.length} plan${myEvents.length === 1 ? '' : 's'}`)
      if (overdue.length) bits.push(`${overdue.length} overdue`)
      const names = [
        ...myEvents.map((e) => (e.time ? `${e.title} (${e.time})` : e.title)),
        ...dueToday.map((t) => t.text),
        ...overdue.map((t) => t.text),
      ].filter(Boolean)
      sent += await pushTo(db, c.id, [uid], {
        title: `Good morning! Today: ${bits.join(' · ')}`,
        body: clip(names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} more` : ''), 160),
        url: dueToday.length || overdue.length ? '/tasks' : '/calendar',
        tag: `digest/${today}`,
      })
    }
  }
  return { date: today, sent }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  res.setHeader('Cache-Control', 'no-store')
  const q = req.query || {}
  const libsOk = await loadLibs()

  // Self-check: /api/reminders?check=1 (never shows secrets)
  if (req.method === 'GET' && 'check' in q) {
    const report = {
      librariesInstalled: libsOk,
      ...(libsOk ? {} : { problem: libError }),
      serviceAccountValid: !!serviceAccount(),
      cronSecretSet: !!process.env.CRON_SECRET,
      vapidReady: !!(vapid().publicKey && vapid().privateKey),
      timezone: process.env.DIGEST_TZ || 'Asia/Singapore',
      summaryHour: Number(process.env.DIGEST_HOUR || 8),
    }
    try {
      const { db } = admin()
      const pending = await db.collection('reminders').count().get()
      report.firestoreConnected = true
      report.pendingReminders = pending.data().count
    } catch (e) {
      report.firestoreConnected = false
      report.firestoreError = clip(e?.message || e, 160)
    }
    report.ready = libsOk && report.serviceAccountValid && report.cronSecretSet && report.vapidReady && report.firestoreConnected
    return res.status(200).json(report)
  }

  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const secret = (process.env.CRON_SECRET || '').trim()
  const isCron = !!secret && (bearer === secret || q.key === secret)

  let db
  let auth
  try {
    ;({ db, auth } = admin())
  } catch (e) {
    return res.status(503).json({ error: `Reminders not set up: ${e.message}` })
  }

  // ---- Cron run (cron-job.org every 5 minutes) ----
  if (isCron) {
    const out = { reminders: await sendDueReminders(db) }
    try {
      out.summary = await sendMorningSummary(db, { force: q.summary === 'now' })
    } catch (e) {
      out.summary = { error: clip(e?.message || e, 160) }
    }
    return res.status(200).json(out)
  }

  // ---- App registering a task reminder ----
  if (req.method !== 'POST') return res.status(401).json({ error: 'Not allowed.' })
  let uid
  try {
    uid = (await auth.verifyIdToken(bearer)).uid
  } catch {
    return res.status(401).json({ error: 'Sign in first.' })
  }
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  const coupleId = String(body?.coupleId || '')
  const taskId = String(body?.taskId || '')
  if (!coupleId || !taskId || /[/]/.test(coupleId + taskId)) return res.status(400).json({ error: 'Missing task.' })

  const coupleSnap = await db.collection('couples').doc(coupleId).get()
  if (!(coupleSnap.get('members') || []).includes(uid)) return res.status(403).json({ error: 'Not your couple.' })
  const taskSnap = await db.collection('couples').doc(coupleId).collection('tasks').doc(taskId).get()
  const remindAt = taskSnap.exists ? taskSnap.get('remindAt') : null
  const ref = db.collection('reminders').doc(`${coupleId}__${taskId}`)
  if (!remindAt) {
    await ref.delete().catch(() => {})
    return res.status(200).json({ scheduled: false })
  }
  await ref.set({ coupleId, taskId, at: remindAt })
  return res.status(200).json({ scheduled: true, at: remindAt.toDate().toISOString() })
}