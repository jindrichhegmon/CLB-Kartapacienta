/* Service worker karty: aplikace funguje bez signálu (data jsou v IndexedDB, API se nekešuje). */
const CACHE = 'kp-karta-0.11.5';
const SHELL = ['/karta/', '/shared/kp.css', '/shared/kp.js', '/icons/icon.svg', '/icons/icon-192.png', '/karta/manifest.webmanifest', '/shared/kp-napoveda.js', '/api/napoveda'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x.startsWith('kp-karta-') && x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // API se nekešuje – kromě návodu (GET /api/napoveda), aby nápověda šla otevřít i bez signálu
  if (e.request.method !== 'GET' || u.origin !== location.origin || (u.pathname.startsWith('/api/') && u.pathname !== '/api/napoveda')) return;
  // síť první (aby se aktualizace projevila), bez sítě z cache
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('/karta/'))));
});
