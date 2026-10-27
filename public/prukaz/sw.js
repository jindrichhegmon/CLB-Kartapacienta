/* Service worker aplikace Průkaz pro plán péče: aplikace běží bez signálu i bez serveru (data jsou v IndexedDB, žádné API). */
const CACHE = 'kp-prukaz-0.1.0';
const SHELL = ['/prukaz/', '/shared/kp.css', '/shared/kp.js', '/icons/icon.svg', '/icons/icon-192.png', '/prukaz/manifest.webmanifest', '/shared/kp-napoveda.js', '/api/napoveda', '/prukaz/dialogus.png'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x.startsWith('kp-prukaz-') && x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || (u.pathname.startsWith('/api/') && u.pathname !== '/api/napoveda')) return;
  // síť první (aby se aktualizace projevila), bez sítě z cache
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('/prukaz/'))));
});
