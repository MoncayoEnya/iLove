import {
  FiActivity,
  FiCalendar,
  FiCheckSquare,
  FiClock,
  FiGift,
  FiHeart,
  FiMessageSquare,
  FiSmile,
  FiTarget,
} from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'

// Every widget the Connection view can show. The person picks which ones
// are on and in what order (saved on their own users/{uid} doc as
// `connectionWidgets`); `wide` widgets take two columns on bigger screens.
//
// Adding a widget later: add it here (and render it in ConnectionView's
// WIDGET_RENDERERS). Saved layouts pick it up automatically at the end.
export const CONNECTION_WIDGETS = [
  { id: 'moods', label: 'Moods today', hint: 'How you both feel, plus a nudge', icon: FiSmile, wide: true, defaultOn: true },
  { id: 'health', label: 'Relationship health', hint: 'Your weekly score and what makes it', icon: FiActivity, defaultOn: true },
  { id: 'question', label: 'Question of the day', hint: 'Answer to see theirs', icon: FiMessageSquare, wide: true, defaultOn: true },
  { id: 'tasks', label: 'Your tasks', hint: 'Tick them off right here', icon: FiCheckSquare, defaultOn: true },
  { id: 'nextup', label: 'Next up', hint: 'Countdown or your next plan', icon: FiCalendar, wide: true, defaultOn: true },
  { id: 'appreciation', label: 'Appreciation for you', hint: 'Love jar notes from them', icon: FiGift, defaultOn: true },
  { id: 'streak', label: 'Streak', hint: 'Days you both checked in', icon: FaFire, defaultOn: true },
  { id: 'onthisday', label: 'On this day', hint: 'A memory from before', icon: FiClock, wide: true, defaultOn: true },
  { id: 'lovelanguage', label: 'Their love language', hint: 'How they feel most loved', icon: FiHeart, defaultOn: true },
  { id: 'goals', label: 'Keep building', hint: 'A shortcut to your shared goals', icon: FiTarget, defaultOn: false },
]

export const DEFAULT_LAYOUT = CONNECTION_WIDGETS.map((w) => ({ id: w.id, on: w.defaultOn }))

// Merge a saved layout with the current widget list: keeps the saved order
// and on/off choices, drops widgets that no longer exist, and appends any
// new ones with their default setting.
export function normalizeLayout(saved) {
  const known = new Set(CONNECTION_WIDGETS.map((w) => w.id))
  const out = []
  const seen = new Set()
  ;(Array.isArray(saved) ? saved : []).forEach((item) => {
    if (item && known.has(item.id) && !seen.has(item.id)) {
      out.push({ id: item.id, on: !!item.on })
      seen.add(item.id)
    }
  })
  CONNECTION_WIDGETS.forEach((w) => {
    if (!seen.has(w.id)) out.push({ id: w.id, on: w.defaultOn })
  })
  return out
}

export function widgetMeta(id) {
  return CONNECTION_WIDGETS.find((w) => w.id === id)
}
