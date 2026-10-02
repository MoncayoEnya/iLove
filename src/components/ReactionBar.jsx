import { useEffect, useState } from 'react'
import { deleteField, doc, updateDoc } from 'firebase/firestore'
import { AnimatePresence, motion } from 'framer-motion'
import { FiSmile } from 'react-icons/fi'
import { REACTIONS, ReactionIcon } from '../utils/reactions'
import toast from 'react-hot-toast'
import { db } from '../firebase'
import { haptic } from '../utils/haptics'


// Little icon reactions for any shared item (memory, love jar note…).
// Stored on the item itself as reactions: { [uid]: key } (key from
// utils/reactions.jsx) — one reaction per person, tap it again to take it back.
//
//   <ReactionBar path={['couples', coupleId, 'memories', id]} reactions={m.reactions} uid={me} />
export default function ReactionBar({ path, reactions, uid, names = {}, className = '' }) {
  const [local, setLocal] = useState(reactions || {})
  const [open, setOpen] = useState(false)

  // Follow live updates from Firestore (the partner reacting).
  useEffect(() => {
    setLocal(reactions || {})
  }, [JSON.stringify(reactions || {})]) // eslint-disable-line react-hooks/exhaustive-deps

  const mine = local[uid]
  const groups = Object.entries(local).reduce((acc, [who, e]) => {
    if (!e) return acc
    ;(acc[e] ||= []).push(who)
    return acc
  }, {})

  async function react(emoji) {
    setOpen(false)
    haptic('light')
    const next = { ...local }
    const removing = mine === emoji
    if (removing) delete next[uid]
    else next[uid] = emoji
    const prev = local
    setLocal(next)
    try {
      await updateDoc(doc(db, ...path), {
        [`reactions.${uid}`]: removing ? deleteField() : emoji,
      })
    } catch {
      setLocal(prev)
      toast.error("Couldn't save that reaction.")
    }
  }

  return (
    <div className={`relative flex items-center gap-1.5 flex-wrap ${className}`} onClick={(e) => e.stopPropagation()}>
      <AnimatePresence initial={false}>
        {Object.entries(groups).map(([emoji, who]) => (
          <motion.button
            key={emoji}
            layout
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            onClick={() => react(emoji)}
            title={who.map((w) => (w === uid ? 'You' : names[w] || 'Partner')).join(' & ')}
            className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${
              who.includes(uid) ? 'border-peach/60 bg-peach/10' : 'border-black/10 bg-white/60'
            }`}
          >
            <ReactionIcon k={emoji} size={12} />
            {who.length > 1 && <span className="font-semibold text-[10px]">{who.length}</span>}
          </motion.button>
        ))}
      </AnimatePresence>

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Add reaction"
        className="w-7 h-7 rounded-full flex items-center justify-center text-[#9a8a9c] hover:bg-black/5"
      >
        <FiSmile size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute bottom-full mb-1.5 left-0 z-20 flex gap-0.5 bg-white border border-black/10 rounded-full px-1.5 py-1 shadow-lg"
          >
            {REACTIONS.map((r, i) => (
              <motion.button
                key={r.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ scale: 1.3, y: -3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => react(r.key)}
                aria-label={r.label}
                title={r.label}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${mine === r.key ? 'bg-peach/15' : ''}`}
              >
                <ReactionIcon k={r.key} size={16} />
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}