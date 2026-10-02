import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { AnimatePresence, motion } from 'framer-motion'
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { FiChevronLeft, FiChevronRight, FiHeart, FiMail, FiMapPin, FiPause, FiPlay, FiX } from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'
import MoodIcon from '../components/MoodIcon'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { MOODS } from '../utils/moods'
import { celebrate } from '../utils/celebrate'

// "Our year, wrapped" — a full-screen, tap-through story of the couple's
// year: memories, check-ins, top mood, streak, messages, tasks, notes,
// places, bucket list and your song. Tap right/left (or arrow keys) to
// move, hold to pause. Reads counts with aggregate queries so it stays
// cheap even with thousands of messages.

const SLIDE_MS = 5200

const BACKGROUNDS = [
  'linear-gradient(160deg, #3d2340 0%, #7a3f8c 55%, #e8a87c 100%)',
  'linear-gradient(160deg, #e8a87c 0%, #e8b978 60%, #fbe1ea 100%)',
  'linear-gradient(160deg, #1f4a57 0%, #3d8fa6 60%, #6ec6c1 100%)',
  'linear-gradient(160deg, #6b3a52 0%, #c2447a 60%, #f3b6c9 100%)',
  'linear-gradient(160deg, #2b1e2f 0%, #3d2340 50%, #a33d6b 100%)',
  'linear-gradient(160deg, #8a6416 0%, #e8b978 55%, #fdf0c9 100%)',
]

async function countIn(colPath, field, start, end) {
  const q = query(collection(db, ...colPath), where(field, '>=', start), where(field, '<=', end))
  try {
    const snap = await getCountFromServer(q)
    return snap.data().count
  } catch {
    try {
      return (await getDocs(q)).size
    } catch {
      return 0
    }
  }
}

function useWrappedStats(coupleId, year, uid, partnerUid) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!coupleId) return undefined
    let cancelled = false
    const start = dayjs(`${year}-01-01`).startOf('day').toDate()
    const end = dayjs(`${year}-12-31`).endOf('day').toDate()
    const startStr = `${year}-01-01`
    const endStr = `${year}-12-31`
    const base = ['couples', coupleId]

    ;(async () => {
      const [memoriesCount, messages, tasksDone, jarCount, bucketDone, checkinSnap, photoSnap, playlistSnap, placesSnap] =
        await Promise.all([
          countIn([...base, 'memories'], 'createdAt', start, end),
          countIn([...base, 'messages'], 'createdAt', start, end),
          countIn([...base, 'tasks'], 'completedAt', start, end),
          countIn([...base, 'jar'], 'createdAt', start, end),
          countIn([...base, 'bucketList'], 'completedAt', start, end),
          getDocs(
            query(collection(db, ...base, 'checkins'), where('date', '>=', startStr), where('date', '<=', endStr))
          ).catch(() => null),
          getDocs(
            query(
              collection(db, ...base, 'memories'),
              where('createdAt', '>=', start),
              where('createdAt', '<=', end),
              orderBy('createdAt', 'asc'),
              limit(30)
            )
          ).catch(() => null),
          getDocs(collection(db, ...base, 'playlist')).catch(() => null),
          getDocs(collection(db, ...base, 'sharedPlaces')).catch(() => null),
        ])

      const checkins = checkinSnap ? checkinSnap.docs.map((d) => d.data()) : []
      const moodCounts = {}
      checkins.forEach((c) => {
        moodCounts[c.mood] = (moodCounts[c.mood] || 0) + 1
      })
      const topMoodKey = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
      const bothDays = (() => {
        const byDate = {}
        checkins.forEach((c) => {
          ;(byDate[c.date] ||= new Set()).add(c.uid)
        })
        return Object.values(byDate).filter((s) => s.has(uid) && s.has(partnerUid)).length
      })()

      const photos = photoSnap
        ? photoSnap.docs.map((d) => d.data()).filter((m) => m.photoData).map((m) => ({ src: m.photoData, caption: m.caption }))
        : []

      const songs = playlistSnap ? playlistSnap.docs.map((d) => d.data()) : []
      const ourSong = songs.find((s) => s.tag === 'our-song') || songs[0] || null

      const places = placesSnap
        ? placesSnap.docs
            .map((d) => d.data())
            .filter((p) => {
              const t = p.createdAt?.toDate?.()
              return t && t.getFullYear() === Number(year)
            })
        : []

      if (!cancelled) {
        setStats({
          memoriesCount,
          messages,
          tasksDone,
          jarCount,
          bucketDone,
          checkinsCount: checkins.length,
          myCheckins: checkins.filter((c) => c.uid === uid).length,
          bothDays,
          topMood: MOODS.find((m) => m.v === topMoodKey) || null,
          photos,
          ourSong,
          placesCount: places.length,
          placeNames: places.slice(0, 3).map((p) => p.name),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [coupleId, year, uid, partnerUid])

  return stats
}

// Frosted circle that holds a big icon on the story slides.
function IconBadge({ children }) {
  return (
    <div className="w-20 h-20 rounded-full bg-white/20 border border-white/30 backdrop-blur flex items-center justify-center text-white">
      {children}
    </div>
  )
}

function BigNumber({ value, delay = 0.2 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const target = Number(value) || 0
    const t0 = performance.now() + delay * 1000
    let raf
    const tick = (t) => {
      const p = Math.max(0, Math.min(1, (t - t0) / 1100))
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, delay])
  return <span className="tabular-nums">{n.toLocaleString()}</span>
}

const rise = (d = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: d, type: 'spring', stiffness: 160, damping: 20 },
})

export default function Wrapped() {
  const navigate = useNavigate()
  const { firebaseUser, profile, couple } = useAuth()
  const { partner, partnerUid } = usePartner()
  const thisYear = dayjs().year()
  const [year, setYear] = useState(thisYear)
  const stats = useWrappedStats(couple?.id, year, firebaseUser?.uid, partnerUid)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const holdRef = useRef(null)

  const me = profile?.displayName || 'You'
  const them = partner?.displayName || 'your partner'

  const slides = useMemo(() => {
    if (!stats) return []
    const s = []
    s.push({
      key: 'intro',
      render: () => (
        <>
          <motion.div {...rise(0)} className="text-sm uppercase tracking-[0.3em] opacity-80">
            {year}
          </motion.div>
          <motion.h1 {...rise(0.15)} className="font-serif text-5xl sm:text-6xl font-semibold leading-tight mt-3">
            {me} & {them}
          </motion.h1>
          <motion.p {...rise(0.35)} className="text-lg mt-4 opacity-90">
            Your year, wrapped.
          </motion.p>
          <motion.div {...rise(0.6)} className="mt-8 flex justify-center">
            <IconBadge>
              <FiHeart size={34} fill="currentColor" />
            </IconBadge>
          </motion.div>
        </>
      ),
    })
    s.push({
      key: 'memories',
      render: () => (
        <>
          <motion.p {...rise(0)} className="text-lg opacity-90">This year you saved</motion.p>
          <motion.div {...rise(0.15)} className="text-8xl font-semibold my-3">
            <BigNumber value={stats.memoriesCount} />
          </motion.div>
          <motion.p {...rise(0.3)} className="text-2xl font-serif">
            {stats.memoriesCount === 1 ? 'memory' : 'memories'} together
          </motion.p>
          {stats.photos.length > 0 && (
            <div className="flex justify-center gap-2 mt-8">
              {stats.photos.slice(0, 4).map((p, i) => (
                <motion.img
                  key={i}
                  src={p.src}
                  alt=""
                  initial={{ opacity: 0, y: 30, rotate: (i - 1.5) * 8 }}
                  animate={{ opacity: 1, y: 0, rotate: (i - 1.5) * 6 }}
                  transition={{ delay: 0.5 + i * 0.12, type: 'spring', stiffness: 140, damping: 16 }}
                  className="w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xl border-4 border-white shadow-xl"
                />
              ))}
            </div>
          )}
        </>
      ),
    })
    s.push({
      key: 'checkins',
      render: () => (
        <>
          <motion.p {...rise(0)} className="text-lg opacity-90">You checked in on each other</motion.p>
          <motion.div {...rise(0.15)} className="text-8xl font-semibold my-3">
            <BigNumber value={stats.checkinsCount} />
          </motion.div>
          <motion.p {...rise(0.3)} className="text-2xl font-serif">
            {stats.checkinsCount === 1 ? 'time' : 'times'}
          </motion.p>
          {stats.bothDays > 0 && (
            <motion.p {...rise(0.5)} className="mt-6 opacity-90">
              and both showed up on <strong>{stats.bothDays}</strong> of the same{' '}
              {stats.bothDays === 1 ? 'day' : 'days'}.
            </motion.p>
          )}
        </>
      ),
    })
    if (stats.topMood) {
      s.push({
        key: 'mood',
        render: () => (
          <>
            <motion.p {...rise(0)} className="text-lg opacity-90">The mood of your year</motion.p>
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 12 }}
              className="my-6 flex justify-center"
            >
              <div className="w-32 h-32 rounded-full bg-white/95 flex items-center justify-center shadow-2xl">
                <MoodIcon mood={stats.topMood.v} size={64} />
              </div>
            </motion.div>
            <motion.p {...rise(0.45)} className="text-4xl font-serif font-semibold">
              {stats.topMood.l}
            </motion.p>
          </>
        ),
      })
    }
    s.push({
      key: 'streak',
      render: () => (
        <>
          <motion.p {...rise(0)} className="text-lg opacity-90">Your longest streak</motion.p>
          <motion.div {...rise(0.15)} className="text-8xl font-semibold my-3 flex items-center justify-center gap-3">
            <motion.span
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="flex"
            >
              <FaFire size={64} className="text-[#ffcf9e]" />
            </motion.span>
            <BigNumber value={couple?.longestStreak || couple?.streak || 0} />
          </motion.div>
          <motion.p {...rise(0.3)} className="text-2xl font-serif">days in a row</motion.p>
        </>
      ),
    })
    s.push({
      key: 'words',
      render: () => (
        <>
          <motion.p {...rise(0)} className="text-lg opacity-90">You sent each other</motion.p>
          <motion.div {...rise(0.15)} className="text-7xl sm:text-8xl font-semibold my-3">
            <BigNumber value={stats.messages} />
          </motion.div>
          <motion.p {...rise(0.3)} className="text-2xl font-serif">messages</motion.p>
          <motion.div {...rise(0.55)} className="grid grid-cols-3 gap-3 mt-10 text-center">
            <div>
              <div className="text-3xl font-semibold"><BigNumber value={stats.jarCount} delay={0.7} /></div>
              <div className="text-xs opacity-80 mt-1">love notes</div>
            </div>
            <div>
              <div className="text-3xl font-semibold"><BigNumber value={stats.tasksDone} delay={0.8} /></div>
              <div className="text-xs opacity-80 mt-1">tasks done</div>
            </div>
            <div>
              <div className="text-3xl font-semibold"><BigNumber value={stats.bucketDone} delay={0.9} /></div>
              <div className="text-xs opacity-80 mt-1">dreams ticked off</div>
            </div>
          </motion.div>
        </>
      ),
    })
    if (stats.placesCount > 0) {
      s.push({
        key: 'places',
        render: () => (
          <>
            <motion.p {...rise(0)} className="text-lg opacity-90">You found</motion.p>
            <motion.div {...rise(0.15)} className="text-8xl font-semibold my-3">
              <BigNumber value={stats.placesCount} />
            </motion.div>
            <motion.p {...rise(0.3)} className="text-2xl font-serif">new places together</motion.p>
            <div className="mt-6 flex flex-col gap-2 items-center">
              {stats.placeNames.map((n, i) => (
                <motion.div
                  key={n + i}
                  {...rise(0.5 + i * 0.12)}
                  className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur flex items-center gap-1.5"
                >
                  <FiMapPin size={14} /> {n}
                </motion.div>
              ))}
            </div>
          </>
        ),
      })
    }
    if (stats.ourSong) {
      s.push({
        key: 'song',
        render: () => (
          <>
            <motion.p {...rise(0)} className="text-lg opacity-90">The soundtrack of your year</motion.p>
            <motion.div
              initial={{ rotate: 0, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 360, scale: 1, opacity: 1 }}
              transition={{ rotate: { duration: 6, repeat: Infinity, ease: 'linear' }, scale: { delay: 0.2 }, opacity: { delay: 0.2 } }}
              className="w-40 h-40 mx-auto my-8 rounded-full bg-[#1c1420] border-[10px] border-[#2b1e2f] shadow-2xl flex items-center justify-center overflow-hidden"
            >
              {stats.ourSong.coverUrl ? (
                <img src={stats.ourSong.coverUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-peach to-gold" />
              )}
            </motion.div>
            <motion.p {...rise(0.4)} className="text-3xl font-serif font-semibold">
              {stats.ourSong.title}
            </motion.p>
            {stats.ourSong.artist && (
              <motion.p {...rise(0.5)} className="opacity-85 mt-1">
                {stats.ourSong.artist}
              </motion.p>
            )}
          </>
        ),
      })
    }
    s.push({
      key: 'outro',
      render: () => (
        <>
          <motion.div {...rise(0)} className="flex justify-center">
            <IconBadge>
              <FiMail size={32} />
            </IconBadge>
          </motion.div>
          <motion.h2 {...rise(0.2)} className="font-serif text-4xl sm:text-5xl font-semibold mt-6 leading-tight">
            Here's to another year of us.
          </motion.h2>
          <motion.p {...rise(0.4)} className="mt-4 opacity-90">
            Every check-in, note and photo added up to this.
          </motion.p>
          <motion.button
            {...rise(0.6)}
            onClick={(e) => {
              e.stopPropagation()
              navigate('/dashboard')
            }}
            className="mt-10 px-6 py-3 rounded-full bg-white text-plumdeep font-semibold"
          >
            Back to us
          </motion.button>
        </>
      ),
    })
    return s
  }, [stats, year, me, them, couple?.longestStreak, couple?.streak, navigate])

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, Math.max(0, slides.length - 1))), [slides.length])
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Auto-advance: progress for the current slide (0..1), driven by rAF so
  // pausing freezes the bar exactly where it is.
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  useEffect(() => {
    progressRef.current = 0
    setProgress(0)
  }, [index, year])
  useEffect(() => {
    if (!slides.length || paused || index >= slides.length - 1) return undefined
    let raf
    let last = performance.now()
    const tick = (t) => {
      const dt = t - last
      last = t
      progressRef.current += dt / SLIDE_MS
      if (progressRef.current >= 1) {
        progressRef.current = 0
        next()
        return
      }
      setProgress(progressRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [index, paused, slides.length, next])

  useEffect(() => {
    if (slides[index]?.key === 'outro') celebrate({ kind: 'big' })
  }, [index, slides])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') navigate('/dashboard')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, navigate])

  useEffect(() => {
    setIndex(0)
  }, [year])

  const slide = slides[index]

  function onPointerDown() {
    holdRef.current = setTimeout(() => setPaused(true), 220)
  }
  function onPointerUp(e) {
    clearTimeout(holdRef.current)
    if (paused) {
      setPaused(false)
      return
    }
    const x = e.clientX / window.innerWidth
    if (x < 0.3) prev()
    else next()
  }

  return (
    <div className="fixed inset-0 z-[70] text-white select-none overflow-hidden" style={{ background: '#1c1420' }}>
      <motion.div
        key={`bg-${index}`}
        className="absolute inset-0"
        style={{ background: BACKGROUNDS[index % BACKGROUNDS.length] }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />

      {/* progress bars */}
      <div className="absolute top-0 inset-x-0 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex gap-1 z-20">
        {slides.map((s, i) => (
          <div key={s.key} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white"
              style={{
                width: `${i < index ? 100 : i === index ? (index === slides.length - 1 ? 100 : progress * 100) : 0}%`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="absolute top-6 inset-x-0 px-4 pt-[env(safe-area-inset-top)] flex items-center justify-between z-20">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="bg-white/15 text-white text-sm rounded-full px-3 py-1.5 border border-white/25 backdrop-blur"
          aria-label="Year"
        >
          {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
            <option key={y} value={y} className="text-plumdeep">
              {y}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play' : 'Pause'}
            className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur"
          >
            {paused ? <FiPlay size={15} /> : <FiPause size={15} />}
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => navigate('/dashboard')}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur"
          >
            <FiX size={16} />
          </button>
        </div>
      </div>

      <div
        className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {!stats ? (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="flex"
          >
            <FiHeart size={44} fill="currentColor" />
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={slide?.key + year}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.35 }}
              className="max-w-md w-full"
            >
              {slide?.render()}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* desktop arrows */}
      <button
        onClick={prev}
        aria-label="Previous"
        className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/15 border border-white/25 items-center justify-center backdrop-blur disabled:opacity-30"
        disabled={index === 0}
      >
        <FiChevronLeft size={20} />
      </button>
      <button
        onClick={next}
        aria-label="Next"
        className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/15 border border-white/25 items-center justify-center backdrop-blur disabled:opacity-30"
        disabled={index >= slides.length - 1}
      >
        <FiChevronRight size={20} />
      </button>
    </div>
  )
}