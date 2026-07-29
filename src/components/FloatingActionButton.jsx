import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      <button
        onClick={() => setOpen(true)}
        aria-label="Quick add"
        className="fixed z-30 right-4 bottom-24 lg:right-8 lg:bottom-8 w-14 h-14 rounded-full bg-gradient-to-br from-peach to-gold text-plumdeep shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <FiPlus size={24} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Quick add">
        <div className="flex flex-col gap-1 -mx-1">
          {ACTIONS.map(({ to, icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => go(to)}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-black/[0.03] text-left"
            >
              <div className="w-9 h-9 rounded-full bg-peachsoft flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-plum" />
              </div>
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  )
}