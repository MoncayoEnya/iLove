import { motion } from 'framer-motion'

export default function EmptyState({ icon: Icon, title, subtitle, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex flex-col items-center text-center py-8 px-4 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-peach/20 to-gold/20 flex items-center justify-center mb-3">
        <Icon size={20} className="text-peach" />
      </div>
      <div className="text-sm font-semibold text-ink mb-1">{title}</div>
      {subtitle && <p className="text-xs text-[#9a8a9c] max-w-[280px]">{subtitle}</p>}
    </motion.div>
  )
}
