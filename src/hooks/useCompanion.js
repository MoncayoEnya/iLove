import { useEffect, useMemo, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { app, db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const COOLDOWN_MS = 12 * 60 * 60 * 1000

/** AI Companion state + actions, shared by the Companion page and the
 *  Dashboard teaser card. Opt-in only: nothing is generated until
 *  `companionEnabled` is turned on, and every suggestion is a single
 *  one-off text — never a running chat log. */
export function useCompanion() {
  const { couple } = useAuth()
  const coupleId = couple?.id

  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!coupleId) {
      setSuggestions([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, 'couples', coupleId, 'companionSuggestions'),
      orderBy('createdAt', 'desc'),
      limit(10)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSuggestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.error('Companion suggestions read error:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [coupleId])

  const enabled = !!couple?.companionEnabled
  const latest = suggestions[0] || null

  const cooldownMsLeft = useMemo(() => {
    const lastAt = couple?.companionLastGeneratedAt?.seconds
      ? couple.companionLastGeneratedAt.seconds * 1000
      : 0
    return Math.max(0, COOLDOWN_MS - (Date.now() - lastAt))
  }, [couple?.companionLastGeneratedAt])

  async function setEnabled(next) {
    if (!coupleId) return
    try {
      await updateDoc(doc(db, 'couples', coupleId), { companionEnabled: next })
    } catch (e) {
      toast.error("Couldn't update that — try again.")
    }
  }

  async function generate() {
    setGenerating(true)
    try {
      const fn = httpsCallable(getFunctions(app), 'generateCompanionSuggestion')
      await fn()
    } catch (e) {
      toast.error(e?.message || "Couldn't get a suggestion right now — try again later.")
    } finally {
      setGenerating(false)
    }
  }

  async function dismiss(id) {
    if (!coupleId) return
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'companionSuggestions', id), { dismissed: true })
    } catch (e) {
      // Non-critical — fail silently, the card just stays visible.
    }
  }

  return {
    enabled,
    setEnabled,
    suggestions,
    latest,
    loading,
    generating,
    generate,
    dismiss,
    cooldownMsLeft,
    hasPartner: !!couple?.members && couple.members.length > 1,
  }
}
