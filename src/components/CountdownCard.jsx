import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { AnimatePresence, motion } from 'framer-motion'
import { celebrate } from '../utils/celebrate'
import { FiClock } from 'react-icons/fi'
import { HiSparkles } from 'react-icons/hi2'

// Live countdown to the next calendar event marked "Show a countdown"
// (trips, visits, anniversaries). Ticks every second, and throws a small
// party when it reaches zero while you're looking at it.
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

function Unit({ value, label }) {
  const v = String(value).padStart(2, '0')
  return (
    <div className="flex flex-col items-center min-w-[52px]">
      <div className="relative h-10 overflow-hidden text-3xl font-semibold tabular-nums leading-10">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={v}
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="block"
          >
            {v}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="text-[10px] uppercase tracking-wide text-plumdeep/60 font-semibold">{label}</div>
    </div>
  )
}

export default function CountdownCard({ events, className = 'mb-4' }) {
  const now = useNow()
  const target = useMemo(() => {
    const upcoming = (events || [])
      .filter((e) => e.countdown)
      .map((e) => ({ ...e, at: dayjs(`${e.date}T${e.time || '00:00'}`).valueOf() }))
      .filter((e) => e.at > Date.now() - 60 * 60 * 1000)
      .sort((a, b) => a.at - b.at)
    return upcoming[0] || null
  }, [events])

  const diff = target ? Math.max(0, target.at - now) : 0
  const reached = target && diff === 0

  useEffect(() => {
    if (reached) celebrate({ kind: 'big' })
  }, [reached])

  if (!target) return null

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)

  return (
    <div className={`${className} rounded-2xl p-5 text-plumdeep bg-gradient-to-br from-peach/30 to-gold/30 border border-peach/25 flex flex-col sm:flex-row sm:items-center gap-4 relative overflow-hidden`}>
      <motion.div
        aria-hidden="true"
        className="absolute left-[40%] -bottom-10 opacity-[0.08] pointer-events-none select-none"
        animate={{ rotate: [0, 8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <FiClock size={120} strokeWidth={1.5} />
      </motion.div>
      <div className="flex-1 min-w-0 relative">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-plumdeep/70">Counting down to</div>
        <div className="text-xl font-semibold font-serif truncate">{target.title}</div>
        <div className="text-xs text-plumdeep/70 mt-0.5">
          {dayjs(target.date).format('dddd, MMMM D')}
          {target.time ? ` · ${target.time}` : ''} ·{' '}
          <Link to="/calendar" className="underline">
            calendar
          </Link>
        </div>
      </div>
      {reached ? (
        <div className="text-2xl font-semibold relative flex items-center gap-2">
          <HiSparkles className="text-peach" /> It's today!
        </div>
      ) : (
        <div className="flex items-center gap-1 relative">
          <Unit value={days} label={days === 1 ? 'day' : 'days'} />
          <span className="text-2xl font-semibold opacity-40 -mt-4">:</span>
          <Unit value={hours} label="hrs" />
          <span className="text-2xl font-semibold opacity-40 -mt-4">:</span>
          <Unit value={minutes} label="min" />
          <span className="text-2xl font-semibold opacity-40 -mt-4 hidden sm:inline">:</span>
          <div className="hidden sm:block">
            <Unit value={seconds} label="sec" />
          </div>
        </div>
      )}
    </div>
  )
}