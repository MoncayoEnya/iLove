import { useEffect, useRef, useState } from 'react'
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
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  FiCheck,
  FiChevronRight,
  FiFrown,
  FiGift,
  FiHeart,
  FiMeh,
  FiSmile,
  FiTarget,
  FiX,
} from 'react-icons/fi'
import { FaFire, FaHeart } from 'react-icons/fa'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { usePartner } from '../hooks/usePartner'
import { MOODS } from '../utils/moods'
import { todayStr } from '../utils/date'
import { computeRelationshipHealth } from '../utils/relationshipHealth'
import { LOVE_LANGUAGES } from '../lib/schemas'

// Same gradient ring used on the Dashboard's relationship-pulse card, kept
// local here too since Dashboard defines its own rather than importing
// components/HealthRing (that shared one is tuned for dark cards, not a
// plain paper background).
function HealthRing({ score, size = 150 }) {
  const stroke = 11
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
        stroke="url(#connectionHealthGradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
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

// amazing/good -> smile, okay -> meh, sad/hard -> frown — same mapping the
// Dashboard uses, so a mood reads the same icon everywhere in the app.
function moodIconFor(v) {
  if (v === 'amazing' || v === 'good') return FiSmile
  if (v === 'okay') return FiMeh
  if (v === 'sad' || v === 'hard') return FiFrown
  return FiMeh
}

// One short line of context per mood, shown under "Your mood" / their mood —
// separate from the MOODS list itself so this stays presentation-only.
const MOOD_BLURB = {
  amazing: 'Full, warm, and glowing today.',
  good: 'Grateful, present, and keeping going.',
  okay: "A steady kind of day — and that's fine.",
  sad: 'A harder day. Worth a gentle check-in.',
  hard: 'A tough one — be extra kind to each other.',
}

function Avatar({ name, photoURL, size = 56 }) {
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep font-semibold border-2 border-white shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {photoURL ? (
        <img src={photoURL} alt="" className="w-full h-full object-cover" />
      ) : (
        (name || '?')[0]?.toUpperCase()
      )}
    </div>
  )
}

// A stat tile that's either a plain readout (no onPress) or a real,
// pressable row — the chevron only shows up when it actually does
// something, so nothing on screen looks tappable without being tappable.
function StatCard({ tone, isLight, icon: Icon, label, value, sub, onPress }) {
  const wash =
    tone === 'rose'
      ? isLight
        ? 'bg-blush'
        : 'bg-peach/10'
      : isLight
      ? 'bg-[#faf6f8]'
      : 'bg-white/[0.04]'
  const Tag = onPress ? 'button' : 'div'
  return (
    <Tag
      onClick={onPress}
      className={`rounded-2xl p-4 text-left ${wash} ${
        onPress ? 'transition-transform active:scale-[0.97] hover:brightness-[0.98] cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isLight ? 'bg-white' : 'bg-white/10'
          }`}
        >
          <Icon size={15} className="text-peach" />
        </div>
        {onPress && <FiChevronRight size={14} className={isLight ? 'text-black/25' : 'text-white/25'} />}
      </div>
      <div className={`text-[11px] font-semibold uppercase tracking-wide mt-3 ${isLight ? 'text-[#9a8a9c]' : 'text-[#c9b6cb]'}`}>
        {label}
      </div>
      <div
        className={`font-semibold mt-0.5 leading-tight ${isLight ? 'text-plumdeep' : 'text-[#f3e6e8]'}`}
        style={{ fontSize: value.length > 13 ? '1.05rem' : '1.3rem' }}
      >
        {value}
      </div>
      <div className={`text-xs mt-1.5 leading-snug ${isLight ? 'text-[#9a8a9c]' : 'text-[#a894ab]'}`}>{sub}</div>
    </Tag>
  )
}

export default function ConnectionView({ open, onClose }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const { firebaseUser, profile, couple } = useAuth()
  const { partner, partnerUid } = usePartner()
  const navigate = useNavigate()
  const coupleId = couple?.id
  const today = todayStr()
  const touchXRef = useRef(null)

  const [tasks, setTasks] = useState([])
  const [jar, setJar] = useState([])
  const [weekCheckins, setWeekCheckins] = useState([])
  const [events, setEvents] = useState([])
  const [showFactors, setShowFactors] = useState(false)
  const [nudgeSending, setNudgeSending] = useState(false)
  const [nudgeCooldown, setNudgeCooldown] = useState(false)

  const sevenDaysAgo = dayjs().subtract(6, 'day').format('YYYY-MM-DD')

  // Only listen while the panel is actually open — this view can mount on
  // every page via AppLayout, so there's no reason to keep four extra
  // snapshot listeners alive when the person never opens it.
  useEffect(() => {
    if (!open || !coupleId) return
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
        setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.date >= today))
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [open, coupleId, today, sevenDaysAgo])

  // Reset the expanded breakdown each time the panel opens fresh.
  useEffect(() => {
    if (!open) setShowFactors(false)
  }, [open])

  const todaysCheckins = weekCheckins.filter((c) => c.date === today)
  const myCheckin = todaysCheckins.find((c) => c.uid === firebaseUser?.uid)
  const partnerCheckin = todaysCheckins.find((c) => c.uid !== firebaseUser?.uid && partnerUid)

  const mineTasks = tasks.filter((t) => t.assignedTo === firebaseUser?.uid || !t.assignedTo)
  const upcomingMine = mineTasks
    .slice()
    .sort((a, b) => Number(a.done) - Number(b.done))
    .slice(0, 3)

  // --- Relationship health, computed the same way as the dashboard -----
  const sevenDaysAgoSeconds = dayjs().subtract(7, 'day').unix()
  const weekCheckinDays = new Set(weekCheckins.map((c) => c.date)).size
  const appreciationsLast7 = jar.filter((n) => (n.createdAt?.seconds || 0) >= sevenDaysAgoSeconds).length
  const tasksDoneLast7 = tasks.filter((t) => t.done && t.completedAt?.seconds >= sevenDaysAgoSeconds).length
  const tasksTotalLast7 = tasks.filter(
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
  const healthCaption =
    health.score >= 70
      ? 'Every little effort builds a brighter us.'
      : health.score >= 40
      ? "You're building something good, together."
      : 'Small moments add up. Keep showing up.'

  // Notes the partner has dropped for you — "from" is whoever wrote it.
  const appreciationForMe = partnerUid ? jar.filter((n) => n.from === partnerUid) : []
  const lastAppreciation = appreciationForMe
    .slice()
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0]

  const loveLanguageInfo = LOVE_LANGUAGES.find((l) => l.value === partner?.loveLanguage)
  const loveLanguageBlurb = loveLanguageInfo
    ? loveLanguageInfo.description.replace(/^Feels/, 'They feel')
    : "They haven't shared a love language yet."

  async function toggleTask(task) {
    const ref = doc(db, 'couples', coupleId, 'tasks', task.id)
    if (task.done) {
      await updateDoc(ref, { done: false, completedAt: null, completedBy: null })
    } else {
      await updateDoc(ref, { done: true, completedAt: serverTimestamp(), completedBy: firebaseUser.uid })
    }
  }

  // Navigates to another page and closes the panel behind it — used by
  // every stat card below so tapping one always goes somewhere real.
  function go(path) {
    onClose()
    navigate(path)
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

  function onTouchStart(e) {
    touchXRef.current = e.touches[0].clientX
  }
  function onTouchEnd(e) {
    if (touchXRef.current == null) return
    const dx = e.changedTouches[0].clientX - touchXRef.current
    touchXRef.current = null
    if (dx > 70) onClose()
  }

  const MyMoodIcon = moodIconFor(myCheckin?.mood)
  const PartnerMoodIcon = moodIconFor(partnerCheckin?.mood)

  const panelBg = isLight ? 'bg-paper' : 'bg-plumdeep'
  const cardBg = isLight ? 'bg-white border border-black/10' : 'bg-white/[0.04] border border-white/10'
  const textMain = isLight ? 'text-plumdeep' : 'text-[#f3e6e8]'
  const textSoft = isLight ? 'text-[#9a8a9c]' : 'text-[#c9b6cb]'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Your connection"
          className={`fixed inset-0 z-50 overflow-y-auto ${panelBg}`}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className={`sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-9 py-3 lg:py-4 border-b pt-[calc(0.75rem+env(safe-area-inset-top))] ${
              isLight ? 'bg-paper border-black/10' : 'bg-plumdeep border-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <FaHeart className="text-peach" size={18} />
              <span className={`font-serif font-semibold text-lg ${textMain}`}>iLove</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close connection view"
              className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border transition-transform active:scale-[0.96] ${
                isLight ? 'border-black/10 hover:bg-black/5' : 'border-white/15 hover:bg-white/5'
              }`}
            >
              <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size={28} />
              <span className={`text-sm font-semibold ${textMain}`}>{profile?.displayName}</span>
              <FiX size={14} className={textSoft} />
            </button>
          </div>

          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-9 py-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_1fr] gap-6 lg:gap-8 items-start">
              {/* ---------------- YOU ---------------- */}
              <div className="flex flex-col gap-4 min-w-0">
                <div className="flex items-center gap-3.5">
                  <Avatar name={profile?.displayName} photoURL={profile?.photoURL} />
                  <div className="min-w-0">
                    <div className={`text-[11px] font-semibold uppercase tracking-wide ${textSoft}`}>You</div>
                    <div className={`font-serif text-xl font-semibold truncate ${textMain}`}>{profile?.displayName}</div>
                    <div className={`text-xs italic font-serif mt-0.5 ${textSoft}`}>Growing a little every day.</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    isLight={isLight}
                    tone="peach"
                    icon={FaFire}
                    label="Streak"
                    value={`${couple?.streak || 0} day${couple?.streak === 1 ? '' : 's'}`}
                    sub="You're showing up! Keep it going."
                    onPress={() => go('/insights')}
                  />
                  <StatCard
                    isLight={isLight}
                    tone="peach"
                    icon={MyMoodIcon}
                    label="Your mood"
                    value={myCheckin ? MOODS.find((m) => m.v === myCheckin.mood)?.l || 'Good' : 'Not yet'}
                    sub={myCheckin ? MOOD_BLURB[myCheckin.mood] || 'Checked in today.' : 'Tap to check in for today.'}
                    onPress={() => go(myCheckin ? '/checkins' : '/dashboard')}
                  />
                </div>

                <div className={`rounded-2xl p-2 ${cardBg}`}>
                  <div className="flex items-center justify-between px-3 pt-2 pb-1">
                    <h3 className={`text-sm font-semibold ${textMain}`}>Your tasks</h3>
                    <button
                      onClick={() => go('/tasks')}
                      className="text-xs text-peach font-semibold flex items-center gap-0.5 transition-opacity active:opacity-60"
                    >
                      View all <FiChevronRight size={12} />
                    </button>
                  </div>
                  {upcomingMine.length === 0 ? (
                    <button
                      onClick={() => go('/tasks')}
                      className={`w-full text-sm text-left px-3 py-3 transition-opacity active:opacity-60 ${textSoft}`}
                    >
                      No tasks yet — tap to add one.
                    </button>
                  ) : (
                    upcomingMine.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => toggleTask(t)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 border-t text-left transition-colors active:opacity-70 ${
                          isLight ? 'border-black/5 hover:bg-black/[0.02]' : 'border-white/5 hover:bg-white/[0.03]'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                            t.done ? 'bg-peach border-peach' : isLight ? 'border-black/20' : 'border-white/25'
                          }`}
                        >
                          {t.done && <FiCheck size={12} className="text-white" />}
                        </span>
                        <span className={`text-sm truncate ${t.done ? textSoft + ' line-through' : textMain}`}>
                          {t.text}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* ---------------- CONNECTION ---------------- */}
              <div className="flex flex-col items-center text-center gap-1 lg:pt-1">
                <div className={`text-xs font-semibold uppercase tracking-wide ${textSoft}`}>Our connection</div>
                <FaHeart className="text-peach my-2" size={20} />
                <div className={`w-px h-8 ${isLight ? 'bg-black/10' : 'bg-white/10'}`} />

                <div className={`text-xs font-semibold uppercase tracking-wide mt-4 ${textSoft}`}>
                  Relationship health
                </div>
                <button
                  onClick={() => setShowFactors((v) => !v)}
                  aria-expanded={showFactors}
                  aria-label="Show how relationship health is calculated"
                  className="relative w-[150px] h-[150px] my-3 flex items-center justify-center transition-transform active:scale-[0.97]"
                >
                  <HealthRing score={health.score} size={150} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`font-serif text-3xl font-semibold ${textMain}`}>{health.score}%</span>
                  </div>
                </button>
                <p className={`text-sm max-w-[180px] ${textSoft}`}>{healthCaption}</p>
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
                      className={`w-full mt-3 rounded-2xl text-left overflow-hidden ${isLight ? 'bg-[#faf6f8]' : 'bg-white/[0.04]'}`}
                    >
                      <div className="p-4 space-y-2">
                        {health.factors.map((f) => (
                          <div key={f.key} className="flex items-center justify-between text-xs">
                            <span className={textSoft}>{f.label}</span>
                            <span className={`font-semibold ${textMain}`}>{Math.round(f.value * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className={`text-sm leading-[2.1] mt-5 font-semibold ${textMain}`}>
                  <div>Same Team</div>
                  <div>Brighter Days</div>
                  <div>More Us</div>
                </div>
                <FaHeart className="text-peach mt-2" size={14} />
              </div>

              {/* ---------------- PARTNER ---------------- */}
              <div className="flex flex-col gap-4 min-w-0">
                {!partner ? (
                  <div className={`rounded-2xl p-6 text-center ${cardBg}`}>
                    <p className={`text-sm ${textSoft}`}>
                      Waiting for your partner to join with your invite code.
                    </p>
                    <button onClick={() => go('/link')} className="text-xs text-peach font-semibold mt-2">
                      Go to invite code
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3.5">
                      <Avatar name={partner?.displayName} photoURL={partner?.photoURL} />
                      <div className="min-w-0">
                        <div className={`text-[11px] font-semibold uppercase tracking-wide ${textSoft}`}>
                          Your partner
                        </div>
                        <div className={`font-serif text-xl font-semibold truncate ${textMain}`}>
                          {partner?.displayName}
                        </div>
                        <div className={`text-xs italic font-serif mt-0.5 ${textSoft}`}>Different paths, same heart.</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <StatCard
                        isLight={isLight}
                        tone="rose"
                        icon={FiHeart}
                        label="Love language"
                        value={partner?.loveLanguage || 'Not set yet'}
                        sub={loveLanguageBlurb}
                        onPress={() => go('/profile')}
                      />
                      <StatCard
                        isLight={isLight}
                        tone="peach"
                        icon={PartnerMoodIcon}
                        label="Their mood"
                        value={partnerCheckin ? MOODS.find((m) => m.v === partnerCheckin.mood)?.l || 'Okay' : 'Not yet'}
                        sub={
                          partnerCheckin
                            ? MOOD_BLURB[partnerCheckin.mood] || `${partner.displayName} checked in today.`
                            : nudgeCooldown
                            ? 'Nudge sent — tap again later.'
                            : nudgeSending
                            ? 'Sending a nudge…'
                            : 'Tap to send a gentle nudge.'
                        }
                        onPress={partnerCheckin ? () => go('/checkins') : sendNudge}
                      />
                    </div>

                    <button
                      onClick={() => go('/memories?tab=jar')}
                      className={`w-full rounded-2xl p-4 flex items-center gap-4 text-left transition-transform active:scale-[0.98] ${
                        isLight ? 'bg-[#fdf3e0] hover:brightness-[0.98]' : 'bg-gold/10 hover:bg-gold/[0.14]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isLight ? 'bg-white' : 'bg-white/10'}`}>
                        <FiGift size={16} className="text-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-semibold uppercase tracking-wide ${textSoft}`}>
                          Appreciation for you
                        </div>
                        <div className={`font-serif text-2xl font-semibold ${textMain}`}>{appreciationForMe.length}</div>
                        <div className={`text-xs mt-0.5 truncate ${textSoft}`}>
                          {lastAppreciation ? `Latest: "${lastAppreciation.text}"` : "They haven't sent one yet."}
                        </div>
                      </div>
                      <FiChevronRight size={14} className={`flex-shrink-0 ${isLight ? 'text-black/25' : 'text-white/25'}`} />
                    </button>

                    <button
                      onClick={() => go('/goals')}
                      className={`w-full rounded-2xl p-5 text-center transition-transform active:scale-[0.98] ${
                        isLight ? 'bg-[#eef4ea] hover:brightness-[0.98]' : 'bg-white/[0.04] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full mx-auto flex items-center justify-center ${isLight ? 'bg-white' : 'bg-white/10'}`}>
                        <FiTarget size={16} className="text-[#6e8f73]" />
                      </div>
                      <h3 className={`text-sm font-semibold mt-2.5 ${textMain}`}>Keep building together</h3>
                      <p className={`text-xs mt-1.5 leading-relaxed ${textSoft}`}>
                        Check in, complete tasks, and show appreciation — see your shared goals for what's next.
                      </p>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className={`text-center text-xs mt-8 flex items-center justify-center gap-1.5 ${textSoft}`}>
              <FiChevronRight className="rotate-180" size={12} />
              swipe right or tap your name to go back
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}