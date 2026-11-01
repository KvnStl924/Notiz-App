// Service Worker: macht die App offline nutzbar.
// Strategie "Netz zuerst": ist Internet da, kommt immer die neueste Version.
// Ohne Internet wird die zuletzt geladene Version aus dem Cache gestartet.
const CACHE = 'notiz-v6';

// Beim Installieren die App-Dateien vorladen (Startseite, Programm, Design, Schrift, Icons),
// damit die App auch beim allerersten Mal ohne Netz startet.
async function precache() {
  const cache = await caches.open(CACHE);
  const base = self.registration.scope;
  const urls = new Set([base, new URL('index.html', base).href]);
  const html = await (await fetch(base, { cache: 'reload' })).text();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = new URL(m[1], base);
    if (u.origin === self.location.origin) urls.add(u.href);
  }
  // Aus dem Design die Schriftdateien (lateinisch), aus dem Programm den nachgeladenen Sync-Teil
  for (const href of [...urls]) {
    try {
      if (href.endsWith('.css')) {
        const css = await (await fetch(href)).text();
        for (const m of css.matchAll(/url\(([^)]+?\.woff2)\)/g)) {
          if (/latin/.test(m[1])) urls.add(new URL(m[1].replace(/["']/g, ''), href).href);
        }
      } else if (/\/assets\/.*\.js$/.test(href)) {
        const js = await (await fetch(href)).text();
        for (const m of js.matchAll(/\.\/(firestore-backend-[\w-]+\.js)/g)) urls.add(new URL(m[1], href).href);
      }
    } catch {
      /* einzelne Datei nicht lesbar: weiter */
    }
  }
  await Promise.allSettled([...urls].map((u) => cache.add(u)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()));
});

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
        // Startseite, Konfiguration und Manifest immer beim Server nachfragen (GitHub Pages hält Seiten sonst bis zu 10 Min. im Zwischenspeicher)
        const fresh = req.mode === 'navigate' || /(\/|index\.html|\.json|\.webmanifest)$/.test(url.pathname);
        const res = await fetch(req, fresh ? { cache: 'no-cache' } : undefined);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') {
          const scope = self.registration.scope;
          const shell = (await cache.match(scope)) || (await cache.match(new URL('index.html', scope)));
          if (shell) return shell;
        }
        throw e;
      }
    })()
  );
});
