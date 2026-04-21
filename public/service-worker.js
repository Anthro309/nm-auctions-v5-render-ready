// NM Auctions Service Worker v2
// HTML pages always fetched fresh from network; assets use normal caching

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Always bypass HTTP cache for HTML page navigations
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        new Response('Offline — check your connection.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        })
      )
    );
    return;
  }
  // All other requests (JS, CSS, images) use default caching
  event.respondWith(
    fetch(event.request).catch(() =>
      new Response('Offline', { status: 503 })
    )
  );
});
