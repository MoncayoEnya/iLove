import { FiCloudRain, FiFrown, FiMeh, FiSmile, FiSun } from 'react-icons/fi'

// `e` (emoji) is kept for any older screen that still reads it; new UI
// uses `icon` + `color` through components/MoodIcon.jsx.
export const MOODS = [
  { v: 'amazing', e: '😊', l: 'Amazing', icon: FiSun, color: '#e8a87c' },
  { v: 'good', e: '🙂', l: 'Good', icon: FiSmile, color: '#d9a35a' },
  { v: 'okay', e: '😐', l: 'Okay', icon: FiMeh, color: '#9a8a9c' },
  { v: 'sad', e: '😔', l: 'Sad', icon: FiFrown, color: '#7a8fb8' },
  { v: 'hard', e: '😢', l: 'Hard day', icon: FiCloudRain, color: '#c0473c' },
]

// Look up one mood by its value ('amazing', 'good'…). Returns null if unknown.
export function moodInfo(v) {
  return MOODS.find((m) => m.v === v) || null
}