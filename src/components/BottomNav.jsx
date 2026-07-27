import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiCheckSquare, FiHome, FiImage, FiMessageCircle, FiUser } from 'react-icons/fi'

// Primary 5 destinations per the design guide (Home, Chat, Planner, Memories,
// Profile). Everything else lives behind the hamburger menu in Sidebar.
const items = [
  ['/dashboard', FiHome, 'Home'],
  ['/chat', FiMessageCircle, 'Chat'],
  ['/tasks', FiCheckSquare, 'Planner'],
  ['/memories', FiImage, 'Memories'],
  ['/profile', FiUser, 'Profile'],
]

export default function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-plumdeep/95 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="flex items-stretch justify-around">
        {items.map(([to, Icon, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px] font-medium"
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="bottomnav-pill"
                    className="absolute top-1 h-8 w-12 rounded-full bg-peach/20"
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
                <Icon
                  size={19}
                  strokeWidth={2}
                  className={`relative z-10 transition-colors ${
                    isActive ? 'text-peachsoft' : 'text-[#a892a9]'
                  }`}
                />
                <span
                  className={`relative z-10 transition-colors ${
                    isActive ? 'text-peachsoft font-semibold' : 'text-[#a892a9]'
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
