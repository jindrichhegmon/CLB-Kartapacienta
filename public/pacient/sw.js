/* 0.11.111: aplikace Můj průkaz je zrušená (nahradil ji Průkaz pacienta). Tento service worker smaže uložené kopie staré aplikace,
   odregistruje se a otevřená okna načte znovu – ukáže se stránka s odkazem na Průkaz pacienta. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('kp-pacient-')) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
  })());
});
