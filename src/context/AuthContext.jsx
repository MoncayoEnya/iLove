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
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

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

  async function signup({ displayName, email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName,
      email,
      photoURL: null,
      anniversaryDate: null,
      coupleId: null,
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
    unlinkPartner,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}