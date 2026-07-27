// Minimal service worker: enables "Add to Home Screen" installability and
// caches the app shell so the last-loaded screen still shows up offline.
// This does NOT implement push notifications — real push requires a
// backend (e.g. Firebase Cloud Messaging + a Cloud Function) that this
// front-end-only pass can't wire up or test.

const CACHE_NAME = 'ilovee-shell-v1'
const SHELL_URLS = ['/', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first for navigations (so signed-in users always get fresh data
// when online), falling back to the cached shell when offline.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(() => caches.match('/'))
  )
})
