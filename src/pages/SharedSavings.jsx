import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { FiPlus, FiTarget, FiTrash2, FiX } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import EmptyState from '../components/EmptyState'

// This is a *tracker*, not a payments feature — there is no bank/account
// integration. Amounts are just numbers either partner logs by hand, so the
// UI below is careful to read as "keeping score of what we've put aside"
// rather than anything that moves real money.

function formatMoney(n) {
  return (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(`${dateStr}T00:00:00`) - new Date(new Date().toDateString())
  return Math.round(diff / 86400000)
}

// Circular progress ring, same gradient-stroke technique as the Dashboard's
// relationship-health ring. gradientId must be unique per rendered ring
// (a page can show several at once) — callers pass the goal's Firestore id.
function GoalRing({ pct, size = 108, stroke = 9, gradientId }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = c - (clamped / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(61,35,64,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8a87c" />
          <stop offset="100%" stopColor="#f0c987" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// Ring + centered percentage, the piece reused by both the featured goal
// and the compact grid (only the featured one also shows a "saved" caption).
function RingStat({ pct, size, stroke, idSuffix, caption }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <GoalRing pct={pct} size={size} stroke={stroke} gradientId={`savings-ring-${idSuffix}`} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={caption ? 'text-2xl font-bold text-ink' : 'text-base font-bold text-ink'}>{pct}%</span>
        {caption && <span className="text-[10px] uppercase tracking-wide text-[#9a8a9c] mt-0.5">{caption}</span>}
      </div>
    </div>
  )
}

export default function SharedSavings() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [goals, setGoals] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)

  const [contribGoalId, setContribGoalId] = useState(null)
  const [contribAmount, setContribAmount] = useState('')
  const [contribNote, setContribNote] = useState('')

  useEffect(() => {
    if (!coupleId) return
    const q = query(collection(db, 'couples', coupleId, 'savingsGoals'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [coupleId])

  async function addGoal() {
    const t = title.trim()
    const target = Number(targetAmount)
    if (!t || !target || target <= 0 || !coupleId) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'savingsGoals'), {
        title: t,
        targetAmount: target,
        savedAmount: 0,
        deadline: deadline || null,
        contributions: [],
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
      setTitle('')
      setTargetAmount('')
      setDeadline('')
      setShowForm(false)
    } catch (e) {
      toast.error("Couldn't create that goal — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function removeGoal(goal) {
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'savingsGoals', goal.id))
    } catch (e) {
      toast.error("Couldn't remove that goal — try again.")
    }
  }

  function openContribute(goal) {
    setContribGoalId((cur) => (cur === goal.id ? null : goal.id))
    setContribAmount('')
    setContribNote('')
  }

  async function addContribution(goal) {
    const amount = Number(contribAmount)
    if (!amount || amount <= 0 || !coupleId) return
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'savingsGoals', goal.id), {
        savedAmount: increment(amount),
        contributions: arrayUnion({
          amount,
          note: contribNote.trim(),
          by: firebaseUser.uid,
          date: new Date().toISOString().slice(0, 10),
        }),
      })
      const newTotal = (goal.savedAmount || 0) + amount
      if (newTotal >= goal.targetAmount && (goal.savedAmount || 0) < goal.targetAmount) {
        toast.success(`"${goal.title}" — fully funded! 🎉`)
      } else {
        toast.success('Contribution added')
      }
      setContribGoalId(null)
    } catch (e) {
      toast.error("Couldn't add that contribution — try again.")
    }
  }

  const activeGoals = useMemo(() => goals.filter((g) => (g.savedAmount || 0) < g.targetAmount), [goals])
  const fundedGoals = useMemo(() => goals.filter((g) => (g.savedAmount || 0) >= g.targetAmount), [goals])
  const [featured, ...rest] = activeGoals

  function ContributeForm({ goal }) {
    return (
      <div className="border-t border-black/10 mt-4 pt-3.5">
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <input
            type="number"
            min="0"
            step="0.01"
            autoFocus
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Amount"
            value={contribAmount}
            onChange={(e) => setContribAmount(e.target.value)}
          />
          <input
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Note (optional)"
            value={contribNote}
            onChange={(e) => setContribNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addContribution(goal)}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => addContribution(goal)}
            disabled={!contribAmount || Number(contribAmount) <= 0}
            className="flex-1 sm:flex-none px-5 py-2 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => setContribGoalId(null)}
            className="px-4 py-2 rounded-xl font-semibold text-sm border border-black/10"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Shared savings</h1>
          <p className="text-sm text-[#7a6a7c]">
            Track what you're putting aside together — a trip, a ring, a rainy day.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="py-2.5 px-4 rounded-full font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep flex items-center gap-1.5 flex-shrink-0 shadow-sm hover:shadow-md transition-shadow"
        >
          {showForm ? <FiX size={14} /> : <FiPlus size={14} />}
          {showForm ? 'Cancel' : 'New goal'}
        </button>
      </div>

      <div className="bg-blush/50 border border-black/10 rounded-xl px-4 py-3 mb-5 text-xs sm:text-sm text-[#6b5a6d]">
        This is just a tracker for you two — no bank or card is connected. Log contributions by hand
        whenever you set money aside.
      </div>

      {showForm && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mb-5">
          <h3 className="font-semibold mb-3">New savings goal</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">What are you saving for?</label>
              <input
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                placeholder="e.g. Trip to Japan"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Target amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                  placeholder="2000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Deadline (optional)</label>
                <input
                  type="date"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={addGoal}
              disabled={saving || !title.trim() || !targetAmount}
              className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create goal'}
            </button>
          </div>
        </div>
      )}

      {goals.length === 0 && !showForm && (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <EmptyState
            icon={FiTarget}
            title="No savings goals yet"
            subtitle="Start one for a trip, a gift, or anything you're working toward together."
          />
        </div>
      )}

      {featured &&
        (() => {
          const goal = featured
          const pct = Math.min(100, Math.round(((goal.savedAmount || 0) / goal.targetAmount) * 100))
          const remaining = Math.max(0, goal.targetAmount - (goal.savedAmount || 0))
          const dLeft = daysUntil(goal.deadline)
          const contributions = [...(goal.contributions || [])].sort((a, b) =>
            (b.date || '').localeCompare(a.date || '')
          )

          return (
            <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 mb-5">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="flex items-start sm:items-center gap-5 flex-1 min-w-0">
                  <RingStat pct={pct} size={108} stroke={9} idSuffix={goal.id} caption="saved" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xl font-bold text-ink truncate">{goal.title}</h3>
                      <button
                        onClick={() => removeGoal(goal)}
                        aria-label="Remove goal"
                        className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                    {goal.deadline && (
                      <p className="text-xs text-[#9a8a9c] mt-0.5">
                        {dLeft >= 0 ? `${dLeft} day${dLeft === 1 ? '' : 's'} left` : 'Deadline passed'} · target{' '}
                        {new Date(`${goal.deadline}T00:00:00`).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#9a8a9c]">Saved</div>
                        <div className="text-lg font-bold text-ink">{formatMoney(goal.savedAmount || 0)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#9a8a9c]">Goal</div>
                        <div className="text-lg font-bold text-ink">{formatMoney(goal.targetAmount)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#9a8a9c]">
                          Left to go
                        </div>
                        <div className="text-lg font-bold text-ink">{formatMoney(remaining)}</div>
                      </div>
                    </div>

                    {contribGoalId === goal.id ? (
                      <ContributeForm goal={goal} />
                    ) : (
                      <button
                        onClick={() => openContribute(goal)}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-black/10 text-sm font-semibold text-peach hover:bg-peach/5 transition-colors"
                      >
                        <FiPlus size={13} /> Log a contribution
                      </button>
                    )}
                  </div>
                </div>

                {contributions.length > 0 && (
                  <div className="lg:w-52 flex-shrink-0 lg:pl-6 lg:border-l lg:border-black/10 pt-5 lg:pt-0 border-t lg:border-t-0 border-black/5">
                    <h4 className="text-[10px] font-bold uppercase tracking-wide text-[#9a8a9c] mb-2">Recent</h4>
                    {contributions.slice(0, 4).map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                        <span className="text-[#7a6a7c] truncate">
                          {names[c.by] || '...'}
                          {c.note ? ` — ${c.note}` : ''}
                        </span>
                        <span className="font-bold text-ink flex-shrink-0">+{formatMoney(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          {rest.map((goal) => {
            const pct = Math.min(100, Math.round(((goal.savedAmount || 0) / goal.targetAmount) * 100))
            const remaining = Math.max(0, goal.targetAmount - (goal.savedAmount || 0))

            return (
              <div key={goal.id} className="bg-white border border-black/10 rounded-2xl p-5">
                <div className="flex items-center gap-4">
                  <RingStat pct={pct} size={72} stroke={7} idSuffix={goal.id} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-base text-ink truncate">{goal.title}</h4>
                      <button
                        onClick={() => removeGoal(goal)}
                        aria-label="Remove goal"
                        className="w-6 h-6 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0"
                      >
                        <FiTrash2 size={11} />
                      </button>
                    </div>
                    <p className="text-sm text-[#9a8a9c] mt-0.5 truncate">
                      {formatMoney(goal.savedAmount || 0)} of {formatMoney(goal.targetAmount)} ·{' '}
                      {formatMoney(remaining)} left
                    </p>
                  </div>
                </div>

                {contribGoalId === goal.id ? (
                  <ContributeForm goal={goal} />
                ) : (
                  <button
                    onClick={() => openContribute(goal)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-black/10 text-xs font-semibold text-peach hover:bg-peach/5 transition-colors"
                  >
                    <FiPlus size={12} /> Log a contribution
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {fundedGoals.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Fully funded</h3>
          {fundedGoals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-center justify-between py-2.5 border-b border-black/10 last:border-b-0"
            >
              <div>
                <div>{goal.title}</div>
                <div className="text-xs text-[#9a8a9c] mt-0.5">{formatMoney(goal.targetAmount)} saved</div>
              </div>
              <button
                onClick={() => removeGoal(goal)}
                aria-label="Remove goal"
                className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0"
              >
                <FiTrash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}