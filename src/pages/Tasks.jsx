import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { FiCheck } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { useMemberNames } from '../hooks/useMemberNames'
import { todayStr } from '../utils/date'
import { useUIStore } from '../store/uiStore'

export default function Tasks() {
  const { firebaseUser, couple } = useAuth()
  const { partner, partnerUid } = usePartner()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [tasks, setTasks] = useState([])
  const [text, setText] = useState('')
  const [assignee, setAssignee] = useState('either') // 'either' | 'me' | 'partner'
  const [dueDate, setDueDate] = useState('')
  const taskFilter = useUIStore((s) => s.taskFilter)
  const setTaskFilter = useUIStore((s) => s.setTaskFilter)

  useEffect(() => {
    if (!coupleId) return
    const q = query(collection(db, 'couples', coupleId, 'tasks'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [coupleId])

  async function addTask() {
    const t = text.trim()
    if (!t || !coupleId) return
    setText('')
    const assignedTo = assignee === 'me' ? firebaseUser.uid : assignee === 'partner' ? partnerUid : null
    try {
      await addDoc(collection(db, 'couples', coupleId, 'tasks'), {
        text: t,
        assignedTo,
        dueDate: dueDate || null,
        done: false,
        completedBy: null,
        completedAt: null,
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
      setDueDate('')
    } catch (e) {
      setText(t)
      toast.error("Couldn't add that task — try again.")
    }
  }

  async function toggle(task) {
    const ref = doc(db, 'couples', coupleId, 'tasks', task.id)
    try {
      if (task.done) {
        await updateDoc(ref, { done: false, completedAt: null, completedBy: null })
      } else {
        await updateDoc(ref, { done: true, completedAt: serverTimestamp(), completedBy: firebaseUser.uid })
      }
    } catch (e) {
      toast.error("Couldn't update that task — try again.")
    }
  }

  function assigneeLabel(task) {
    if (!task.assignedTo) return 'Either of you'
    if (task.assignedTo === firebaseUser.uid) return 'You'
    return names[task.assignedTo] || partner?.displayName || '...'
  }

  const openTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.done)
      .filter((t) => {
        if (taskFilter === 'mine') return t.assignedTo === firebaseUser.uid
        if (taskFilter === 'partner') return t.assignedTo && t.assignedTo === partnerUid
        return true
      })
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return 0
      })
  }, [tasks, taskFilter, firebaseUser.uid, partnerUid])

  const completedTasks = useMemo(() => {
    return tasks
      .filter((t) => t.done)
      .sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
  }, [tasks])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Shared tasks</h1>
        <p className="text-sm text-[#7a6a7c]">Assign it, date it, check it off — it all counts.</p>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-semibold">To do</h3>
          <div className="flex items-center gap-1 bg-black/5 rounded-lg p-1">
            {[
              ['all', 'All'],
              ['mine', 'Mine'],
              ['partner', partner?.displayName || 'Partner'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTaskFilter(value)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors ${
                  taskFilter === value ? 'bg-white shadow-sm text-plum' : 'text-[#9a8a9c]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {openTasks.length === 0 && (
          <div className="text-sm text-[#a892a9] py-2.5">
            {taskFilter === 'all' ? 'No open tasks — add one below.' : 'No tasks match this filter.'}
          </div>
        )}
        {openTasks.map((t) => {
          const overdue = t.dueDate && t.dueDate < todayStr()
          return (
            <div key={t.id} className="flex items-start gap-2.5 py-2.5 border-b border-black/10 last:border-b-0">
              <div
                onClick={() => toggle(t)}
                className="w-5 h-5 rounded-md border border-black/20 flex items-center justify-center text-xs cursor-pointer mt-0.5 flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{t.text}</span>
                  <span className="text-[10px] text-[#9a8a9c] border border-black/10 rounded-full px-2 py-0.5">
                    {assigneeLabel(t)}
                  </span>
                  {t.dueDate && (
                    <span
                      className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${
                        overdue ? 'bg-[#fbe4e4] text-[#9b3b3b]' : 'bg-blush text-plum'
                      }`}
                    >
                      {overdue ? 'Overdue · ' : 'Due '}
                      {t.dueDate}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#9a8a9c] mt-1">added by {names[t.createdBy] || '...'}</div>
              </div>
            </div>
          )
        })}

        <div className="mt-4 pt-4 border-t border-black/10">
          <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Task</label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="e.g. Call tonight, drink water, watch a movie..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">
            <div>
              <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Assign to</label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm bg-white"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="either">Either of us</option>
                <option value="me">Me</option>
                {partnerUid && <option value="partner">{partner?.displayName || 'Partner'}</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Due date (optional)</label>
              <input
                type="date"
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={addTask}
            className="mt-3 py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            Add task
          </button>
        </div>
      </div>

      {completedTasks.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mt-4">
          <h3 className="font-semibold mb-3">Completed history</h3>
          {completedTasks.map((t) => (
            <div key={t.id} className="flex items-start gap-2.5 py-2 border-b border-black/10 last:border-b-0">
              <div
                onClick={() => toggle(t)}
                className="w-5 h-5 rounded-md border border-ok bg-ok text-white flex items-center justify-center cursor-pointer mt-0.5 flex-shrink-0"
              >
                <FiCheck size={12} strokeWidth={3} />
              </div>
              <div className="flex-1">
                <div className="line-through opacity-50">{t.text}</div>
                <div className="text-xs text-[#9a8a9c] mt-1">
                  completed by {t.completedBy === firebaseUser.uid ? 'you' : names[t.completedBy] || '...'}
                  {t.completedAt?.toDate ? ` on ${dayjs(t.completedAt.toDate()).format('YYYY-MM-DD')}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}