// ═══════════════════════════════════════════════════════════
//  Service Worker «Суши Шторм» — САМОЛИКВИДАТОР (kill-switch).
//  Раньше SW кэшировал картинки и на старом движке планшета
//  заклинивал перезагрузку, а cache-first держал старые битые
//  картинки. Кэширование УБРАНО навсегда.
//  Этот файл оставлен НАМЕРЕННО: планшет, где ещё висит старый
//  SW, при следующей навигации подтянет этот скрипт по сети,
//  тот снесёт все кэши, отрегистрирует сам себя и перезагрузит
//  вкладку начисто. Никто этот SW больше не регистрирует —
//  новые устройства его просто не получают.
//  Не кэширует ничего: fetch-обработчика нет → все запросы
//  идут прямо в сеть.
// ═══════════════════════════════════════════════════════════

self.addEventListener('install', function(e) {
  self.skipWaiting(); // активируемся немедленно, не ждём закрытия вкладок
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.registration.unregister();
    }).then(function() {
      return self.clients.matchAll({ type: 'window' });
    }).then(function(clients) {
      // принудительно перезагружаем все открытые вкладки, чтобы сбросить контроль SW
      for (var i = 0; i < clients.length; i++) {
        clients[i].navigate(clients[i].url);
      }
    }).catch(function() {})
  );
});

// fetch-обработчика НЕТ — ничего не перехватываем, всё идёт в сеть напрямую.

// На случай старой команды со страницы — тоже чистимся.
self.addEventListener('message', function(e) {
  if (e.data === 'clearCache') {
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.registration.unregister();
    }).catch(function() {});
  }
});
