import dayjs from 'dayjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from './usePartner'
import { todayStr } from '../utils/date'
import { moodInfo } from '../utils/moods'

// Builds the notification feed from things your PARTNER did in the app
// (new song, memory, task, message, check-in, nudge, ...). No server and no
// extra collection needed: it reads the last two weeks of each shared list
// and keeps only your partner's items.
//
// "Read" state is one timestamp on your user doc, so it syncs across your
// devices: users/{uid}.notificationsSeenAt
//
// Only single-field queries (createdAt range + order), so Firestore needs no
// extra indexes.

const WINDOW_DAYS = 14
const PER_SOURCE = 10

const short = (s, n = 70) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

const toDate = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null)

// Each source: which collection, who wrote it, and how to describe it.
// describe() returns null to skip an item (private, auto-made, not for me...).
const SOURCES = [
  {
    col: 'messages',
    by: (d) => d.from,
    describe: (d) => ({
      type: 'message',
      action: 'left you a message',
      detail: d.type === 'image' ? 'Photo' : short(d.text),
      link: '/chat',
    }),
  },
  {
    col: 'nudges',
    by: (d) => d.from,
    describe: () => ({
      type: 'nudge',
      action: 'wants to hear from you',
      detail: 'Check in so they know how your day is going',
      link: '/dashboard',
    }),
  },
  {
    col: 'hearts',
    by: (d) => d.from,
    describe: (d, uid) =>
      d.to && d.to !== uid ? null : { type: 'heart', action: 'is thinking of you', detail: 'Send one back with the heart button', link: '/dashboard' },
  },
  {
    col: 'checkins',
    by: (d) => d.uid,
    describe: (d) => {
      const m = d.mood ? moodInfo(d.mood) : null
      return {
        type: 'checkin',
        action: 'checked in today',
        // A rough day gets a gentle hint to show them some extra love.
        detail: !m?.l
          ? short(d.gratitude)
          : ['sad', 'hard'].includes(d.mood)
          ? `Feeling ${m.l.toLowerCase()}. Maybe send them a little extra love`
          : `Feeling ${m.l.toLowerCase()}`,
        link: '/checkins',
      }
    },
  },
  {
    col: 'jar',
    by: (d) => d.from,
    describe: (d) =>
      d.private ? null : {
            type: 'jar',
            action: 'left a little note in your love jar',
            detail: 'No peeking from here. Open the jar to read it',
            link: '/memories?tab=jar',
          },
  },
  {
    col: 'memories',
    by: (d) => d.from,
    describe: (d) =>
      d.auto || d.private
        ? null
        : {
            type: 'memory',
            action: d.entryType === 'photo' ? 'saved a memory of you two' : 'marked a milestone for you both',
            detail: short(d.caption || d.title),
            link: '/memories',
          },
  },
  {
    col: 'tasks',
    by: (d) => d.createdBy,
    describe: (d, uid) =>
      d.private
        ? null
        : {
            type: 'task',
            action: d.assignedTo === uid ? 'asked for your help with something' : 'added to your to-do list',
            detail: short(d.text),
            link: '/tasks',
          },
  },
  {
    col: 'events',
    by: (d) => d.createdBy,
    // Repeating events make one doc per date — only the series is news.
    describe: (d) =>
      d.private || d.seriesId
        ? null
        : { type: 'event', action: 'planned something for you both', detail: short(d.title), link: '/calendar' },
  },
  {
    col: 'playlist',
    by: (d) => d.addedBy,
    describe: (d) => ({
      type: 'song',
      action: 'added a song for you',
      detail: short([d.title, d.artist].filter(Boolean).join(' · ')),
      link: '/playlist',
    }),
  },
  {
    col: 'sharedPlaces',
    by: (d) => d.addedBy,
    describe: (d) => ({ type: 'place', action: 'wants to go somewhere with you', detail: short(d.name), link: '/places' }),
  },
  {
    col: 'bucketList',
    by: (d) => d.addedBy,
    describe: (d) => ({ type: 'bucket', action: 'added a dream to your bucket list', detail: short(d.text), link: '/bucket-list' }),
  },
  {
    col: 'goals',
    by: (d) => d.createdBy,
    describe: (d) => ({ type: 'goal', action: 'set a new goal for you two', detail: short(d.title), link: '/goals' }),
  },
  {
    col: 'customDateIdeas',
    by: (d) => d.addedBy,
    describe: (d) => ({ type: 'idea', action: 'has a date idea for you', detail: short(d.title), link: '/date-ideas' }),
  },
  {
    col: 'timeCapsules',
    by: (d) => d.authorId,
    describe: (d) => ({
      type: 'capsule',
      action: 'sealed a time capsule for future you',
      detail: d.unlockDate ? `It opens on ${dayjs(d.unlockDate).format('MMM D, YYYY')}` : 'Sealed until the big day',
      link: '/memories?tab=capsule',
    }),
  },
  {
    col: 'flappyDuels',
    by: (d) => d.challengerId,
    describe: (d, uid) =>
      d.opponentId !== uid
        ? null
        : { type: 'duel', action: 'challenged you to Flappy Date', detail: 'Think you can beat their score?', link: '/play' },
  },
]

export function useNotifications() {
  const { firebaseUser, couple, profile } = useAuth()
  const { partnerUid } = usePartner()
  const uid = firebaseUser?.uid
  const coupleId = couple?.id
  const [bySource, setBySource] = useState({})
  const [today, setToday] = useState(todayStr())

  // Roll over at midnight so "answered today's question" follows the day.
  useEffect(() => {
    const id = setInterval(() => setToday(todayStr()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!coupleId || !uid || !partnerUid) {
      setBySource({})
      return undefined
    }
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const unsubs = SOURCES.map((src) =>
      onSnapshot(
        query(
          collection(db, 'couples', coupleId, src.col),
          where('createdAt', '>', since),
          orderBy('createdAt', 'desc'),
          limit(PER_SOURCE)
        ),
        (snap) => {
          const items = []
          snap.docs.forEach((d) => {
            const data = d.data()
            if (src.by(data) !== partnerUid) return
            const at = toDate(data.createdAt)
            if (!at) return
            const info = src.describe(data, uid)
            if (!info) return
            items.push({ id: `${src.col}/${d.id}`, at, ...info })
          })
          setBySource((prev) => ({ ...prev, [src.col]: items }))
        },
        () => setBySource((prev) => ({ ...prev, [src.col]: [] })) // no access / offline: stay quiet
      )
    )
    return () => unsubs.forEach((u) => u())
  }, [coupleId, uid, partnerUid])

  // Partner answered today's question of the day.
  useEffect(() => {
    if (!coupleId || !partnerUid) return undefined
    return onSnapshot(
      doc(db, 'couples', coupleId, 'dailyAnswers', today),
      (snap) => {
        const a = snap.exists() ? snap.data()[partnerUid] : null
        const at = toDate(a?.at)
        setBySource((prev) => ({
          ...prev,
          dailyAnswers: at
            ? [
                {
                  id: `dailyAnswers/${today}`,
                  at,
                  type: 'question',
                  action: "answered today's question",
                  detail: 'Answer yours to unlock theirs',
                  link: '/dashboard#daily-question',
                },
              ]
            : [],
        }))
      },
      () => {}
    )
  }, [coupleId, partnerUid, today])

  const seenAt = toDate(profile?.notificationsSeenAt) || null

  const items = useMemo(() => {
    const all = Object.values(bySource).flat()
    // Many chat messages in a row collapse into one line.
    const messages = all.filter((n) => n.type === 'message').sort((a, b) => b.at - a.at)
    const rest = all.filter((n) => n.type !== 'message')
    if (messages.length) {
      const unreadMsgs = seenAt ? messages.filter((m) => m.at > seenAt).length : messages.length
      const latest = messages[0]
      rest.push(
        unreadMsgs > 1
          ? { ...latest, action: `left you ${unreadMsgs} messages` }
          : latest
      )
    }
    return rest.sort((a, b) => b.at - a.at).slice(0, 40)
  }, [bySource, seenAt])

  const unreadCount = items.filter((n) => !seenAt || n.at > seenAt).length

  async function markAllSeen() {
    if (!uid) return
    await setDoc(doc(db, 'users', uid), { notificationsSeenAt: new Date() }, { merge: true }).catch(() => {})
  }

  return { items, unreadCount, seenAt, markAllSeen }
}

// Watches the feed and pops a real phone/desktop notification for anything
// NEW that arrives while the app is open in the background (another tab,
// minimized window). Items already there when the app loads never pop.
export function useBackgroundAlerts(items, partnerName, onOpen) {
  const openedAt = useRef(Date.now())
  const alerted = useRef(new Set())

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const fresh = items.filter((n) => n.at.getTime() > openedAt.current && !alerted.current.has(n.id))
    fresh.forEach((n) => alerted.current.add(n.id))
    if (!fresh.length || Notification.permission !== 'granted') return
    // You're looking at the app — the bell badge is enough.
    if (document.visibilityState === 'visible' && document.hasFocus()) return

    fresh.slice(0, 3).forEach((n) => {
      const title = `${partnerName} ${n.action}`
      const options = { body: n.detail || 'Open iLove to see it', tag: n.id }
      try {
        const note = new Notification(title, options)
        note.onclick = () => {
          window.focus()
          onOpen?.(n)
          note.close()
        }
      } catch {
        // Android Chrome only allows notifications through the service worker.
        navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, options)).catch(() => {})
      }
    })
  }, [items, partnerName, onOpen])
}
