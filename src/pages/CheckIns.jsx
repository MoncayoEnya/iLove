import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import dayjs from 'dayjs'
import { FaFire } from 'react-icons/fa'
import { FiChevronLeft, FiChevronRight, FiSmile } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { MOODS } from '../utils/moods'
import { todayStr } from '../utils/date'
import EmptyState from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'

function moodInfo(v) {
  return MOODS.find((m) => m.v === v)
}

// Firestore gives back a Timestamp on synced docs, a plain Date right after
// a local write — handle both so a photo/memory shows up the moment it's
// added, not just after the next sync.
function tsToDateStr(ts) {
  if (!ts) return null
  if (typeof ts.toDate === 'function') return dayjs(ts.toDate()).format('YYYY-MM-DD')
  if (ts instanceof Date) return dayjs(ts).format('YYYY-MM-DD')
  return null
}

// --- Calendar --------------------------------------------------------
// A plain, airy month grid — numbers with a small dot under any day either
// of you checked in, today and the selected day marked with a ring, rather
// than the boxed-cell treatment used elsewhere in the app.
function CheckInCalendar({ month, selectedDate, onSelectDate, onPrevMonth, onNextMonth, checkinsByDate, today }) {
  const startOfMonth = month.startOf('month')
  const endOfMonth = month.endOf('month')
  const gridStart = startOfMonth.startOf('week')
  const gridEnd = endOfMonth.endOf('week')

  const days = []
  let cur = gridStart
  while (cur.isBefore(gridEnd) || cur.isSame(gridEnd, 'day')) {
    days.push(cur)
    cur = cur.add(1, 'day')
  }

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7a6a7c] hover:bg-black/5"
        >
          <FiChevronLeft size={18} />
        </button>
        <h2 className="font-serif text-xl font-semibold">{month.format('MMMM YYYY')}</h2>
        <button
          onClick={onNextMonth}
          aria-label="Next month"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7a6a7c] hover:bg-black/5"
        >
          <FiChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((w) => (
          <div key={w} className="text-center text-[10px] font-semibold tracking-wide text-[#a892a9]">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-3">
        {days.map((d) => {
          const dStr = d.format('YYYY-MM-DD')
          const inMonth = d.isSame(month, 'month')
          const isToday = dStr === today
          const isSelected = dStr === selectedDate
          const info = checkinsByDate[dStr]
          const hasCheckin = Boolean(info?.mine || info?.theirs)

          return (
            <button
              key={dStr}
              onClick={() => onSelectDate(dStr)}
              disabled={!inMonth}
              className={`flex flex-col items-center justify-center gap-1.5 py-1.5 ${inMonth ? '' : 'invisible'}`}
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors ${
                  isSelected
                    ? 'border-2 border-peach font-semibold'
                    : isToday
                    ? 'border border-peach/50'
                    : 'hover:bg-black/5'
                } ${isSelected || isToday ? 'text-peach' : 'text-ink'}`}
              >
                {d.date()}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${hasCheckin ? 'bg-peach' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-6 pt-5 border-t border-black/10 text-xs text-[#9a8a9c]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-peach inline-block" /> Check-in completed
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border border-peach/60 inline-block" /> Today
        </div>
      </div>
    </div>
  )
}

// --- Day detail --------------------------------------------------------
function MoodRow({ who, entry }) {
  const m = entry ? moodInfo(entry.mood) : null
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-blush flex items-center justify-center text-2xl flex-shrink-0">
        {m?.e || '·'}
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">{who}</div>
        <div className="font-serif text-lg font-semibold">{m?.l || 'No check-in'}</div>
      </div>
    </div>
  )
}

function DayDetail({ dateStr, today, mine, theirs, partnerName, photos }) {
  const isToday = dateStr === today
  const hasAnyCheckin = Boolean(mine || theirs)

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 h-full">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] flex items-center gap-2">
        {dayjs(dateStr).format('dddd, MMM D, YYYY')}
        {isToday && <span className="bg-blush text-plum px-2 py-0.5 rounded-full normal-case">Today</span>}
      </div>

      {!hasAnyCheckin ? (
        <div className="mt-6">
          <EmptyState icon={FiSmile} title="No check-in this day" subtitle="Nothing was logged yet for this date." />
        </div>
      ) : (
        <>
          <div className="mt-4 grid sm:grid-cols-2 gap-5">
            <MoodRow who="You" entry={mine} />
            <MoodRow who={partnerName} entry={theirs} />
          </div>

          {(mine?.gratitude || theirs?.gratitude) && (
            <div className="mt-6 pt-5 border-t border-black/10 space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">Grateful for</div>
              {mine?.gratitude && <div className="jar-note text-sm">You: {mine.gratitude}</div>}
              {theirs?.gratitude && (
                <div className="jar-note text-sm">
                  {partnerName}: {theirs.gratitude}
                </div>
              )}
            </div>
          )}

          {(mine?.journal || theirs?.journal) && (
            <div className="mt-6 pt-5 border-t border-black/10 space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">Notes</div>
              {mine?.journal && (
                <div>
                  <div className="text-xs font-semibold text-[#9a8a9c] mb-1">You</div>
                  <p className="font-serif text-[15px] leading-relaxed whitespace-pre-wrap">{mine.journal}</p>
                </div>
              )}
              {theirs?.journal && (
                <div>
                  <div className="text-xs font-semibold text-[#9a8a9c] mb-1">{partnerName}</div>
                  <p className="font-serif text-[15px] leading-relaxed whitespace-pre-wrap">{theirs.journal}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {photos.length > 0 && (
        <div className="mt-6 pt-5 border-t border-black/10">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-3">Photos</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {photos.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="w-full aspect-square object-cover rounded-xl"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CheckIns() {
  const { firebaseUser, couple } = useAuth()
  const { partner, partnerUid, hasPartner } = usePartner()
  const coupleId = couple?.id
  const today = todayStr()

  const [checkins, setCheckins] = useState([])
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => dayjs())
  const [selectedDate, setSelectedDate] = useState(today)

  useEffect(() => {
    if (!coupleId) return
    const unsubs = [
      onSnapshot(collection(db, 'couples', coupleId, 'checkins'), (snap) => {
        setCheckins(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }),
      onSnapshot(collection(db, 'couples', coupleId, 'memories'), (snap) =>
        setMemories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [coupleId])

  const checkinsByDate = useMemo(() => {
    const map = {}
    for (const c of checkins) {
      if (!map[c.date]) map[c.date] = { mine: null, theirs: null }
      if (c.uid === firebaseUser.uid) map[c.date].mine = c
      else if (c.uid === partnerUid) map[c.date].theirs = c
    }
    return map
  }, [checkins, firebaseUser.uid, partnerUid])

  const memoriesByDate = useMemo(() => {
    const map = {}
    for (const m of memories) {
      const d = tsToDateStr(m.createdAt)
      if (!d) continue
      if (!map[d]) map[d] = []
      map[d].push(m)
    }
    return map
  }, [memories])

  const selected = checkinsByDate[selectedDate] || { mine: null, theirs: null }
  const selectedPhotos = [
    selected.mine?.photoData,
    selected.theirs?.photoData,
    ...(memoriesByDate[selectedDate] || []).map((m) => m.photoData),
  ].filter(Boolean)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Check-ins</h1>
          <p className="text-sm text-[#7a6a7c]">Better together, day by day.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-peach/10 rounded-full px-3.5 py-2 text-sm text-plum font-semibold w-fit">
          <FaFire size={13} /> {couple?.streak || 0} day streak
          {couple?.streak > 0 && couple?.streakGraceAvailable !== false && (
            <span
              title="Miss a day and your streak survives once, automatically."
              className="ml-1 text-xs font-normal text-[#9a8a9c]"
            >
              🛡️
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonList count={3} lines={2} />
      ) : (
        <div className="grid lg:grid-cols-[1fr_1fr] gap-5 items-start">
          <CheckInCalendar
            month={month}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={() => setMonth((m) => m.subtract(1, 'month'))}
            onNextMonth={() => setMonth((m) => m.add(1, 'month'))}
            checkinsByDate={checkinsByDate}
            today={today}
          />
          <DayDetail
            dateStr={selectedDate}
            today={today}
            mine={selected.mine}
            theirs={selected.theirs}
            partnerName={hasPartner ? partner?.displayName || 'Partner' : 'Partner'}
            photos={selectedPhotos}
          />
        </div>
      )}
    </div>
  )
}