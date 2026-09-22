import {
  FiAward,
  FiCalendar,
  FiCheckSquare,
  FiCompass,
  FiDollarSign,
  FiFeather,
  FiHome,
  FiImage,
  FiList,
  FiMapPin,
  FiMessageCircle,
  FiMusic,
  FiSmile,
  FiTarget,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'

// Single source of truth for every navigable feature in the app. Both the
// favorites icon rail and the full feature sidebar read from this so the
// two stay in sync automatically — add a route here once and it shows up
// in both places (and in the "edit favorites" picker) for free.
export const navGroups = [
  {
    label: 'Core',
    items: [
      { to: '/dashboard', icon: FiHome, label: 'Dashboard', end: true },
      { to: '/chat', icon: FiMessageCircle, label: 'Chat' },
    ],
  },
  {
    label: 'Today',
    items: [
      { to: '/insights', icon: FiTrendingUp, label: 'Insights' },
      { to: '/checkins', icon: FiSmile, label: 'Check-ins' },
    ],
  },
  {
    label: 'Planner',
    items: [
      { to: '/tasks', icon: FiCheckSquare, label: 'Tasks' },
      { to: '/calendar', icon: FiCalendar, label: 'Calendar' },
      { to: '/goals', icon: FiTarget, label: 'Goals' },
      { to: '/bucket-list', icon: FiList, label: 'Bucket list' },
      { to: '/achievements', icon: FiAward, label: 'Achievements' },
    ],
  },
  {
    label: 'Together',
    items: [
      { to: '/memories', icon: FiImage, label: 'Memories' },
      { to: '/date-ideas', icon: FiCompass, label: 'Date ideas' },
      { to: '/places', icon: FiMapPin, label: 'Shared places' },
      { to: '/playlist', icon: FiMusic, label: 'Shared playlist' },
      { to: '/savings', icon: FiDollarSign, label: 'Shared savings' },
      { to: '/conflict', icon: FiUsers, label: 'Conflict recovery' },
      { to: '/play', icon: FiFeather, label: 'Flappy Date' },
    ],
  },
]

// Flat lookup, handy for the favorites rail / picker.
export const navItemsFlat = navGroups.flatMap((g) => g.items)

export function findNavItem(to) {
  return navItemsFlat.find((item) => item.to === to)
}

export const DEFAULT_FAVORITE_PATHS = ['/dashboard', '/chat', '/tasks', '/memories']