import { motion } from 'framer-motion'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import MoodIcon from './MoodIcon'

// dayData: { 'YYYY-MM-DD': { mine: checkinOrNull, partner: checkinOrNull } }
export default function MoodCalendarGrid({
  month,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  dayData,
  todayStr,
  hasPartner,
}) {
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
          const hasAny = Boolean(info?.mine || info?.partner)

          return (
            <motion.button
              key={dStr}
              whileTap={{ scale: 0.94 }}
              onClick={() => onSelectDate(dStr)}
              className={`relative aspect-square rounded-xl overflow-hidden flex flex-col items-center justify-center gap-0.5 text-xs font-medium border transition-colors ${
                isSelected
                  ? 'border-peach ring-2 ring-peach/50'
                  : isToday
                  ? 'border-peach/60'
                  : 'border-black/5'
              } ${inMonth ? '' : 'opacity-35'} ${hasAny ? 'bg-[#faf5f3]' : ''}`}
            >
              <span className={isToday ? 'text-peach font-bold' : 'text-ink'}>{d.date()}</span>
              <div className="flex items-center gap-0.5 h-3.5">
                {info?.mine && <MoodIcon mood={info.mine.mood} size={12} />}
                {hasPartner && info?.partner && <MoodIcon mood={info.partner.mood} size={12} />}
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
