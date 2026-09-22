import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { FiCheck, FiPlus } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useUIStore } from '../store/uiStore'
import { navGroups, findNavItem } from '../navConfig'
import Logo from './Logo'
import BottomSheet from './BottomSheet'

function RailIcon({ to, Icon, label, end, isLight }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        `relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
          isActive
            ? isLight
              ? 'bg-peach text-white shadow-sm'
              : 'bg-white/[0.12] text-peachsoft'
            : isLight
            ? 'text-[#9a8a9c] hover:bg-black/5 hover:text-plumdeep'
            : 'text-[#a892a9] hover:bg-white/[0.06] hover:text-[#f3e6e8]'
        }`
      }
    >
      <Icon size={18} strokeWidth={2} />
    </NavLink>
  )
}

function ProfileDot({ profile, isLight }) {
  return (
    <NavLink
      to="/profile"
      title={profile?.displayName || 'Profile'}
      aria-label="Profile"
      className={({ isActive }) =>
        `w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-gradient-to-br from-peach to-gold text-plumdeep font-semibold text-sm ring-2 transition-shadow ${
          isActive ? 'ring-peach' : isLight ? 'ring-transparent' : 'ring-transparent'
        }`
      }
    >
      {profile?.photoURL ? (
        <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
      ) : (
        (profile?.displayName || '?')[0]?.toUpperCase()
      )}
    </NavLink>
  )
}

// The first, narrowest sidebar — a quick-access rail of only the features
// the person has favorited, icon-only so it stays compact. The full list of
// every feature lives one column over, in Sidebar.jsx. Favorites are edited
// from the "+" button, which opens a picker of every available route.
export default function IconRail() {
  const { profile } = useAuth()
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const favoriteNav = useUIStore((s) => s.favoriteNav)
  const toggleFavoriteNav = useUIStore((s) => s.toggleFavoriteNav)
  const [editing, setEditing] = useState(false)

  const favorites = favoriteNav.map(findNavItem).filter(Boolean)

  return (
    <div
      className={`hidden lg:flex lg:w-[68px] lg:h-screen flex-shrink-0 flex-col items-center py-5 gap-1 ${
        isLight ? 'bg-white border-r border-black/10' : 'bg-plumdeep border-r border-white/10'
      }`}
    >
      <NavLink to="/dashboard" aria-label="Home" className="mb-4 flex-shrink-0">
        <Logo size="md" />
      </NavLink>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-1.5">
        {favorites.map((item) => (
          <RailIcon
            key={item.to}
            to={item.to}
            Icon={item.icon}
            label={item.label}
            end={item.end}
            isLight={isLight}
          />
        ))}

        <button
          onClick={() => setEditing(true)}
          title="Edit favorites"
          aria-label="Edit favorites"
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-dashed transition-colors ${
            isLight
              ? 'border-black/15 text-[#9a8a9c] hover:border-peach/50 hover:text-peach'
              : 'border-white/15 text-[#a892a9] hover:border-peach/40 hover:text-peachsoft'
          }`}
        >
          <FiPlus size={16} />
        </button>
      </div>

      <div className={`pt-4 mt-2 border-t w-full flex justify-center flex-shrink-0 ${isLight ? 'border-black/10' : 'border-white/10'}`}>
        <ProfileDot profile={profile} isLight={isLight} />
      </div>

      <BottomSheet open={editing} onClose={() => setEditing(false)} title="Edit favorites">
        <p className="text-xs text-[#9a8a9c] -mt-2 mb-4">
          Choose the features you want one tap away from the quick-access rail.
        </p>
        <div className="flex flex-col gap-4 max-h-[55vh] overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#a892a9] mb-1.5 px-1">
                {group.label}
              </div>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = favoriteNav.includes(item.to)
                  return (
                    <button
                      key={item.to}
                      onClick={() => toggleFavoriteNav(item.to)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/[0.03] text-sm text-left"
                    >
                      <item.icon size={16} className="text-peach flex-shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                          active ? 'bg-peach border-peach text-white' : 'border-black/15 text-transparent'
                        }`}
                      >
                        <FiCheck size={12} strokeWidth={3} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
