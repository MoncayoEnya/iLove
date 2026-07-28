import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import {
  FiCalendar,
  FiCamera,
  FiCheckSquare,
  FiHeart,
  FiMapPin,
  FiMeh,
  FiMessageCircle,
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

function StatCard({ icon: Icon, label, value, current, previous, showDelta = true }) {
  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-[#9a8a9c] mb-2">
        <Icon size={15} className="text-peach" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-semibold">{value}</div>
      {showDelta && (
        <div className="mt-1.5">
          <Delta current={current} previous={previous} />
        </div>
      )}
    </div>
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

  // --- Appreciations (love jar notes added) ---------------------------
  const appreciationsCurrent = jar.filter((n) => toSeconds(n.createdAt) >= start7Sec).length
  const appreciationsPrev = jar.filter(
    (n) => toSeconds(n.createdAt) >= prevStartSec && toSeconds(n.createdAt) < start7Sec
  ).length

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

  // --- Tasks completed together -----------------------------------------
  const tasksCurrent = allTasks.filter((t) => t.done && toSeconds(t.completedAt) >= start7Sec).length
  const tasksPrev = allTasks.filter(
    (t) => t.done && toSeconds(t.completedAt) >= prevStartSec && toSeconds(t.completedAt) < start7Sec
  ).length

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

  const hasAnyData = jar.length > 0 || events.length > 0 || allTasks.some((t) => t.done) || checkins.length > 0

  // --- All Time tab data -------------------------------------------------
  // Anniversary date lives on whichever partner's profile has it set; if
  // both do (the common case) they should agree, so mine wins on a tie.
  const anniversaryDate = profile?.anniversaryDate || partner?.anniversaryDate || null
  const together = daysTogether(anniversaryDate)
  const daysAsCouple = couple?.createdAt?.seconds
    ? dayjs().diff(dayjs.unix(couple.createdAt.seconds), 'day') + 1
    : null
  const tasksDoneTotal = allTasks.filter((t) => t.done).length
  const longestStreak = Math.max(couple?.longestStreak || 0, couple?.streak || 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <FiTrendingUp className="text-peach" /> Insights
        </h1>
        <p className="text-sm text-[#7a6a7c]">
          {tab === 'week'
            ? 'This week, compared to last week — progress over time, not just today.'
            : 'Everything you two have built here, added up.'}
        </p>
      </div>

      <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1 mb-5 w-fit">
        {[
          { key: 'week', label: 'This Week' },
          { key: 'all', label: 'All Time' },
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

      {tab === 'week' ? (
        !hasAnyData ? (
          <EmptyState
            icon={FiTrendingUp}
            title="Nothing to show yet"
            subtitle="Check in, drop a note in the love jar, or finish a task together — your weekly trends will show up here."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard icon={FiHeart} label="Appreciations" value={appreciationsCurrent} current={appreciationsCurrent} previous={appreciationsPrev} />
              <StatCard icon={FiSmile} label="Positive days" value={positiveDaysCurrent} current={positiveDaysCurrent} previous={positiveDaysPrev} />
              <StatCard icon={FaFire} label="Streak" value={couple?.streak || 0} showDelta={false} />
              <StatCard icon={FiCalendar} label="Shared events" value={sharedEventsCurrent} current={sharedEventsCurrent} previous={sharedEventsPrev} />
              <StatCard icon={FiCheckSquare} label="Tasks completed together" value={tasksCurrent} current={tasksCurrent} previous={tasksPrev} />
            </div>

            <div className="bg-white border border-black/10 rounded-2xl p-5 mt-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FiSmile size={16} className="text-peach" /> This week's check-ins
              </h3>
              <div className="flex items-end justify-between gap-2 h-28">
                {days.map((d) => (
                  <div key={d.dateStr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="leading-none text-peach">
                      {d.moods.includes('amazing') ? (
                        <FiSmile size={14} />
                      ) : d.moods.includes('good') ? (
                        <FiSmile size={14} className="opacity-70" />
                      ) : d.count > 0 ? (
                        <FiMeh size={14} className="text-[#9a8a9c]" />
                      ) : null}
                    </span>
                    <div
                      className={`w-full rounded-t-lg ${d.count > 0 ? 'bg-gradient-to-t from-peach to-gold' : 'bg-black/5'}`}
                      style={{ height: `${Math.max((d.count / maxPossible) * 100, d.count > 0 ? 18 : 4)}%` }}
                      title={`${d.count} check-in${d.count === 1 ? '' : 's'}`}
                    />
                    <span className={`text-[10.5px] ${d.isToday ? 'text-peach font-semibold' : 'text-[#9a8a9c]'}`}>
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      ) : (
        <>
          <div
            className="rounded-2xl p-6 mb-4 text-white"
            style={{ background: 'linear-gradient(135deg, #e07a52, #d9a441)' }}
          >
            {together != null ? (
              <>
                <div className="text-4xl font-bold leading-none">{together.toLocaleString()}</div>
                <div className="text-sm opacity-90 mt-1.5">
                  day{together === 1 ? '' : 's'} together since {dayjs(anniversaryDate).format('MMMM D, YYYY')}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-semibold">Add your anniversary date to see your day count</div>
                <Link to="/profile" className="text-sm underline underline-offset-2 opacity-90 inline-block mt-1.5">
                  Set it in Profile →
                </Link>
              </>
            )}
            {daysAsCouple != null && (
              <div className="text-xs opacity-75 mt-3">
                {daysAsCouple.toLocaleString()} day{daysAsCouple === 1 ? '' : 's'} using iLovee together
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard icon={FiHeart} label="Love notes" value={jar.length ? jar.length : 0} showDelta={false} />
            <StatCard icon={FaFire} label="Longest streak" value={longestStreak} showDelta={false} />
            <StatCard icon={FiMessageCircle} label="Messages sent" value={totalMessages} showDelta={false} />
            <StatCard icon={FiCamera} label="Memories saved" value={totalMemories} showDelta={false} />
            <StatCard icon={FiCheckSquare} label="Tasks completed" value={tasksDoneTotal} showDelta={false} />
            <StatCard icon={FiSmile} label="Total check-ins" value={totalCheckins} showDelta={false} />
            <StatCard icon={FiMapPin} label="Places saved" value={placesCount} showDelta={false} />
            <StatCard
              icon={FiCheckSquare}
              label="Bucket list"
              value={bucketTotal ? `${bucketDone}/${bucketTotal}` : '0'}
              showDelta={false}
            />
          </div>
        </>
      )}
    </div>
  )
}
