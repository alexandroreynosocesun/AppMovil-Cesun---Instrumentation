const CACHE_VERSION = 3;
const STATIC_CACHE = 'checkapp-static-v' + CACHE_VERSION;
const RUNTIME_CACHE = 'checkapp-runtime-v' + CACHE_VERSION;

// App shell: cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icon-192x192.png',
];

// Never cache these patterns
const NEVER_CACHE = [
  '/api/',
  '/auth/',
  '/login',
  '/token',
  'socket',
  'hot-update',
];

// Cache-first for these (static assets that rarely change)
const CACHE_FIRST_PATTERNS = [
  /\.(?:js|css|woff2?|ttf|otf|eot)$/,
  /\/icon-\d+x\d+\.png$/,
  /\/splash-\d+x\d+\.png$/,
  /\/apple-touch-icon\.png$/,
  /\/favicon\.png$/,
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches and notify clients of update
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        const oldCaches = keys.filter((k) => !currentCaches.includes(k));
        return Promise.all(oldCaches.map((k) => caches.delete(k)))
          .then(() => {
            // Notify all clients that an update is available
            if (oldCaches.length > 0) {
              self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                  client.postMessage({ type: 'SW_UPDATED' });
                });
              });
            }
          });
      })
      .then(() => self.clients.claim())
  );
});

// Helper: should this request be cached?
function shouldCache(url) {
  return !NEVER_CACHE.some((pattern) => url.includes(pattern));
}

// Helper: is this a static asset?
function isCacheFirst(url) {
  return CACHE_FIRST_PATTERNS.some((pattern) => pattern.test(url));
}

// Fetch handler with smart strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests (POST, PUT, DELETE = API mutations)
  if (request.method !== 'GET') return;

  // Skip requests we should never cache
  if (!shouldCache(url)) return;

  // Strategy 1: Cache-first for static assets (JS, CSS, fonts, icons)
  if (isCacheFirst(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Strategy 2: Network-first for HTML/navigation (always get latest)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
  );
});
