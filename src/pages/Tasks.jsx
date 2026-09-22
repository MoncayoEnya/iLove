import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiLock,
  FiMoreHorizontal,
  FiPlus,
  FiUsers,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { useMemberNames } from '../hooks/useMemberNames'
import { todayStr } from '../utils/date'
import { isLockedFor } from '../utils/privacy'

/** Monday (start of day) of the week containing `d`. */
function mondayOf(d) {
  const dow = d.day() // 0 = Sun .. 6 = Sat
  const diff = dow === 0 ? -6 : 1 - dow
  return d.add(diff, 'day').startOf('day')
}

function Avatar({ photoURL, name, size = 38 }) {
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {photoURL ? (
        <img src={photoURL} alt="" className="w-full h-full object-cover" />
      ) : (
        (name || '?')[0]?.toUpperCase()
      )}
    </div>
  )
}

function TaskRow({ task, onToggle, locked, ownerLabel }) {
  const overdue = task.dueDate && task.dueDate < todayStr()

  if (locked) {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-black/5 last:border-b-0">
        <div className="w-5 h-5 rounded-full border border-black/10 flex-shrink-0 opacity-50" />
        <div className="flex items-center gap-1.5 text-[#b6a5b8] italic text-sm min-w-0">
          <FiLock size={11} className="flex-shrink-0" />
          <span className="truncate">{ownerLabel} has a private task</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-black/5 last:border-b-0">
      <button
        onClick={onToggle}
        aria-label="Mark task done"
        className="w-5 h-5 rounded-full border border-black/20 flex-shrink-0 hover:border-peach transition-colors"
      />
      <span className="flex-1 text-[15px] text-plumdeep truncate">{task.text}</span>
      {task.private && <FiLock size={11} className="text-[#b6a5b8] flex-shrink-0" />}
      {task.dueDate && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {overdue && <span className="w-1.5 h-1.5 rounded-full bg-[#e8635a]" />}
          <span
            className={`text-xs rounded-full px-2.5 py-1 font-medium whitespace-nowrap ${
              overdue ? 'bg-[#fbe4e1] text-[#c0473c]' : 'bg-black/[0.04] text-[#7a6a7c]'
            }`}
          >
            {dayjs(task.dueDate).format('MMM D')}
          </span>
        </div>
      )}
    </div>
  )
}

function TaskColumn({ avatar, title, tasks, firebaseUid, names, partner, onToggle }) {
  return (
    <div className="md:px-7 md:first:pl-0 md:last:pr-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {avatar}
          <div className="min-w-0">
            <div className="font-serif text-lg text-plumdeep truncate">{title}</div>
            <div className="text-xs text-[#9a8a9c]">
              {tasks.length} task{tasks.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="text-[#b6a5b8] hover:text-plumdeep hover:bg-black/5 rounded-full transition-colors p-1 flex-shrink-0"
          aria-label="More options"
        >
          <FiMoreHorizontal size={16} />
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-sm text-[#c3b3c5] italic py-2">Nothing here this week</div>
      ) : (
        tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            locked={isLockedFor(t, firebaseUid)}
            ownerLabel={names[t.ownerId] || partner?.displayName || 'Your partner'}
            onToggle={() => onToggle(t)}
          />
        ))
      )}
    </div>
  )
}

export default function Tasks() {
  const { firebaseUser, couple, profile } = useAuth()
  const { partner, partnerUid, hasPartner } = usePartner()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [tasks, setTasks] = useState([])
  const [text, setText] = useState('')
  const [assignee, setAssignee] = useState('either') // 'either' | 'me' | 'partner'
  const [dueDate, setDueDate] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

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
        private: isPrivate,
        ownerId: isPrivate ? firebaseUser.uid : null,
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
      setDueDate('')
      setIsPrivate(false)
      setShowDatePicker(false)
    } catch (e) {
      setText(t)
      toast.error("Couldn't add that task — try again.")
    }
  }

  async function toggle(task) {
    if (isLockedFor(task, firebaseUser.uid)) return
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

  // --- Week window ---------------------------------------------------
  const weekStart = useMemo(() => mondayOf(dayjs().add(weekOffset, 'week')), [weekOffset])
  const weekEnd = weekStart.add(6, 'day')
  const weekStartStr = weekStart.format('YYYY-MM-DD')
  const weekEndStr = weekEnd.format('YYYY-MM-DD')
  const weekLabel = `${weekStart.format('MMM D')} – ${weekEnd.format('MMM D, YYYY')}`

  // Open tasks due within the selected week. Undated tasks only show up
  // in the current week (they aren't scheduled anywhere in particular).
  const weekTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.done)
      .filter((t) => (t.dueDate ? t.dueDate >= weekStartStr && t.dueDate <= weekEndStr : weekOffset === 0))
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return 0
      })
  }, [tasks, weekStartStr, weekEndStr, weekOffset])

  const mineTasks = weekTasks.filter((t) => t.assignedTo === firebaseUser.uid)
  const partnerTasks = weekTasks.filter((t) => partnerUid && t.assignedTo === partnerUid)
  const eitherTasks = weekTasks.filter((t) => !t.assignedTo)

  // Completed this week, for the strip below the board.
  const completedThisWeek = useMemo(() => {
    return tasks
      .filter((t) => t.done && t.completedAt?.seconds)
      .filter((t) => {
        const d = dayjs.unix(t.completedAt.seconds).format('YYYY-MM-DD')
        return d >= weekStartStr && d <= weekEndStr
      })
      .sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
  }, [tasks, weekStartStr, weekEndStr])

  if (!hasPartner) {
    return (
      <div className="bg-white border border-black/10 rounded-3xl px-6 py-10 sm:px-10 sm:py-14 text-center">
        <h1 className="font-serif italic text-3xl text-plumdeep mb-2">What we're carrying this week</h1>
        <p className="text-sm text-[#7a6a7c]">Waiting for your partner to join with your invite code.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-white border border-black/10 rounded-3xl px-5 py-6 sm:px-9 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <h1 className="font-serif italic text-3xl sm:text-4xl text-plumdeep leading-tight">
            What we're carrying this week
          </h1>
          <div className="flex items-center gap-2 text-sm text-[#7a6a7c] flex-shrink-0">
            <span>{weekLabel}</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setWeekOffset((o) => o - 1)}
                aria-label="Previous week"
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
              >
                <FiChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((o) => o + 1)}
                aria-label="Next week"
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
              >
                <FiChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-black/10 gap-8 md:gap-0">
          <TaskColumn
            avatar={<Avatar photoURL={profile?.photoURL} name={profile?.displayName} />}
            title="Mine"
            tasks={mineTasks}
            firebaseUid={firebaseUser.uid}
            names={names}
            partner={partner}
            onToggle={toggle}
          />
          <TaskColumn
            avatar={<Avatar photoURL={partner?.photoURL} name={partner?.displayName} />}
            title={partner?.displayName || 'Partner'}
            tasks={partnerTasks}
            firebaseUid={firebaseUser.uid}
            names={names}
            partner={partner}
            onToggle={toggle}
          />
          <TaskColumn
            avatar={
              <div className="w-[38px] h-[38px] rounded-full bg-black/5 flex items-center justify-center flex-shrink-0">
                <FiUsers size={17} className="text-[#7a6a7c]" />
              </div>
            }
            title="Either of us"
            tasks={eitherTasks}
            firebaseUid={firebaseUser.uid}
            names={names}
            partner={partner}
            onToggle={toggle}
          />
        </div>

        {completedThisWeek.length > 0 && (
          <div className="mt-8 pt-6 border-t border-black/10">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#9a8a9c] mb-2">
              Completed this week
            </h3>
            {completedThisWeek.map((t) => {
              const locked = isLockedFor(t, firebaseUser.uid)
              return (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-black/5 last:border-b-0">
                  <button
                    onClick={() => toggle(t)}
                    aria-label="Mark task not done"
                    className={`w-5 h-5 rounded-full bg-peach/80 flex items-center justify-center flex-shrink-0 ${
                      locked ? 'cursor-not-allowed opacity-40' : ''
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </button>
                  {locked ? (
                    <span className="text-[#b6a5b8] italic text-sm">
                      {names[t.ownerId] || partner?.displayName || 'Your partner'} completed a private task
                    </span>
                  ) : (
                    <span className="text-sm text-[#b0a0b2] line-through truncate">{t.text}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-black/10 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2.5 flex-1 bg-black/[0.03] border border-black/10 rounded-xl px-4 py-2.5 min-w-0">
            <FiPlus size={16} className="text-[#b6a5b8] flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm text-plumdeep placeholder-[#b6a5b8] focus:outline-none min-w-0"
              placeholder="Add a task..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
            />
            <button
              type="button"
              onClick={() => setShowDatePicker((s) => !s)}
              title="Due date"
              aria-label="Set due date"
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                dueDate ? 'text-peach' : 'text-[#b6a5b8] hover:text-[#7a6a7c]'
              }`}
            >
              <FiCalendar size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsPrivate((p) => !p)}
              title="Only visible to me"
              aria-label="Toggle private task"
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                isPrivate ? 'text-peach' : 'text-[#b6a5b8] hover:text-[#7a6a7c]'
              }`}
            >
              <FiLock size={13} />
            </button>
          </div>

          {showDatePicker && (
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-black/[0.03] text-sm text-plumdeep rounded-xl px-3 py-2.5 border border-black/10 focus:outline-none flex-shrink-0"
            />
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-[#9a8a9c] hidden sm:inline">Assign to:</span>
            <button
              type="button"
              onClick={() => setAssignee('me')}
              title="Me"
              aria-label="Assign to me"
              className={`rounded-full transition-shadow ${
                assignee === 'me' ? 'ring-2 ring-peach' : 'ring-2 ring-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Avatar photoURL={profile?.photoURL} name={profile?.displayName || 'Me'} size={30} />
            </button>
            <button
              type="button"
              onClick={() => setAssignee('partner')}
              title={partner?.displayName || 'Partner'}
              aria-label="Assign to partner"
              className={`rounded-full transition-shadow ${
                assignee === 'partner' ? 'ring-2 ring-peach' : 'ring-2 ring-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Avatar photoURL={partner?.photoURL} name={partner?.displayName || 'Partner'} size={30} />
            </button>
            <button
              type="button"
              onClick={() => setAssignee('either')}
              title="Either of us"
              aria-label="Assign to either of us"
              className={`w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 bg-black/5 transition-shadow ${
                assignee === 'either' ? 'ring-2 ring-peach' : 'ring-2 ring-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <FiUsers size={14} className="text-[#7a6a7c]" />
            </button>
          </div>

          <button
            onClick={addTask}
            className="py-2.5 px-6 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep flex-shrink-0"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}