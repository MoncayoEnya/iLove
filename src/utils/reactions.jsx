import { FiHeart, FiSmile, FiStar, FiSun, FiThumbsUp } from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'

// Icon reactions for memories and love jar notes, in the app's Feather
// icon style instead of emoji. Stored by `key`.
export const REACTIONS = [
  { key: 'love', label: 'Love', icon: FiHeart, color: '#e8635a', fill: true },
  { key: 'happy', label: 'Happy', icon: FiSmile, color: '#d9a35a' },
  { key: 'fire', label: 'Fire', icon: FaFire, color: '#e8a87c' },
  { key: 'star', label: 'Favorite', icon: FiStar, color: '#c9a227', fill: true },
  { key: 'warm', label: 'Warm', icon: FiSun, color: '#e8b978' },
  { key: 'yes', label: 'Agree', icon: FiThumbsUp, color: '#7a6a7c' },
]

export function reactionMeta(key) {
  return REACTIONS.find((r) => r.key === key) || null
}

export function ReactionIcon({ k, size = 14 }) {
  const r = reactionMeta(k)
  if (!r) return null
  const Icon = r.icon
  // Only outline (Feather) icons take a fill; the solid fire icon draws
  // itself and would disappear with fill="none".
  return <Icon size={size} style={{ color: r.color }} {...(r.fill ? { fill: 'currentColor' } : {})} />
}
