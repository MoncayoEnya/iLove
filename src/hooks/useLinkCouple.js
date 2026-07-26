import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)]
  return c
}

export function useLinkCouple() {
  const { firebaseUser, profile } = useAuth()

  // Create a new couple space, return the invite code
  async function createSpace() {
    const code = genCode()
    const coupleRef = doc(collection(db, 'couples'))
    await setDoc(coupleRef, {
      members: [firebaseUser.uid],
      inviteCode: code,
      streak: 0,
      lastCheckinDate: null,
      createdAt: serverTimestamp(),
    })
    await setDoc(
      doc(db, 'users', firebaseUser.uid),
      { coupleId: coupleRef.id },
      { merge: true }
    )
    return code
  }

  // Join an existing couple using their invite code
  async function joinWithCode(code) {
    const q = query(collection(db, 'couples'), where('inviteCode', '==', code.toUpperCase()))
    const snap = await getDocs(q)
    if (snap.empty) throw new Error("That code doesn't match anything. Double check it.")
    const coupleDoc = snap.docs[0]

    await runTransaction(db, async (tx) => {
      const freshSnap = await tx.get(coupleDoc.ref)
      const data = freshSnap.data()
      if (data.members.includes(firebaseUser.uid)) return
      if (data.members.length >= 2) throw new Error('That space is already full.')
      tx.update(coupleDoc.ref, { members: [...data.members, firebaseUser.uid] })
      tx.set(doc(db, 'users', firebaseUser.uid), { coupleId: coupleDoc.id }, { merge: true })
    })

    return coupleDoc.id
  }

  return { createSpace, joinWithCode }
}
