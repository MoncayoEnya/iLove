import { motion } from 'framer-motion'

// Wraps a route's content so navigating between pages fades/slides instead
// of hard-cutting. Pair with <AnimatePresence mode="wait"> + a key={pathname}
// one level up (in App.jsx) so React remounts and animates on route change.
export default function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}