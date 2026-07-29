import { useEffect } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

// Set this in your .env file: VITE_VAPID_PUBLIC_KEY=<public key from `npx web-push generate-vapid-keys`>
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

// Registers the service worker (public/sw.js) and subscribes this browser
// to push, then stores the subscription in Firestore so the scheduled job
// (scripts/send-jar-nudges.js) knows where to send notifications for this
// user's couple. Call this once near the top of App.jsx, e.g. right next to
// useLocalReminders().
export function usePushSubscription() {
  const { firebaseUser, couple } = useAuth()

  useEffect(() => {
    if (!firebaseUser?.uid) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!VAPID_PUBLIC_KEY) {
      console.warn('usePushSubscription: VITE_VAPID_PUBLIC_KEY is not set — skipping push subscribe.')
      return
    }

    let cancelled = false

    async function subscribe() {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') return
      }
      if (Notification.permission !== 'granted') return

      const reg = await navigator.serviceWorker.register('/sw.js')
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }
      if (cancelled) return

      await setDoc(doc(db, 'pushSubscriptions', firebaseUser.uid), {
        subscription: sub.toJSON(),
        coupleId: couple?.id || null,
        updatedAt: new Date(),
      })
    }

    subscribe().catch((err) => console.error('Push subscribe failed:', err))

    return () => {
      cancelled = true
    }
  }, [firebaseUser?.uid, couple?.id])
}
