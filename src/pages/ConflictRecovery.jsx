import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { FiCheckCircle, FiHeart, FiLock, FiUsers } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { friendlyDate, todayStr } from '../utils/date'

// Fixed guided prompts, per the design guide: both partners reflect privately
// on the same questions before anything is shared, so nobody's first draft
// is written in reaction to what the other person said.
const PROMPTS = [
  {
    id: 'happened',
    label: 'What happened, from your side?',
    hint: 'Stick to the facts — what was said or done, not how you read into it.',
  },
  {
    id: 'feelings',
    label: 'How did it make you feel?',
    hint: 'Name the feeling, not the story about who\'s right.',
  },
  {
    id: 'understand',
    label: 'What do you think your partner needs to understand?',
    hint: 'The thing you most want them to get, even if it\'s hard to say.',
  },
  {
    id: 'resolve',
    label: 'What would help you feel like this is resolved?',
    hint: 'Something concrete, even small.',
  },
]

const emptyAnswers = () => Object.fromEntries(PROMPTS.map((p) => [p.id, '']))

export default function ConflictRecovery() {
  const { firebaseUser, couple } = useAuth()
  const { partner, partnerUid, hasPartner } = usePartner()
  const coupleId = couple?.id
  const uid = firebaseUser?.uid

  const [sessions, setSessions] = useState([])
  const [topic, setTopic] = useState('')
  const [starting, setStarting] = useState(false)
  const [answers, setAnswers] = useState(emptyAnswers())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!coupleId) return
    const unsub = onSnapshot(
      query(collection(db, 'couples', coupleId, 'conflictSessions'), orderBy('createdAt', 'desc')),
      (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [coupleId])

  // The most recent session that isn't closed yet is the "active" one —
  // only one conflict recovery flow runs at a time.
  const activeSession = sessions.find((s) => s.status !== 'closed') || null
  const history = sessions.filter((s) => s.status === 'closed')

  useEffect(() => {
    setAnswers(emptyAnswers())
  }, [activeSession?.id])

  const myResponse = activeSession?.responses?.[uid] || null
  const partnerResponse = (partnerUid && activeSession?.responses?.[partnerUid]) || null
  const bothSubmitted = !!myResponse && !!partnerResponse

  async function startSession() {
    if (!topic.trim() || !coupleId || starting) return
    setStarting(true)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'conflictSessions'), {
        topic: topic.trim(),
        initiatedBy: uid,
        createdAt: serverTimestamp(),
        status: 'active',
        responses: {},
      })
      setTopic('')
    } catch (e) {
      toast.error("Couldn't start that session — try again.")
    } finally {
      setStarting(false)
    }
  }

  async function submitAnswers() {
    if (!activeSession || submitting) return
    if (PROMPTS.some((p) => !answers[p.id].trim())) {
      toast.error('Fill in all four before submitting.')
      return
    }
    setSubmitting(true)
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'conflictSessions', activeSession.id), {
        [`responses.${uid}`]: { answers, submittedAt: serverTimestamp() },
      })
      toast.success('Saved. Sit tight for your partner.')
    } catch (e) {
      toast.error("Couldn't save your answers — try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function revealTogether() {
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'conflictSessions', activeSession.id), {
        status: 'revealed',
      })
    } catch (e) {
      toast.error("Couldn't reveal — try again.")
    }
  }

  async function closeSession() {
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'conflictSessions', activeSession.id), {
        status: 'closed',
        closedAt: serverTimestamp(),
      })
      toast.success('Marked as resolved.')
    } catch (e) {
      toast.error("Couldn't close that session — try again.")
    }
  }

  const partnerName = partner?.displayName || 'your partner'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Conflict recovery</h1>
        <p className="text-sm text-[#7a6a7c]">
          Reflect privately on the same prompts, then share what you wrote together — not in the heat of it.
        </p>
      </div>

      {!hasPartner && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 text-sm text-[#9a8a9c]">
          This works best once you're linked with a partner.
        </div>
      )}

      {hasPartner && !activeSession && (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-1">Start a session</h3>
          <p className="text-xs text-[#9a8a9c] mb-4">
            Give it a short, neutral label — not a verdict. e.g. "Friday night plans", not "you were rude".
          </p>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="e.g. The argument about Friday night"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button
            onClick={startSession}
            disabled={starting || !topic.trim()}
            className="mt-3 py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60"
          >
            {starting ? 'Starting...' : 'Start reflecting'}
          </button>
        </div>
      )}

      {hasPartner && activeSession && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <h3 className="font-semibold">{activeSession.topic}</h3>
            <span className="text-[10.5px] bg-blush text-plum px-2 py-0.5 rounded-full font-semibold">
              {friendlyDate(
                activeSession.createdAt?.toDate ? activeSession.createdAt.toDate().toISOString().slice(0, 10) : todayStr()
              )}
            </span>
          </div>

          {/* Stage 1: still writing */}
          {!myResponse && activeSession.status === 'active' && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex items-center gap-1.5 text-xs text-[#9a8a9c]">
                <FiLock size={11} /> Your answers stay private until you both finish.
              </div>
              {PROMPTS.map((p) => (
                <div key={p.id}>
                  <label className="block text-sm font-semibold mb-1">{p.label}</label>
                  <p className="text-xs text-[#9a8a9c] mb-1.5">{p.hint}</p>
                  <textarea
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                    value={answers[p.id]}
                    onChange={(e) => setAnswers((a) => ({ ...a, [p.id]: e.target.value }))}
                  />
                </div>
              ))}
              <button
                onClick={submitAnswers}
                disabled={submitting}
                className="py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60 self-start"
              >
                {submitting ? 'Saving...' : 'Submit my answers'}
              </button>
            </div>
          )}

          {/* Stage 2: I've submitted, waiting on partner */}
          {myResponse && !bothSubmitted && activeSession.status === 'active' && (
            <div className="mt-4 text-sm text-[#7a6a7c] flex items-center gap-2">
              <FiCheckCircle size={15} className="text-[#7fae7f]" />
              You're done. Waiting on {partnerName} to finish their reflection.
            </div>
          )}

          {/* Stage 3: both submitted, ready to reveal together */}
          {bothSubmitted && activeSession.status === 'active' && (
            <div className="mt-4 bg-[#faf6f8] rounded-xl p-4 text-center">
              <FiUsers size={20} className="mx-auto mb-2 text-peach" />
              <p className="text-sm mb-3">
                You've both finished. When you're sitting down together, reveal what you each wrote.
              </p>
              <button
                onClick={revealTogether}
                className="py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
              >
                Reveal together
              </button>
            </div>
          )}

          {/* Stage 4: revealed — show both sets side by side */}
          {activeSession.status === 'revealed' && myResponse && partnerResponse && (
            <div className="mt-4 flex flex-col gap-4">
              {PROMPTS.map((p) => (
                <div key={p.id}>
                  <div className="text-sm font-semibold mb-2">{p.label}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="jar-note text-left text-[13.5px] p-3">
                      <div className="text-[10px] uppercase tracking-wide text-[#9a8a9c] not-italic mb-1">You</div>
                      {myResponse.answers[p.id]}
                    </div>
                    <div className="jar-note text-left text-[13.5px] p-3">
                      <div className="text-[10px] uppercase tracking-wide text-[#9a8a9c] not-italic mb-1">
                        {partnerName}
                      </div>
                      {partnerResponse.answers[p.id]}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={closeSession}
                className="flex items-center gap-1.5 py-2.5 px-5 rounded-xl font-semibold text-sm border border-black/10 self-start"
              >
                <FiHeart size={13} /> Mark as resolved
              </button>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Past sessions</h3>
          <div className="flex flex-col gap-2">
            {history.map((s) => (
              <div key={s.id} className="text-sm text-[#7a6a7c] flex items-center gap-2">
                <FiCheckCircle size={13} className="text-[#7fae7f] flex-shrink-0" />
                {s.topic}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
