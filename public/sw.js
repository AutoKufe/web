/**
 * AutoKufe Service Worker
 * Handles Web Push notifications for job completion events
 */

// Push event - triggered when server sends a push message
self.addEventListener('push', function(event) {
  console.log('[SW] Push event received')

  let data = {}

  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    console.error('[SW] Error parsing push data:', e)
    data = {
      title: 'AutoKufe',
      body: 'Tienes una nueva notificacion'
    }
  }

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: data.tag || 'autokufe-notification',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || '/'
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'AutoKufe', options)
  )
})

// Notification click - open the app when user clicks notification
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked')

  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Check if there's already a window open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        // If we already have a window open, focus it and navigate
        if ('focus' in client) {
          client.focus()
          if (client.url !== urlToOpen) {
            client.navigate(urlToOpen)
          }
          return
        }
      }

      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Service worker activation - clean up old caches if needed
self.addEventListener('activate', function(event) {
  console.log('[SW] Service Worker activated')
  event.waitUntil(self.clients.claim())
})

// Service worker installation
self.addEventListener('install', function(event) {
  console.log('[SW] Service Worker installed')
  self.skipWaiting()
})
