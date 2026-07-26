import { useEffect, useMemo, useState } from 'react'
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
import { FiBell, FiRepeat, FiX } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'

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

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

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
  const names = useMemberNames(couple?.members)

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Shared calendar</h1>
        <p className="text-sm text-[#7a6a7c]">Plan dates, drop reminders, leave a love note on any day.</p>
      </div>

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
        {sortedDates.length === 0 && (
          <div className="text-sm text-[#a892a9] py-2.5">Nothing on the calendar yet.</div>
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