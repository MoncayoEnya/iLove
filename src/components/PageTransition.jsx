import { motion } from 'framer-motion'

// Wraps a route's content so navigating between pages fades/slides instead
// of hard-cutting. Pair with <AnimatePresence mode="wait"> + a key={pathname}
// one level up (in App.jsx) so React remounts and animates on route change.
//
// Only opacity + y here, on purpose: a `filter` (even blur(0px)) or a
// leftover transform on this wrapper turns it into the frame for every
// position:fixed popup inside the page, so modals and lightboxes get
// trapped inside the content area instead of covering the screen.
export default function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}