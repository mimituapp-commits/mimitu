// Mimitu PWA — service worker (offline-first, cache estática)
const CACHE = 'mimitu-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './api.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './legal/privacidad.html',
  './legal/terminos.html',
  './legal/eliminar-cuenta.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  // Nunca cachear la API: peticiones a otro origen (backend) o rutas /api/ van siempre a la red.
  if (url.origin !== self.location.origin || url.pathname.indexOf('/api/') !== -1) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
