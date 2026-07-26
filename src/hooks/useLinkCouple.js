import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
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
    // Small lookup doc, keyed by the code itself, so joining can find the
    // space with a direct getDoc() instead of a where() query. Firestore
    // rules can only safely gate a *query* using fields in the query's
    // own where() clause — since we'd otherwise need to check `members`
    // (not part of the where clause), Firestore rejects that query
    // outright before it even runs. A direct-by-ID getDoc() doesn't have
    // that restriction, so this sidesteps the problem entirely.
    await setDoc(doc(db, 'inviteCodes', code), {
      coupleId: coupleRef.id,
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
    const upperCode = code.toUpperCase()
    const lookupSnap = await getDoc(doc(db, 'inviteCodes', upperCode))
    if (!lookupSnap.exists()) {
      throw new Error("That code doesn't match anything. Double check it.")
    }
    const coupleId = lookupSnap.data().coupleId
    const coupleRef = doc(db, 'couples', coupleId)

    await runTransaction(db, async (tx) => {
      const freshSnap = await tx.get(coupleRef)
      const data = freshSnap.data()
      if (data.members.includes(firebaseUser.uid)) return
      if (data.members.length >= 2) throw new Error('That space is already full.')
      tx.update(coupleRef, { members: [...data.members, firebaseUser.uid] })
      tx.set(doc(db, 'users', firebaseUser.uid), { coupleId }, { merge: true })
    })

    return coupleId
  }

  return { createSpace, joinWithCode }
}