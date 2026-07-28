import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { FiAward, FiLock } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { ACHIEVEMENTS, evaluateAchievements } from '../utils/achievements'

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Achievements</h1>
        <p className="text-sm text-[#7a6a7c]">
          {unlockedCount} of {ACHIEVEMENTS.length} unlocked — earned by doing what you already do together.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = unlockedSet.has(a.id)
          const [current, target] = a.progress ? a.progress(stats) : [0, 1]
          const pct = Math.min(100, Math.round((current / target) * 100))

          return (
            <div
              key={a.id}
              className={`rounded-2xl border p-4 flex items-start gap-3 ${
                unlocked ? 'bg-white border-black/10' : 'bg-black/[0.02] border-black/10 opacity-70'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  unlocked ? 'bg-gradient-to-br from-peach to-gold text-plumdeep' : 'bg-black/5 text-[#9a8a9c]'
                }`}
              >
                {unlocked ? <FiAward size={18} /> : <FiLock size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{a.title}</div>
                <div className="text-xs text-[#9a8a9c] mt-0.5">{a.description}</div>
                {!unlocked && (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-peach to-gold transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-[#9a8a9c] mt-1">
                      {Math.min(current, target)} / {target}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}