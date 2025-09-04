self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.some(c => c.url.includes('nocache=1'))) {
      await self.registration.unregister();
      return;
    }
    await self.clients.claim();
  })());
});
