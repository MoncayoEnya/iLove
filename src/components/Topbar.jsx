import dayjs from 'dayjs'
import { FiBell, FiChevronRight, FiHeart } from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { usePartner } from '../hooks/usePartner'
import ThemeToggle from './ThemeToggle'
import GlobalSearch from './GlobalSearch'

function greeting() {
  const h = dayjs().hour()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function Avatar({ name, photoURL, tone }) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-white overflow-hidden flex-shrink-0 ${tone}`}
      title={name}
    >
      {photoURL ? (
        <img src={photoURL} alt="" className="w-full h-full object-cover" />
      ) : (
        (name || '?')[0]?.toUpperCase()
      )}
    </div>
  )
}

// The single top bar for the whole app — greeting, search, the couple's
// streak, dark-mode, notifications, and the synced "you & partner" profile
// cluster all live here now, so Sidebar / IconRail only have to worry about
// navigation. Renders on every breakpoint and theme; mobile gets a
// condensed version since the greeting/date already has room to breathe on
// desktop but would crowd a phone screen.
export default function Topbar({ onOpenConnection }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const { profile, couple } = useAuth()
  const { partner } = usePartner()

  const coupleLabel = partner
    ? `${profile?.displayName || 'You'} & ${partner?.displayName || 'Partner'}`
    : profile?.displayName || 'You'

  // Same source as the Insights page's day count — whichever partner has
  // set an anniversary date.
  const anniversaryDate = profile?.anniversaryDate || partner?.anniversaryDate || null
  const daysShared = anniversaryDate
    ? dayjs().startOf('day').diff(dayjs(anniversaryDate).startOf('day'), 'day') + 1
    : null

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-9 py-3 lg:py-4 border-b ${
        isLight ? 'bg-white border-black/10' : 'bg-plumdeep/95 border-white/10'
      }`}
    >
      <div className="min-w-0">
        <div className={`hidden sm:block font-semibold text-lg truncate ${isLight ? 'text-plumdeep' : 'text-[#f3e6e8]'}`}>
          {greeting()}, {profile?.displayName}
        </div>
        <div className={`text-xs mt-0.5 ${isLight ? 'text-[#9a8a9c]' : 'text-[#c9b6cb]'}`}>
          {dayjs().format('dddd, D MMMM')}
          {daysShared != null && (
            <span> · {daysShared.toLocaleString()} day{daysShared === 1 ? '' : 's'} shared</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div
          className={`hidden sm:flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs font-medium w-fit ${
            isLight ? 'border-peach/30 text-peach' : 'border-peach/25 text-peachsoft'
          }`}
        >
          <FaFire size={12} className="text-peach" /> {couple?.streak || 0} day streak
        </div>

        <GlobalSearch light={isLight} />
        <ThemeToggle light={isLight} />

        <button
          aria-label="Notifications"
          className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${
            isLight ? 'border-black/10 text-plumdeep' : 'border-white/15 text-[#f3e6e8]'
          }`}
        >
          <FiBell size={16} />
        </button>

        {/* Opens the connection view — same content you'd reach by swiping
            left from anywhere in the app (see AppLayout). */}
        <button
          onClick={onOpenConnection}
          aria-label="View your connection"
          title="View your connection"
          className={`sm:hidden w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${
            isLight ? 'border-black/10 text-peach' : 'border-white/15 text-peachsoft'
          }`}
        >
          <FiHeart size={16} />
        </button>

        <button
          onClick={onOpenConnection}
          className={`hidden sm:flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition-colors ${
            isLight ? 'hover:bg-black/5' : 'hover:bg-white/5'
          }`}
          title={coupleLabel}
        >
          <div className="flex items-center -space-x-2">
            <Avatar name={profile?.displayName} photoURL={profile?.photoURL} tone="bg-blush text-peach" />
            {partner && (
              <Avatar name={partner?.displayName} photoURL={partner?.photoURL} tone="bg-[#d7efe9] text-[#1f7a68]" />
            )}
          </div>
          <span
            className={`hidden md:inline text-sm font-semibold truncate max-w-[140px] ${
              isLight ? 'text-plumdeep' : 'text-[#f3e6e8]'
            }`}
          >
            {coupleLabel}
          </span>
          <FiChevronRight size={13} className={isLight ? 'text-black/30' : 'text-white/30'} />
        </button>
      </div>
    </div>
  )
}