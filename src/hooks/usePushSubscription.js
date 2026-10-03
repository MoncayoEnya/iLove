import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { enablePush } from '../utils/push'

// Keeps this device's push address fresh once alerts are allowed (browsers
// sometimes rotate it). Turning alerts on the first time happens from the
// bell: "Turn on alerts on this device". Mounted once in App.jsx.
export function usePushSubscription() {
  const { firebaseUser, couple } = useAuth()
  const uid = firebaseUser?.uid
  const coupleId = couple?.id

  useEffect(() => {
    if (!uid || !coupleId) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    enablePush(coupleId, uid).catch((err) => console.warn('Push setup skipped:', err?.message || err))
  }, [uid, coupleId])
}
