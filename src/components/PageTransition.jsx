import { motion } from 'framer-motion'

// Wraps a route's content so navigating between pages fades/slides instead
// of hard-cutting. Pair with <AnimatePresence mode="wait"> + a key={pathname}
// one level up (in App.jsx) so React remounts and animates on route change.
export default function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
