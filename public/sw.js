// Web Push service worker.
//
// IMPORTANT: this file must be served from your site's ROOT (e.g.
// https://yourapp.com/sw.js), not from a subfolder — that's a browser
// requirement for the service worker's scope to cover the whole app.
// Put it at  public/sw.js  in your Vite project (Vite copies everything
// in public/ to the build root untouched), then it'll be reachable at
// /sw.js, which matches the reg = navigator.serviceWorker.register('/sw.js')
// call already in src/hooks/usePushSubscription.js.
//
// This worker does nothing until the browser wakes it up for a push event —
// it does NOT run continuously, so it costs no battery while idle.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'iLovee', body: event.data ? event.data.text() : '' }
  }

  const { title = 'iLovee', body = '', tag, url = '/calendar' } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag, // same tag as any local Notification for this event, so browsers replace rather than stack
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
    })
  )
})

// Tapping the notification focuses an existing app tab if one is open,
// otherwise opens a new one at the relevant page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/calendar'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})