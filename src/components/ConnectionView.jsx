import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  FiArrowDown,
  FiArrowLeft,
  FiArrowUp,
  FiBell,
  FiCalendar,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiGift,
  FiHeart,
  FiRotateCcw,
  FiSliders,
  FiTarget,
  FiX,
} from 'react-icons/fi'
import { FaFire, FaHeart } from 'react-icons/fa'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { usePartner } from '../hooks/usePartner'
import { isOnline, lastSeenText } from '../hooks/usePresence'
import { MOODS } from '../utils/moods'
import { todayStr } from '../utils/date'
import { computeRelationshipHealth } from '../utils/relationshipHealth'
import { celebrateFrom } from '../utils/celebrate'
import { haptic } from '../utils/haptics'
import { CONNECTION_WIDGETS, DEFAULT_LAYOUT, normalizeLayout, widgetMeta } from '../utils/connectionWidgets'
import { LOVE_LANGUAGES } from '../lib/schemas'
import MoodIcon from './MoodIcon'
import CountUp from './CountUp'
import ThinkingOfYouButton from './ThinkingOfYouButton'
import DailyQuestion from './DailyQuestion'
import CountdownCard from './CountdownCard'
import OnThisDay from './OnThisDay'

// The Connection view: you on one side, your partner on the other, and
// "us, right now" in the middle — then a grid of widgets each person can
// switch on/off and reorder (Customize). Opens as a full-screen layer from
// the Topbar's couple avatars or a left swipe; closes back to the same page.

const MOOD_BLURB = {
  amazing: 'Full, warm, and glowing today.',
  good: 'Grateful, present, and keeping going.',
  okay: "A steady kind of day, and that's fine.",
  sad: 'A harder day. Worth a gentle check-in.',
  hard: 'A tough one. Be extra kind to each other.',
}

function HealthRing({ score, size = 140, dark = false }) {
  const stroke = 11
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 flex-shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={dark ? 'rgba(255,255,255,0.12)' : 'rgba(61,35,64,0.1)'}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#connectionHealthGradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
      <defs>
        <linearGradient id="connectionHealthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8a87c" />
          <stop offset="100%" stopColor="#f0c987" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function Avatar({ name, photoURL, size = 56, online = false }) {
  return (
    <div className="relative flex-shrink-0">
      <div
        className="rounded-full overflow-hidden bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep font-semibold border-2 border-white shadow-sm"
        style={{ width: size, height: size, fontSize: size * 0.36 }}
      >
        {photoURL ? <img src={photoURL} alt="" className="w-full h-full object-cover" /> : (name || '?')[0]?.toUpperCase()}
      </div>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-[#3fbf7f] border-2 border-white"
          style={{ width: size * 0.26, height: size * 0.26 }}
        >
          <span className="absolute inset-0 rounded-full bg-[#3fbf7f] animate-ping opacity-60" />
        </span>
      )}
    </div>
  )
}

// Shared card shell + header for the widgets. Defined at module level (not
// inside ConnectionView) so React keeps the same component between renders —
// otherwise every live update would remount every card and replay animations.
function Card({ tk, children, className = '', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`w-full h-full text-left rounded-2xl p-5 ${tk.cardBg} ${className}`}>
      {children}
    </Tag>
  )
}

function CardHeader({ tk, icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <span className={`flex items-center gap-2 ${tk.label}`}>
        <span className={`w-7 h-7 rounded-full flex items-center justify-center ${tk.iconBubble}`}>
          <Icon size={13} className="text-peach" />
        </span>
        {title}
      </span>
      {action}
    </div>
  )
}

function useTick(active, ms = 30000) {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [active, ms])
}

export default function ConnectionView({ open, onClose }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const { firebaseUser, profile, couple } = useAuth()
  const { partner, partnerUid } = usePartner()
  const navigate = useNavigate()
  const coupleId = couple?.id
  const uid = firebaseUser?.uid
  const today = todayStr()
  const touchXRef = useRef(null)
  useTick(open)
  const [heroAvatar, setHeroAvatar] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 44 : 56
  )
  useEffect(() => {
    const onResize = () => setHeroAvatar(window.innerWidth < 640 ? 44 : 56)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const [tasks, setTasks] = useState([])
  const [jar, setJar] = useState([])
  const [weekCheckins, setWeekCheckins] = useState([])
  const [events, setEvents] = useState([])
  const [showFactors, setShowFactors] = useState(false)
  const [nudgeSending, setNudgeSending] = useState(false)
  const [nudgeCooldown, setNudgeCooldown] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [draft, setDraft] = useState(null) // layout being edited
  const [savingLayout, setSavingLayout] = useState(false)
  const [ringScore, setRingScore] = useState(0)

  const sevenDaysAgo = dayjs().subtract(6, 'day').format('YYYY-MM-DD')

  // Only listen while the panel is open — it's mounted on every page.
  useEffect(() => {
    if (!open || !coupleId) return undefined
    const unsubs = [
      onSnapshot(collection(db, 'couples', coupleId, 'tasks'), (s) =>
        setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, 'couples', coupleId, 'jar'), (s) =>
        setJar(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(
        query(collection(db, 'couples', coupleId, 'checkins'), where('date', '>=', sevenDaysAgo)),
        (s) => setWeekCheckins(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, 'couples', coupleId, 'events'), (s) =>
        setEvents(
          s.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((e) => e.date >= today)
            .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
        )
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [open, coupleId, today, sevenDaysAgo])

  useEffect(() => {
    if (!open) {
      setShowFactors(false)
      setCustomizing(false)
      setRingScore(0)
    }
  }, [open])

  // Close on Escape (desktop).
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // --- derived data ------------------------------------------------------
  const todaysCheckins = weekCheckins.filter((c) => c.date === today)
  const myCheckin = todaysCheckins.find((c) => c.uid === uid)
  const partnerCheckin = partnerUid ? todaysCheckins.find((c) => c.uid === partnerUid) : null

  const mineTasks = tasks.filter((t) => t.assignedTo === uid || !t.assignedTo)
  const openMine = mineTasks.filter((t) => !t.done)
  const shownTasks = mineTasks
    .slice()
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate || '9').localeCompare(b.dueDate || '9'))
    .slice(0, 4)

  const sevenDaysAgoSeconds = dayjs().subtract(7, 'day').unix()
  const weekCheckinDays = new Set(weekCheckins.map((c) => c.date)).size
  const appreciationsLast7 = jar.filter((n) => (n.createdAt?.seconds || 0) >= sevenDaysAgoSeconds).length
  const tasksDoneLast7 = tasks.filter((t) => t.done && t.completedAt?.seconds >= sevenDaysAgoSeconds).length
  const tasksTotalLast7 = tasks.filter(
    (t) =>
      (t.done && t.completedAt?.seconds >= sevenDaysAgoSeconds) ||
      (!t.done && t.createdAt?.seconds >= sevenDaysAgoSeconds)
  ).length
  const nextEvent = events.find((e) => !e.private || e.ownerId === uid) || null
  const daysUntilNextEvent = nextEvent ? dayjs(nextEvent.date).diff(dayjs(today), 'day') : null

  const health = computeRelationshipHealth({
    weekCheckinDays,
    streak: couple?.streak || 0,
    appreciationsLast7,
    tasksDoneLast7,
    tasksTotalLast7,
    daysUntilNextEvent,
  })
  const healthCaption =
    health.score >= 70
      ? 'Every little effort builds a brighter us.'
      : health.score >= 40
      ? "You're building something good, together."
      : 'Small moments add up. Keep showing up.'

  // Sweep the ring in from 0 each time the view opens.
  useEffect(() => {
    if (!open) return undefined
    const id = setTimeout(() => setRingScore(health.score), 250)
    return () => clearTimeout(id)
  }, [open, health.score])

  const appreciationForMe = partnerUid ? jar.filter((n) => n.from === partnerUid) : []
  const lastAppreciation = appreciationForMe
    .slice()
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0]

  const loveLanguageInfo = LOVE_LANGUAGES.find((l) => l.value === partner?.loveLanguage)
  const partnerName = partner?.displayName || 'Your partner'
  const partnerOnline = isOnline(partner)
  const partnerSeen = lastSeenText(partner)

  const savedLayout = useMemo(() => normalizeLayout(profile?.connectionWidgets), [profile?.connectionWidgets])
  const layout = customizing && draft ? draft : savedLayout
  const visibleWidgets = layout.filter((w) => w.on)

  // --- actions -----------------------------------------------------------
  function go(path) {
    onClose()
    navigate(path)
  }

  async function toggleTask(task, el) {
    const ref = doc(db, 'couples', coupleId, 'tasks', task.id)
    try {
      if (task.done) {
        await updateDoc(ref, { done: false, completedAt: null, completedBy: null })
      } else {
        celebrateFrom(el)
        await updateDoc(ref, { done: true, completedAt: serverTimestamp(), completedBy: uid })
      }
    } catch {
      toast.error("Couldn't update that task — try again.")
    }
  }

  async function sendNudge() {
    if (!coupleId || nudgeSending || nudgeCooldown) return
    setNudgeSending(true)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'nudges'), { from: uid, createdAt: new Date() })
      haptic('light')
      toast.success(`Nudge sent to ${partnerName}.`)
      setNudgeCooldown(true)
      setTimeout(() => setNudgeCooldown(false), 60000)
    } catch {
      toast.error("Couldn't send that nudge — try again in a bit.")
    } finally {
      setNudgeSending(false)
    }
  }

  function startCustomizing() {
    setDraft(savedLayout)
    setCustomizing(true)
  }
  function moveWidget(index, dir) {
    setDraft((d) => {
      const next = d.slice()
      const j = index + dir
      if (j < 0 || j >= next.length) return d
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }
  function toggleWidget(id) {
    setDraft((d) => d.map((w) => (w.id === id ? { ...w, on: !w.on } : w)))
  }
  async function saveLayout() {
    if (!uid) return
    setSavingLayout(true)
    try {
      await setDoc(doc(db, 'users', uid), { connectionWidgets: draft }, { merge: true })
      haptic('success')
      toast.success('Layout saved')
      setCustomizing(false)
    } catch {
      toast.error("Couldn't save your layout — try again.")
    } finally {
      setSavingLayout(false)
    }
  }

  function onTouchStart(e) {
    touchXRef.current = e.touches[0].clientX
  }
  function onTouchEnd(e) {
    if (touchXRef.current == null) return
    const dx = e.changedTouches[0].clientX - touchXRef.current
    touchXRef.current = null
    if (dx > 70 && !customizing) onClose()
  }

  // --- styling helpers ---------------------------------------------------
  const panelBg = isLight ? 'bg-paper' : 'bg-plumdeep'
  const cardBg = isLight ? 'bg-white border border-black/10' : 'bg-white/[0.04] border border-white/10'
  const textMain = isLight ? 'text-plumdeep' : 'text-[#f3e6e8]'
  const textSoft = isLight ? 'text-[#9a8a9c]' : 'text-[#c9b6cb]'
  const iconBubble = isLight ? 'bg-[#faf6f8]' : 'bg-white/10'
  const label = `text-[11px] font-semibold uppercase tracking-wide ${textSoft}`

  const tk = { cardBg, label, iconBubble }

  // --- widgets -----------------------------------------------------------
  const WIDGET_RENDERERS = {
    moods: () => (
      <Card tk={tk} className="flex flex-col">
        <CardHeader tk={tk} icon={FiHeart} title="Moods today" />
        <div className="grid grid-cols-2 gap-3 flex-1">
          {[
            { who: 'You', entry: myCheckin, mine: true },
            { who: partnerName, entry: partnerCheckin, mine: false },
          ].map(({ who, entry, mine }) => {
            const m = MOODS.find((x) => x.v === entry?.mood)
            return (
              <motion.button
                key={`${who}-${entry?.id || 'none'}`}
                initial={{ scale: 0.96, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                onClick={() =>
                  entry ? go('/checkins') : mine ? go('/dashboard') : sendNudge()
                }
                className={`rounded-xl p-4 text-left flex flex-col justify-center ${isLight ? 'bg-[#faf6f8]' : 'bg-white/[0.04]'}`}
              >
                <div className={`text-[11px] font-semibold ${textSoft} truncate`}>{who}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  {m ? (
                    <MoodIcon mood={m.v} size={22} />
                  ) : (
                    <span className={`w-[22px] h-[22px] rounded-full border-2 border-dashed ${isLight ? 'border-black/15' : 'border-white/20'}`} />
                  )}
                  <span className={`font-semibold text-lg ${textMain}`}>{m ? m.l : 'Not yet'}</span>
                </div>
                <div className={`text-xs mt-1.5 leading-snug ${textSoft}`}>
                  {m
                    ? MOOD_BLURB[m.v]
                    : mine
                    ? 'Tap to check in for today.'
                    : nudgeCooldown
                    ? 'Nudge sent. Give them a moment.'
                    : nudgeSending
                    ? 'Sending a nudge…'
                    : (
                      <span className="inline-flex items-center gap-1 text-peach font-semibold">
                        <FiBell size={11} /> Send a gentle nudge
                      </span>
                    )}
                </div>
              </motion.button>
            )
          })}
        </div>
      </Card>
    ),

    health: () => (
      <Card tk={tk} className="flex flex-col items-center text-center">
        <div className="self-stretch">
          <CardHeader tk={tk} icon={FiHeart} title="Relationship health" />
        </div>
        <button
          onClick={() => setShowFactors((v) => !v)}
          aria-expanded={showFactors}
          aria-label="Show how relationship health is calculated"
          className="relative w-[140px] h-[140px] flex items-center justify-center"
        >
          <HealthRing score={ringScore} dark={!isLight} />
          <span className={`absolute inset-0 flex items-center justify-center font-serif text-3xl font-semibold ${textMain}`}>
            <CountUp value={ringScore} duration={1400} />%
          </span>
        </button>
        <p className={`text-sm mt-2 ${textSoft}`}>{healthCaption}</p>
        <button
          onClick={() => setShowFactors((v) => !v)}
          className="text-xs text-peach font-semibold mt-1.5 flex items-center gap-0.5"
        >
          {showFactors ? 'Hide the details' : 'See what this is made of'}
          <FiChevronRight size={12} className={`transition-transform ${showFactors ? 'rotate-90' : ''}`} />
        </button>
        <AnimatePresence>
          {showFactors && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`w-full mt-3 rounded-xl text-left overflow-hidden ${isLight ? 'bg-[#faf6f8]' : 'bg-white/[0.04]'}`}
            >
              <div className="p-3.5 space-y-2.5">
                {health.factors.map((f) => (
                  <div key={f.key} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className={textSoft}>{f.label}</span>
                      <span className={`font-semibold ${textMain}`}>{Math.round(f.value * 100)}%</span>
                    </div>
                    <div className={`h-1.5 rounded-full mt-1 overflow-hidden ${isLight ? 'bg-black/[0.06]' : 'bg-white/10'}`}>
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-peach to-gold"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(f.value * 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    ),

    question: () => (
      <DailyQuestion
        coupleId={coupleId}
        uid={uid}
        partnerUid={partnerUid}
        partnerName={partnerName}
        today={today}
        anchorId="connection-daily-question"
        className={`h-full ${isLight ? '' : '!bg-white/[0.04] !border-white/10'}`}
      />
    ),

    tasks: () => (
      <Card tk={tk} className="!p-2">
        <div className="px-3 pt-3">
          <CardHeader
            tk={tk}
            icon={FiCheck}
            title={`Your tasks${openMine.length ? ` · ${openMine.length} open` : ''}`}
            action={
              <button onClick={() => go('/tasks')} className="text-xs text-peach font-semibold flex items-center gap-0.5">
                View all <FiChevronRight size={12} />
              </button>
            }
          />
        </div>
        {shownTasks.length === 0 ? (
          <button onClick={() => go('/tasks')} className={`w-full text-sm text-left px-3 pb-3 ${textSoft}`}>
            No tasks yet. Tap to add one.
          </button>
        ) : (
          <AnimatePresence initial={false}>
            {shownTasks.map((t) => (
              <motion.button
                layout
                key={t.id}
                onClick={(e) => toggleTask(t, e.currentTarget)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 border-t text-left rounded-lg ${
                  isLight ? 'border-black/5 hover:bg-black/[0.02]' : 'border-white/5 hover:bg-white/[0.03]'
                }`}
              >
                <motion.span
                  animate={t.done ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                    t.done ? 'bg-peach border-peach' : isLight ? 'border-black/20' : 'border-white/25'
                  }`}
                >
                  {t.done && <FiCheck size={12} className="text-white" />}
                </motion.span>
                <span className={`text-sm truncate flex-1 ${t.done ? `${textSoft} line-through` : textMain}`}>{t.text}</span>
                {t.dueDate && !t.done && (
                  <span className={`text-[11px] flex-shrink-0 ${t.dueDate < today ? 'text-[#c0473c] font-semibold' : textSoft}`}>
                    {dayjs(t.dueDate).format('MMM D')}
                  </span>
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </Card>
    ),

    nextup: () => {
      const hasCountdown = events.some((e) => e.countdown)
      if (hasCountdown) return <CountdownCard events={events} className="h-full" />
      return (
        <Card tk={tk} onClick={() => go(nextEvent ? '/calendar' : '/date-ideas')}>
          <CardHeader tk={tk} icon={FiCalendar} title="Next up" action={<FiChevronRight size={14} className={textSoft} />} />
          {nextEvent ? (
            <>
              <div className={`font-serif text-xl font-semibold ${textMain}`}>{nextEvent.title}</div>
              <div className={`text-sm mt-1 ${textSoft}`}>
                {daysUntilNextEvent === 0
                  ? 'Today'
                  : daysUntilNextEvent === 1
                  ? 'Tomorrow'
                  : `In ${daysUntilNextEvent} days · ${dayjs(nextEvent.date).format('ddd, MMM D')}`}
                {nextEvent.time ? ` · ${nextEvent.time}` : ''}
              </div>
              <div className={`text-xs mt-3 flex items-center gap-1.5 ${textSoft}`}>
                <FiClock size={11} /> Tip: tick "Show a countdown" on an event to see a live countdown here.
              </div>
            </>
          ) : (
            <>
              <div className={`font-serif text-xl font-semibold ${textMain}`}>Nothing planned yet</div>
              <div className={`text-sm mt-1 ${textSoft}`}>Pick something from date ideas to look forward to.</div>
            </>
          )}
        </Card>
      )
    },

    appreciation: () => (
      <Card tk={tk} onClick={() => go('/memories?tab=jar')} className={isLight ? '!bg-[#fdf3e0] !border-transparent' : ''}>
        <CardHeader tk={tk} icon={FiGift} title="Appreciation for you" action={<FiChevronRight size={14} className={textSoft} />} />
        <div className={`font-serif text-3xl font-semibold ${textMain}`}>
          <CountUp value={appreciationForMe.length} />
        </div>
        <div className={`text-xs mt-1 line-clamp-2 ${textSoft}`}>
          {lastAppreciation ? `Latest: "${lastAppreciation.text}"` : `${partnerName} hasn't sent one yet.`}
        </div>
      </Card>
    ),

    streak: () => (
      <Card tk={tk} onClick={() => go('/insights')}>
        <CardHeader tk={tk} icon={FaFire} title="Streak" action={<FiChevronRight size={14} className={textSoft} />} />
        <div className={`flex items-end gap-2 ${textMain}`}>
          <FaFire size={26} className="text-peach lv-flicker mb-1" />
          <span className="font-serif text-3xl font-semibold">
            <CountUp value={couple?.streak || 0} />
          </span>
          <span className={`text-sm mb-1 ${textSoft}`}>day{couple?.streak === 1 ? '' : 's'}</span>
        </div>
        <div className={`text-xs mt-1.5 ${textSoft}`}>
          Best: {Math.max(couple?.longestStreak || 0, couple?.streak || 0)} days.{' '}
          {myCheckin && partnerCheckin ? 'You both showed up today.' : 'Check in together to keep it going.'}
        </div>
      </Card>
    ),

    onthisday: () => (
      <OnThisDay
        coupleId={coupleId}
        names={{ [uid]: profile?.displayName, ...(partner ? { [partner.id]: partner.displayName } : {}) }}
        className={`h-full ${isLight ? '' : '!bg-white/[0.04] !border-white/10'}`}
        emptyFallback={
          <Card tk={tk} onClick={() => go('/memories')}>
            <CardHeader tk={tk} icon={FiClock} title="On this day" />
            <div className={`text-sm ${textSoft}`}>
              Nothing from this day yet. Add a photo today and it'll come back to you next year.
            </div>
          </Card>
        }
      />
    ),

    lovelanguage: () => (
      <Card tk={tk} onClick={() => go('/profile')} className={isLight ? '!bg-blush !border-transparent' : ''}>
        <CardHeader tk={tk} icon={FiHeart} title={`${partnerName}'s love language`} action={<FiChevronRight size={14} className={textSoft} />} />
        <div className={`font-semibold text-lg ${textMain}`}>{partner?.loveLanguage || 'Not set yet'}</div>
        <div className={`text-xs mt-1 leading-snug ${textSoft}`}>
          {loveLanguageInfo
            ? loveLanguageInfo.description.replace(/^Feels/, 'They feel')
            : "They haven't shared one yet. Ask them to add it on their profile."}
        </div>
      </Card>
    ),

    goals: () => (
      <Card tk={tk} onClick={() => go('/goals')} className={`text-center ${isLight ? '!bg-[#eef4ea] !border-transparent' : ''}`}>
        <div className={`w-9 h-9 rounded-full mx-auto flex items-center justify-center ${isLight ? 'bg-white' : 'bg-white/10'}`}>
          <FiTarget size={16} className="text-[#6e8f73]" />
        </div>
        <h3 className={`text-sm font-semibold mt-2.5 ${textMain}`}>Keep building together</h3>
        <p className={`text-xs mt-1.5 leading-relaxed ${textSoft}`}>See your shared goals and what's next.</p>
      </Card>
    ),
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Your connection"
          data-lv-on
          className={`fixed inset-0 z-50 overflow-y-auto ${panelBg}`}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* ---------- header ---------- */}
          <div
            className={`sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-9 py-3 lg:py-4 border-b pt-[calc(0.75rem+env(safe-area-inset-top))] ${
              isLight ? 'bg-paper/95 border-black/10' : 'bg-plumdeep/95 border-white/10'
            } backdrop-blur`}
          >
            <button
              onClick={onClose}
              className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl border ${
                isLight ? 'border-black/10 text-plumdeep' : 'border-white/15 text-[#f3e6e8]'
              }`}
            >
              <FiArrowLeft size={15} /> Back
            </button>
            <div className="flex items-center gap-2">
              <FaHeart className="text-peach" size={16} />
              <span className={`font-serif font-semibold text-lg ${textMain}`}>Us</span>
            </div>
            {customizing ? (
              <button
                onClick={() => setCustomizing(false)}
                className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border ${
                  isLight ? 'border-black/10 text-plumdeep' : 'border-white/15 text-[#f3e6e8]'
                }`}
              >
                <FiX size={14} /> Cancel
              </button>
            ) : (
              <button
                onClick={startCustomizing}
                className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border ${
                  isLight ? 'border-black/10 text-plumdeep' : 'border-white/15 text-[#f3e6e8]'
                }`}
              >
                <FiSliders size={14} /> <span className="hidden sm:inline">Customize</span>
              </button>
            )}
          </div>

          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-9 py-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
            {/* ---------- customize panel ---------- */}
            <AnimatePresence initial={false}>
              {customizing && draft && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`rounded-2xl p-4 sm:p-5 mb-6 ${cardBg}`} data-lv-off>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <div className={`font-semibold ${textMain}`}>Customize your view</div>
                        <div className={`text-xs ${textSoft}`}>
                          Turn widgets on or off and move them up or down. Only you see your layout.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDraft(DEFAULT_LAYOUT)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border ${
                            isLight ? 'border-black/10 text-[#7a6a7c]' : 'border-white/15 text-[#c9b6cb]'
                          }`}
                        >
                          <FiRotateCcw size={12} /> Reset
                        </button>
                        <button
                          onClick={saveLayout}
                          disabled={savingLayout}
                          className="px-4 py-2 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60"
                        >
                          {savingLayout ? 'Saving…' : 'Done'}
                        </button>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-2 max-w-2xl">
                      {draft.map((w, i) => {
                        const meta = widgetMeta(w.id)
                        if (!meta) return null
                        const Icon = meta.icon
                        return (
                          <motion.li
                            layout
                            key={w.id}
                            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                              isLight ? 'bg-[#faf6f8]' : 'bg-white/[0.04]'
                            } ${w.on ? '' : 'opacity-55'}`}
                          >
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isLight ? 'bg-white' : 'bg-white/10'}`}>
                              <Icon size={14} className="text-peach" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-semibold truncate ${textMain}`}>{meta.label}</div>
                              <div className={`text-[11px] truncate ${textSoft}`}>{meta.hint}</div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => moveWidget(i, -1)}
                                disabled={i === 0}
                                aria-label={`Move ${meta.label} up`}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-25 ${textSoft} hover:bg-black/5`}
                              >
                                <FiArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => moveWidget(i, 1)}
                                disabled={i === draft.length - 1}
                                aria-label={`Move ${meta.label} down`}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-25 ${textSoft} hover:bg-black/5`}
                              >
                                <FiArrowDown size={14} />
                              </button>
                              <button
                                role="switch"
                                aria-checked={w.on}
                                aria-label={`${w.on ? 'Hide' : 'Show'} ${meta.label}`}
                                onClick={() => toggleWidget(w.id)}
                                className={`relative w-10 h-6 rounded-full transition-colors ml-1 ${
                                  w.on ? 'bg-peach' : isLight ? 'bg-black/15' : 'bg-white/20'
                                }`}
                              >
                                <motion.span
                                  layout
                                  transition={{ type: 'spring', stiffness: 600, damping: 32 }}
                                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow ${w.on ? 'right-1' : 'left-1'}`}
                                />
                              </button>
                            </div>
                          </motion.li>
                        )
                      })}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ---------- hero: you · us, right now · partner ---------- */}
            <div className="grid grid-cols-2 lg:grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-4 lg:gap-8 items-center mb-6">
              <div className="flex items-center gap-3 min-w-0 lg:justify-self-start">
                <Avatar name={profile?.displayName} photoURL={profile?.photoURL} online size={heroAvatar} />
                <div className="min-w-0">
                  <div className={label}>You</div>
                  <div className={`font-serif text-lg sm:text-xl font-semibold truncate ${textMain}`}>{profile?.displayName}</div>
                  <div className={`text-xs mt-0.5 ${textSoft}`}>
                    {myCheckin ? 'Checked in today' : "Haven't checked in yet"}
                  </div>
                </div>
              </div>

              <div className={`col-span-2 lg:col-span-1 order-last lg:order-none rounded-2xl px-6 py-4 flex flex-col items-center text-center ${cardBg}`}>
                <div className={label}>Us, right now</div>
                <div className="flex items-center gap-3 mt-2.5">
                  <ThinkingOfYouButton light={isLight} className="!w-11 !h-11 !rounded-full" />
                  <div className="text-left">
                    <div className={`text-sm font-semibold ${textMain}`}>Thinking of you</div>
                    <div className={`text-xs ${textSoft}`}>Tap to send {partnerName} a heart</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 min-w-0 justify-self-end flex-row-reverse text-right">
                {partner ? (
                  <>
                    <Avatar name={partner.displayName} photoURL={partner.photoURL} online={partnerOnline} size={heroAvatar} />
                    <div className="min-w-0">
                      <div className={label}>Your partner</div>
                      <div className={`font-serif text-lg sm:text-xl font-semibold truncate ${textMain}`}>{partner.displayName}</div>
                      <div className={`text-xs mt-0.5 ${partnerOnline ? 'text-[#2f9e68] font-semibold' : textSoft}`}>
                        {partnerSeen || 'Not seen yet'}
                      </div>
                    </div>
                  </>
                ) : (
                  <button onClick={() => go('/link')} className={`text-sm ${textSoft}`}>
                    Waiting for your partner. <span className="text-peach font-semibold">Share your invite code</span>
                  </button>
                )}
              </div>
            </div>

            {/* ---------- widgets ---------- */}
            {visibleWidgets.length === 0 ? (
              <div className={`rounded-2xl p-8 text-center ${cardBg}`}>
                <div className={`font-semibold ${textMain}`}>All widgets are hidden</div>
                <button onClick={startCustomizing} className="text-sm text-peach font-semibold mt-1">
                  Customize to add some back
                </button>
              </div>
            ) : (
              <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 grid-flow-row-dense">
                <AnimatePresence initial={false}>
                  {visibleWidgets.map((w) => {
                    const meta = widgetMeta(w.id)
                    const render = WIDGET_RENDERERS[w.id]
                    if (!meta || !render) return null
                    return (
                      <motion.div
                        layout
                        key={w.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className={`min-w-0 ${meta.wide ? 'md:col-span-2' : ''}`}
                      >
                        {render()}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </motion.div>
            )}

            <div className={`text-center text-xs mt-8 lg:hidden flex items-center justify-center gap-1.5 ${textSoft}`}>
              <FiChevronRight className="rotate-180" size={12} />
              Swipe right to go back
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Exported for tests / other screens that want the same list.
export { CONNECTION_WIDGETS }
