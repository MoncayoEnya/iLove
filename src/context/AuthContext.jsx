import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  arrayRemove,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

// Chars chosen to avoid visually ambiguous ones (0/O, 1/I, etc.)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined) // undefined = loading, null = signed out
  const [profile, setProfile] = useState(null) // users/{uid} doc
  const [couple, setCouple] = useState(null) // couples/{coupleId} doc
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null) // surfaced instead of hanging forever

  // watch firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        setFirebaseUser(u || null)
        if (!u) {
          setProfile(null)
          setCouple(null)
          setLoading(false)
        }
      },
      (err) => {
        console.error('Auth state error:', err)
        setAuthError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  // watch the user's profile doc in real time
  useEffect(() => {
    if (!firebaseUser) return
    const ref = doc(db, 'users', firebaseUser.uid)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      },
      (err) => {
        // Without this, a denied/failed read leaves loading=true forever
        // and the app hangs on a blank "Loading..." screen with no error shown.
        console.error('Profile read error:', err)
        setAuthError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [firebaseUser])

  // watch the couple doc in real time once we know the coupleId
  useEffect(() => {
    if (!profile?.coupleId) {
      setCouple(null)
      return
    }
    const ref = doc(db, 'couples', profile.coupleId)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setCouple(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      },
      (err) => {
        console.error('Couple read error:', err)
        setAuthError(err.message)
      }
    )
    return unsub
  }, [profile?.coupleId])

  // Every user needs a public-ish invite code (stored in /inviteCodes/{code}
  // so a partner can resolve it to a uid before the two are linked, when
  // reading /users/{uid} directly isn't allowed yet). Generate one lazily
  // the first time a profile loads without one.
  useEffect(() => {
    if (!firebaseUser || !profile) return
    if (profile.inviteCode) return
    ensureInviteCode().catch((err) => {
      console.error('Failed to generate invite code:', err)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, profile?.inviteCode])

  async function signup({ displayName, email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName,
      email,
      photoURL: null,
      anniversaryDate: null,
      coupleId: null,
      inviteCode: null,
      createdAt: serverTimestamp(),
    })
    return cred.user
  }

  async function login({ email, password }) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  }

  async function logout() {
    await signOut(auth)
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email)
  }

  // Update editable fields on the signed-in user's own profile doc
  async function updateProfile(fields) {
    if (!firebaseUser) throw new Error('Not signed in.')
    await setDoc(doc(db, 'users', firebaseUser.uid), fields, { merge: true })
  }

  // Generates a unique invite code and saves it to both:
  //  - users/{uid}.inviteCode  (for display in Settings)
  //  - inviteCodes/{code}      (public-ish lookup so a partner can resolve
  //    the code to a uid before the two accounts are linked)
  // Returns the code. Safe to call repeatedly — it's a no-op once you
  // already have one.
  async function ensureInviteCode() {
    if (!firebaseUser) throw new Error('Not signed in.')
    if (profile?.inviteCode) return profile.inviteCode

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode()
      const codeRef = doc(db, 'inviteCodes', code)
      try {
        // eslint-disable-next-line no-await-in-loop
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(codeRef)
          if (snap.exists()) throw new Error('CODE_TAKEN')
          tx.set(codeRef, { uid: firebaseUser.uid, createdAt: serverTimestamp() })
          tx.set(doc(db, 'users', firebaseUser.uid), { inviteCode: code }, { merge: true })
        })
        return code
      } catch (err) {
        if (err.message === 'CODE_TAKEN') continue
        throw err
      }
    }
    throw new Error('Could not generate an invite code right now — try again.')
  }

  // Links the signed-in user with whoever owns `inputCode`. Creates the
  // shared couples doc and sets coupleId on both profiles in one
  // transaction (see canLinkPartner() in firestore.rules for how the
  // cross-account write is allowed).
  async function linkPartner(inputCode) {
    if (!firebaseUser) throw new Error('Not signed in.')
    if (profile?.coupleId) throw new Error("You're already linked with a partner.")

    const code = (inputCode || '').trim().toUpperCase()
    if (!code) throw new Error('Enter an invite code.')

    const codeRef = doc(db, 'inviteCodes', code)
    const coupleRef = doc(collection(db, 'couples'))

    await runTransaction(db, async (tx) => {
      const codeSnap = await tx.get(codeRef)
      if (!codeSnap.exists()) {
        throw new Error("That code doesn't match anyone. Double check and try again.")
      }
      const partnerUid = codeSnap.data().uid
      if (partnerUid === firebaseUser.uid) {
        throw new Error("That's your own code — ask your partner for theirs.")
      }

      tx.set(coupleRef, {
        members: [firebaseUser.uid, partnerUid],
        createdAt: serverTimestamp(),
      })
      tx.set(doc(db, 'users', firebaseUser.uid), { coupleId: coupleRef.id }, { merge: true })
      tx.set(doc(db, 'users', partnerUid), { coupleId: coupleRef.id }, { merge: true })
    })
  }

  // Leave the shared couple space. If your partner already left (or there
  // never was one), the space is deleted; otherwise it's left intact for them.
  async function unlinkPartner() {
    if (!firebaseUser || !profile?.coupleId) return
    const coupleId = profile.coupleId
    const coupleRef = doc(db, 'couples', coupleId)

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(coupleRef)
      if (!snap.exists()) return
      const remaining = (snap.data().members || []).filter((m) => m !== firebaseUser.uid)
      if (remaining.length === 0) {
        tx.delete(coupleRef)
      } else {
        tx.update(coupleRef, { members: arrayRemove(firebaseUser.uid) })
      }
      tx.set(doc(db, 'users', firebaseUser.uid), { coupleId: null }, { merge: true })
    })
  }

  const value = {
    firebaseUser,
    profile,
    couple,
    loading,
    authError,
    signup,
    login,
    logout,
    resetPassword,
    updateProfile,
    ensureInviteCode,
    linkPartner,
    unlinkPartner,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}