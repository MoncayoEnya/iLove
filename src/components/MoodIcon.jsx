import { moodInfo } from '../utils/moods'

/**
 * Renders a single mood as a colored icon (no emoji). Falls back to a
 * neutral placeholder dot when there's no mood for that slot yet.
 */
export default function MoodIcon({ mood, size = 16, className = '' }) {
  const m = moodInfo(mood)
  if (!m) {
    return <span className={`inline-block w-1.5 h-1.5 rounded-full bg-black/15 ${className}`} />
  }
  const Icon = m.icon
  return <Icon size={size} style={{ color: m.color }} className={className} />
}
