const CACHE = 'asiri-music-recovery-v17';
const STATIC_ASSETS = ['./manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);
  const isAppFile = url.origin === self.location.origin &&
    (request.mode === 'navigate' || /\.(?:html|js|css)$/.test(url.pathname));

  if (isAppFile) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (!response || response.status !== 200 || response.type === 'opaque') return response;
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    }))
  );
});
