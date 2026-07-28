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
    setContribGoalId(goal.id)
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

  const activeGoals = useMemo(
    () => goals.filter((g) => (g.savedAmount || 0) < g.targetAmount),
    [goals]
  )
  const fundedGoals = useMemo(
    () => goals.filter((g) => (g.savedAmount || 0) >= g.targetAmount),
    [goals]
  )

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Shared savings</h1>
          <p className="text-sm text-[#7a6a7c]">
            Track what you're putting aside together — a trip, a ring, a rainy day.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="py-2.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep flex items-center gap-1.5 flex-shrink-0"
        >
          {showForm ? <FiX size={14} /> : <FiPlus size={14} />}
          {showForm ? 'Cancel' : 'New goal'}
        </button>
      </div>

      <div className="bg-blush/60 border border-black/10 rounded-xl px-4 py-2.5 mb-4 text-xs text-[#6b5a6d]">
        This is just a tracker for you two — no bank or card is connected. Log contributions by
        hand whenever you set money aside.
      </div>

      {showForm && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
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

      {activeGoals.map((goal) => {
        const pct = Math.min(100, Math.round(((goal.savedAmount || 0) / goal.targetAmount) * 100))
        const remaining = Math.max(0, goal.targetAmount - (goal.savedAmount || 0))
        const dLeft = daysUntil(goal.deadline)
        const contributions = [...(goal.contributions || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

        return (
          <div key={goal.id} className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="font-semibold">{goal.title}</h3>
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
              </div>
              <button
                onClick={() => removeGoal(goal)}
                aria-label="Remove goal"
                className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0"
              >
                <FiTrash2 size={13} />
              </button>
            </div>

            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-semibold">
                {formatMoney(goal.savedAmount || 0)} of {formatMoney(goal.targetAmount)}
              </span>
              <span className="text-xs text-[#9a8a9c] font-semibold">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-black/5 overflow-hidden mb-1">
              <div
                className="h-full rounded-full bg-gradient-to-r from-peach to-gold transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-[#9a8a9c] mb-4">{formatMoney(remaining)} left to go</p>

            {contribGoalId === goal.id ? (
              <div className="border-t border-black/10 pt-3 mt-1">
                <div className="flex gap-2 mb-2">
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
                    className="flex-1 py-2 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setContribGoalId(null)}
                    className="py-2 px-4 rounded-xl font-semibold text-sm border border-black/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => openContribute(goal)}
                className="w-full py-2.5 rounded-xl font-semibold text-sm border border-black/10 flex items-center justify-center gap-1.5"
              >
                <FiPlus size={13} /> Log a contribution
              </button>
            )}

            {contributions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-black/10">
                <h4 className="text-xs font-semibold text-[#6b5a6d] mb-2">Recent contributions</h4>
                {contributions.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-[#7a6a7c]">
                      {names[c.by] || '...'}
                      {c.note ? ` — ${c.note}` : ''}
                    </span>
                    <span className="font-semibold flex-shrink-0 ml-2">+{formatMoney(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {fundedGoals.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Fully funded</h3>
          {fundedGoals.map((goal) => (
            <div key={goal.id} className="flex items-center justify-between py-2.5 border-b border-black/10 last:border-b-0">
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
