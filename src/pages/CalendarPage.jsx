import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { FiBell, FiCalendar, FiRepeat, FiX } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import { todayStr } from '../utils/date'
import MonthCalendarGrid from '../components/MonthCalendarGrid'
import DayDetailPanel from '../components/DayDetailPanel'
import EmptyState from '../components/EmptyState'

// Firestore returns Timestamp objects for fields written with
// serverTimestamp()/new Date(). This normalizes either shape to 'YYYY-MM-DD'
// so memories/tasks/notes can be bucketed onto the same grid as events.
function tsToDateStr(ts) {
  if (!ts) return null
  if (typeof ts.toDate === 'function') return dayjs(ts.toDate()).format('YYYY-MM-DD')
  if (ts instanceof Date) return dayjs(ts).format('YYYY-MM-DD')
  return null
}

const TOPUP_DAYS = 90 // keep recurring events generated 3 months ahead

const RECUR_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
]

const REMINDER_OPTIONS = [
  { value: 'none', label: 'No reminder' },
  { value: '0', label: 'At the time' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
]

const RECUR_BADGE = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }

function advance(dateObj, freq) {
  const d = new Date(dateObj)
  if (freq === 'daily') d.setDate(d.getDate() + 1)
  else if (freq === 'weekly') d.setDate(d.getDate() + 7)
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return d
}

function generateOccurrenceDates(startDateStr, freq, horizonDate) {
  const dates = []
  let cur = new Date(`${startDateStr}T00:00:00`)
  let guard = 0
  while (cur <= horizonDate && guard < 400) {
    dates.push(cur.toISOString().slice(0, 10))
    cur = advance(cur, freq)
    guard += 1
  }
  return dates
}

function computeReminderAt(dateStr, timeStr, minutesBefore) {
  const dt = new Date(`${dateStr}T${timeStr || '09:00'}:00`)
  return new Date(dt.getTime() - minutesBefore * 60000)
}

function formatCountdown(targetMs) {
  const diff = targetMs - Date.now()
  if (diff <= 0) return 'now'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `in ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `in ${hours} hr${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return `in ${days} day${days === 1 ? '' : 's'}`
}

export default function CalendarPage() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [memories, setMemories] = useState([])
  const [jarNotes, setJarNotes] = useState([])
  const names = useMemberNames(couple?.members)

  const [month, setMonth] = useState(dayjs())
  const [selectedDate, setSelectedDate] = useState(todayStr())

  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [recurrence, setRecurrence] = useState('none')
  const [reminderChoice, setReminderChoice] = useState('none')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(null) // event id

  // --- Load events ---
  useEffect(() => {
    if (!coupleId) return
    const q = query(collection(db, 'couples', coupleId, 'events'), orderBy('date'))
    const unsub = onSnapshot(q, (snap) => setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [coupleId])

  // --- Load tasks, memories, and jar notes for the day-highlights grid ---
  useEffect(() => {
    if (!coupleId) return
    const unsubTasks = onSnapshot(collection(db, 'couples', coupleId, 'tasks'), (snap) =>
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    const unsubMemories = onSnapshot(collection(db, 'couples', coupleId, 'memories'), (snap) =>
      setMemories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    const unsubJar = onSnapshot(collection(db, 'couples', coupleId, 'jar'), (snap) =>
      setJarNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return () => {
      unsubTasks()
      unsubMemories()
      unsubJar()
    }
  }, [coupleId])

  // --- Keep recurring series topped up to a rolling 3-month window ---
  useEffect(() => {
    if (!coupleId) return
    ;(async () => {
      const seriesSnap = await getDocs(
        query(collection(db, 'couples', coupleId, 'recurringSeries'), where('active', '==', true))
      )
      const horizon = new Date()
      horizon.setDate(horizon.getDate() + TOPUP_DAYS)
      const horizonStr = horizon.toISOString().slice(0, 10)

      for (const seriesDoc of seriesSnap.docs) {
        const series = seriesDoc.data()
        if (!series.lastGeneratedDate || series.lastGeneratedDate >= horizonStr) continue
        const nextStart = advance(new Date(`${series.lastGeneratedDate}T00:00:00`), series.freq)
        const occurrenceDates = generateOccurrenceDates(
          nextStart.toISOString().slice(0, 10),
          series.freq,
          horizon
        )
        if (occurrenceDates.length === 0) continue

        const batch = writeBatch(db)
        occurrenceDates.forEach((d) => {
          const evRef = doc(collection(db, 'couples', coupleId, 'events'))
          batch.set(evRef, {
            date: d,
            time: series.time || null,
            title: series.title,
            note: series.note || '',
            recurrence: series.freq,
            seriesId: seriesDoc.id,
            reminder: series.reminder || null,
            reminderAt: series.reminder ? computeReminderAt(d, series.time, series.reminder.minutesBefore) : null,
            createdBy: series.createdBy,
            createdAt: serverTimestamp(),
          })
        })
        batch.update(seriesDoc.ref, { lastGeneratedDate: occurrenceDates[occurrenceDates.length - 1] })
        await batch.commit()
      }
    })()
  }, [coupleId])

  async function addEvent() {
    if (!title.trim() || !coupleId || saving) return
    setSaving(true)
    try {
      const reminderMinutes = reminderChoice === 'none' ? null : Number(reminderChoice)
      const reminder = reminderMinutes == null ? null : { minutesBefore: reminderMinutes }

      if (recurrence === 'none') {
        await addDoc(collection(db, 'couples', coupleId, 'events'), {
          date,
          time: time || null,
          title: title.trim(),
          note: note.trim(),
          recurrence: null,
          seriesId: null,
          reminder,
          reminderAt: reminder ? computeReminderAt(date, time, reminder.minutesBefore) : null,
          createdBy: firebaseUser.uid,
          createdAt: serverTimestamp(),
        })
      } else {
        const horizon = new Date()
        horizon.setDate(horizon.getDate() + TOPUP_DAYS)
        const occurrenceDates = generateOccurrenceDates(date, recurrence, horizon)
        const seriesRef = doc(collection(db, 'couples', coupleId, 'recurringSeries'))

        const batch = writeBatch(db)
        batch.set(seriesRef, {
          title: title.trim(),
          note: note.trim(),
          freq: recurrence,
          time: time || null,
          reminder,
          startDate: date,
          lastGeneratedDate: occurrenceDates[occurrenceDates.length - 1],
          active: true,
          createdBy: firebaseUser.uid,
          createdAt: serverTimestamp(),
        })
        occurrenceDates.forEach((d) => {
          const evRef = doc(collection(db, 'couples', coupleId, 'events'))
          batch.set(evRef, {
            date: d,
            time: time || null,
            title: title.trim(),
            note: note.trim(),
            recurrence,
            seriesId: seriesRef.id,
            reminder,
            reminderAt: reminder ? computeReminderAt(d, time, reminder.minutesBefore) : null,
            createdBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
          })
        })
        await batch.commit()
      }

      setTitle('')
      setNote('')
      setTime('')
      setRecurrence('none')
      setReminderChoice('none')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSingle(ev) {
    await deleteDoc(doc(db, 'couples', coupleId, 'events', ev.id))
    setConfirmingDelete(null)
  }

  async function deleteSeriesFromHere(ev) {
    const q = query(
      collection(db, 'couples', coupleId, 'events'),
      where('seriesId', '==', ev.seriesId),
      where('date', '>=', ev.date)
    )
    const snap = await getDocs(q)
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    batch.update(doc(db, 'couples', coupleId, 'recurringSeries', ev.seriesId), { active: false })
    await batch.commit()
    setConfirmingDelete(null)
  }

  const upcomingReminders = useMemo(() => {
    const now = Date.now()
    return events
      .filter((e) => e.reminderAt)
      .map((e) => ({ ...e, _at: e.reminderAt.toMillis ? e.reminderAt.toMillis() : new Date(e.reminderAt).getTime() }))
      .filter((e) => e._at >= now)
      .sort((a, b) => a._at - b._at)
      .slice(0, 5)
  }, [events])

  const groupedByDate = useMemo(() => {
    const groups = {}
    events.forEach((ev) => {
      if (!groups[ev.date]) groups[ev.date] = []
      groups[ev.date].push(ev)
    })
    Object.values(groups).forEach((list) =>
      list.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    )
    return groups
  }, [events])

  const sortedDates = Object.keys(groupedByDate).sort()

  const dayData = useMemo(() => {
    const map = {}
    const bucket = (dStr) => {
      if (!dStr) return null
      if (!map[dStr]) map[dStr] = { events: [], tasks: [], memories: [], notes: [] }
      return map[dStr]
    }
    events.forEach((ev) => bucket(ev.date)?.events.push(ev))
    tasks.forEach((t) => bucket(t.dueDate)?.tasks.push(t))
    memories.forEach((m) => bucket(tsToDateStr(m.createdAt))?.memories.push(m))
    jarNotes.forEach((n) => bucket(tsToDateStr(n.createdAt))?.notes.push(n))
    return map
  }, [events, tasks, memories, jarNotes])

  const selectedDayInfo = dayData[selectedDate] || { events: [], tasks: [], memories: [], notes: [] }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Shared calendar</h1>
        <p className="text-sm text-[#7a6a7c]">Plan dates, drop reminders, leave a love note on any day.</p>
      </div>

      <MonthCalendarGrid
        month={month}
        selectedDate={selectedDate}
        onSelectDate={(d) => {
          setSelectedDate(d)
          setDate(d)
        }}
        onPrevMonth={() => setMonth((m) => m.subtract(1, 'month'))}
        onNextMonth={() => setMonth((m) => m.add(1, 'month'))}
        dayData={dayData}
        todayStr={todayStr()}
      />

      <DayDetailPanel
        dateStr={selectedDate}
        todayStr={todayStr()}
        events={selectedDayInfo.events}
        tasks={selectedDayInfo.tasks}
        memories={selectedDayInfo.memories}
        notes={selectedDayInfo.notes}
        names={names}
      />

      {upcomingReminders.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FiBell size={16} className="text-peach" /> Upcoming reminders
          </h3>
          <div className="flex flex-col gap-2">
            {upcomingReminders.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between text-sm">
                <span>
                  {ev.title}{' '}
                  <span className="text-[#9a8a9c]">
                    — {ev.date}
                    {ev.time ? ` ${ev.time}` : ''}
                  </span>
                </span>
                <span className="text-[10.5px] bg-blush text-plum px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                  {formatCountdown(ev._at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-black/10 rounded-2xl p-5">
        <h3 className="font-semibold mb-3">All events</h3>
        {sortedDates.length === 0 && (
          <EmptyState
            icon={FiCalendar}
            title="Nothing on the calendar yet"
            subtitle="Plan a date night, an anniversary reminder, or anything worth marking — add it below."
          />
        )}

        {sortedDates.map((d) => (
          <div key={d} className="py-2.5 border-b border-black/10 last:border-b-0">
            <div className="text-[10.5px] bg-blush text-plum px-2 py-0.5 rounded-full font-semibold inline-block mb-2">
              {d}
              {d === todayStr() ? ' · Today' : ''}
            </div>
            {groupedByDate[d].map((ev) => (
              <div key={ev.id} className="flex items-start gap-2.5 py-2">
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2 flex-wrap">
                    {ev.time && <span className="text-xs text-[#9a8a9c] font-normal">{ev.time}</span>}
                    {ev.title}
                    {ev.recurrence && (
                      <span className="flex items-center gap-1 text-[10px] text-[#9a8a9c] font-normal border border-black/10 rounded-full px-2 py-0.5">
                        <FiRepeat size={10} /> {RECUR_BADGE[ev.recurrence]}
                      </span>
                    )}
                    {ev.reminder && (
                      <span className="flex items-center gap-1 text-[10px] text-[#9a8a9c] font-normal border border-black/10 rounded-full px-2 py-0.5">
                        <FiBell size={10} />{' '}
                        {REMINDER_OPTIONS.find((r) => r.value === String(ev.reminder.minutesBefore))?.label}
                      </span>
                    )}
                  </div>
                  {ev.note && <div className="jar-note mt-1.5 text-[13.5px] p-2.5">{ev.note}</div>}
                  <div className="text-xs text-[#9a8a9c] mt-1">added by {names[ev.createdBy] || '...'}</div>
                </div>

                {confirmingDelete === ev.id ? (
                  <div className="flex flex-col gap-1 items-end">
                    <button
                      onClick={() => deleteSingle(ev)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#e5b7b7] text-[#9b3b3b] whitespace-nowrap"
                    >
                      Delete this one
                    </button>
                    {ev.seriesId && (
                      <button
                        onClick={() => deleteSeriesFromHere(ev)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#e5b7b7] text-[#9b3b3b] whitespace-nowrap"
                      >
                        Delete this & future
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmingDelete(null)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-black/10 whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(ev.id)}
                    className="text-[#9a8a9c] hover:text-[#9b3b3b] px-2 py-1"
                    title="Delete"
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}

        <div className="mt-4 pt-4 border-t border-black/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Date</label>
              <input
                type="date"
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Time (optional)</label>
              <input
                type="time"
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <label className="block text-xs text-[#6b5a6d] mt-3.5 mb-1.5 font-semibold">What is it</label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="e.g. Movie night, her birthday, date night"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className="block text-xs text-[#6b5a6d] mt-3.5 mb-1.5 font-semibold">
            Love note or reminder detail (optional)
          </label>
          <textarea
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="e.g. Thank you for always believing in me."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">
            <div>
              <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Repeats</label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm bg-white"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
              >
                {RECUR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Reminder</label>
              <select
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm bg-white"
                value={reminderChoice}
                onChange={(e) => setReminderChoice(e.target.value)}
              >
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {recurrence !== 'none' && (
            <div className="text-xs text-[#9a8a9c] mt-2">
              This will create occurrences every {recurrence.replace('ly', '')} out to about 3 months ahead,
              and keep topping up automatically after that.
            </div>
          )}

          <button
            onClick={addEvent}
            disabled={saving}
            className="mt-3 py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60"
          >
            {saving ? 'Adding...' : 'Add to calendar'}
          </button>
        </div>
      </div>
    </div>
  )
}