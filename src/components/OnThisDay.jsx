import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { AnimatePresence, motion } from 'framer-motion'
import { FiChevronLeft, FiChevronRight, FiClock, FiHeart } from 'react-icons/fi'
import { db } from '../firebase'
import { MOODS } from '../utils/moods'
import MoodIcon from './MoodIcon'

// "On this day" — resurfaces something from exactly one year / one month /
// one week ago (a photo memory, a milestone, a check-in with a note or
// photo). If nothing lines up with today, it falls back to a random older
// memory so the card is still worth looking at. Hides itself entirely when
// the couple has no history yet.

const WINDOWS = [
  { amount: 1, unit: 'year', label: 'One year ago today' },
  { amount: 6, unit: 'month', label: 'Six months ago today' },
  { amount: 1, unit: 'month', label: 'One month ago today' },
  { amount: 1, unit: 'week', label: 'One week ago today' },
]

function dayRange(d) {
  return [d.startOf('day').toDate(), d.endOf('day').toDate()]
}

export default function OnThisDay({ coupleId, names = {} }) {
  const [items, setItems] = useState(null) // null = loading
  const [index, setIndex] = useState(0)
  const today = dayjs().format('YYYY-MM-DD')

  useEffect(() => {
    if (!coupleId) return undefined
    let cancelled = false

    async function load() {
      const found = []
      for (const w of WINDOWS) {
        const d = dayjs().subtract(w.amount, w.unit)
        const dateStr = d.format('YYYY-MM-DD')
        const [start, end] = dayRange(d)
        try {
          const [mem, chk] = await Promise.all([
            getDocs(
              query(
                collection(db, 'couples', coupleId, 'memories'),
                where('createdAt', '>=', start),
                where('createdAt', '<=', end),
                limit(5)
              )
            ),
            getDocs(query(collection(db, 'couples', coupleId, 'checkins'), where('date', '==', dateStr), limit(4))),
          ])
          mem.docs.forEach((doc) => found.push({ id: doc.id, type: 'memory', label: w.label, ...doc.data() }))
          chk.docs
            .map((doc) => ({ id: doc.id, type: 'checkin', label: w.label, ...doc.data() }))
            .filter((c) => c.photoData || c.journal || c.gratitude)
            .forEach((c) => found.push(c))
        } catch {
          // A missing index or offline read shouldn't break the dashboard.
        }
      }

      if (found.length === 0) {
        // Nothing lines up with today: pick one older memory, stable for the day.
        try {
          const cutoff = dayjs().subtract(14, 'day').toDate()
          const older = await getDocs(
            query(
              collection(db, 'couples', coupleId, 'memories'),
              where('createdAt', '<=', cutoff),
              orderBy('createdAt', 'desc'),
              limit(25)
            )
          )
          if (older.docs.length) {
            const seed = Number(today.replace(/-/g, '')) % older.docs.length
            const doc = older.docs[seed]
            const data = doc.data()
            const when = data.createdAt?.toDate ? dayjs(data.createdAt.toDate()) : null
            found.push({
              id: doc.id,
              type: 'memory',
              label: when ? `From ${when.format('MMMM D, YYYY')}` : 'A memory from before',
              ...data,
            })
          }
        } catch {
          /* ignore */
        }
      }
      const seen = new Set()
      const unique = found.filter((f) => !seen.has(f.id) && seen.add(f.id))
      if (!cancelled) setItems(unique)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [coupleId, today])

  const item = useMemo(() => (items && items.length ? items[index % items.length] : null), [items, index])

  if (!items || items.length === 0 || !item) return null

  const photo = item.photoData
  const mood = item.type === 'checkin' ? MOODS.find((m) => m.v === item.mood) : null
  const title =
    item.type === 'memory'
      ? item.title || item.caption || (item.entryType === 'milestone' ? 'A milestone' : 'A memory')
      : `${names[item.uid] || 'Someone'} felt ${mood?.l?.toLowerCase() || 'something'}`
  const body = item.type === 'checkin' ? item.gratitude || item.journal : ''

  return (
    <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] flex items-center gap-1.5">
          <FiClock size={12} /> On this day
        </span>
        {items.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
              aria-label="Previous"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#9a8a9c] hover:bg-black/5"
            >
              <FiChevronLeft size={14} />
            </button>
            <span className="text-[11px] text-[#9a8a9c] tabular-nums">
              {(index % items.length) + 1}/{items.length}
            </span>
            <button
              onClick={() => setIndex((i) => (i + 1) % items.length)}
              aria-label="Next"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#9a8a9c] hover:bg-black/5"
            >
              <FiChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
          className="flex gap-4 p-5 pt-3 items-center"
        >
          {photo ? (
            <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
              <img src={photo} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-blush flex items-center justify-center flex-shrink-0">
              {mood ? <MoodIcon mood={mood.v} size={28} /> : <FiHeart size={26} className="text-peach" />}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-semibold text-peach">{item.label}</div>
            <div className="text-base font-semibold mt-0.5 font-serif truncate">{title}</div>
            {body && <p className="text-sm text-[#7a6a7c] mt-1 line-clamp-2">"{body}"</p>}
            {item.type === 'memory' && (
              <Link to="/memories" className="text-xs text-[#9a8a9c] underline mt-1.5 inline-block">
                Open memories
              </Link>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}