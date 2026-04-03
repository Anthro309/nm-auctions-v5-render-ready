// NM Auctions Service Worker (SAFE MODE)

// This version disables aggressive caching so updates always load

self.addEventListener('install', event => {
  console.log('Service Worker Installed');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker Activated');

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    )
  );

  self.clients.claim();
});

// Always fetch fresh files (no caching issues)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response("Offline", { status: 503 });
    })
  );
});