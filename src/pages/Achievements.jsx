import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore'
import toast from 'react-hot-toast'
import {
  FiAward,
  FiBookOpen,
  FiCheckSquare,
  FiHeart,
  FiImage,
  FiList,
  FiLock,
  FiMail,
  FiMessageCircle,
  FiMusic,
  FiSun,
  FiUsers,
} from 'react-icons/fi'
import { FaFire, FaLeaf } from 'react-icons/fa'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { ACHIEVEMENTS, evaluateAchievements } from '../utils/achievements'

// Per-achievement icon, keyed by id — purely decorative, falls back to a
// generic award/lock in the shared TimelineNode / AchievementRow below.
const ICONS = {
  'first-note': FiMail,
  'streak-3': FaFire,
  'streak-7': FaFire,
  'streak-30': FaFire,
  'streak-100': FaFire,
  'checkins-30': FiSun,
  'jar-25': FiHeart,
  'jar-100': FiHeart,
  'chat-50': FiMessageCircle,
  'chat-500': FiMessageCircle,
  'memories-10': FiImage,
  'memories-50': FiImage,
  'tasks-25': FiCheckSquare,
  'journal-10': FiBookOpen,
  'bucket-5': FiList,
  'playlist-1': FiMusic,
  'playlist-20': FiMusic,
}

const CATEGORIES = [
  { key: 'daily', label: 'Daily rhythm', subtitle: 'Little habits, big love.', icon: FiSun, tone: '#e8ab3c' },
  { key: 'shared', label: 'Shared moments', subtitle: 'More moments, brighter days.', icon: FiUsers, tone: '#1f7a68' },
  { key: 'growing', label: 'Growing together', subtitle: 'A brighter tomorrow, together.', icon: FaLeaf, tone: '#4a9b6e' },
]

// Up to this many *locked* achievements get a preview slot at the end of
// the timeline, so there's always something to look forward to even once
// every unlocked badge has been earned.
const TIMELINE_PREVIEW_COUNT = 4

function TimelineNode({ a, unlocked, isLast }) {
  const Icon = ICONS[a.id] || FiAward
  return (
    <div className="flex-1 relative flex flex-col items-center min-w-[92px]">
      {!isLast && (
        <div
          className={`absolute top-[22px] left-1/2 w-full h-0.5 ${
            unlocked ? 'bg-peach/50' : 'border-t-2 border-dashed border-black/15'
          }`}
        />
      )}
      <div
        className={`relative w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
          unlocked ? 'bg-gradient-to-br from-peach to-gold text-plumdeep' : 'bg-black/5 text-[#9a8a9c] border border-black/10'
        }`}
      >
        {unlocked ? <Icon size={18} /> : <FiLock size={15} />}
      </div>
      {unlocked && (
        <>
          <div className="mt-2.5 text-xs font-semibold text-center px-1">{a.title}</div>
          <div className="text-[10px] text-[#9a8a9c] text-center mt-0.5 px-2 leading-snug">{a.description}</div>
        </>
      )}
    </div>
  )
}

function AchievementRow({ a, current, target, pct }) {
  return (
    <div className="py-3.5 border-b border-black/10 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-sm">{a.title}</span>
        <span className="text-xs text-[#9a8a9c] font-medium flex-shrink-0">
          {Math.min(current, target)}/{target}
        </span>
      </div>
      <p className="text-xs text-[#9a8a9c] mt-0.5">{a.description}</p>
      <div className="mt-2 h-2 rounded-full bg-black/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-peach to-gold transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function Achievements() {
  const { couple } = useAuth()
  const coupleId = couple?.id

  const [jarCount, setJarCount] = useState(0)
  const [messageCount, setMessageCount] = useState(0)
  const [memoriesCount, setMemoriesCount] = useState(0)
  const [tasksDoneCount, setTasksDoneCount] = useState(0)
  const [journalCount, setJournalCount] = useState(0)
  const [bucketDoneCount, setBucketDoneCount] = useState(0)
  const [checkinsCount, setCheckinsCount] = useState(0)
  const [playlistCount, setPlaylistCount] = useState(0)

  useEffect(() => {
    if (!coupleId) return
    const unsubs = [
      onSnapshot(collection(db, 'couples', coupleId, 'jar'), (s) => setJarCount(s.size)),
      onSnapshot(collection(db, 'couples', coupleId, 'messages'), (s) => setMessageCount(s.size)),
      onSnapshot(collection(db, 'couples', coupleId, 'memories'), (s) => setMemoriesCount(s.size)),
      onSnapshot(collection(db, 'couples', coupleId, 'tasks'), (s) =>
        setTasksDoneCount(s.docs.filter((d) => d.data().done).length)
      ),
      onSnapshot(collection(db, 'couples', coupleId, 'journalEntries'), (s) => setJournalCount(s.size)),
      onSnapshot(collection(db, 'couples', coupleId, 'bucketList'), (s) =>
        setBucketDoneCount(s.docs.filter((d) => d.data().done).length)
      ),
      onSnapshot(collection(db, 'couples', coupleId, 'checkins'), (s) => setCheckinsCount(s.size)),
      onSnapshot(collection(db, 'couples', coupleId, 'playlist'), (s) => setPlaylistCount(s.size)),
    ]
    return () => unsubs.forEach((u) => u())
  }, [coupleId])

  const stats = useMemo(
    () => ({
      streak: couple?.streak || 0,
      jarCount,
      messageCount,
      memoriesCount,
      tasksDoneCount,
      journalCount,
      bucketDoneCount,
      checkinsCount,
      playlistCount,
    }),
    [
      couple?.streak,
      jarCount,
      messageCount,
      memoriesCount,
      tasksDoneCount,
      journalCount,
      bucketDoneCount,
      checkinsCount,
      playlistCount,
    ]
  )

  const unlockedNow = useMemo(() => evaluateAchievements(stats), [stats])
  const previouslyUnlocked = couple?.unlockedAchievements || []

  // Persist newly-crossed achievements once, and celebrate them. This only
  // fires the toast the first time an id appears — after it's written to
  // the couple doc, `previouslyUnlocked` includes it on every future render.
  useEffect(() => {
    if (!coupleId) return
    const newlyUnlocked = unlockedNow.filter((id) => !previouslyUnlocked.includes(id))
    if (newlyUnlocked.length === 0) return

    updateDoc(doc(db, 'couples', coupleId), {
      unlockedAchievements: arrayUnion(...newlyUnlocked),
    }).catch(() => {})

    newlyUnlocked.forEach((id) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id)
      if (a) toast.success(`🏆 Achievement unlocked: ${a.title}!`)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, unlockedNow.join(',')])

  const unlockedSet = new Set([...previouslyUnlocked, ...unlockedNow])
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)).length
  const totalCount = ACHIEVEMENTS.length
  const overallPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0

  // Timeline: every unlocked achievement (in definition order) followed by
  // a handful of upcoming locked ones as a preview of what's next.
  const timelineItems = useMemo(() => {
    const unlocked = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id))
    const locked = ACHIEVEMENTS.filter((a) => !unlockedSet.has(a.id)).slice(0, TIMELINE_PREVIEW_COUNT)
    return [...unlocked, ...locked]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedCount])

  // Category columns only need the locked (in-progress) achievements —
  // unlocked ones already have their moment in the timeline above.
  const columns = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: ACHIEVEMENTS.filter((a) => a.category === cat.key && !unlockedSet.has(a.id)),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedCount])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Achievements</h1>
          <p className="text-sm text-[#7a6a7c]">Celebrate your journey, one milestone at a time.</p>
        </div>
        <div className="flex-shrink-0 w-full sm:w-52">
          <div className="text-sm font-semibold text-right mb-1.5">
            {unlockedCount} of {totalCount} unlocked
          </div>
          <div className="h-2 rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-peach to-gold transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </div>

      {timelineItems.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-6 mb-4 overflow-x-auto">
          <div className="flex items-start min-w-[640px]">
            {timelineItems.map((a, i) => (
              <TimelineNode
                key={a.id}
                a={a}
                unlocked={unlockedSet.has(a.id)}
                isLast={i === timelineItems.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const Icon = col.icon
          return (
            <div key={col.key} className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-1">
                <Icon size={22} style={{ color: col.tone }} className="flex-shrink-0" />
                <h3 className="font-semibold text-base">{col.label}</h3>
              </div>
              <p className="text-xs text-[#9a8a9c] mb-1">{col.subtitle}</p>

              {col.items.length === 0 ? (
                <div className="flex items-center gap-2 py-6 text-sm text-[#9a8a9c]">
                  <FiAward size={16} className="text-peach flex-shrink-0" />
                  All caught up in this category!
                </div>
              ) : (
                col.items.map((a) => {
                  const [current, target] = a.progress ? a.progress(stats) : [0, 1]
                  const pct = Math.min(100, Math.round((current / target) * 100))
                  return <AchievementRow key={a.id} a={a} current={current} target={target} pct={pct} />
                })
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}