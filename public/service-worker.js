const CACHE_NAME = 'auction-legacy-v1';

const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/items.html',
  '/consigner.html',
  '/item.html',
  '/dropoff.html',
  '/initial-visit.html',
  '/reports.html',
  '/styles.css',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});