import { NavLink } from 'react-router-dom'
import {
  FiAward,
  FiCalendar,
  FiCheckSquare,
  FiCompass,
  FiHome,
  FiImage,
  FiList,
  FiLogOut,
  FiMapPin,
  FiDollarSign,
  FiMenu,
  FiMessageCircle,
  FiMusic,
  FiSettings,
  FiSmile,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { useUIStore } from '../store/uiStore'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import GlobalSearch from './GlobalSearch'

// Grouped per Rule #3 ("don't stack 20 cards — group them"). Dashboard and
// Chat are ungrouped since they're primary destinations mirrored in the
// mobile BottomNav; everything else is bucketed by what it's for.
const navGroups = [
  {
    label: null,
    items: [
      ['/dashboard', FiHome, 'Dashboard'],
      ['/chat', FiMessageCircle, 'Chat'],
    ],
  },
  {
    label: 'Today',
    items: [
      ['/insights', FiTrendingUp, 'Insights'],
      ['/checkins', FiSmile, 'Check-ins'],
    ],
  },
  {
    label: 'Planner',
    items: [
      ['/tasks', FiCheckSquare, 'Tasks'],
      ['/calendar', FiCalendar, 'Calendar'],
      ['/goals', FiTarget, 'Goals'],
      ['/bucket-list', FiList, 'Bucket list'],
      ['/achievements', FiAward, 'Achievements'],
    ],
  },
  {
    label: 'Together',
    items: [
      ['/memories', FiImage, 'Memories'],
      ['/date-ideas', FiCompass, 'Date ideas'],
      ['/places', FiMapPin, 'Shared places'],
      ['/playlist', FiMusic, 'Shared playlist'],
      ['/savings', FiDollarSign, 'Shared savings'],
      ['/conflict', FiUsers, 'Conflict recovery'],
    ],
  },
]

const secondaryItems = [
  ['/settings', FiSettings, 'Settings'],
]

// Home/Chat/Tasks/Memories/Profile already have one-tap access from the
// mobile BottomNav, so the hamburger menu only needs to surface the rest —
// same grouping as desktop, just with those four filtered out and any
// resulting empty group dropped.
const mobileOverflowGroups = navGroups
  .map((group) => ({
    ...group,
    items: group.items.filter(
      ([to]) => !['/dashboard', '/chat', '/tasks', '/memories'].includes(to)
    ),
  }))
  .filter((group) => group.items.length > 0)

function NavItem({ to, Icon, label, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 pl-3 pr-3.5 py-2.5 rounded-lg text-sm transition-colors min-w-0 ${
          isActive
            ? 'bg-white/[0.06] text-peachsoft font-semibold'
            : 'text-[#c9b6cb] font-medium hover:bg-white/[0.04] hover:text-[#f3e6e8]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-peach transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <Icon size={17} strokeWidth={2} className="flex-shrink-0" />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function ProfileAvatar({ profile, size = 22 }) {
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {profile?.photoURL ? (
        <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
      ) : (
        (profile?.displayName || '?')[0]?.toUpperCase()
      )}
    </div>
  )
}

export default function Sidebar() {
  const { logout, couple, profile } = useAuth()
  const mobileOpen = useUIStore((s) => s.mobileNavOpen)
  const setMobileOpen = useUIStore((s) => s.setMobileNavOpen)
  const toggleMobileOpen = useUIStore((s) => s.toggleMobileNav)

  return (
    <>
      {/* Mobile/tablet top bar — replaces the sidebar below the lg breakpoint */}
      <div className="lg:hidden bg-plumdeep text-[#f3e6e8] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="font-serif text-lg font-semibold">iLove</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-xs text-peachsoft font-medium border border-peach/25 rounded-full px-2 py-1">
            <FaFire size={11} className="text-peach" /> {couple?.streak || 0}
          </span>
          <ThemeToggle />
          <GlobalSearch />
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            className="w-9 h-9 rounded-lg border border-white/15 flex items-center justify-center flex-shrink-0"
          >
            {mobileOpen ? <FiX size={18} /> : <FiMenu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu — shown in normal flow, pushes content down */}
      {mobileOpen && (
        <div className="lg:hidden bg-plumdeep text-[#f3e6e8] px-4 pb-4 flex flex-col gap-1 border-t border-white/10">
          {mobileOverflowGroups.map((group, i) => (
            <div
              key={group.label || i}
              className={i > 0 ? 'mt-2 pt-2 border-t border-white/10 flex flex-col gap-1' : 'flex flex-col gap-1'}
            >
              {group.label && (
                <span className="px-3.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#a892a9]">
                  {group.label}
                </span>
              )}
              {group.items.map(([to, Icon, label]) => (
                <NavItem
                  key={to}
                  to={to}
                  Icon={Icon}
                  label={label}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">
            <NavLink
              to="/profile"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/[0.06] text-peachsoft font-semibold' : 'text-[#c9b6cb] hover:bg-white/[0.04]'
                }`
              }
            >
              <ProfileAvatar profile={profile} size={20} />
              <span className="truncate">{profile?.displayName || 'Profile'}</span>
            </NavLink>
            <NavItem to="/settings" Icon={FiSettings} label="Settings" onClick={() => setMobileOpen(false)} />
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3.5 py-2.5 mt-1 rounded-lg text-sm font-medium text-[#a892a9] hover:bg-white/[0.04] hover:text-[#f3e6e8] transition-colors"
          >
            <FiLogOut size={17} strokeWidth={2} className="flex-shrink-0" />
            Sign out
          </button>
        </div>
      )}

      {/* Desktop sidebar — hidden through tablet, full column from lg up.
          Split into a scrollable nav region and a footer that's pinned in
          place, so Profile / Settings / your name never get pushed off
          screen — previously the whole sidebar just stretched to match
          the main content's height and the footer could end up below the
          visible viewport with no way to reach it. */}
      <div className="hidden lg:flex lg:w-[230px] lg:h-screen flex-shrink-0 bg-plumdeep text-[#f3e6e8] flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-2">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-serif text-xl font-semibold">iLove</span>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex items-center gap-1.5 border border-peach/25 rounded-full px-2.5 py-1 text-xs text-peachsoft font-medium w-fit">
              <FaFire size={12} className="text-peach" /> {couple?.streak || 0} day streak
            </div>
            <ThemeToggle />
            <GlobalSearch />
          </div>

          <nav className="mt-8 flex flex-col gap-1">
            {navGroups.map((group, i) => (
              <div
                key={group.label || i}
                className={i > 0 ? 'mt-3 pt-3 border-t border-white/10 flex flex-col gap-1' : 'flex flex-col gap-1'}
              >
                {group.label && (
                  <span className="px-3.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#a892a9]">
                    {group.label}
                  </span>
                )}
                {group.items.map(([to, Icon, label]) => (
                  <NavItem key={to} to={to} Icon={Icon} label={label} end={to === '/dashboard'} />
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t border-white/10">
          <div className="flex flex-col gap-1">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `group relative flex items-center gap-3 pl-3 pr-3.5 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-white/[0.06] text-peachsoft font-semibold'
                    : 'text-[#c9b6cb] font-medium hover:bg-white/[0.04] hover:text-[#f3e6e8]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-peach transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <ProfileAvatar profile={profile} />
                  <span className="truncate">{profile?.displayName || 'Profile'}</span>
                </>
              )}
            </NavLink>

            {secondaryItems.map(([to, Icon, label]) => (
              <NavItem key={to} to={to} Icon={Icon} label={label} />
            ))}

            <button
              onClick={logout}
              className="flex items-center gap-3 pl-3 pr-3.5 py-2 rounded-lg text-sm font-medium text-[#a892a9] hover:bg-white/[0.04] hover:text-[#f3e6e8] transition-colors"
            >
              <FiLogOut size={17} strokeWidth={2} className="flex-shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  )
}