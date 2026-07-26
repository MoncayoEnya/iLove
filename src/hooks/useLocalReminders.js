import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const LOOKAHEAD_MS = 24 * 60 * 60 * 1000 // only schedule reminders due within the next 24h
const REFRESH_MS = 5 * 60 * 1000 // re-check the window every 5 minutes
const MAX_TIMERS = 50 // safety cap

// Fires a real browser Notification when a calendar reminder comes due, as long
// as this tab (or another tab of the app) stays open. This is NOT push — it
// can't wake up a closed browser — but it needs no server, no Cloud Functions,
// and no billing plan, so it works entirely on the free Firebase tier.
export function useLocalReminders() {
  const { couple } = useAuth()
  const coupleId = couple?.id
  const [tick, setTick] = useState(0)
  const timers = useRef(new Map())
  const fired = useRef(new Set())

  // Ask for notification permission once, up front.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Periodically refresh so the query window ("now" to "now + 24h") stays current.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!coupleId || typeof window === 'undefined' || !('Notification' in window)) return

    const now = new Date()
    const horizon = new Date(now.getTime() + LOOKAHEAD_MS)
    const q = query(
      collection(db, 'couples', coupleId, 'events'),
      where('reminderAt', '>=', now),
      where('reminderAt', '<=', horizon)
    )

    const unsub = onSnapshot(q, (snap) => {
      const activeIds = new Set()
      snap.docs.forEach((d) => {
        const event = { id: d.id, ...d.data() }
        if (!event.reminderAt) return
        activeIds.add(event.id)
        if (fired.current.has(event.id) || timers.current.has(event.id)) return
        if (timers.current.size >= MAX_TIMERS) return

        const atMs = event.reminderAt.toMillis ? event.reminderAt.toMillis() : new Date(event.reminderAt).getTime()
        const delay = atMs - Date.now()
        if (delay < 0 || delay > LOOKAHEAD_MS) return

        const t = setTimeout(() => {
          fired.current.add(event.id)
          timers.current.delete(event.id)
          try {
            if (Notification.permission === 'granted') {
              new Notification(event.title || 'Reminder', {
                body: event.note || 'Coming up on your shared calendar.',
                tag: event.id,
              })
            }
          } catch {
            // Some browsers/contexts (e.g. iOS Safari) can throw here; fail silently.
          }
        }, delay)
        timers.current.set(event.id, t)
      })

      // Clear timers for events that were deleted or edited out of the window.
      timers.current.forEach((t, id) => {
        if (!activeIds.has(id)) {
          clearTimeout(t)
          timers.current.delete(id)
        }
      })
    })

    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, tick])

  // Clear all pending timers on unmount.
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t))
      timers.current.clear()
    }
  }, [])
}