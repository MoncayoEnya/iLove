import { Link } from 'react-router-dom'
import { HiSparkles } from 'react-icons/hi2'
import { FiArrowRight } from 'react-icons/fi'
import { useCompanion } from '../hooks/useCompanion'

/** Small Dashboard card that either promotes turning Companion on, or
 *  teases the latest suggestion. Drop into Dashboard.jsx wherever the
 *  other summary cards live: `<CompanionTeaserCard />`. */
export default function CompanionTeaserCard() {
  const { enabled, latest } = useCompanion()

  return (
    <Link
      to="/companion"
      className="block bg-white border border-black/10 rounded-2xl p-5 hover:border-peach/40 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#9a8a9c]">
          <HiSparkles size={15} className="text-peach" />
          <span className="text-xs font-semibold uppercase tracking-wide">AI Companion</span>
        </div>
        <FiArrowRight size={14} className="text-[#c9b8cb]" />
      </div>

      {!enabled ? (
        <p className="text-sm mt-2 text-ink">
          Turn on a gentle, optional suggestion based on how you two are doing.
        </p>
      ) : latest && !latest.dismissed ? (
        <p className="text-sm mt-2 text-ink line-clamp-2">{latest.text}</p>
      ) : (
        <p className="text-sm mt-2 text-ink">Get today's suggestion →</p>
      )}
    </Link>
  )
}
