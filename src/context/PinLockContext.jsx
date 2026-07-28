import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { hashPin } from '../utils/pinHash'

const PinLockContext = createContext(null)

function storageKey(uid) {
  return `ilovee-pin-hash-${uid}`
}

// A simple app-level PIN lock, scoped to this device + this account.
// It doesn't encrypt anything server-side — it's a screen lock, not a
// vault — but it's enough to stop someone from picking up an unlocked
// phone and reading the Love Jar, Journal, or Conflict Recovery answers.
export function PinLockProvider({ children }) {
  const { firebaseUser } = useAuth()
  const uid = firebaseUser?.uid || null

  const [hasPin, setHasPin] = useState(false)
  const [locked, setLocked] = useState(false)

  // Load this account's PIN state whenever who's signed in changes.
  useEffect(() => {
    if (!uid) {
      setHasPin(false)
      setLocked(false)
      return
    }
    const stored = localStorage.getItem(storageKey(uid))
    setHasPin(!!stored)
    setLocked(!!stored)
  }, [uid])

  // Re-lock whenever the app is backgrounded (tab hidden, app minimized).
  // We lock on the way out, not the way back in, so there's no gap where
  // a freshly-resumed tab briefly shows unlocked content.
  useEffect(() => {
    if (!uid) return
    function onVisibility() {
      if (document.visibilityState === 'hidden' && localStorage.getItem(storageKey(uid))) {
        setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [uid])

  const setPin = useCallback(
    async (pin) => {
      if (!uid) return
      const hash = await hashPin(uid, pin)
      localStorage.setItem(storageKey(uid), hash)
      setHasPin(true)
      setLocked(false)
    },
    [uid]
  )

  const removePin = useCallback(() => {
    if (!uid) return
    localStorage.removeItem(storageKey(uid))
    setHasPin(false)
    setLocked(false)
  }, [uid])

  const verifyPin = useCallback(
    async (pin) => {
      if (!uid) return false
      const stored = localStorage.getItem(storageKey(uid))
      if (!stored) return false
      const hash = await hashPin(uid, pin)
      const ok = hash === stored
      if (ok) setLocked(false)
      return ok
    },
    [uid]
  )

  const lockNow = useCallback(() => {
    if (hasPin) setLocked(true)
  }, [hasPin])

  // If someone forgets their PIN, there's no way to verify the old one —
  // it's only ever stored as a hash. Signing out and back in clears the
  // local lock for this device so they can set a fresh PIN.
  const forgetPin = useCallback(() => {
    if (!uid) return
    localStorage.removeItem(storageKey(uid))
    setHasPin(false)
    setLocked(false)
  }, [uid])

  return (
    <PinLockContext.Provider
      value={{ hasPin, locked, setPin, removePin, verifyPin, lockNow, forgetPin }}
    >
      {children}
    </PinLockContext.Provider>
  )
}

export function usePinLock() {
  const ctx = useContext(PinLockContext)
  if (!ctx) throw new Error('usePinLock must be used within a PinLockProvider')
  return ctx
}
