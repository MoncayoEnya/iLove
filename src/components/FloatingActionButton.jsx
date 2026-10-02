import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiCalendar, FiCheckSquare, FiHeart, FiImage, FiPlus, FiTarget } from 'react-icons/fi'
import BottomSheet from './BottomSheet'

// Rule #6: one button instead of ten scattered "add" buttons across pages.
// Tapping + opens a sheet of quick actions that jump straight to the right
// page's add flow, instead of the person having to know which page hosts
// which kind of "add".
const ACTIONS = [
  { to: '/tasks', icon: FiCheckSquare, label: 'Add task' },
  { to: '/calendar', icon: FiCalendar, label: 'Add event' },
  { to: '/memories', icon: FiImage, label: 'Add memory' },
  { to: '/memories?tab=jar', icon: FiHeart, label: 'Appreciation' },
  { to: '/goals', icon: FiTarget, label: 'Add goal' },
]

export default function FloatingActionButton() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  function go(to) {
    setOpen(false)
    navigate(to)
  }

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        aria-label="Quick add"
        className="fixed z-30 right-4 bottom-24 lg:right-8 lg:bottom-8 w-14 h-14 rounded-full bg-gradient-to-br from-peach to-gold text-plumdeep shadow-lg flex items-center justify-center"
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
      >
        {/* Soft breathing halo so the button invites a tap. */}
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-gradient-to-br from-peach to-gold pointer-events-none"
          style={{ zIndex: -1 }}
          animate={{ scale: [1, 1.55], opacity: [0.5, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', repeatDelay: 0.6 }}
        />
        <motion.span
          className="flex"
          animate={{ rotate: open ? 135 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          <FiPlus size={24} />
        </motion.span>
      </motion.button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Quick add">
        <div className="flex flex-col gap-1 -mx-1">
          {ACTIONS.map(({ to, icon: Icon, label }, i) => (
            <motion.button
              key={label}
              onClick={() => go(to)}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-black/[0.03] text-left"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.05, type: 'spring', stiffness: 400, damping: 28 }}
              whileHover={{ x: 4 }}
            >
              <div className="w-9 h-9 rounded-full bg-peachsoft flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-plum" />
              </div>
              <span className="text-sm font-medium">{label}</span>
            </motion.button>
          ))}
        </div>
      </BottomSheet>
    </>
  )
}