import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

// Real push notifications: alerts reach your partner's phone/computer even
// when iLove is closed.
//
// How it fits together:
//   1. enablePush() asks the browser for a "push address" for this device and
//      saves it at couples/{coupleId}/pushSubs/{deviceId}.
//   2. When you do something (add a song, send a heart...), sendPush() asks
//      our Vercel function (api/push.js) to deliver a short alert to every
//      device your partner has turned alerts on for.
//   3. public/push-sw.js (loaded by your service worker) shows the alert and
//      opens the right page when it's tapped.
//
// Only the PUBLIC key lives here (VITE_VAPID_PUBLIC_KEY). The private key is
// a Vercel environment variable and never reaches the browser.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const AI_URL = import.meta.env.VITE_AI_API_URL || ''
// Local dev: reuse the deployed site's address from VITE_AI_API_URL.
const PUSH_URL = import.meta.env.VITE_PUSH_API_URL || (AI_URL ? AI_URL.replace(/\/api\/ai$/, '/api/push') : '/api/push')
const FLAG = 'ilove-push-on'

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  )
}

export function pushIsOn() {
  try {
    return localStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

function setFlag(on) {
  try {
    if (on) localStorage.setItem(FLAG, '1')
    else localStorage.removeItem(FLAG)
  } catch {
    /* private mode */
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function deviceId(endpoint) {
  const bytes = new TextEncoder().encode(endpoint)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Turns on push for this device. Safe to call often (it just refreshes the
// saved address). Returns true when push is on.
export async function enablePush(coupleId, uid) {
  if (!pushSupported() || !coupleId || !uid) return false
  if (Notification.permission !== 'granted') return false
  // The service worker is only registered on the deployed site (main.jsx).
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((r) => setTimeout(() => r(null), 4000)),
  ])
  if (!reg) return false
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  const json = sub.toJSON()
  await setDoc(doc(db, 'couples', coupleId, 'pushSubs', await deviceId(json.endpoint)), {
    uid,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
    device: /Android/i.test(navigator.userAgent) ? 'android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'ios' : 'computer',
    updatedAt: new Date(),
  })
  setFlag(true)
  return true
}

// Sends one alert to your partner's devices. Never throws — if push isn't
// set up, the bell inside the app still shows everything.
export async function sendPush(coupleId, { title, body, url, tag }) {
  try {
    const user = auth.currentUser
    if (!user || !coupleId) return
    const token = await user.getIdToken()
    await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ coupleId, title, body, url, tag }),
      keepalive: true,
    })
  } catch {
    /* offline / not set up — fine */
  }
}

const REMIND_URL = PUSH_URL.replace(/\/api\/push$/, '/api/reminders')

// Registers a task's reminder with the server so it can be sent at the right
// time even when nobody has iLove open. The server reads the time from the
// task itself, so this only says "this task has a reminder now".
export async function scheduleReminder(coupleId, taskId) {
  try {
    const user = auth.currentUser
    if (!user || !coupleId || !taskId) return false
    const token = await user.getIdToken()
    const res = await fetch(REMIND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ coupleId, taskId }),
    })
    return res.ok
  } catch {
    return false
  }
}
