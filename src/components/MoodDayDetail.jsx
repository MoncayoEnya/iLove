import dayjs from 'dayjs'
import { FiSmile } from 'react-icons/fi'

// Mirrors DayDetailPanel's card style, but for a single day's mood check-ins
// instead of events/tasks/memories/notes.
export default function MoodDayDetail({ dateStr, todayStr, mine, theirs, names, firebaseUser, partnerUid }) {
  const isToday = dateStr === todayStr
  const label = dayjs(dateStr).format('dddd, MMMM D')

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <FiSmile size={16} className="text-peach" />
        {label}
        {isToday && (
          <span className="text-[10.5px] bg-blush text-plum px-2 py-0.5 rounded-full font-semibold">Today</span>
        )}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-black/10 p-3.5 flex items-center gap-3">
          <span className="text-2xl leading-none">{mine?.emoji || '·'}</span>
          <div>
            <div className="text-xs text-[#9a8a9c]">You</div>
            <div className="font-semibold text-sm">{mine?.label || 'No check-in'}</div>
          </div>
        </div>
        <div className="rounded-xl border border-black/10 p-3.5 flex items-center gap-3">
          <span className="text-2xl leading-none">{theirs?.emoji || '·'}</span>
          <div>
            <div className="text-xs text-[#9a8a9c]">{names?.[partnerUid] || 'Partner'}</div>
            <div className="font-semibold text-sm">{theirs?.label || 'No check-in'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
