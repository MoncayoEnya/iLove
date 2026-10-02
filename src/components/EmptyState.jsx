import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from './Skeleton'
import { FiHeart } from 'react-icons/fi'

// Friendly empty state: a gently floating icon with little hearts drifting
// off it, a title, a line of encouragement and (optionally) the exact
// button to add the first item.
//
// It waits a moment before appearing. Pages start with an empty list while
// Firestore loads, and without this delay "No memories yet" would flash
// for a split second before the real items arrive. If data shows up within
// the delay, the page swaps this out and the person never sees it.
export default function EmptyState({ icon: Icon, title, subtitle, className = '', action, delay = 450 }) {
  const [ready, setReady] = useState(delay <= 0)

  useEffect(() => {
    if (delay <= 0) return undefined
    const t = setTimeout(() => setReady(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  if (!ready) {
    return (
      <div className={`flex flex-col items-center py-8 px-4 gap-3 ${className}`} aria-busy="true">
        <Skeleton className="w-14 h-14 rounded-full" />
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={`flex flex-col items-center text-center py-8 px-4 ${className}`}
    >
      <div className="relative mb-4">
        <motion.div
          className="w-14 h-14 rounded-full bg-gradient-to-br from-peach/20 to-gold/20 flex items-center justify-center"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon size={22} className="text-peach" />
        </motion.div>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute text-peach/70 pointer-events-none select-none"
            style={{ left: `${30 + i * 18}%`, top: 0 }}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 0.9, 0], y: [-2, -26], x: [0, i % 2 ? 6 : -6] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          >
            <FiHeart size={8 + i * 2} fill="currentColor" />
          </motion.span>
        ))}
      </div>
      <div className="text-sm font-semibold text-ink mb-1">{title}</div>
      {subtitle && <p className="text-xs text-[#9a8a9c] max-w-[300px]">{subtitle}</p>}
      {action && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            action.onClick()
          }}
          className="mt-4 px-4 py-2 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  )
}