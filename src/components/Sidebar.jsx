import { NavLink } from 'react-router-dom'
import {
  FiCalendar,
  FiCheckSquare,
  FiHeart,
  FiHome,
  FiImage,
  FiMenu,
  FiMessageCircle,
  FiSettings,
  FiSmile,
  FiTarget,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import { useUIStore } from '../store/uiStore'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

const items = [
  ['/dashboard', FiHome, 'Dashboard'],
  ['/checkins', FiSmile, 'Check-ins'],
  ['/chat', FiMessageCircle, 'Chat'],
  ['/tasks', FiCheckSquare, 'Tasks'],
  ['/calendar', FiCalendar, 'Calendar'],
  ['/jar', FiHeart, 'Love jar'],
  ['/memories', FiImage, 'Memories'],
  ['/goals', FiTarget, 'Goals'],
  ['/conflict', FiUsers, 'Conflict recovery'],
]

const secondaryItems = [
  ['/profile', FiUser, 'Profile'],
  ['/settings', FiSettings, 'Settings'],
]

// Home/Chat/Tasks/Memories/Profile already have one-tap access from the
// mobile BottomNav, so the hamburger menu only needs to surface the rest.
const mobileOverflowItems = items.filter(
  ([to]) => !['/dashboard', '/chat', '/tasks', '/memories'].includes(to)
)

function NavItem({ to, Icon, label, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          isActive
            ? 'bg-peach/20 text-peachsoft font-semibold'
            : 'text-[#d9c6da] hover:bg-white/5'
        }`
      }
    >
      <Icon size={17} strokeWidth={2} className="flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

export default function Sidebar() {
  const { logout, couple, profile } = useAuth()
  const mobileOpen = useUIStore((s) => s.mobileNavOpen)
  const setMobileOpen = useUIStore((s) => s.setMobileNavOpen)
  const toggleMobileOpen = useUIStore((s) => s.toggleMobileNav)

  return (
    <>
      {/* Mobile top bar — replaces the sidebar below the md breakpoint */}
      <div className="md:hidden bg-plumdeep text-[#f3e6e8] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="font-serif text-lg font-semibold">iLove</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-xs text-peachsoft font-semibold bg-peach/10 rounded-full px-2.5 py-1.5">
            <FaFire size={12} /> {couple?.streak || 0}
          </span>
          <ThemeToggle />
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
        <div className="md:hidden bg-plumdeep text-[#f3e6e8] px-4 pb-4 flex flex-col gap-1 border-t border-white/10">
          {mobileOverflowItems.map(([to, Icon, label]) => (
            <NavItem
              key={to}
              to={to}
              Icon={Icon}
              label={label}
              onClick={() => setMobileOpen(false)}
            />
          ))}
          <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">
            <NavItem to="/settings" Icon={FiSettings} label="Settings" onClick={() => setMobileOpen(false)} />
          </div>
          <button
            onClick={logout}
            className="text-left text-xs text-[#a892a9] px-3.5 py-2.5 mt-1"
          >
            Sign out
          </button>
        </div>
      )}

      {/* Desktop sidebar — hidden on mobile, full column from md up */}
      <div className="hidden md:flex md:w-[230px] flex-shrink-0 bg-plumdeep text-[#f3e6e8] p-6 flex-col">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-serif text-xl font-semibold">iLove</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-peach/10 rounded-full px-3 py-2 text-sm text-peachsoft font-semibold w-fit">
            <FaFire size={13} /> {couple?.streak || 0} day streak
          </div>
          <ThemeToggle />
        </div>

        <nav className="mt-8 flex flex-col gap-1 flex-1">
          {items.map(([to, Icon, label]) => (
            <NavItem key={to} to={to} Icon={Icon} label={label} end={to === '/dashboard'} />
          ))}

          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-1">
            {secondaryItems.map(([to, Icon, label]) => (
              <NavItem key={to} to={to} Icon={Icon} label={label} />
            ))}
          </div>
        </nav>

        <NavLink to="/profile" className="flex items-center gap-2.5 px-1 py-2 mb-1 group">
          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep text-xs font-semibold">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              (profile?.displayName || '?')[0]?.toUpperCase()
            )}
          </div>
          <span className="text-xs text-[#d9c6da] group-hover:text-peach truncate">
            {profile?.displayName}
          </span>
        </NavLink>

        <button
          onClick={logout}
          className="text-left text-xs text-[#a892a9] hover:text-peach px-3.5 py-2"
        >
          Sign out
        </button>
      </div>
    </>
  )
}
