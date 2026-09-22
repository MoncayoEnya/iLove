import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  FiAward,
  FiChevronLeft,
  FiChevronRight,
  FiMinus,
  FiPlus,
  FiTarget,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'

const STAGES = [
  ['now', 'Now'],
  ['next', 'Next'],
  ['someday', 'Someday'],
]

function stageOf(goal) {
  return goal.stage === 'next' || goal.stage === 'someday' ? goal.stage : 'now'
}

function GoalCard({ g, stageKey, names, onProgress, onMove }) {
  return (
    <div className="border border-black/10 rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm">{g.title}</span>
        {g.targetDate && (
          <span className="text-[10px] bg-blush text-plum rounded-full px-2 py-0.5 font-semibold whitespace-nowrap flex-shrink-0">
            by {g.targetDate}
          </span>
        )}
      </div>

      {g.description && <div className="text-xs text-[#7a6a7c] mt-1">{g.description}</div>}

      <div className="mt-2.5 h-1.5 rounded-full bg-black/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-peach to-gold transition-all"
          style={{ width: `${g.progress || 0}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-[#9a8a9c]">
          {g.progress || 0}% · {names[g.createdBy] || '...'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onProgress(g, (g.progress || 0) - 10)}
            aria-label="Decrease progress"
            className="w-6 h-6 rounded-md border border-black/10 flex items-center justify-center"
          >
            <FiMinus size={11} />
          </button>
          <button
            onClick={() => onProgress(g, (g.progress || 0) + 10)}
            aria-label="Increase progress"
            className="w-6 h-6 rounded-md border border-black/10 flex items-center justify-center"
          >
            <FiPlus size={11} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-black/5">
        {stageKey !== 'now' ? (
          <button
            onClick={() => onMove(g, stageKey === 'next' ? 'now' : 'next')}
            className="text-[10px] text-[#9a8a9c] flex items-center gap-0.5 hover:text-plumdeep transition-colors"
          >
            <FiChevronLeft size={11} /> Move back
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          {stageKey !== 'someday' && (
            <button
              onClick={() => onMove(g, stageKey === 'now' ? 'next' : 'someday')}
              className="text-[10px] text-[#9a8a9c] flex items-center gap-0.5 hover:text-plumdeep transition-colors"
            >
              Move on <FiChevronRight size={11} />
            </button>
          )}
          <button
            onClick={() => onProgress(g, 100)}
            className="text-[10px] px-2 py-1 rounded-md border border-black/10"
          >
            Mark done
          </button>
        </div>
      </div>
    </div>
  )
}

function Column({ stageKey, label, goals, names, onProgress, onMove, onAdd, isLast }) {
  return (
    <div className={`flex flex-col ${isLast ? '' : 'md:border-r md:border-black/10'}`}>
      <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold">{label}</h3>
        {goals.length > 0 && <span className="text-xs text-[#9a8a9c]">{goals.length}</span>}
      </div>

      <div className="p-5 flex-1 flex flex-col gap-3 min-h-[220px]">
        {goals.length === 0 ? (
          stageKey === 'now' ? (
            <button onClick={onAdd} className="flex-1 flex flex-col text-left">
              <EmptyState
                icon={FiTarget}
                title="Start something new"
                subtitle="Ready to save for that trip or build a new habit? Define your first big intention together."
                className="flex-1 justify-center"
              />
            </button>
          ) : (
            <button
              onClick={onAdd}
              className="flex-1 flex items-center justify-center text-sm text-[#9a8a9c] hover:text-plumdeep transition-colors"
            >
              {stageKey === 'next' ? (
                'Add target'
              ) : (
                <span className="flex items-center gap-1.5">
                  <FiPlus size={14} /> Add
                </span>
              )}
            </button>
          )
        ) : (
          <>
            {goals.map((g) => (
              <GoalCard key={g.id} g={g} stageKey={stageKey} names={names} onProgress={onProgress} onMove={onMove} />
            ))}
            <button
              onClick={onAdd}
              className="text-xs font-semibold text-peach flex items-center gap-1 mt-1 hover:opacity-75 transition-opacity"
            >
              <FiPlus size={12} /> Add
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Goals() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [goals, setGoals] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [stage, setStage] = useState('now')

  useEffect(() => {
    if (!coupleId) return
    const q = query(collection(db, 'couples', coupleId, 'goals'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [coupleId])

  function openModal(presetStage) {
    setStage(presetStage || 'now')
    setModalOpen(true)
  }

  async function addGoal() {
    const t = title.trim()
    if (!t || !coupleId) return
    try {
      await addDoc(collection(db, 'couples', coupleId, 'goals'), {
        title: t,
        description: description.trim(),
        targetDate: targetDate || null,
        stage,
        progress: 0,
        done: false,
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
      setTitle('')
      setDescription('')
      setTargetDate('')
      setStage('now')
      setModalOpen(false)
    } catch (e) {
      toast.error("Couldn't add that goal — try again.")
    }
  }

  async function setProgress(goal, progress) {
    const clamped = Math.max(0, Math.min(100, progress))
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'goals', goal.id), {
        progress: clamped,
        done: clamped === 100,
      })
      if (clamped === 100 && !goal.done) toast.success(`"${goal.title}" — goal complete!`)
    } catch (e) {
      toast.error("Couldn't update progress — try again.")
    }
  }

  async function moveStage(goal, newStage) {
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'goals', goal.id), { stage: newStage })
    } catch (e) {
      toast.error("Couldn't move that goal — try again.")
    }
  }

  async function reopen(goal) {
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'goals', goal.id), { progress: 90, done: false })
    } catch (e) {
      toast.error("Couldn't update that goal — try again.")
    }
  }

  const activeGoals = useMemo(() => goals.filter((g) => !g.done), [goals])
  const completedGoals = useMemo(() => goals.filter((g) => g.done), [goals])

  const byStage = useMemo(() => {
    const grouped = { now: [], next: [], someday: [] }
    for (const g of activeGoals) grouped[stageOf(g)].push(g)
    return grouped
  }, [activeGoals])

  const nextMilestone = useMemo(() => {
    const dated = activeGoals.filter((g) => g.targetDate).sort((a, b) => a.targetDate.localeCompare(b.targetDate))
    if (dated.length > 0) return dated[0].title
    return activeGoals[0]?.title || null
  }, [activeGoals])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Goals</h1>
          <p className="text-sm text-[#7a6a7c]">Build your future together, one intention at a time.</p>
        </div>
        <button
          onClick={() => openModal('now')}
          className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep flex-shrink-0"
        >
          <FiPlus size={15} /> New goal
        </button>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {STAGES.map(([key, label], i) => (
            <Column
              key={key}
              stageKey={key}
              label={label}
              goals={byStage[key]}
              names={names}
              onProgress={setProgress}
              onMove={moveStage}
              onAdd={() => openModal(key)}
              isLast={i === STAGES.length - 1}
            />
          ))}
        </div>
      </div>

      {activeGoals.length > 1 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
          <h3 className="font-semibold mb-4 text-sm text-[#7a6a7c]">Progress overview</h3>
          <div style={{ height: Math.max(120, activeGoals.length * 46) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeGoals.map((g) => ({ name: g.title, progress: g.progress || 0 }))}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#00000010" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9a8a9c' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12, fill: '#3d2340' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #00000015', fontSize: 12 }}
                  formatter={(v) => [`${v}%`, 'Progress']}
                />
                <Bar dataKey="progress" radius={[0, 6, 6, 0]} barSize={16}>
                  {activeGoals.map((g, i) => (
                    <Cell key={i} fill={(g.progress || 0) >= 70 ? '#e8b978' : '#f0c9b0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {completedGoals.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FiAward size={16} className="text-peach" /> Achieved
          </h3>
          {completedGoals.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-2 border-b border-black/10 last:border-b-0">
              <span className="line-through opacity-50">{g.title}</span>
              <button
                onClick={() => reopen(g)}
                className="text-xs text-[#9a8a9c] px-2.5 py-1.5 rounded-lg border border-black/10"
              >
                Reopen
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center sm:justify-start gap-6 flex-wrap pt-4 border-t border-black/10 text-sm text-[#6b5a6d]">
        <span>
          <strong className="text-ink font-semibold">{activeGoals.length}</strong> Active Goal
          {activeGoals.length === 1 ? '' : 's'}
        </span>
        <span>
          <strong className="text-ink font-semibold">{completedGoals.length}</strong> Completed
        </span>
        <span>Next Milestone: {nextMilestone || '—'}</span>
      </div>

      <BottomSheet open={modalOpen} onClose={() => setModalOpen(false)} title="New goal">
        <div>
          <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Goal</label>
          <input
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="e.g. Save for our trip to Japan"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
          />

          <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold mt-3">Details (optional)</label>
          <textarea
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Any details"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold mt-3">Target date (optional)</label>
          <input
            type="date"
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />

          <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold mt-3">Stage</label>
          <div className="flex gap-2">
            {STAGES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStage(key)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  stage === key ? 'bg-peach/15 border-peach text-plum' : 'border-black/10 text-[#7a6a7c]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={addGoal}
            className="mt-4 w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            Add goal
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}