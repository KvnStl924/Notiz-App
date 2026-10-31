// Service Worker: macht die App offline nutzbar.
// Strategie "Netz zuerst": ist Internet da, kommt immer die neueste Version.
// Ohne Internet wird die zuletzt geladene Version aus dem Cache gestartet.
const CACHE = 'notiz-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Nur eigene Dateien; Firebase/Google-Anfragen laufen direkt (die haben eigenes Offline-Handling).
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') {
          const shell = await cache.match('index.html') || await cache.match('./');
          if (shell) return shell;
        }
        throw e;
      }
    })()
  );
});
