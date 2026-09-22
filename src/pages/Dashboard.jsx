import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
} from 'firebase/firestore'
import {
  FiArrowRight,
  FiCalendar,
  FiCamera,
  FiFrown,
  FiGift,
  FiHelpCircle,
  FiMeh,
  FiSmile,
  FiSun,
} from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'
import { db } from '../firebase'
import BottomSheet from '../components/BottomSheet'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { compressImage } from '../utils/compressImage'
import { MOODS } from '../utils/moods'
import { anniversaryInfo, ordinalSuffix, todayStr } from '../utils/date'
import { computeRelationshipHealth } from '../utils/relationshipHealth'

// Circular progress ring for the relationship-health score. Pure SVG, no
// deps — a stroked circle with a partial dasharray offset by score.
function HealthRing({ score, size = 96 }) {
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(61,35,64,0.1)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#healthRingGradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <defs>
        <linearGradient id="healthRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8a87c" />
          <stop offset="100%" stopColor="#f0c987" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function moodIconFor(v) {
  if (v === 'amazing' || v === 'good') return FiSmile
  if (v === 'okay') return FiMeh
  if (v === 'sad' || v === 'hard') return FiFrown
  return FiMeh
}

// amazing -> 5 ... hard -> 1, used to turn a week of checkins into bar heights
function moodScore(v) {
  return { amazing: 5, good: 4, okay: 3, sad: 2, hard: 1 }[v] || 0
}

export default function Dashboard() {
  const { firebaseUser, profile, couple } = useAuth()
  const { partner, hasPartner } = usePartner()
  const today = todayStr()

  const [allTasks, setAllTasks] = useState([])
  const [events, setEvents] = useState([])
  const [jar, setJar] = useState([])
  const [weekCheckins, setWeekCheckins] = useState([])
  const [pickedMood, setPickedMood] = useState(null)
  const [gratitude, setGratitude] = useState('')
  const [journal, setJournal] = useState('')
  const [photoData, setPhotoData] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const [showHealthInfo, setShowHealthInfo] = useState(false)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [moodView, setMoodView] = useState('partner') // 'partner' | 'you' — flip the mood card
  const [nudgeSending, setNudgeSending] = useState(false)
  const [nudgeCooldown, setNudgeCooldown] = useState(false)
  const photoInputRef = useRef(null)
  const moodTouchXRef = useRef(null)

  const coupleId = couple?.id
  const sevenDaysAgo = dayjs().subtract(6, 'day').format('YYYY-MM-DD')

  useEffect(() => {
    if (!coupleId) return
    const unsubs = [
      onSnapshot(collection(db, 'couples', coupleId, 'tasks'), (s) =>
        setAllTasks(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, 'couples', coupleId, 'events'), orderBy('date')), (s) =>
        setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.date >= today))
      ),
      onSnapshot(collection(db, 'couples', coupleId, 'jar'), (s) =>
        setJar(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'checkins'), where('date', '>=', sevenDaysAgo)),
        (s) => setWeekCheckins(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [coupleId, today, sevenDaysAgo])

  const checkins = weekCheckins.filter((c) => c.date === today)
  const myCheckin = checkins.find((c) => c.uid === firebaseUser.uid)
  const partnerCheckin = checkins.find((c) => c.uid !== firebaseUser.uid)
  const lastJarNote = jar.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0]
  const anniversary = anniversaryInfo(profile?.anniversaryDate || partner?.anniversaryDate)

  // --- Relationship Health inputs -----------------------------------
  const sevenDaysAgoSeconds = dayjs().subtract(7, 'day').unix()

  const weekCheckinDays = new Set(weekCheckins.map((c) => c.date)).size

  const appreciationsLast7 = jar.filter((n) => (n.createdAt?.seconds || 0) >= sevenDaysAgoSeconds).length

  const tasksDoneLast7 = allTasks.filter(
    (t) => t.done && t.completedAt?.seconds >= sevenDaysAgoSeconds
  ).length
  const tasksTotalLast7 = allTasks.filter(
    (t) =>
      (t.done && t.completedAt?.seconds >= sevenDaysAgoSeconds) ||
      (!t.done && t.createdAt?.seconds >= sevenDaysAgoSeconds)
  ).length

  const nextEvent = events[0] || null
  const daysUntilNextEvent = nextEvent ? dayjs(nextEvent.date).diff(dayjs(today), 'day') : null

  const health = computeRelationshipHealth({
    weekCheckinDays,
    streak: couple?.streak || 0,
    appreciationsLast7,
    tasksDoneLast7,
    tasksTotalLast7,
    daysUntilNextEvent,
  })

  const healthMessage =
    health.score >= 70
      ? "You're thriving, together."
      : health.score >= 40
      ? "You're building something good."
      : "There's room to grow, together."
  const healthSubMessage = health.score >= 70 ? 'Keep doing what you\u2019re doing.' : 'Small moments add up. Keep showing up.'

  // --- This week's mood bars ------------------------------------------
  const weekDates = Array.from({ length: 7 }, (_, i) => dayjs(sevenDaysAgo).add(i, 'day').format('YYYY-MM-DD'))
  const weekBars = weekDates.map((date) => {
    const dayCheckins = weekCheckins.filter((c) => c.date === date)
    const avg = dayCheckins.length
      ? dayCheckins.reduce((sum, c) => sum + moodScore(c.mood), 0) / dayCheckins.length
      : null
    return { date, label: dayjs(date).format('ddd'), avg }
  })

  function moodBarClasses(avg) {
    if (avg == null) return 'bg-black/10'
    if (avg >= 4) return 'bg-gradient-to-t from-peach to-gold'
    if (avg >= 2.5) return 'bg-peachsoft'
    return 'bg-[#e5b7b7]'
  }

  function greeting() {
    const h = dayjs().hour()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  async function handlePhotoPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.')
      return
    }
    setPhotoError('')
    setPhotoLoading(true)
    try {
      setPhotoData(await compressImage(file))
    } catch (err) {
      setPhotoError(err.message)
    } finally {
      setPhotoLoading(false)
    }
  }

  async function submitCheckin() {
    if (!pickedMood) return
    await addDoc(collection(db, 'couples', coupleId, 'checkins'), {
      date: today,
      uid: firebaseUser.uid,
      mood: pickedMood,
      gratitude: gratitude.trim(),
      journal: journal.trim(),
      photoData: photoData || null,
      createdAt: new Date(),
    })
    setCheckinOpen(false)

    // If both partners have now checked in today, bump the streak (once)
    const members = couple.members
    if (members.length === 2) {
      const otherUid = members.find((m) => m !== firebaseUser.uid)
      const otherCheckedIn = checkins.some((c) => c.uid === otherUid)
      if (otherCheckedIn && couple.lastCheckinDate !== today) {
        const coupleRef = doc(db, 'couples', coupleId)
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(coupleRef)
          const data = snap.data()
          if (data.lastCheckinDate === today) return

          const last = data.lastCheckinDate
          const gap = last ? dayjs(today).diff(dayjs(last), 'day') : null
          const graceAvailable = data.streakGraceAvailable !== false

          let newStreak
          let graceUsed = false
          if (!last || gap <= 1) {
            // First check-in ever, or checked in yesterday — normal streak.
            newStreak = (data.streak || 0) + 1
          } else if (gap === 2 && graceAvailable) {
            // Missed exactly one day, and the grace day hasn't been spent yet.
            newStreak = (data.streak || 0) + 1
            graceUsed = true
          } else {
            // Missed more than a grace day covers — streak restarts today.
            newStreak = 1
          }

          tx.update(coupleRef, {
            streak: newStreak,
            // Best-ever streak, kept separately from the live one so a
            // reset streak doesn't erase the couple's record.
            longestStreak: Math.max(data.longestStreak || 0, newStreak),
            lastCheckinDate: today,
            // A restarted streak gets a fresh grace day; using the grace
            // day spends it until the streak breaks and restarts again.
            streakGraceAvailable: newStreak === 1 ? true : !graceUsed && graceAvailable,
          })

          if (graceUsed) {
            toast.success("Missed a day? No worries — your streak grace day covered it.")
          } else if (newStreak === 1 && data.streak > 1) {
            toast("Streak restarted today — every streak starts somewhere.", { icon: '🔥' })
          }
        })
      }
    }
  }

  function flipMoodView() {
    setMoodView((v) => (v === 'you' ? 'partner' : 'you'))
  }

  function onMoodTouchStart(e) {
    moodTouchXRef.current = e.touches[0].clientX
  }

  function onMoodTouchEnd(e) {
    if (moodTouchXRef.current == null) return
    const dx = e.changedTouches[0].clientX - moodTouchXRef.current
    moodTouchXRef.current = null
    if (Math.abs(dx) > 30) flipMoodView()
  }

  async function sendNudge() {
    if (!coupleId || nudgeSending || nudgeCooldown) return
    setNudgeSending(true)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'nudges'), {
        from: firebaseUser.uid,
        createdAt: new Date(),
      })
      toast.success(`Nudge sent to ${partner?.displayName || 'your partner'}.`)
      setNudgeCooldown(true)
      setTimeout(() => setNudgeCooldown(false), 60000)
    } catch {
      toast.error("Couldn't send that nudge — try again in a bit.")
    } finally {
      setNudgeSending(false)
    }
  }

  const displayedMood = moodView === 'you' ? myCheckin?.mood : partnerCheckin?.mood
  const DisplayedMoodIcon = moodIconFor(displayedMood)

  return (
    <div>
      {!hasPartner ? (
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1">
            {greeting()}, {profile.displayName}
          </h1>
          <p className="text-sm text-[#7a6a7c]">Waiting for your partner to join with your invite code.</p>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-sm text-[#7a6a7c] mb-4">
            {greeting()}, {profile.displayName}
          </p>

          {/* Row 1 — Relationship pulse (tall) + Streak/Today stacked in the other two columns */}
          <div className="grid grid-cols-1 md:grid-cols-[1.8fr_1fr_1fr] gap-4">
            <div className="md:row-span-2 bg-white border border-black/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <button
                onClick={() => setShowHealthInfo((v) => !v)}
                className="relative flex-shrink-0"
                aria-expanded={showHealthInfo}
                aria-label="Show how relationship health is calculated"
              >
                <HealthRing score={health.score} />
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                  {health.score}%
                </div>
              </button>
              <div className="text-center sm:text-left flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">
                    Relationship pulse
                  </span>
                  <button
                    onClick={() => setShowHealthInfo((v) => !v)}
                    className="hidden sm:flex items-center gap-1 text-xs text-peach font-semibold"
                  >
                    See details <FiArrowRight size={11} />
                  </button>
                </div>
                <p className="text-lg font-semibold mt-1">{healthMessage}</p>
                <p className="text-sm text-[#9a8a9c] mt-1">{healthSubMessage}</p>

                {showHealthInfo && (
                  <div className="mt-4 bg-[#faf6f8] rounded-2xl p-4 text-xs space-y-1.5 text-left">
                    <p className="font-semibold text-[13px] mb-1.5">How this is calculated</p>
                    {health.factors.map((f) => (
                      <div key={f.key} className="flex items-center justify-between">
                        <span>{f.label}</span>
                        <span className="font-semibold">{Math.round(f.value * 100)}%</span>
                      </div>
                    ))}
                    <p className="text-[#9a8a9c] pt-1">A snapshot, not a grade — it moves with what you both do this week.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-3">Streak</div>
              <FaFire size={22} className="text-peach" />
              <div className="text-2xl font-semibold mt-2">
                {couple?.streak || 0} Day{couple?.streak === 1 ? '' : 's'}
              </div>
              <div className="text-xs text-[#9a8a9c] mt-1">Consistency builds closer tomorrows.</div>
            </div>

            <div className="rounded-2xl p-5 text-plumdeep bg-gradient-to-br from-peach/25 to-gold/30 border border-peach/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-plumdeep/70">Today</span>
                <span className="text-[11px] font-semibold text-plumdeep/70">{dayjs(today).format('MMM D')}</span>
              </div>
              {nextEvent ? (
                <>
                  <FiGift size={20} />
                  <div className="text-lg font-semibold mt-2">{nextEvent.title}</div>
                  <div className="text-xs text-plumdeep/70 mt-1">
                    {daysUntilNextEvent === 0
                      ? 'Make today special'
                      : `In ${daysUntilNextEvent} day${daysUntilNextEvent === 1 ? '' : 's'}`}
                  </div>
                </>
              ) : (
                <>
                  <FiCalendar size={20} />
                  <div className="text-lg font-semibold mt-2">Nothing planned</div>
                  <Link to="/calendar" className="text-xs text-plumdeep/70 underline mt-1 inline-block">
                    Add something to look forward to
                  </Link>
                </>
              )}
            </div>

            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-3">Daily check-in</div>
              {myCheckin ? (
                <>
                  <FiSun size={20} className="text-peach" />
                  <div className="text-lg font-semibold mt-2">
                    Checked in: {MOODS.find((m) => m.v === myCheckin.mood)?.l}
                  </div>
                  <div className="text-xs text-[#9a8a9c] mt-1">Nice — see you again tomorrow.</div>
                </>
              ) : (
                <>
                  <FiSun size={20} className="text-peach" />
                  <div className="text-lg font-semibold mt-2">You haven't checked in today.</div>
                  <div className="text-xs text-[#9a8a9c] mt-1 mb-3">A little check-in goes a long way.</div>
                  <button
                    onClick={() => setCheckinOpen(true)}
                    className="px-4 py-2 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
                  >
                    Check in
                  </button>
                </>
              )}
            </div>

            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">Anniversary</span>
                {anniversary && (
                  <span className="text-[11px] font-semibold text-[#9a8a9c]">
                    {(profile?.anniversaryDate || partner?.anniversaryDate)}
                  </span>
                )}
              </div>
              {!anniversary ? (
                <>
                  <FiCalendar size={20} className="text-peach" />
                  <div className="text-sm text-[#9a8a9c] mt-2">
                    Add your anniversary date on your{' '}
                    <Link to="/profile" className="underline">
                      profile
                    </Link>{' '}
                    to see the countdown here.
                  </div>
                </>
              ) : anniversary.daysUntil === 0 ? (
                <>
                  <FiCalendar size={20} className="text-peach" />
                  <div className="text-lg font-semibold mt-2 text-peach">Happy anniversary!</div>
                  <div className="text-xs text-[#9a8a9c] mt-1">
                    {anniversary.years} year{anniversary.years === 1 ? '' : 's'} together today.
                  </div>
                </>
              ) : (
                <>
                  <FiCalendar size={20} className="text-peach" />
                  <div className="text-2xl font-semibold mt-2">
                    {anniversary.daysUntil} <span className="text-sm font-medium">days</span>
                  </div>
                  <div className="text-xs text-[#9a8a9c] mt-1">
                    Until your {anniversary.years}
                    {ordinalSuffix(anniversary.years)} anniversary. More love ahead.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 2 — Love jar quote / this week / partner mood */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">Love jar</span>
                <Link to="/memories?tab=jar" className="text-xs text-peach font-semibold flex items-center gap-1">
                  See all <FiArrowRight size={11} />
                </Link>
              </div>
              {!lastJarNote ? (
                <div className="text-sm text-[#a892a9]">No notes saved yet.</div>
              ) : (
                <div className="jar-note">"{lastJarNote.text}"</div>
              )}
            </div>

            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">This week</span>
                <span className="text-[11px] text-[#9a8a9c]">
                  {dayjs(weekDates[0]).format('MMM D')} – {dayjs(weekDates[6]).format('MMM D')}
                </span>
              </div>
              <div className="flex items-end justify-between gap-2 h-24">
                {weekBars.map((b) => (
                  <div key={b.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div
                      className={`w-full rounded-full ${moodBarClasses(b.avg)}`}
                      style={{ height: `${b.avg == null ? 6 : Math.max(10, (b.avg / 5) * 100)}%` }}
                    />
                    <span className="text-[10px] text-[#9a8a9c]">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="bg-white border border-black/10 rounded-2xl p-5 select-none"
              onTouchStart={onMoodTouchStart}
              onTouchEnd={onMoodTouchEnd}
            >
              <div className="flex items-center justify-between mb-3">
                <button onClick={flipMoodView} className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">
                    {moodView === 'you' ? 'Your mood' : `${partner?.displayName || 'Partner'}'s mood`}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${moodView === 'you' ? 'bg-peach' : 'bg-black/15'}`} />
                    <span className={`w-1.5 h-1.5 rounded-full ${moodView === 'partner' ? 'bg-peach' : 'bg-black/15'}`} />
                  </div>
                  <span title="Tap the card or the dots to switch between your mood and theirs.">
                    <FiHelpCircle size={13} className="text-[#a892a9]" />
                  </span>
                </div>
              </div>
              <button onClick={flipMoodView} className="flex items-center gap-3 w-full text-left">
                <div className="w-9 h-9 rounded-full bg-[#faf6f8] flex items-center justify-center flex-shrink-0">
                  <DisplayedMoodIcon size={17} className="text-peach" />
                </div>
                <div className="text-lg font-semibold">
                  {MOODS.find((m) => m.v === displayedMood)?.l || 'Not yet'}
                </div>
              </button>
              <div className="text-xs text-[#9a8a9c] mt-2">
                {moodView === 'you'
                  ? myCheckin
                    ? 'You checked in today.'
                    : "You haven't checked in today."
                  : partnerCheckin
                  ? `${partner?.displayName || 'They'} checked in today.`
                  : `${partner?.displayName || 'They'} haven't checked in today. A little nudge can go a long way.`}
              </div>
              {moodView === 'partner' && !partnerCheckin && (
                <button
                  onClick={sendNudge}
                  disabled={nudgeSending || nudgeCooldown}
                  className="w-full mt-3 py-2 rounded-xl font-semibold text-sm border border-black/10 disabled:opacity-50"
                >
                  {nudgeCooldown ? 'Nudge sent' : nudgeSending ? 'Sending…' : 'Send a nudge'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomSheet open={checkinOpen} onClose={() => setCheckinOpen(false)} title="Daily check-in">
        <div className="flex gap-2 mt-2">
          {MOODS.map((m) => (
            <div
              key={m.v}
              onClick={() => setPickedMood(m.v)}
              className={`flex-1 border rounded-xl py-3 text-center cursor-pointer text-2xl ${
                pickedMood === m.v ? 'border-peach bg-peachsoft' : 'border-black/10'
              }`}
            >
              <div>{m.e}</div>
              <div className="text-[10px] text-[#9a8a9c] mt-1">{m.l}</div>
            </div>
          ))}
        </div>
        <textarea
          rows={2}
          className="w-full mt-2.5 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="How was today, really? (optional journal entry)"
          value={journal}
          onChange={(e) => setJournal(e.target.value)}
        />
        <input
          className="w-full mt-2.5 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="One thing you appreciated today (optional)"
          value={gratitude}
          onChange={(e) => setGratitude(e.target.value)}
        />

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoPick}
        />
        <div className="flex items-center gap-2.5 mt-2.5">
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={photoLoading}
            className="flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border border-black/10 disabled:opacity-50"
          >
            <FiCamera size={14} />
            {photoLoading ? 'Adding photo...' : photoData ? 'Change photo' : 'Add a photo (optional)'}
          </button>
          {photoData && (
            <button
              onClick={() => setPhotoData(null)}
              className="text-xs text-[#9a8a9c]"
            >
              Remove
            </button>
          )}
        </div>
        {photoData && (
          <img src={photoData} alt="Preview" className="rounded-xl mt-2.5 max-h-32 object-cover" />
        )}
        {photoError && <div className="text-xs text-[#9b3b3b] mt-1.5">{photoError}</div>}

        <button
          onClick={submitCheckin}
          className="w-full mt-3 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
        >
          Save check-in
        </button>
      </BottomSheet>
    </div>
  )
}