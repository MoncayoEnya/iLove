import { AnimatePresence, motion } from 'framer-motion'
import { FiX } from 'react-icons/fi'

// Rule #5: actions that would otherwise push the user to a new page slide up
// from the bottom instead, the way Instagram's "new post" flow does. On
// screens with room to spare it renders as a centered modal instead of
// pinning a phone-style sheet to the bottom of a wide screen.
export default function BottomSheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="pointer-events-auto bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">{title}</h3>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full flex items-center justify-center border border-black/10 text-[#7a6a7c] flex-shrink-0"
                >
                  <FiX size={15} />
                </button>
              </div>
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
