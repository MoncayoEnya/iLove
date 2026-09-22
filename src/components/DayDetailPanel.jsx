import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import { FiBell, FiCheckSquare, FiHeart, FiLock, FiMoreVertical, FiPlus, FiRepeat } from 'react-icons/fi'
import { isLockedFor } from '../utils/privacy'

const RECUR_BADGE = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }

/** '14:30' -> '2:30 PM'. Falls back to the raw string if it doesn't parse. */
function formatTime(t) {
  const parsed = dayjs(`2000-01-01T${t}`)
  return parsed.isValid() ? parsed.format('h:mm A') : t
}

/** A little variety so every event isn't the same dull dot — pure styling,
 *  no data model change. Keeps to hex tokens the app's dark-mode CSS already
 *  overrides (see index.css) so this stays legible in both themes. */
function eventDotClass(title = '') {
  const t = title.toLowerCase()
  if (/gym|workout|run|hike|fitness/.test(t)) return 'bg-gold'
  if (/date|dinner|movie|beach|kiss|anniversary|love/.test(t)) return 'bg-[#d97a6a]'
  return 'bg-[#7fae7f]'
}

function EventRow({ ev, uid, names, partnerLabel, confirming, onRequestDelete, onDeleteSingle, onDeleteSeries, onCancelDelete }) {
  const locked = isLockedFor(ev, uid)
  return (
    <div className="flex items-start gap-3 py-3 border-b border-black/10 last:border-b-0">
      <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${eventDotClass(ev.title)}`} />
      <div className="flex-1 min-w-0">
        {locked ? (
          <div className="text-sm italic text-[#9a8a9c] flex items-center gap-1.5 flex-wrap">
            <FiLock size={11} className="flex-shrink-0" />
            {names[ev.ownerId] || partnerLabel || 'Your partner'} has a private reminder
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              {ev.time && <span className="text-xs text-[#9a8a9c]">{formatTime(ev.time)}</span>}
              <span className="font-semibold text-[15px]">{ev.title}</span>
            </div>
            {ev.note && <div className="text-sm text-[#9a8a9c] mt-0.5">{ev.note}</div>}
            {(ev.private || ev.recurrence || ev.reminder) && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {ev.private && (
                  <span className="flex items-center gap-1 text-[10px] text-[#9a8a9c] border border-black/10 rounded-full px-2 py-0.5">
                    <FiLock size={9} /> Only me
                  </span>
                )}
                {ev.recurrence && (
                  <span className="flex items-center gap-1 text-[10px] text-[#9a8a9c] border border-black/10 rounded-full px-2 py-0.5">
                    <FiRepeat size={10} /> {RECUR_BADGE[ev.recurrence]}
                  </span>
                )}
                {ev.reminder && (
                  <span className="flex items-center gap-1 text-[10px] text-[#9a8a9c] border border-black/10 rounded-full px-2 py-0.5">
                    <FiBell size={10} />
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!locked &&
        (confirming ? (
          <div className="flex flex-col gap-1 items-end flex-shrink-0">
            <button
              onClick={onDeleteSingle}
              className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-[#e5b7b7] text-[#9b3b3b] whitespace-nowrap"
            >
              Delete this one
            </button>
            {ev.seriesId && (
              <button
                onClick={onDeleteSeries}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-[#e5b7b7] text-[#9b3b3b] whitespace-nowrap"
              >
                Delete this & future
              </button>
            )}
            <button
              onClick={onCancelDelete}
              className="text-[11px] px-2 py-1 rounded-lg border border-black/10 whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onRequestDelete}
            className="text-[#9a8a9c] hover:text-[#9b3b3b] p-1 flex-shrink-0"
            title="Options"
            aria-label={`Options for ${ev.title || 'event'}`}
          >
            <FiMoreVertical size={15} />
          </button>
        ))}
    </div>
  )
}

export default function DayDetailPanel({
  dateStr,
  todayStr,
  events,
  tasks,
  memories,
  notes,
  names,
  uid,
  partnerLabel,
  onAddClick,
  confirmingDelete,
  onRequestDelete,
  onDeleteSingle,
  onDeleteSeries,
  onCancelDelete,
}) {
  const isToday = dateStr === todayStr
  const d = dayjs(dateStr)
  const nothing = events.length === 0 && tasks.length === 0 && memories.length === 0 && notes.length === 0

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5">
      <div className="text-xs font-semibold text-[#9a8a9c] uppercase tracking-wide">{d.format('ddd')}</div>
      <h3 className="font-serif text-2xl leading-tight mb-4 flex items-center gap-2 flex-wrap">
        {d.format('MMMM D, YYYY')}
        {isToday && (
          <span className="text-[10.5px] font-sans font-semibold bg-blush text-plum px-2 py-0.5 rounded-full">
            Today
          </span>
        )}
      </h3>

      {nothing && (
        <div className="text-sm text-[#a892a9] mb-1">
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
        <div className="flex flex-col mb-1">
          {events.map((ev) => (
            <EventRow
              key={ev.id}
              ev={ev}
              uid={uid}
              names={names}
              partnerLabel={partnerLabel}
              confirming={confirmingDelete === ev.id}
              onRequestDelete={() => onRequestDelete(ev.id)}
              onDeleteSingle={() => onDeleteSingle(ev)}
              onDeleteSeries={() => onDeleteSeries(ev)}
              onCancelDelete={onCancelDelete}
            />
          ))}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2 mb-1">
          {tasks.map((t) => {
            const locked = isLockedFor(t, uid)
            return (
              <div key={t.id} className="text-sm flex items-center gap-2">
                <FiCheckSquare size={13} className={`flex-shrink-0 ${t.done ? 'text-[#7fae7f]' : 'text-[#9a8a9c]'}`} />
                {locked ? (
                  <span className="flex items-center gap-1.5 italic text-[#9a8a9c]">
                    <FiLock size={11} /> {names[t.ownerId] || partnerLabel || 'Your partner'} has a private task
                  </span>
                ) : (
                  <span className={t.done ? 'line-through text-[#a892a9]' : ''}>{t.text}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {memories.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2 mb-1">
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
        <div className="flex flex-col gap-2 mt-2">
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

      <button
        onClick={onAddClick}
        className="w-full mt-4 py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep flex items-center justify-center gap-1.5"
      >
        <FiPlus size={15} /> Add event
      </button>
    </div>
  )
}