import { useState } from 'react'
import { addDoc, collection } from 'firebase/firestore'
import { motion, AnimatePresence } from 'framer-motion'
import { FiHeart } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { haptic } from '../utils/haptics'

// One tap = "I'm thinking of you". Your partner gets floating hearts the
// next time they're in the app (see hooks/usePartnerSignals.js).
export default function ThinkingOfYouButton({ light = true, className = '' }) {
  const { firebaseUser, couple } = useAuth()
  const { partnerUid, partner } = usePartner()
  const [cooling, setCooling] = useState(false)
  const [bursts, setBursts] = useState([])

  if (!partnerUid) return null

  async function send() {
    if (cooling) return
    haptic('medium')
    const id = Date.now()
    setBursts((b) => [...b, id])
    setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 900)
    setCooling(true)
    setTimeout(() => setCooling(false), 4000)
    try {
      await addDoc(collection(db, 'couples', couple.id, 'hearts'), {
        from: firebaseUser.uid,
        to: partnerUid,
        createdAt: new Date(),
        seen: false,
      })
      toast(`Sent to ${partner?.displayName || 'your partner'}`, { icon: <FiHeart className="text-peach" fill="currentColor" />, duration: 1800 })
    } catch {
      toast.error("Couldn't send that — try again.")
    }
  }

  return (
    <motion.button
      onClick={send}
      whileTap={{ scale: 0.85 }}
      aria-label="Send a 'thinking of you' heart"
      title="Thinking of you"
      className={`relative w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${
        light ? 'border-black/10 text-peach' : 'border-white/15 text-peachsoft'
      } ${className}`}
    >
      <motion.span
        animate={cooling ? { scale: [1, 1.35, 1] } : { scale: 1 }}
        transition={{ duration: 0.45 }}
        className="flex"
      >
        <FiHeart size={16} fill={cooling ? 'currentColor' : 'none'} />
      </motion.span>
      <AnimatePresence>
        {bursts.map((id) =>
          [0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={`${id}-${i}`}
              aria-hidden="true"
              className="absolute text-peach pointer-events-none"
              initial={{ opacity: 1, x: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: 0, x: (i - 2) * 9, y: -28 - (i % 2) * 10, scale: 1.1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <FiHeart size={10} fill="currentColor" />
            </motion.span>
          ))
        )}
      </AnimatePresence>
    </motion.button>
  )
}