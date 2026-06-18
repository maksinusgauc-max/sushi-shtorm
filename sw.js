// ═══════════════════════════════════════════════════════════
//  Service Worker для киоска «Суши Шторм»
//  Кэширует страницу, меню и картинки на планшете.
//  После первой загрузки всё берётся из кэша — быстро и без падений.
// ═══════════════════════════════════════════════════════════

const CACHE = 'sushi-kiosk-v1';

// При установке — сразу активируемся
self.addEventListener('install', function(e) {
  self.skipWaiting();
});

// При активации — чистим старые версии кэша
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Стратегия:
//  - картинки (.jpg/.png): сначала кэш, если нет — сеть + сохранить (cache-first)
//  - страница, menu.js: сначала сеть (чтобы видеть обновления), если нет сети — кэш (network-first)
self.addEventListener('fetch', function(e) {
  const url = e.request.url;
  // только GET-запросы
  if (e.request.method !== 'GET') return;
  // не трогаем API (заказы, чат) — они всегда через сеть
  if (url.indexOf('/api/') !== -1) return;

  const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url);

  if (isImage) {
    // CACHE-FIRST для картинок — главное для слабого планшета
    e.respondWith(
      caches.open(CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          if (cached) return cached;
          return fetch(e.request).then(function(resp) {
            if (resp && resp.status === 200) cache.put(e.request, resp.clone());
            return resp;
          }).catch(function() { return cached; });
        });
      })
    );
  } else {
    // NETWORK-FIRST для страницы и menu.js — чтобы обновления подхватывались,
    // но при обрыве сети отдаём из кэша (не падаем)
    e.respondWith(
      fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, copy); });
        }
        return resp;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
  }
});
