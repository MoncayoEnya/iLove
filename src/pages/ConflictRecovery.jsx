import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import {
  FiCheck,
  FiCheckCircle,
  FiChevronRight,
  FiGift,
  FiHeart,
  FiLock,
  FiUsers,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { friendlyDate, todayStr } from '../utils/date'

// Fixed guided prompts (steps 1-4 of the spec). Both partners reflect
// privately on the same questions before anything is shared, so nobody's
// first draft is written in reaction to what the other person said.
// Step 5, "let's make a promise," happens together after reveal — see
// the promise section further down.
//
// `category` is the short step-list name (left column); `label` is the
// full question shown as "Step N. <label>" in the main panel and in the
// "Coming next" preview; `hint` is reused in both places.
const PROMPTS = [
  {
    id: 'feel',
    category: 'Internal state',
    label: 'How do you feel?',
    hint: 'Name the feeling, not the story.',
    placeholder: 'I feel overwhelmed, unheard, or perhaps small…',
  },
  {
    id: 'hurt',
    category: 'The catalyst',
    label: 'What hurt you?',
    hint: 'Identify the specific moment.',
    placeholder: 'The specific word, moment, or thing that stung…',
  },
  {
    id: 'need',
    category: 'The need',
    label: 'What do you need?',
    hint: 'Name one concrete need right now.',
    placeholder: 'One concrete thing you need right now, even if small…',
  },
  {
    id: 'partnerCanDo',
    category: 'A way forward',
    label: 'What can your partner do?',
    hint: 'Ask for one real, doable thing.',
    placeholder: 'One real, doable thing they could do — not "just understand me"…',
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
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [promiseDraft, setPromiseDraft] = useState('')
  const [savingPromise, setSavingPromise] = useState(false)
  const [activeResponses, setActiveResponses] = useState({})

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

  // Responses live in a per-user subcollection (couples/{id}/conflictSessions/{id}/responses/{uid})
  // rather than a map field on the session doc. That's what makes the "hidden
  // until both finish" promise real: a map field is fetched in full the moment
  // either partner writes to it, so the partner's answers are already sitting
  // in memory the instant they're saved — the UI was just choosing not to
  // render them yet. Splitting into one document per uid lets Firestore
  // security rules actually block the read server-side until status is
  // 'revealed' or 'closed'. See the rules snippet below — it has to be added
  // to your firestore.rules file directly; this file can't deploy it for you.
  //
  // match /couples/{coupleId}/conflictSessions/{sessionId}/responses/{responseUid} {
  //   allow write: if request.auth.uid == responseUid;
  //   allow read: if request.auth.uid == responseUid
  //     || get(/databases/$(database)/documents/couples/$(coupleId)/conflictSessions/$(sessionId)).data.status != 'active';
  // }
  useEffect(() => {
    if (!coupleId || !activeSession) {
      setActiveResponses({})
      return
    }
    const unsub = onSnapshot(
      collection(db, 'couples', coupleId, 'conflictSessions', activeSession.id, 'responses'),
      (snap) => {
        const next = {}
        snap.docs.forEach((d) => (next[d.id] = d.data()))
        setActiveResponses(next)
      }
    )
    return unsub
  }, [coupleId, activeSession?.id])

  useEffect(() => {
    setAnswers(emptyAnswers())
    setCurrentStep(0)
    setPromiseDraft('')
  }, [activeSession?.id])

  const myResponse = activeResponses[uid] || null
  const partnerResponse = (partnerUid && activeResponses[partnerUid]) || null
  const bothSubmitted = !!myResponse && !!partnerResponse

  // The most recent closed session with a promise that hasn't been marked
  // kept yet — a gentle reminder so promises don't quietly get forgotten.
  const openPromise = history.find((s) => s.promise && !s.promiseFulfilled) || null

  const sessionDateLabel = useMemo(() => {
    if (!activeSession) return ''
    const d = activeSession.createdAt?.toDate ? dayjs(activeSession.createdAt.toDate()) : dayjs()
    return d.format('MMMM D').toUpperCase()
  }, [activeSession])

  async function startSession() {
    if (!topic.trim() || !coupleId || starting) return
    setStarting(true)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'conflictSessions'), {
        topic: topic.trim(),
        initiatedBy: uid,
        createdAt: serverTimestamp(),
        status: 'active',
        promise: null,
        promiseBy: null,
        promiseFulfilled: false,
      })
      setTopic('')
    } catch (e) {
      toast.error("Couldn't start that session — try again.")
    } finally {
      setStarting(false)
    }
  }

  function goBack() {
    setCurrentStep((s) => Math.max(0, s - 1))
  }

  async function goContinue() {
    const prompt = PROMPTS[currentStep]
    if (!answers[prompt.id].trim()) {
      toast.error("Fill this one in before continuing — even a few words.")
      return
    }
    if (currentStep < PROMPTS.length - 1) {
      setCurrentStep((s) => s + 1)
      return
    }
    await submitAnswers()
  }

  async function submitAnswers() {
    if (!activeSession || submitting) return
    if (PROMPTS.some((p) => !answers[p.id].trim())) {
      toast.error('Fill in all four before submitting.')
      return
    }
    setSubmitting(true)
    try {
      await setDoc(
        doc(db, 'couples', coupleId, 'conflictSessions', activeSession.id, 'responses', uid),
        { answers, submittedAt: serverTimestamp() }
      )
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

  async function savePromise() {
    if (!promiseDraft.trim() || savingPromise) return
    setSavingPromise(true)
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'conflictSessions', activeSession.id), {
        promise: promiseDraft.trim(),
        promiseBy: uid,
        promiseAt: serverTimestamp(),
      })
    } catch (e) {
      toast.error("Couldn't save that promise — try again.")
    } finally {
      setSavingPromise(false)
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

  async function markPromiseFulfilled(sessionId) {
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'conflictSessions', sessionId), {
        promiseFulfilled: true,
      })
      toast.success('Nice. That one\'s kept.')
    } catch (e) {
      toast.error("Couldn't update that — try again.")
    }
  }

  const partnerName = partner?.displayName || 'your partner'
  const activePrompt = PROMPTS[currentStep]
  const nextPrompt = PROMPTS[currentStep + 1] || null
  const isWriting = hasPartner && activeSession && !myResponse && activeSession.status === 'active'

  return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500;1,9..144,600&display=swap');
        .cr-title-font { font-family: 'Fraunces', Georgia, serif; }
      `}</style>

      {/* ---------- Writing flow: one question at a time ---------- */}
      {isWriting ? (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr] items-start">
          {/* Left: progress + step list */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold tracking-[2px] text-[#9a8a9c] whitespace-nowrap">
                STEP {String(currentStep + 1).padStart(2, '0')} / {String(PROMPTS.length).padStart(2, '0')}
              </span>
              <span className="flex-1 h-px bg-black/10" />
            </div>

            <div>
              <h1 className="cr-title-font italic text-4xl font-medium text-plumdeep">
                Conflict recovery
              </h1>
              <p className="text-sm text-[#7a6a7c] mt-3 leading-relaxed max-w-[38ch]">
                Reflect privately on the same prompts, then share what you wrote together — not
                in the heat of it.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              {PROMPTS.map((p, i) => {
                const done = i < currentStep
                const active = i === currentStep
                return (
                  <div key={p.id} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                        done
                          ? 'bg-[#7fae7f]'
                          : active
                          ? 'border-2 border-gold bg-white'
                          : 'border-2 border-black/10 bg-white'
                      }`}
                    >
                      {done && <FiCheck size={10} className="text-white" strokeWidth={3} />}
                    </span>
                    <div>
                      <div
                        className={`text-xs font-bold tracking-wide uppercase ${
                          active ? 'text-plumdeep' : done ? 'text-[#7a6a7c]' : 'text-[#c8bcc4]'
                        }`}
                      >
                        {p.category}
                      </div>
                      <p className={`text-sm mt-0.5 ${active ? 'text-[#7a6a7c]' : 'text-[#c8bcc4]'}`}>
                        {p.hint}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bg-white border border-black/10 rounded-2xl p-4 flex items-start gap-3">
              <FiLock size={16} className="text-plum mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold">Private reflection</div>
                <p className="text-xs text-[#9a8a9c] mt-0.5">
                  Your answers stay private until you both finish.
                </p>
              </div>
            </div>
          </div>

          {/* Right: current question */}
          <div className="bg-white border border-black/10 rounded-2xl p-6 sm:p-8">
            <div className="text-[11px] font-semibold tracking-[2px] text-[#9a8a9c] uppercase">
              {sessionDateLabel} · Reflection session
            </div>
            <h2 className="cr-title-font text-2xl sm:text-[28px] font-medium text-ink mt-3 leading-snug">
              “{activeSession.topic}”
            </h2>

            <div className="mt-8">
              <div className="text-base font-semibold text-ink">
                Step {currentStep + 1}. {activePrompt.label}
              </div>
              <p className="text-sm text-[#9a8a9c] mt-1">{activePrompt.hint}</p>

              <textarea
                autoFocus
                rows={7}
                className="w-full mt-4 px-4 py-3.5 rounded-xl border border-black/10 text-sm leading-relaxed resize-y"
                placeholder={activePrompt.placeholder}
                value={answers[activePrompt.id]}
                onChange={(e) => setAnswers((a) => ({ ...a, [activePrompt.id]: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4 mt-6">
              <button
                onClick={goBack}
                disabled={currentStep === 0}
                className="text-sm font-semibold text-[#9a8a9c] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[#9a8a9c] hidden sm:inline">Saved privately</span>
                <button
                  onClick={goContinue}
                  disabled={submitting}
                  className="flex items-center gap-1.5 py-2.5 px-5 rounded-full font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Continue'}
                  {!submitting && <FiChevronRight size={15} />}
                </button>
              </div>
            </div>

            {nextPrompt && (
              <div className="mt-8 pt-6 border-t border-black/10">
                <div className="text-xs font-semibold tracking-wide uppercase text-[#9a8a9c]">
                  Coming next
                </div>
                <p className="cr-title-font italic text-2xl text-[#c8bcc4] mt-2">
                  {nextPrompt.label}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="cr-title-font italic text-3xl font-medium text-plumdeep mb-1">
              Conflict recovery
            </h1>
            <p className="text-sm text-[#7a6a7c]">
              Reflect privately on the same prompts, then share what you wrote together — not in the heat of it.
            </p>
          </div>

          {openPromise && (
            <div className="bg-blush rounded-2xl p-4 mb-4 flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5">
                <FiGift size={16} className="text-plum mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-plum uppercase tracking-wide mb-0.5">
                    Promise from "{openPromise.topic}"
                  </div>
                  <div className="text-sm text-plumdeep">{openPromise.promise}</div>
                </div>
              </div>
              <button
                onClick={() => markPromiseFulfilled(openPromise.id)}
                className="text-xs font-semibold bg-white/70 rounded-xl px-3 py-2 flex-shrink-0"
              >
                Mark as kept
              </button>
            </div>
          )}

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
                <h3 className="cr-title-font text-lg font-medium">{activeSession.topic}</h3>
                <span className="text-[10.5px] bg-blush text-plum px-2 py-0.5 rounded-full font-semibold">
                  {friendlyDate(
                    activeSession.createdAt?.toDate ? activeSession.createdAt.toDate().toISOString().slice(0, 10) : todayStr()
                  )}
                </span>
              </div>

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

              {/* Stage 4: revealed — show both sets side by side, then step 5 */}
              {activeSession.status === 'revealed' && myResponse && partnerResponse && (
                <div className="mt-4 flex flex-col gap-4">
                  {PROMPTS.map((p, i) => (
                    <div key={p.id}>
                      <div className="text-sm font-semibold mb-2">
                        Step {i + 1}. {p.label}
                      </div>
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

                  <div className="border-t border-black/10 pt-4">
                    <div className="text-sm font-semibold mb-1">Step 5. Let's make a promise</div>
                    <p className="text-xs text-[#9a8a9c] mb-2">
                      One thing you're both agreeing to going forward. Either of you can write it.
                    </p>
                    {activeSession.promise ? (
                      <div className="jar-note text-left text-[13.5px] p-3">{activeSession.promise}</div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                          placeholder="e.g. We'll check in with each other before making weekend plans."
                          value={promiseDraft}
                          onChange={(e) => setPromiseDraft(e.target.value)}
                        />
                        <button
                          onClick={savePromise}
                          disabled={savingPromise || !promiseDraft.trim()}
                          className="py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60 flex-shrink-0"
                        >
                          {savingPromise ? 'Saving...' : 'Save promise'}
                        </button>
                      </div>
                    )}
                  </div>

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
              <div className="flex flex-col gap-2.5">
                {history.map((s) => (
                  <div key={s.id} className="text-sm text-[#7a6a7c]">
                    <div className="flex items-center gap-2">
                      <FiCheckCircle size={13} className="text-[#7fae7f] flex-shrink-0" />
                      {s.topic}
                    </div>
                    {s.promise && (
                      <div className="text-xs text-[#9a8a9c] mt-1 ml-5">
                        Promise: {s.promise} {s.promiseFulfilled ? '— kept ✓' : '— still open'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}