import { Link } from 'react-router-dom'
import { FiBell, FiCheckSquare, FiHeart, FiRepeat } from 'react-icons/fi'
import { friendlyDate } from '../utils/date'

export default function DayDetailPanel({ dateStr, todayStr, events, tasks, memories, notes, names }) {
  const nothing = events.length === 0 && tasks.length === 0 && memories.length === 0 && notes.length === 0

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
      <h3 className="font-semibold mb-3">{friendlyDate(dateStr, todayStr)}</h3>

      {nothing && (
        <div className="text-sm text-[#a892a9]">
          Nothing here yet — add an event below, or drop a{' '}
          <Link to="/memories?tab=jar" className="text-peach font-semibold">
            love note
          </Link>{' '}
          or a{' '}
          <Link to="/memories" className="text-peach font-semibold">
            memory
          </Link>{' '}
          on this day.
        </div>
      )}

      {events.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {events.map((ev) => (
            <div key={ev.id} className="text-sm flex items-center gap-2 flex-wrap">
              {ev.time && <span className="text-xs text-[#9a8a9c]">{ev.time}</span>}
              <span className="font-medium">{ev.title}</span>
              {ev.recurrence && <FiRepeat size={11} className="text-[#9a8a9c]" />}
              {ev.reminder && <FiBell size={11} className="text-[#9a8a9c]" />}
            </div>
          ))}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {tasks.map((t) => (
            <div key={t.id} className="text-sm flex items-center gap-2">
              <FiCheckSquare size={13} className={t.done ? 'text-[#7fae7f]' : 'text-[#9a8a9c]'} />
              <span className={t.done ? 'line-through text-[#a892a9]' : ''}>{t.text}</span>
            </div>
          ))}
        </div>
      )}

      {memories.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {memories.map((m) => (
            <img
              key={m.id}
              src={m.photoData}
              alt={m.caption || ''}
              className="w-full aspect-square object-cover rounded-lg border border-black/10"
            />
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <div key={n.id} className="jar-note text-[13.5px] p-2.5 flex items-start gap-1.5">
              <FiHeart size={12} className="text-[#d97a6a] fill-current flex-shrink-0 mt-0.5" />
              <span>
                "{n.text}" <span className="not-italic text-[#9a8a9c]">— {names[n.from] || '...'}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
