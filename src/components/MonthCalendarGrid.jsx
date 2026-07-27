import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { FiChevronLeft, FiChevronRight, FiHeart } from 'react-icons/fi'

// dayData: { 'YYYY-MM-DD': { events: [], tasks: [], memories: [], notes: [] } }
export default function MonthCalendarGrid({ month, selectedDate, onSelectDate, onPrevMonth, onNextMonth, dayData, todayStr }) {
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
    <div className="bg-white border border-black/10 rounded-2xl p-4 sm:p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="w-8 h-8 rounded-lg border border-black/10 flex items-center justify-center hover:bg-black/5"
        >
          <FiChevronLeft size={16} />
        </button>
        <h3 className="font-semibold text-sm">{month.format('MMMM YYYY')}</h3>
        <button
          onClick={onNextMonth}
          aria-label="Next month"
          className="w-8 h-8 rounded-lg border border-black/10 flex items-center justify-center hover:bg-black/5"
        >
          <FiChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-[#a892a9]">
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
          const thumb = info?.memories?.[0]?.photoData

          return (
            <motion.button
              key={dStr}
              whileTap={{ scale: 0.94 }}
              onClick={() => onSelectDate(dStr)}
              className={`relative aspect-square rounded-xl overflow-hidden flex flex-col items-center justify-center text-xs font-medium border transition-colors ${
                isSelected
                  ? 'border-peach ring-2 ring-peach/50'
                  : isToday
                  ? 'border-peach/60'
                  : 'border-black/5'
              } ${inMonth ? '' : 'opacity-35'}`}
            >
              {thumb ? (
                <>
                  <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/35" />
                  <span className="relative z-10 text-white font-semibold drop-shadow">{d.date()}</span>
                </>
              ) : (
                <span className={isToday ? 'text-peach font-bold' : 'text-ink'}>{d.date()}</span>
              )}

              {(info?.events?.length > 0 || info?.tasks?.length > 0 || info?.notes?.length > 0) && (
                <div className="absolute bottom-1 flex items-center gap-0.5 z-10">
                  {info?.events?.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-sm" title="Event" />
                  )}
                  {info?.tasks?.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-peach shadow-sm" title="Task due" />
                  )}
                  {info?.notes?.length > 0 && (
                    <FiHeart size={7} className="text-[#d97a6a] fill-current drop-shadow" title="Appreciation note" />
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
