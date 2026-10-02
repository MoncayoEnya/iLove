import { useEffect } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

dayjs.extend(relativeTime)

// Presence lives on each person's own users/{uid} doc (which they can
// always write), so the partner already receives it through usePartner's
// live listener — no extra reads.
//
//   lastActiveAt — refreshed every minute while the tab is visible
// (Chat's "typing…" indicator already exists separately in Chat.jsx.)

const HEARTBEAT_MS = 60 * 1000
const ONLINE_WINDOW_MS = 2.5 * 60 * 1000

function toMillis(ts) {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

export function isOnline(user) {
  return Date.now() - toMillis(user?.lastActiveAt) < ONLINE_WINDOW_MS
}

export function lastSeenText(user) {
  const ms = toMillis(user?.lastActiveAt)
  if (!ms) return null
  if (isOnline(user)) return 'Online now'
  return `Active ${dayjs(ms).fromNow()}`
}

// Mount once (AppLayout). Keeps lastActiveAt fresh while the app is open
// and visible; stops when the tab is hidden so "online" means really here.
export function usePresenceHeartbeat() {
  const { firebaseUser } = useAuth()
  const uid = firebaseUser?.uid

  useEffect(() => {
    if (!uid) return undefined
    const ref = doc(db, 'users', uid)
    const beat = () => {
      if (document.visibilityState !== 'visible') return
      setDoc(ref, { lastActiveAt: new Date() }, { merge: true }).catch(() => {})
    }
    beat()
    const id = setInterval(beat, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', beat)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [uid])
}
