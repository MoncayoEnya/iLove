// Runs independently of your app's tab — this is what lets a notification
// show up even while you're locked out / in another app. The browser keeps
// this script alive in the background and wakes it up when a push arrives.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'iLovee', body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'iLovee', {
      body: data.body || '',
      tag: data.tag || 'ilovee',
      icon: data.icon || '/vite.svg',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})
