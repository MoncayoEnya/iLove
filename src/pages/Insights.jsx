import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import {
  FiArrowRight,
  FiCalendar,
  FiHeart,
  FiMeh,
  FiPlus,
  FiSmile,
  FiTrendingUp,
} from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { todayStr } from '../utils/date'
import EmptyState from '../components/EmptyState'

const POSITIVE_MOODS = ['amazing', 'good']

function toSeconds(ts) {
  return ts?.seconds || 0
}

/** Whole days between an anniversary date (YYYY-MM-DD) and today, 1-indexed
 *  so the anniversary day itself reads as "Day 1" rather than "Day 0". */
function daysTogether(anniversaryDate) {
  if (!anniversaryDate) return null
  const diff = dayjs().startOf('day').diff(dayjs(anniversaryDate).startOf('day'), 'day')
  return diff >= 0 ? diff + 1 : null
}

/** Small "+2 vs last week" / "Same as last week" / "-1 vs last week" label. */
function Delta({ current, previous }) {
  const diff = current - previous
  if (diff === 0) {
    return <span className="text-[11px] text-[#9a8a9c]">Same as last week</span>
  }
  const up = diff > 0
  return (
    <span className={`text-[11px] font-semibold ${up ? 'text-[#3f8f5f]' : 'text-[#9b3b3b]'}`}>
      {up ? '+' : ''}
      {diff} vs last week
    </span>
  )
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

function Card({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ duration: 0.35, ease: 'easeOut', delay }}
      className={`rounded-2xl ${className}`}
    >
      {children}
    </motion.div>
  )
}

export default function Insights() {
  const { profile, couple } = useAuth()
  const { partner, hasPartner } = usePartner()
  const coupleId = couple?.id
  const today = todayStr()

  const [tab, setTab] = useState('week') // 'week' | 'all'

  const [allTasks, setAllTasks] = useState([])
  const [jar, setJar] = useState([])
  const [events, setEvents] = useState([])
  const [checkins, setCheckins] = useState([])

  // All-time-only totals. Kept as plain counts (not full doc arrays) since
  // the All Time tab only ever needs sizes, never individual records.
  const [totalCheckins, setTotalCheckins] = useState(0)
  const [totalMessages, setTotalMessages] = useState(0)
  const [totalMemories, setTotalMemories] = useState(0)
  const [bucketDone, setBucketDone] = useState(0)
  const [bucketTotal, setBucketTotal] = useState(0)
  const [placesCount, setPlacesCount] = useState(0)

  // Two trailing 7-day windows: "this week" and the 7 days before it, so
  // every stat can show a "+N vs last week" comparison instead of a raw
  // number with no context.
  const start7 = dayjs().subtract(6, 'day')
  const prevStart = dayjs().subtract(13, 'day')
  const start7Str = start7.format('YYYY-MM-DD')
  const prevStartStr = prevStart.format('YYYY-MM-DD')
  const start7Sec = start7.startOf('day').unix()
  const prevStartSec = prevStart.startOf('day').unix()

  useEffect(() => {
    if (!coupleId) return
    const unsubs = [
      onSnapshot(collection(db, 'couples', coupleId, 'tasks'), (s) =>
        setAllTasks(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, 'couples', coupleId, 'jar'), (s) =>
        setJar(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, 'couples', coupleId, 'events'), (s) =>
        setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'checkins'), where('date', '>=', prevStartStr)),
        (s) => setCheckins(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      // Lifetime counts for the All Time tab — sizes only, so these stay
      // cheap even as history grows.
      onSnapshot(collection(db, 'couples', coupleId, 'checkins'), (s) => setTotalCheckins(s.size)),
      onSnapshot(collection(db, 'couples', coupleId, 'messages'), (s) => setTotalMessages(s.size)),
      onSnapshot(collection(db, 'couples', coupleId, 'memories'), (s) => setTotalMemories(s.size)),
      onSnapshot(collection(db, 'couples', coupleId, 'bucketList'), (s) => {
        setBucketTotal(s.size)
        setBucketDone(s.docs.filter((d) => d.data().done).length)
      }),
      onSnapshot(collection(db, 'couples', coupleId, 'sharedPlaces'), (s) => setPlacesCount(s.size)),
    ]
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, prevStartStr])

  if (!hasPartner) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1">Insights</h1>
          <p className="text-sm text-[#7a6a7c]">Waiting for your partner to join with your invite code.</p>
        </div>
      </div>
    )
  }

  function greeting() {
    const h = dayjs().hour()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  // --- Appreciations (love jar notes added) ---------------------------
  const appreciationsCurrent = jar.filter((n) => toSeconds(n.createdAt) >= start7Sec).length
  const appreciationsPrev = jar.filter(
    (n) => toSeconds(n.createdAt) >= prevStartSec && toSeconds(n.createdAt) < start7Sec
  ).length
  const latestNote = [...jar].sort((a, b) => toSeconds(b.createdAt) - toSeconds(a.createdAt))[0]

  // --- Positive days (at least one "amazing"/"good" check-in that day) -
  const positiveDates = new Set(
    checkins.filter((c) => POSITIVE_MOODS.includes(c.mood)).map((c) => c.date)
  )
  const positiveDaysCurrent = [...positiveDates].filter((d) => d >= start7Str).length
  const positiveDaysPrev = [...positiveDates].filter((d) => d >= prevStartStr && d < start7Str).length

  // --- Shared events (dated within the window, so it reflects planning,
  //     not just "everything on the calendar ever") ----------------------
  const sharedEventsCurrent = events.filter((e) => e.date >= start7Str && e.date <= today).length
  const sharedEventsPrev = events.filter((e) => e.date >= prevStartStr && e.date < start7Str).length
  const upcomingEvents = events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    .slice(0, 3)

  // --- Tasks completed together -----------------------------------------
  const tasksCurrent = allTasks.filter((t) => t.done && toSeconds(t.completedAt) >= start7Sec).length
  const tasksPrev = allTasks.filter(
    (t) => t.done && toSeconds(t.completedAt) >= prevStartSec && toSeconds(t.completedAt) < start7Sec
  ).length
  const tasksWeeklyGoal = 5
  const tasksProgress = Math.max(4, Math.min(100, Math.round((tasksCurrent / tasksWeeklyGoal) * 100)))

  // --- 7-day check-in activity strip -------------------------------------
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = dayjs().subtract(6 - i, 'day')
    const dateStr = date.format('YYYY-MM-DD')
    const dayCheckins = checkins.filter((c) => c.date === dateStr)
    return {
      dateStr,
      label: date.format('ddd'),
      isToday: dateStr === today,
      count: dayCheckins.length,
      moods: dayCheckins.map((c) => c.mood),
    }
  })
  const maxPossible = couple?.members?.length || 2
  const checkedInDaysCurrent = days.filter((d) => d.count > 0).length

  const hasAnyData = jar.length > 0 || events.length > 0 || allTasks.some((t) => t.done) || checkins.length > 0

  // --- Streak -------------------------------------------------------------
  const streak = couple?.streak || 0
  const longestStreak = Math.max(couple?.longestStreak || 0, streak)
  const isLongestYet = streak > 0 && streak >= longestStreak
  const streakDots = Array.from({ length: 7 }, (_, i) => i < Math.min(streak, 7))
  const streakToBeat = longestStreak - streak

  // --- All Time tab data -------------------------------------------------
  // Anniversary date lives on whichever partner's profile has it set; if
  // both do (the common case) they should agree, so mine wins on a tie.
  const anniversaryDate = profile?.anniversaryDate || partner?.anniversaryDate || null
  const together = daysTogether(anniversaryDate)
  const daysAsCouple = couple?.createdAt?.seconds
    ? dayjs().diff(dayjs.unix(couple.createdAt.seconds), 'day') + 1
    : null
  const tasksDoneTotal = allTasks.filter((t) => t.done).length

  const quickActions = (
    <Card className="bg-white border border-black/10 p-5" delay={0.25}>
      <h3 className="font-semibold mb-4">Quick actions</h3>
      <div className="space-y-2.5">
        <Link
          to="/checkins"
          className="flex items-center justify-between bg-plumdeep text-white rounded-xl px-4 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Log tonight's check-in
          <FiArrowRight size={15} />
        </Link>
        <Link
          to="/memories?tab=jar"
          className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-black/[0.03] transition-colors"
        >
          Send an appreciation
          <FiHeart size={15} className="text-peach" />
        </Link>
        <Link
          to="/calendar"
          className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-black/[0.03] transition-colors"
        >
          Plan a shared event
          <FiPlus size={15} className="text-peach" />
        </Link>
      </div>
    </Card>
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
            {dayjs().format('dddd')}, a look at your week
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold mb-1.5">
            {greeting()}, <span className="font-serif italic text-peach">{profile?.displayName}</span>
          </h1>
          <p className="text-sm text-[#7a6a7c] max-w-md">
            {tab === 'week'
              ? 'Your shared week is settling in — progress over time, not just today.'
              : 'Everything you two have built here, added up.'}
          </p>
        </div>

        <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1 w-fit h-fit">
          {[
            { key: 'week', label: 'This week' },
            { key: 'all', label: 'All time' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors ${
                tab === t.key ? 'bg-white shadow-sm text-plumdeep' : 'text-[#9a8a9c]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'week' ? (
        !hasAnyData ? (
          <EmptyState
            icon={FiTrendingUp}
            title="Nothing to show yet"
            subtitle="Check in, drop a note in the love jar, or finish a task together — your weekly trends will show up here."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main column */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <Card className="bg-white border border-black/10 p-5 sm:p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="font-semibold">Weekly check-ins</h3>
                    <p className="text-xs text-[#9a8a9c] mt-0.5">
                      {days[0].label} to {days[6].label}
                    </p>
                  </div>
                  <span className="text-xs font-semibold bg-peach/15 text-peach px-3 py-1.5 rounded-full whitespace-nowrap">
                    {checkedInDaysCurrent} of 7 in
                  </span>
                </div>
                <div className="flex items-end justify-between gap-2 sm:gap-3 h-40">
                  {days.map((d) => (
                    <div key={d.dateStr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="leading-none text-peach h-3.5">
                        {d.moods.includes('amazing') ? (
                          <FiSmile size={14} />
                        ) : d.moods.includes('good') ? (
                          <FiSmile size={14} className="opacity-70" />
                        ) : d.count > 0 ? (
                          <FiMeh size={14} className="text-[#9a8a9c]" />
                        ) : null}
                      </span>
                      <div
                        className={`w-full rounded-t-lg transition-all ${
                          d.isToday
                            ? 'bg-gradient-to-t from-peach to-gold'
                            : d.count > 0
                            ? 'bg-peachsoft'
                            : 'bg-black/5'
                        }`}
                        style={{ height: `${Math.max((d.count / maxPossible) * 100, d.count > 0 ? 22 : 5)}%` }}
                        title={`${d.count} check-in${d.count === 1 ? '' : 's'}`}
                      />
                      <span
                        className={`text-[11px] ${
                          d.isToday ? 'text-peach font-bold' : 'text-[#9a8a9c] font-medium'
                        }`}
                      >
                        {d.isToday ? 'Today' : d.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-black/5">
                  <span className="text-xs text-[#9a8a9c]">
                    {positiveDaysCurrent} positive day{positiveDaysCurrent === 1 ? '' : 's'} this week
                  </span>
                  <Delta current={positiveDaysCurrent} previous={positiveDaysPrev} />
                </div>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Card className="bg-white border border-black/10 p-5" delay={0.05}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#9a8a9c]">
                      Appreciations
                    </span>
                    <FiHeart size={14} className="text-peach" />
                  </div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-semibold">{appreciationsCurrent}</span>
                    <Delta current={appreciationsCurrent} previous={appreciationsPrev} />
                  </div>
                  <p className="text-xs text-[#9a8a9c] mb-3">sent &amp; received this week</p>
                  {latestNote ? (
                    <>
                      <div className="jar-note text-sm">"{latestNote.text}"</div>
                      <p className="text-[11px] text-[#9a8a9c] mt-2">
                        — saved {dayjs.unix(toSeconds(latestNote.createdAt)).format('MMM D')}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-[#9a8a9c] italic">No notes in the jar yet.</p>
                  )}
                </Card>

                <Card className="bg-white border border-black/10 p-5" delay={0.1}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#9a8a9c]">
                      Shared events
                    </span>
                    <FiCalendar size={14} className="text-peach" />
                  </div>
                  {upcomingEvents.length ? (
                    <div className="space-y-3">
                      {upcomingEvents.map((e) => (
                        <div key={e.id} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blush flex items-center justify-center text-sm font-semibold text-plumdeep flex-shrink-0">
                            {dayjs(e.date).format('D')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{e.title}</p>
                            <p className="text-xs text-[#9a8a9c]">
                              {e.date === today ? 'Today' : dayjs(e.date).format('dddd')}
                              {e.time ? ` · ${e.time}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#9a8a9c]">
                      Nothing on the calendar yet.{' '}
                      <Link to="/calendar" className="text-peach font-semibold">
                        Plan something →
                      </Link>
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-5">
              <Card className="bg-plumdeep p-6 text-white" delay={0.05}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60 mb-3">
                  Days together this week
                </div>
                <div className="text-5xl font-serif font-semibold leading-none">
                  {String(checkedInDaysCurrent).padStart(2, '0')}
                </div>
              </Card>

              <Card
                className="bg-gradient-to-br from-peach/20 to-gold/25 border border-peach/20 p-5"
                delay={0.1}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-plumdeep/70">
                    Shared streak
                  </span>
                  {isLongestYet && (
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-white/70 text-peach px-2 py-0.5 rounded-full">
                      Longest yet
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-4xl font-serif font-semibold text-plumdeep">{streak}</span>
                  <span className="text-sm font-medium text-plumdeep/70">day{streak === 1 ? '' : 's'}</span>
                </div>
                <div className="flex gap-1.5 mb-3">
                  {streakDots.map((filled, i) => (
                    <span
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full ${
                        filled ? 'bg-peach' : 'bg-white/60 border border-peach/40'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-plumdeep/70 leading-snug">
                  {isLongestYet
                    ? "You're on your longest streak yet — keep it going."
                    : `${streakToBeat} more check-in${streakToBeat === 1 ? '' : 's'} and your streak extends past the longest run you've shared.`}
                </p>
              </Card>

              <Card className="bg-white border border-black/10 p-5" delay={0.15}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">Tasks done</h3>
                  <span className="text-2xl font-semibold">{tasksCurrent}</span>
                </div>
                <p className="text-xs text-[#9a8a9c] mb-4">completed together this week</p>
                <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-peach to-gold transition-all"
                    style={{ width: `${tasksProgress}%` }}
                  />
                </div>
              </Card>

              {quickActions}
            </div>
          </div>
        )
      ) : (
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          {/* Hero: lifetime day count */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="text-center mb-7"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#9a8a9c] mb-3">
              Our journey together
            </p>
            {together != null ? (
              <>
                <div className="text-6xl sm:text-7xl font-serif font-bold text-plumdeep leading-none mb-3">
                  {together.toLocaleString()}
                </div>
                <p className="text-sm text-[#7a6a7c] mb-4">
                  day{together === 1 ? '' : 's'} together since {dayjs(anniversaryDate).format('MMMM D, YYYY')}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold mb-1.5">Add your anniversary date to see your day count</p>
                <Link to="/profile" className="text-sm underline underline-offset-2 text-peach inline-block mb-4">
                  Set it in Profile →
                </Link>
              </>
            )}
            {daysAsCouple != null && (
              <span className="inline-block text-xs font-semibold bg-peach/15 text-peach px-4 py-1.5 rounded-full">
                {daysAsCouple.toLocaleString()} day{daysAsCouple === 1 ? '' : 's'} using iLovee together
              </span>
            )}
          </motion.div>

          {/* Stat grid */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <Card
              className="col-span-2 sm:col-span-1 bg-white border border-black/10 p-5 relative"
              delay={0.05}
            >
              <span className="absolute top-4 right-4 w-8 h-8 rounded-full bg-peach/15 flex items-center justify-center">
                <FaFire size={14} className="text-peach" />
              </span>
              <div className="text-xs font-semibold text-[#9a8a9c] mb-3">Current streak</div>
              <div className="text-2xl font-serif font-semibold text-plumdeep">
                {streak} day{streak === 1 ? '' : 's'}
              </div>
              <p className="text-[11px] text-[#9a8a9c] mt-1.5">
                Longest yet: {longestStreak} day{longestStreak === 1 ? '' : 's'}
              </p>
            </Card>

            <Card className="bg-white border border-black/10 p-5" delay={0.08}>
              <div className="text-xs font-semibold text-[#9a8a9c] mb-3">Love notes</div>
              <div className="text-2xl font-semibold text-plumdeep">{jar.length || 0}</div>
            </Card>

            <Card className="bg-white border border-black/10 p-5" delay={0.11}>
              <div className="text-xs font-semibold text-[#9a8a9c] mb-3">Memories</div>
              <div className="text-2xl font-semibold text-plumdeep">{totalMemories}</div>
            </Card>

            <Card className="bg-white border border-black/10 p-5" delay={0.14}>
              <div className="text-xs font-semibold text-[#9a8a9c] mb-3">Messages</div>
              <div className="text-2xl font-semibold text-plumdeep">{totalMessages}</div>
            </Card>

            <Card className="bg-white border border-black/10 p-5" delay={0.17}>
              <div className="text-xs font-semibold text-[#9a8a9c] mb-3">Check-ins</div>
              <div className="text-2xl font-semibold text-plumdeep">{totalCheckins}</div>
            </Card>

            <Card className="bg-white border border-black/10 p-5" delay={0.2}>
              <div className="text-xs font-semibold text-[#9a8a9c] mb-3">Tasks</div>
              <div className="text-2xl font-semibold text-plumdeep">{tasksDoneTotal}</div>
            </Card>

            <Card className="bg-white border border-black/10 p-5" delay={0.23}>
              <div className="text-xs font-semibold text-[#9a8a9c] mb-3">Bucket list</div>
              <div className="text-2xl font-semibold text-plumdeep">
                {bucketTotal ? `${bucketDone}/${bucketTotal}` : '0'}
              </div>
            </Card>

            <Card className="bg-white border border-black/10 p-5" delay={0.26}>
              <div className="text-xs font-semibold text-[#9a8a9c] mb-3">Places saved</div>
              <div className="text-2xl font-semibold text-plumdeep">{placesCount}</div>
            </Card>
          </div>

          {/* Actions */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <Link
              to="/checkins"
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #e07a52, #d9a441)' }}
            >
              Log tonight's check-in
            </Link>
            <Link
              to="/memories?tab=jar"
              className="flex items-center justify-center gap-2 border border-black/10 bg-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-black/[0.03] transition-colors"
            >
              Send an appreciation
            </Link>
          </div>
          <Link
            to="/calendar"
            className="w-full flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-peach bg-peach/12 hover:bg-peach/18 transition-colors"
          >
            Plan a shared event
          </Link>
        </div>
      )}

      <p className="text-center text-[11px] text-[#9a8a9c] uppercase tracking-wide mt-8">
        Private to you two · nothing is shared
      </p>
    </div>
  )
}