import { NavLink } from 'react-router-dom'
import { FiLogOut, FiMenu, FiSettings, FiX } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useUIStore } from '../store/uiStore'
import { navGroups } from '../navConfig'
import Logo from './Logo'

const secondaryItems = [['/settings', FiSettings, 'Settings']]

// Home/Chat/Tasks/Memories/Profile already have one-tap access from the
// mobile BottomNav, so the hamburger menu only needs to surface the rest —
// same grouping as desktop, just with those four filtered out and any
// resulting empty group dropped.
const mobileOverflowGroups = navGroups
  .map((group) => ({
    ...group,
    items: group.items.filter(
      ({ to }) => !['/dashboard', '/chat', '/tasks', '/memories'].includes(to)
    ),
  }))
  .filter((group) => group.items.length > 0)

// `light` switches the nav item to the clean white-sidebar look (soft peach
// pill + peach text on the active item, dark neutral text otherwise) instead
// of the dark plumdeep chrome's white-on-dark treatment. Everything else
// about the item — routing, the left accent bar — stays identical.
function NavItem({ to, Icon, label, end, onClick, light = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 pl-3 pr-3.5 py-2.5 rounded-lg text-sm transition-colors min-w-0 ${
          isActive
            ? light
              ? 'bg-peach/10 text-peach font-semibold'
              : 'bg-white/[0.06] text-peachsoft font-semibold'
            : light
            ? 'text-[#4b3f4d] font-medium hover:bg-black/5 hover:text-plumdeep'
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

export default function Sidebar() {
  const { logout } = useAuth()
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const mobileOpen = useUIStore((s) => s.mobileNavOpen)
  const setMobileOpen = useUIStore((s) => s.setMobileNavOpen)
  const toggleMobileOpen = useUIStore((s) => s.toggleMobileNav)

  return (
    <>
      {/* Mobile/tablet top bar — replaces the two-column sidebar below the lg
          breakpoint. Search, streak, and dark-mode now live in Topbar. */}
      <div
        className={`lg:hidden px-4 py-3 flex items-center justify-between ${
          isLight ? 'bg-white text-plumdeep border-b border-black/10' : 'bg-plumdeep text-[#f3e6e8]'
        }`}
      >
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="font-serif text-lg font-semibold">iLove</span>
        </div>
        <button
          onClick={toggleMobileOpen}
          aria-label="Toggle menu"
          className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${
            isLight ? 'border-black/10' : 'border-white/15'
          }`}
        >
          {mobileOpen ? <FiX size={18} /> : <FiMenu size={18} />}
        </button>
      </div>

      {/* Mobile dropdown menu — shown in normal flow, pushes content down */}
      {mobileOpen && (
        <div
          className={`lg:hidden px-4 pb-4 flex flex-col gap-1 border-t ${
            isLight ? 'bg-white text-plumdeep border-black/10' : 'bg-plumdeep text-[#f3e6e8] border-white/10'
          }`}
        >
          {mobileOverflowGroups.map((group, i) => (
            <div
              key={group.label || i}
              className={
                i > 0
                  ? `mt-2 pt-2 border-t flex flex-col gap-1 ${isLight ? 'border-black/10' : 'border-white/10'}`
                  : 'flex flex-col gap-1'
              }
            >
              {group.label && (
                <span className="px-3.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#a892a9]">
                  {group.label}
                </span>
              )}
              {group.items.map(({ to, icon: Icon, label, end }) => (
                <NavItem
                  key={to}
                  to={to}
                  Icon={Icon}
                  label={label}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  light={isLight}
                />
              ))}
            </div>
          ))}
          <div className={`mt-2 pt-2 border-t flex flex-col gap-1 ${isLight ? 'border-black/10' : 'border-white/10'}`}>
            <NavItem to="/settings" Icon={FiSettings} label="Settings" onClick={() => setMobileOpen(false)} light={isLight} />
          </div>
          <button
            onClick={logout}
            className={`flex items-center gap-3 px-3.5 py-2.5 mt-1 rounded-lg text-sm font-medium transition-colors ${
              isLight ? 'text-[#9a8a9c] hover:bg-black/5 hover:text-plumdeep' : 'text-[#a892a9] hover:bg-white/[0.04] hover:text-[#f3e6e8]'
            }`}
          >
            <FiLogOut size={17} strokeWidth={2} className="flex-shrink-0" />
            Sign out
          </button>
        </div>
      )}

      {/* Desktop sidebar — the second, wider column: every feature in the
          app, grouped. The first column (IconRail) handles favorites; the
          logo, streak, search, and theme toggle now live in Topbar, so this
          column is nav-only. Split into a scrollable nav region and a
          footer that's pinned in place, so Settings / Sign out never get
          pushed off screen. */}
      <div
        className={`hidden lg:flex lg:w-[200px] lg:h-screen flex-shrink-0 flex-col ${
          isLight ? 'bg-white text-plumdeep border-r border-black/10' : 'bg-plumdeep text-[#f3e6e8]'
        }`}
      >
        <nav className="flex-1 min-h-0 overflow-y-auto p-5 pb-2 flex flex-col gap-1">
          {navGroups.map((group, i) => (
            <div
              key={group.label || i}
              className={
                i > 0
                  ? `mt-3 pt-3 border-t flex flex-col gap-1 ${isLight ? 'border-black/10' : 'border-white/10'}`
                  : 'flex flex-col gap-1'
              }
            >
              {group.label && (
                <span className="px-3.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#a892a9]">
                  {group.label}
                </span>
              )}
              {group.items.map(({ to, icon: Icon, label, end }) => (
                <NavItem key={to} to={to} Icon={Icon} label={label} end={end} light={isLight} />
              ))}
            </div>
          ))}
        </nav>

        <div className={`flex-shrink-0 px-4 pb-4 pt-3 border-t ${isLight ? 'border-black/10' : 'border-white/10'}`}>
          <div className="flex flex-col gap-1">
            {secondaryItems.map(([to, Icon, label]) => (
              <NavItem key={to} to={to} Icon={Icon} label={label} light={isLight} />
            ))}

            <button
              onClick={logout}
              className={`flex items-center gap-3 pl-3 pr-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                isLight ? 'text-[#9a8a9c] hover:bg-black/5 hover:text-plumdeep' : 'text-[#a892a9] hover:bg-white/[0.04] hover:text-[#f3e6e8]'
              }`}
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