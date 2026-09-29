/* Kebbi Clinic service worker — receives Web Push messages from the backend and
 * shows an OS notification (with sound) even when the tab is closed. Clicking it
 * focuses an open app window or opens a new one. */
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch (err) { /* payload not JSON */ }
  const title = d.title || 'Kebbi Clinic'
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'You have a new notification',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'kebbi-clinic',
    data: { url: d.url || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil((async () => {
    const url = (e.notification.data && e.notification.data.url) || '/'
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of all) {
      if ('focus' in client) return client.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})
