// ═══════════════════════════════════════════════════════════
//  Service Worker для киоска «Суши Шторм» — v2
//  Кэширует картинки, но НЕ кэширует битые/заглушки.
//  Страница и menu.js всегда грузятся свежими (если есть сеть).
// ═══════════════════════════════════════════════════════════

const CACHE = 'sushi-kiosk-v3';   // ← версия. Меняй цифру, чтобы сбросить кэш у всех

self.addEventListener('install', function(e) {
  self.skipWaiting();   // новая версия активируется сразу
});

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

self.addEventListener('fetch', function(e) {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  if (url.indexOf('/api/') !== -1) return;  // API — всегда сеть

  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url);

  if (isImage) {
    // Картинки: сначала кэш, если нет — сеть. Кэшируем ТОЛЬКО успешные (status 200).
    e.respondWith(
      caches.open(CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          if (cached) return cached;
          return fetch(e.request).then(function(resp) {
            // кэшируем только реально загруженную картинку, не ошибку
            if (resp && resp.status === 200 && resp.type !== 'opaque') {
              cache.put(e.request, resp.clone());
            }
            return resp;
          }).catch(function() {
            // нет сети и нет в кэше — пусть сработает onerror в html (покажет заглушку, но НЕ закэширует её)
            return new Response('', { status: 404 });
          });
        });
      })
    );
  } else {
    // Страница, menu.js, sw — СНАЧАЛА СЕТЬ (всегда свежее), кэш только как резерв при обрыве
    e.respondWith(
      fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, copy); });
        }
        return resp;
      }).catch(function() {
        return caches.match(e.request).then(function(c) {
          return c || new Response('Нет соединения', { status: 503 });
        });
      })
    );
  }
});

// Принудительный сброс кэша по команде со страницы
self.addEventListener('message', function(e) {
  if (e.data === 'clearCache') {
    caches.delete(CACHE).then(function() {
      self.registration.unregister();
    });
  }
});
