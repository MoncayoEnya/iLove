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
  FiCheckSquare,
  FiGift,
  FiHeart,
  FiInfo,
  FiSmile,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { compressImage } from '../utils/compressImage'
import { MOODS } from '../utils/moods'
import { anniversaryInfo, friendlyDate, ordinalSuffix, todayStr } from '../utils/date'
import { computeRelationshipHealth } from '../utils/relationshipHealth'

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
  const photoInputRef = useRef(null)

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

  const tasks = allTasks.filter((t) => !t.done)
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

  const newAppreciationCount = jar.filter(
    (n) => n.from !== firebaseUser.uid && (n.createdAt?.seconds || 0) >= dayjs().subtract(1, 'day').unix()
  ).length

  const todayTasks = allTasks.filter((t) => t.dueDate === today)
  const todayGoalDone = todayTasks.filter((t) => t.done).length
  const todayGoalTotal = todayTasks.length

  function greeting() {
    const h = dayjs().hour()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  function nextEventLabel(ev) {
    const diff = dayjs(ev.date).diff(dayjs(today), 'day')
    const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : friendlyDate(ev.date, today)
    return ev.time ? `${day}, ${ev.time}` : day
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
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-peach via-[#f5a3ae] to-gold p-5 sm:p-7 text-plumdeep mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-plumdeep/70">
                {greeting()}, {profile.displayName}
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold mt-0.5">
                You &amp; {partner?.displayName || '...'} <span aria-hidden>❤️</span>
              </h1>
              {partner?.loveLanguage && (
                <p className="text-xs text-plumdeep/70 mt-1">
                  {partner.displayName || 'Your partner'}'s love language is{' '}
                  <span className="font-semibold">{partner.loveLanguage}</span>
                </p>
              )}
            </div>

            <button
              onClick={() => setShowHealthInfo((v) => !v)}
              className="text-right shrink-0"
              aria-expanded={showHealthInfo}
              aria-label="Show how relationship health is calculated"
            >
              <div className="flex items-center gap-1 justify-end">
                <div className="text-3xl sm:text-4xl font-bold leading-none">{health.score}%</div>
                <FiInfo size={14} className="text-plumdeep/60 mb-3" />
              </div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-plumdeep/70">
                Relationship health
              </div>
            </button>
          </div>

          {showHealthInfo && (
            <div className="mt-4 bg-white/70 rounded-2xl p-4 text-xs space-y-1.5">
              <p className="font-semibold text-[13px] mb-1.5">How this is calculated</p>
              {health.factors.map((f) => (
                <div key={f.key} className="flex items-center justify-between">
                  <span>{f.label}</span>
                  <span className="font-semibold">{Math.round(f.value * 100)}%</span>
                </div>
              ))}
              <p className="text-plumdeep/60 pt-1">A snapshot, not a grade — it moves with what you both do this week.</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5">
            <div className="bg-white/70 rounded-2xl p-3">
              <div className="text-xl leading-none">🔥</div>
              <div className="text-lg font-semibold mt-1">{couple?.streak || 0} Day{couple?.streak === 1 ? '' : 's'}</div>
              <div className="text-[10.5px] text-plumdeep/70">Streak</div>
            </div>

            <div className="bg-white/70 rounded-2xl p-3">
              <div className="text-xl leading-none">{MOODS.find((m) => m.v === partnerCheckin?.mood)?.e || '😊'}</div>
              <div className="text-lg font-semibold mt-1">
                {MOODS.find((m) => m.v === partnerCheckin?.mood)?.l || 'Not yet'}
              </div>
              <div className="text-[10.5px] text-plumdeep/70">{partner?.displayName || 'Partner'}'s mood</div>
            </div>

            <div className="bg-white/70 rounded-2xl p-3">
              <div className="text-xl leading-none">💌</div>
              <div className="text-lg font-semibold mt-1">{newAppreciationCount}</div>
              <div className="text-[10.5px] text-plumdeep/70">New appreciation</div>
            </div>

            <div className="bg-white/70 rounded-2xl p-3">
              <div className="text-xl leading-none">📅</div>
              <div className="text-lg font-semibold mt-1">{nextEvent ? nextEventLabel(nextEvent) : 'None yet'}</div>
              <div className="text-[10.5px] text-plumdeep/70">
                {nextEvent ? nextEvent.title : 'Next date'}
              </div>
            </div>

            <div className="bg-white/70 rounded-2xl p-3 col-span-2 sm:col-span-1">
              <div className="text-xl leading-none">🎯</div>
              <div className="text-lg font-semibold mt-1">
                {todayGoalTotal === 0 ? '—' : `${todayGoalDone}/${todayGoalTotal}`}
              </div>
              <div className="text-[10.5px] text-plumdeep/70">
                {todayGoalTotal === 0 ? "No tasks due today" : "Today's goal"}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <FiSmile size={16} className="text-peach" /> Daily check-in
            </h3>
            <Link to="/checkins" className="text-xs text-peach font-semibold flex items-center gap-1">
              History <FiArrowRight size={12} />
            </Link>
          </div>
          {myCheckin ? (
            <>
              <div className="text-sm text-[#9a8a9c]">
                You checked in today: {MOODS.find((m) => m.v === myCheckin.mood)?.e}{' '}
                {MOODS.find((m) => m.v === myCheckin.mood)?.l}
              </div>
              {myCheckin.journal && (
                <div className="text-sm mt-3 whitespace-pre-wrap">{myCheckin.journal}</div>
              )}
              {myCheckin.gratitude && <div className="jar-note mt-3 text-sm">{myCheckin.gratitude}</div>}
              {myCheckin.photoData && (
                <img
                  src={myCheckin.photoData}
                  alt="Today's check-in"
                  className="rounded-xl mt-3 max-h-48 w-full object-cover"
                />
              )}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FiCheckSquare size={16} className="text-peach" /> Today's tasks
          </h3>
          {tasks.length === 0 ? (
            <div className="text-sm text-[#a892a9]">Nothing open — nice.</div>
          ) : (
            tasks.slice(0, 4).map((t) => (
              <div key={t.id} className="text-sm py-1.5">
                • {t.text}
              </div>
            ))
          )}
          <Link to="/tasks" className="inline-block mt-3 text-sm border border-black/10 rounded-xl px-4 py-2">
            Go to tasks
          </Link>
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FiCalendar size={16} className="text-peach" /> Coming up
          </h3>
          {events.length === 0 ? (
            <div className="text-sm text-[#a892a9]">Nothing planned yet.</div>
          ) : (
            events.slice(0, 3).map((ev) => (
              <div key={ev.id} className="text-sm py-1.5">
                <span className="text-[10.5px] bg-blush text-plum px-2 py-0.5 rounded-full font-semibold mr-2">
                  {ev.date}
                </span>
                {ev.title}
              </div>
            ))
          )}
          <Link to="/calendar" className="inline-block mt-3 text-sm border border-black/10 rounded-xl px-4 py-2">
            Open calendar
          </Link>
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FiGift size={16} className="text-peach" /> Anniversary
          </h3>
          {!anniversary ? (
            <div className="text-sm text-[#a892a9]">
              Add your anniversary date on your{' '}
              <Link to="/profile" className="underline">
                profile
              </Link>{' '}
              to see the countdown here.
            </div>
          ) : anniversary.daysUntil === 0 ? (
            <div className="text-sm font-semibold text-peach">
              Happy anniversary! {anniversary.years} year{anniversary.years === 1 ? '' : 's'} together today.
            </div>
          ) : (
            <div className="text-sm">
              <span className="text-2xl font-semibold">{anniversary.daysUntil}</span>{' '}
              day{anniversary.daysUntil === 1 ? '' : 's'} until your {anniversary.years}
              {ordinalSuffix(anniversary.years)}{' '}
              anniversary.
            </div>
          )}
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FiHeart size={16} className="text-peach" /> Latest from the love jar
          </h3>
          {!lastJarNote ? (
            <div className="text-sm text-[#a892a9]">No notes saved yet.</div>
          ) : (
            <div className="jar-note">"{lastJarNote.text}"</div>
          )}
          <Link to="/jar" className="inline-block mt-3 text-sm border border-black/10 rounded-xl px-4 py-2">
            Open love jar
          </Link>
        </div>
      </div>
    </div>
  )
}