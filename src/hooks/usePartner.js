import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

// Returns { partner, partnerUid, hasPartner }
export function usePartner() {
  const { firebaseUser, couple } = useAuth()
  const [partner, setPartner] = useState(null)

  const partnerUid = couple?.members?.find((m) => m !== firebaseUser?.uid) || null

  useEffect(() => {
    if (!partnerUid) {
      setPartner(null)
      return
    }
    const unsub = onSnapshot(doc(db, 'users', partnerUid), (snap) => {
      setPartner(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    })
    return unsub
  }, [partnerUid])

  return { partner, partnerUid, hasPartner: !!partnerUid }
}
