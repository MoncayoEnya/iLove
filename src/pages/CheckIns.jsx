import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import dayjs from 'dayjs'
import { FaFire } from 'react-icons/fa'
import { FiSmile } from 'react-icons/fi'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { MOODS } from '../utils/moods'
import { friendlyDate, lastNDays, todayStr, yesterdayStr } from '../utils/date'
import EmptyState from '../components/EmptyState'

function moodInfo(v) {
  return MOODS.find((m) => m.v === v)
}

// Higher = better mood. Used to plot a numeric trend line from the mood picker's labels.
const MOOD_SCORE = { amazing: 5, good: 4, okay: 3, sad: 2, hard: 1 }

export default function CheckIns() {
  const { firebaseUser, couple } = useAuth()
  const { partner, partnerUid, hasPartner } = usePartner()
  const coupleId = couple?.id
  const today = todayStr()
  const yesterday = useMemo(() => yesterdayStr(), [])

  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!coupleId) return
    const q = query(
      collection(db, 'couples', coupleId, 'checkins'),
      orderBy('date', 'desc'),
      limit(120)
    )
    const unsub = onSnapshot(q, (snap) => {
      setCheckins(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [coupleId])

  // Group check-ins by date -> array of entries for that date.
  const byDate = useMemo(() => {
    const map = {}
    for (const c of checkins) {
      if (!map[c.date]) map[c.date] = []
      map[c.date].push(c)
    }
    return map
  }, [checkins])

  const trendDays = lastNDays(14).reverse()

  function entryFor(dateStr, uid) {
    return (byDate[dateStr] || []).find((c) => c.uid === uid)
  }

  const chartData = useMemo(
    () =>
      trendDays.map((d) => {
        const mine = entryFor(d, firebaseUser.uid)
        const theirs = partnerUid ? entryFor(d, partnerUid) : null
        return {
          date: d,
          label: friendlyDate(d, today, yesterday).slice(0, 3),
          you: mine ? MOOD_SCORE[mine.mood] : null,
          partner: theirs ? MOOD_SCORE[theirs.mood] : null,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byDate, trendDays.join(','), firebaseUser.uid, partnerUid]
  )

  const sortedDates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Check-ins</h1>
          <p className="text-sm text-[#7a6a7c]">
            How you and {hasPartner ? partner?.displayName || 'your partner' : 'your partner'} have
            been doing, day by day.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-peach/10 rounded-full px-3.5 py-2 text-sm text-plum font-semibold w-fit">
          <FaFire size={13} /> {couple?.streak || 0} day streak
        </div>
      </div>

      {/* ---- 14-day mood trend chart ---- */}
      <div className="bg-white border border-black/10 rounded-2xl p-5 mb-5">
        <h3 className="font-semibold mb-4 text-sm text-[#7a6a7c]">Mood trend</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9a8a9c' }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 11, fill: '#9a8a9c' }}
                axisLine={false}
                tickLine={false}
                width={20}
              />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #00000015', fontSize: 12 }}
                formatter={(value, name) => [value ? MOODS.find((m) => MOOD_SCORE[m.v] === value)?.l : '—', name]}
              />
              <Line
                type="monotone"
                dataKey="you"
                name="You"
                stroke="#d97a6a"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              {hasPartner && (
                <Line
                  type="monotone"
                  dataKey="partner"
                  name={partner?.displayName || 'Partner'}
                  stroke="#e8b978"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---- 14-day mood trend ---- */}
      <div className="bg-white border border-black/10 rounded-2xl p-5 mb-5 overflow-x-auto">
        <h3 className="font-semibold mb-4 text-sm text-[#7a6a7c]">Last 14 days</h3>
        <div className="flex gap-2 min-w-[560px]">
          {trendDays.map((d) => {
            const mine = entryFor(d, firebaseUser.uid)
            const theirs = partnerUid ? entryFor(d, partnerUid) : null
            return (
              <div key={d} className="flex-1 text-center">
                <div className="text-[9px] text-[#a892a9] mb-1.5 uppercase tracking-wide">
                  {dayjs(d).format('dd')[0]}
                </div>
                <div className="flex flex-col gap-1 items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${
                      mine ? 'bg-blush' : 'bg-black/5'
                    }`}
                    title={mine ? moodInfo(mine.mood)?.l : 'No check-in'}
                  >
                    {mine ? moodInfo(mine.mood)?.e : '·'}
                  </div>
                  {hasPartner && (
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${
                        theirs ? 'bg-peachsoft' : 'bg-black/5'
                      }`}
                      title={theirs ? moodInfo(theirs.mood)?.l : 'No check-in'}
                    >
                      {theirs ? moodInfo(theirs.mood)?.e : '·'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-[#9a8a9c]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blush inline-block" /> You
          </div>
          {hasPartner && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-peachsoft inline-block" />{' '}
              {partner?.displayName || 'Partner'}
            </div>
          )}
        </div>
      </div>

      {/* ---- History feed ---- */}
      {loading ? (
        <div className="text-sm text-[#a892a9]">Loading…</div>
      ) : sortedDates.length === 0 ? (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <EmptyState
            icon={FiSmile}
            title="No check-ins yet"
            subtitle="Once you check in from the dashboard, they'll show up here."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sortedDates.map((dateStr) => (
            <div key={dateStr} className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="text-xs font-semibold text-[#9a8a9c] uppercase tracking-wide mb-3">
                {friendlyDate(dateStr, today, yesterday)}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {byDate[dateStr].map((c) => {
                  const isMe = c.uid === firebaseUser.uid
                  const who = isMe ? 'You' : partner?.displayName || 'Partner'
                  const m = moodInfo(c.mood)
                  return (
                    <div key={c.id} className="border border-black/5 rounded-xl p-3.5">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className="text-lg">{m?.e}</span> {who}
                        <span className="text-xs font-normal text-[#a892a9]">{m?.l}</span>
                      </div>
                      {c.journal && (
                        <div className="text-sm mt-2 whitespace-pre-wrap">{c.journal}</div>
                      )}
                      {c.gratitude && <div className="jar-note mt-2 text-sm">{c.gratitude}</div>}
                      {c.photoData && (
                        <img
                          src={c.photoData}
                          alt=""
                          className="rounded-xl mt-2.5 max-h-40 w-full object-cover"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}