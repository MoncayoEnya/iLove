import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { eventReminderCopy, streakRiskCopy } from '../utils/notificationCopy'
import { todayStr } from '../utils/date'

const LOOKAHEAD_MS = 24 * 60 * 60 * 1000 // only schedule reminders due within the next 24h
const REFRESH_MS = 5 * 60 * 1000 // re-check the window every 5 minutes
const MAX_TIMERS = 50 // safety cap
const STREAK_RISK_KEY = 'ilovee-streak-risk-fired'
const STREAK_RISK_WINDOW_HOURS = 3 // start warning once this many hours remain in the day

// Fires a real browser Notification when a calendar reminder comes due, as long
// as this tab (or another tab of the app) stays open. This is NOT push — it
// can't wake up a closed browser — but it needs no server, no Cloud Functions,
// and no billing plan, so it works entirely on the free Firebase tier.
export function useLocalReminders() {
  const { firebaseUser, couple } = useAuth()
  const { partner } = usePartner()
  const coupleId = couple?.id
  const [tick, setTick] = useState(0)
  const timers = useRef(new Map())
  const fired = useRef(new Set())
  const partnerLoveLanguage = partner?.loveLanguage

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

  // ---- Calendar-event reminders ----
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
              const { title, body } = eventReminderCopy(event, partnerLoveLanguage)
              new Notification(title, { body, tag: event.id })
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
  }, [coupleId, tick, partnerLoveLanguage])

  // ---- Streak-at-risk nudge ----
  // Self-contained check: once fewer than STREAK_RISK_WINDOW_HOURS remain
  // today, if this person hasn't checked in yet and hasn't already been
  // warned today, fire one local nudge. "Already warned today" is tracked
  // in localStorage (keyed by date) so it survives tab refreshes and only
  // fires once per day, not once per REFRESH_MS tick.
  useEffect(() => {
    if (!coupleId || !firebaseUser?.uid || typeof window === 'undefined' || !('Notification' in window)) return
    if (!couple?.streak) return

    const today = todayStr()
    const q = query(
      collection(db, 'couples', coupleId, 'checkins'),
      where('date', '==', today),
      where('uid', '==', firebaseUser.uid)
    )
    const unsub = onSnapshot(q, (snap) => {
      const alreadyCheckedIn = !snap.empty
      if (alreadyCheckedIn) return

      const now = new Date()
      const endOfDay = new Date(now)
      endOfDay.setHours(24, 0, 0, 0)
      const hoursLeft = Math.ceil((endOfDay.getTime() - now.getTime()) / (60 * 60 * 1000))
      if (hoursLeft > STREAK_RISK_WINDOW_HOURS || hoursLeft <= 0) return

      const lastFiredDate = localStorage.getItem(STREAK_RISK_KEY)
      if (lastFiredDate === today) return

      try {
        if (Notification.permission === 'granted') {
          const { title, body } = streakRiskCopy(couple.streak, hoursLeft, partnerLoveLanguage)
          new Notification(title, { body, tag: 'streak-risk' })
        }
        localStorage.setItem(STREAK_RISK_KEY, today)
      } catch {
        // Fail silently, same as the event-reminder path above.
      }
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, firebaseUser?.uid, couple?.streak, tick, partnerLoveLanguage])

  // Clear all pending timers on unmount.
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t))
      timers.current.clear()
    }
  }, [])
}
