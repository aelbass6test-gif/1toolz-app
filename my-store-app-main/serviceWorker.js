// A version for our cache. Change this to invalidate the cache.
const CACHE_VERSION = 'v1.1';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;

// A list of files to cache on install.
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// On install, cache the app shell.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  // Ask the service worker to activate as soon as it's finished installing.
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// On activate, clean up old caches.
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  // Take control of all pages under its scope immediately.
  event.waitUntil(clients.claim());

  // Delete old caches.
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
});

// On fetch, serve from cache or network.
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // For navigation requests (loading a page), use a network-first strategy.
  // This ensures the user gets the latest HTML and triggers the SW update flow.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If the network fails, serve the cached index.html as a fallback.
          return caches.match('/index.html');
        })
    );
    return;
  }

  // For all other requests (assets like JS, CSS, images), use a cache-first strategy.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // If the resource is in the cache, return it.
      if (cachedResponse) {
        return cachedResponse;
      }

      // If it's not in the cache, fetch it from the network.
      return fetch(event.request).then((networkResponse) => {
        // A response can only be consumed once. We need to clone it to put it in the cache.
        const responseToCache = networkResponse.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          // Cache the new resource for future requests.
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
