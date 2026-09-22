import { motion } from 'framer-motion'
import { FiHeart } from 'react-icons/fi'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// dayData: { 'YYYY-MM-DD': { events: [], tasks: [], memories: [], notes: [] } }
// When mode="mood", dayData is instead { 'YYYY-MM-DD': { mine: {emoji,label}|null, theirs: {emoji,label}|null } }
//
// Month navigation (prev/next/today) now lives in the page header above this
// grid, so this component only needs the month to render and a selection
// callback — no more onPrevMonth/onNextMonth props.
export default function MonthCalendarGrid({ month, selectedDate, onSelectDate, dayData, todayStr, mode = 'events' }) {
  const startOfMonth = month.startOf('month')
  const endOfMonth = month.endOf('month')
  const gridStart = startOfMonth.startOf('week')
  const gridEnd = endOfMonth.endOf('week')

  const days = []
  let cur = gridStart
  while (cur.isBefore(gridEnd) || cur.isSame(gridEnd, 'day')) {
    days.push(cur)
    cur = cur.add(1, 'day')
  }

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-3 sm:p-5">
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="text-center text-[10.5px] sm:text-xs font-medium text-[#9a8a9c]">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {days.map((d) => {
          const dStr = d.format('YYYY-MM-DD')
          const inMonth = d.isSame(month, 'month')
          const isToday = dStr === todayStr
          const isSelected = dStr === selectedDate
          const info = dayData[dStr]
          const thumb = mode === 'events' ? info?.memories?.[0]?.photoData : null

          // Up to a couple of item chips per cell (dot + label), like a real
          // planner — anything past that collapses into "+N more" so a busy
          // day doesn't blow out the grid.
          const items =
            mode === 'events'
              ? [
                  ...(info?.events || []).map((e) => ({ id: `e-${e.id}`, kind: 'event', label: e.title })),
                  ...(info?.tasks || [])
                    .filter((t) => !t.done)
                    .map((t) => ({ id: `t-${t.id}`, kind: 'task', label: t.text })),
                  ...(info?.notes?.length
                    ? [
                        {
                          id: 'notes',
                          kind: 'note',
                          label: `${info.notes.length} love note${info.notes.length === 1 ? '' : 's'}`,
                        },
                      ]
                    : []),
                ]
              : []
          const maxVisible = thumb ? 1 : 2
          const visibleItems = items.slice(0, maxVisible)
          const extraCount = items.length - visibleItems.length

          return (
            <motion.button
              key={dStr}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelectDate(dStr)}
              className={`relative min-h-[74px] sm:min-h-[104px] rounded-xl p-1 sm:p-2 flex flex-col items-start text-left border overflow-hidden transition-colors ${
                isSelected ? 'bg-peach/10 border-peach/40' : 'border-black/5 hover:bg-black/5'
              } ${inMonth ? '' : 'opacity-35'}`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-[11px] sm:text-xs font-semibold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                    isToday ? 'border-2 border-peach text-peach' : 'text-ink'
                  }`}
                >
                  {d.date()}
                </span>
                {thumb && (
                  <img
                    src={thumb}
                    alt=""
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-md object-cover flex-shrink-0 ml-1"
                  />
                )}
              </div>

              {mode === 'mood' ? (
                <span className="flex items-center gap-0.5 leading-none text-sm mt-1.5 mx-auto">
                  <span title={info?.mine?.label || 'No check-in'}>{info?.mine?.emoji || '·'}</span>
                  <span title={info?.theirs?.label || 'No check-in'}>{info?.theirs?.emoji || '·'}</span>
                </span>
              ) : (
                <div className="flex flex-col gap-0.5 w-full mt-1 min-w-0">
                  {visibleItems.map((it) => (
                    <div key={it.id} className="flex items-center gap-1 min-w-0">
                      {it.kind === 'note' ? (
                        <FiHeart size={7} className="text-[#d97a6a] fill-current flex-shrink-0" />
                      ) : (
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            it.kind === 'task' ? 'bg-peach' : 'bg-gold'
                          }`}
                        />
                      )}
                      <span className="hidden sm:inline text-[10.5px] text-[#6b5a6d] truncate">{it.label}</span>
                    </div>
                  ))}
                  {extraCount > 0 && (
                    <span className="hidden sm:inline text-[10px] text-[#a892a9] pl-2.5">+{extraCount} more</span>
                  )}
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}