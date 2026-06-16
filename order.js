// ═══════════════════════════════════════════════════════════
// Серверная функция Vercel: приём заказа с сайта → ФронтПад
// Файл должен лежать в репозитории по пути: api/order.js
// Секретный ключ хранится в переменных окружения Vercel,
// в коде и в браузере он НЕ светится.
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SECRET = process.env.FRONTPAD_SECRET;
  if (!SECRET) {
    return res.status(500).json({ error: 'Сервер не настроен: нет FRONTPAD_SECRET' });
  }

  try {
    const { name, phone, street, home, apart, pod, et, descr, items } = req.body || {};

    // ── Валидация на сервере (браузеру не доверяем) ──
    if (!name || !phone || !street || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Некорректные данные заказа' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'Слишком много позиций' });
    }
    if (!/^[\d\s+\-()]{10,18}$/.test(String(phone))) {
      return res.status(400).json({ error: 'Некорректный телефон' });
    }

    // ── Собираем запрос к ФронтПаду ──
    // Документация: https://frontpad.ru → раздел API
    const params = new URLSearchParams();
    params.append('secret', SECRET);

    items.forEach((it, i) => {
      // article — артикул товара ИЗ ФронтПада (Справочники → Товары)
      params.append(`product[${i}]`, String(it.article));
      const qty = Math.max(1, Math.min(99, parseInt(it.qty) || 1));
      params.append(`product_kol[${i}]`, String(qty));
    });

    params.append('name',   String(name).slice(0, 100));
    params.append('phone',  String(phone).slice(0, 20));
    params.append('street', String(street).slice(0, 150));
    if (home)  params.append('home',  String(home).slice(0, 20));
    if (apart) params.append('apart', String(apart).slice(0, 20));
    if (pod)   params.append('pod',   String(pod).slice(0, 10));
    if (et)    params.append('et',    String(et).slice(0, 10));
    if (descr) params.append('descr', String(descr).slice(0, 500));

    const fpResponse = await fetch('https://app.frontpad.ru/api/index.php?new_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await fpResponse.json();

    if (data.result === 'success') {
      return res.status(200).json({
        ok: true,
        order_number: data.order_number || data.order_id,
      });
    }

    console.error('FrontPad error:', data);
    return res.status(502).json({
      error: 'ФронтПад отклонил заказ',
      detail: data.error || 'unknown',
    });
  } catch (e) {
    console.error('Order handler error:', e);
    return res.status(500).json({ error: 'Ошибка сервера, попробуйте позвонить: 8 (929) 854-11-44' });
  }
}
