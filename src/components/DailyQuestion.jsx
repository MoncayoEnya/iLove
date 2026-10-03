import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from 'firebase/firestore'
import { AnimatePresence, motion } from 'framer-motion'
import { FiEdit2, FiLock, FiMessageSquare } from 'react-icons/fi'
import { HiSparkles } from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { db } from '../firebase'
import { questionForDate } from '../data/dailyQuestions'
import { celebrate } from '../utils/celebrate'
import { haptic } from '../utils/haptics'
import { askAI } from '../utils/ai'

// One generation per couple per day per browser tab, even if the card is on
// screen twice (Dashboard + Connection view).
const inFlight = new Map()

// Makes today's question with AI (avoiding the last few weeks' questions)
// and stores it on today's answers doc, so both partners get the same one.
// If the AI can't be reached, the built-in list is used instead — the card
// always has a question.
function ensureTodaysQuestion(coupleId, today) {
  const key = `${coupleId}/${today}`
  if (inFlight.has(key)) return inFlight.get(key)
  const job = (async () => {
    const ref = doc(db, 'couples', coupleId, 'dailyAnswers', today)
    let question = ''
    let source = 'list'
    let recent = []
    try {
      const recentSnap = await getDocs(
        query(collection(db, 'couples', coupleId, 'dailyAnswers'), orderBy(documentId(), 'desc'), limit(25))
      )
      recent = recentSnap.docs.map((d) => d.data().question).filter(Boolean)
    } catch {
      // Not critical — just means repeats aren't filtered out today.
    }
    try {
      const res = await askAI('question', { recent }, 9000)
      if (res?.question) {
        question = res.question
        source = 'ai'
      }
    } catch {
      // AI not set up / offline — fall back below.
    }
    if (!question) question = questionForDate(today)
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      if (snap.exists() && snap.data().question) return // partner got there first
      tx.set(ref, { question, questionSource: source }, { merge: true })
    })
  })().finally(() => setTimeout(() => inFlight.delete(key), 60000))
  inFlight.set(key, job)
  return job
}

// Daily question: the same question for both of you each day, written
// fresh by AI. Your partner's answer stays blurred until you've answered.
//
// Data: couples/{coupleId}/dailyAnswers/{YYYY-MM-DD}
//         = { question, questionSource: 'ai' | 'list', [uid]: { text, at } }
export default function DailyQuestion({
  coupleId,
  uid,
  partnerUid,
  partnerName = 'Your partner',
  today,
  onStatus,
  anchorId = 'daily-question',
  className = '',
}) {
  const [answers, setAnswers] = useState({})
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const question = answers.question || (generating ? '' : questionForDate(today))

  useEffect(() => {
    if (!coupleId) return undefined
    const unsub = onSnapshot(
      doc(db, 'couples', coupleId, 'dailyAnswers', today),
      (snap) => {
        setAnswers(snap.exists() ? snap.data() : {})
        setLoaded(true)
      },
      () => setLoaded(true)
    )
    return unsub
  }, [coupleId, today])

  const mine = answers[uid]
  const theirs = partnerUid ? answers[partnerUid] : null

  // No question stored for today yet: make one (first person to open wins).
  useEffect(() => {
    if (!loaded || !coupleId || answers.question) return undefined
    let cancelled = false
    setGenerating(true)
    ensureTodaysQuestion(coupleId, today)
      .catch(() => {})
      .finally(() => !cancelled && setGenerating(false))
    return () => {
      cancelled = true
    }
  }, [loaded, coupleId, today, answers.question])

  useEffect(() => {
    if (loaded) onStatus?.(!!mine)
  }, [loaded, mine, onStatus])

  async function save() {
    const text = draft.trim()
    if (!text || saving) return
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'couples', coupleId, 'dailyAnswers', today),
        { [uid]: { text, at: new Date() } },
        { merge: true }
      )
      haptic('success')
      if (!mine && theirs) celebrate({ kind: 'hearts', intensity: 0.7 })
      setEditing(false)
    } catch {
      toast.error("Couldn't save your answer — try again.")
    } finally {
      setSaving(false)
    }
  }

  const showInput = !mine || editing

  return (
    <div id={anchorId} className={`bg-white border border-black/10 rounded-2xl p-5 scroll-mt-24 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] flex items-center gap-1.5">
          <FiMessageSquare size={12} /> Question of the day
          {answers.questionSource === 'ai' && (
            <span title="Written fresh for you today" className="inline-flex items-center text-peach normal-case tracking-normal">
              <HiSparkles size={12} />
            </span>
          )}
        </span>
        {mine && !editing && (
          <button
            onClick={() => {
              setDraft(mine.text)
              setEditing(true)
            }}
            className="text-xs text-[#9a8a9c] flex items-center gap-1 hover:text-peach"
          >
            <FiEdit2 size={11} /> Edit
          </button>
        )}
      </div>

      {question ? (
        <motion.p
          key={question}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-serif text-lg font-semibold leading-snug"
        >
          {question}
        </motion.p>
      ) : (
        <div className="space-y-2 py-1" aria-label="Writing today's question">
          <div className="lv-shimmer h-4 rounded-lg bg-black/[0.06] w-11/12" />
          <div className="lv-shimmer h-4 rounded-lg bg-black/[0.06] w-2/3" />
        </div>
      )}

      <AnimatePresence mode="wait">
        {showInput ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3"
          >
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  save()
                }
              }}
              maxLength={500}
              placeholder="Your answer…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-[#9a8a9c]">
                {theirs ? `${partnerName} already answered — answer to see it.` : 'Answer to see theirs when they do.'}
              </span>
              <div className="flex gap-2">
                {editing && (
                  <button onClick={() => setEditing(false)} className="text-sm px-3 py-2 rounded-xl border border-black/10">
                    Cancel
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={!draft.trim() || saving}
                  className="px-4 py-2 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Share'}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="answers"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 grid sm:grid-cols-2 gap-3"
          >
            <div className="rounded-xl bg-blush/60 p-3.5">
              <div className="text-[11px] font-semibold text-[#9a8a9c] mb-1">You</div>
              <p className="text-sm whitespace-pre-wrap break-words">{mine.text}</p>
            </div>
            <div className="rounded-xl bg-[#faf6f8] p-3.5 relative overflow-hidden">
              <div className="text-[11px] font-semibold text-[#9a8a9c] mb-1">{partnerName}</div>
              {theirs ? (
                <motion.p
                  initial={{ filter: 'blur(8px)', opacity: 0.4 }}
                  animate={{ filter: 'blur(0px)', opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  className="text-sm whitespace-pre-wrap break-words"
                >
                  {theirs.text}
                </motion.p>
              ) : (
                <p className="text-sm text-[#9a8a9c] italic flex items-center gap-1.5">
                  <FiLock size={12} /> Waiting for their answer…
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* When you haven't answered, their answer exists but stays hidden. */}
      {!mine && theirs && (
        <div className="mt-3 rounded-xl bg-[#faf6f8] p-3.5 select-none" aria-hidden="true">
          <div className="text-[11px] font-semibold text-[#9a8a9c] mb-1">{partnerName}</div>
          <p className="text-sm blur-[6px]">{'•'.repeat(Math.min(80, Math.max(20, theirs.text.length)))}</p>
        </div>
      )}
    </div>
  )
}
