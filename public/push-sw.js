// Push notifications for iLove. Loaded by public/sw.js with:
//   importScripts('/push-sw.js')
//
// Shows the alert your partner's app sent (via api/push.js) and opens the
// right page when you tap it — works even when iLove is closed.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'iLove', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'iLove'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Open iLove to see it',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      icon: data.icon || undefined,
      data: { url: data.url || '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin)
      if (win) {
        await win.focus()
        // Move the open app to the right page.
        if ('navigate' in win) {
          try {
            await win.navigate(url)
            return
          } catch {
            /* not controlled by this worker yet */
          }
        }
        win.postMessage({ type: 'ilove-open', url })
        return
      }
      await self.clients.openWindow(url)
    })()
  )
})
