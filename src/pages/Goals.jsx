import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'

export default function Goals() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [goals, setGoals] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')

  useEffect(() => {
    if (!coupleId) return
    const q = query(collection(db, 'couples', coupleId, 'goals'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [coupleId])

  async function addGoal() {
    const t = title.trim()
    if (!t || !coupleId) return
    setTitle('')
    setDescription('')
    await addDoc(collection(db, 'couples', coupleId, 'goals'), {
      title: t,
      description: description.trim(),
      targetDate: targetDate || null,
      progress: 0,
      done: false,
      createdBy: firebaseUser.uid,
      createdAt: serverTimestamp(),
    })
    setTargetDate('')
  }

  async function setProgress(goal, progress) {
    const clamped = Math.max(0, Math.min(100, progress))
    await updateDoc(doc(db, 'couples', coupleId, 'goals', goal.id), {
      progress: clamped,
      done: clamped === 100,
    })
  }

  const activeGoals = useMemo(() => goals.filter((g) => !g.done), [goals])
  const completedGoals = useMemo(() => goals.filter((g) => g.done), [goals])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Goals</h1>
        <p className="text-sm text-[#7a6a7c]">The bigger things you're working toward together.</p>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
        <h3 className="font-semibold mb-3">In progress</h3>
        {activeGoals.length === 0 && (
          <div className="text-sm text-[#a892a9] py-2.5">No goals yet — add one below.</div>
        )}
        {activeGoals.map((g) => (
          <div key={g.id} className="py-3.5 border-b border-black/10 last:border-b-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-medium">{g.title}</span>
              {g.targetDate && (
                <span className="text-[10px] bg-blush text-plum rounded-full px-2 py-0.5 font-semibold">
                  by {g.targetDate}
                </span>
              )}
            </div>
            {g.description && <div className="text-sm text-[#7a6a7c] mt-1">{g.description}</div>}

            <div className="mt-2.5 h-2 rounded-full bg-black/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-peach to-gold transition-all"
                style={{ width: `${g.progress || 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-[#9a8a9c]">
                {g.progress || 0}% · added by {names[g.createdBy] || '...'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setProgress(g, (g.progress || 0) - 10)}
                  className="w-7 h-7 rounded-lg border border-black/10 text-sm"
                >
                  −
                </button>
                <button
                  onClick={() => setProgress(g, (g.progress || 0) + 10)}
                  className="w-7 h-7 rounded-lg border border-black/10 text-sm"
                >
                  +
                </button>
                <button
                  onClick={() => setProgress(g, 100)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-black/10"
                >
                  Mark done
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-4 pt-4 border-t border-black/10">
          <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Goal</label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="e.g. Save for our trip to Japan"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
          />
          <textarea
            rows={2}
            className="w-full mt-2.5 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Any details (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="mt-2.5">
            <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Target date (optional)</label>
            <input
              type="date"
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <button
            onClick={addGoal}
            className="mt-3 py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            Add goal
          </button>
        </div>
      </div>

      {completedGoals.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Achieved 🎉</h3>
          {completedGoals.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-2 border-b border-black/10 last:border-b-0">
              <span className="line-through opacity-50">{g.title}</span>
              <button
                onClick={() => setProgress(g, 90)}
                className="text-xs text-[#9a8a9c] px-2.5 py-1.5 rounded-lg border border-black/10"
              >
                Reopen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}