const CACHE = 'tpvapp-v232';
const ASSETS = ['/', '/index.html', '/css/Estilo.css', '/js/App.js', '/js/LoginCuenta.js', '/js/LoginUsuario.js', '/js/Terminal.js', '/js/Main.js', '/js/Cobro.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(ASSETS.map(url =>
        fetch(new Request(url, { cache: 'reload' })).then(res => c.put(url, res)).catch(() => {})
      ))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => Promise.allSettled(clients.map(c => c.navigate(c.url).catch(() => {}))))
  );
});

// Siempre red real, sin caché HTTP — fallback SW cache solo si no hay red
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const mismoOrigen = new URL(e.request.url).origin === self.location.origin;
  const req = mismoOrigen ? new Request(e.request, { cache: 'reload' }) : e.request;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (mismoOrigen) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
