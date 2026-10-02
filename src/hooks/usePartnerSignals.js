import { createElement, useEffect } from 'react'
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from './usePartner'
import { celebrate } from '../utils/celebrate'
import { FiHeart } from 'react-icons/fi'

// Mount once (AppLayout). Listens for "thinking of you" hearts your partner
// sent, plays floating hearts + a toast the moment you're in the app, then
// marks them seen so they only play once (even across devices).
//
// Data: couples/{coupleId}/hearts/{id} = { from, to, createdAt, seen }
export function usePartnerSignals() {
  const { firebaseUser, couple } = useAuth()
  const { partner } = usePartner()
  const coupleId = couple?.id
  const uid = firebaseUser?.uid
  const partnerName = partner?.displayName || 'Your partner'

  useEffect(() => {
    if (!coupleId || !uid) return undefined
    const q = query(
      collection(db, 'couples', coupleId, 'hearts'),
      where('to', '==', uid),
      where('seen', '==', false)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) return
        const count = snap.size
        celebrate({ kind: 'hearts', intensity: Math.min(1.6, 0.7 + count * 0.2) })
        toast(
          count > 1 ? `${partnerName} is thinking of you (×${count})` : `${partnerName} is thinking of you`,
          { icon: createElement(FiHeart, { color: '#e8a87c', fill: '#e8a87c' }), duration: 4000 }
        )
        snap.docs.forEach((d) =>
          updateDoc(doc(db, 'couples', coupleId, 'hearts', d.id), { seen: true }).catch(() => {})
        )
      },
      () => {
        // Rules not updated yet / offline — the feature just stays quiet.
      }
    )
    return unsub
  }, [coupleId, uid, partnerName])
}