// ═══════════════════════════════════════════════════════════
// Серверная функция Vercel: создание онлайн-платежа (ЮKassa)
// Путь в репозитории: api/payment.js
// Ключи хранятся в переменных окружения Vercel:
//   YOOKASSA_SHOP_ID      — идентификатор магазина
//   YOOKASSA_SECRET_KEY   — секретный ключ
// (Settings → Environment Variables). В браузер ключи НЕ попадают.
//
// Пока ключи не заданы — функция возвращает {error:'not_configured'},
// и сайт мягко откатывается на «оплату при получении».
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SHOP_ID = process.env.YOOKASSA_SHOP_ID;
  const SECRET  = process.env.YOOKASSA_SECRET_KEY;
  if (!SHOP_ID || !SECRET) {
    // Эквайринг ещё не подключён
    return res.status(503).json({ error: 'not_configured' });
  }

  try {
    const { amount, description, return_url, order_id } = req.body || {};

    // Валидация суммы
    const value = Number(amount);
    if (!value || value <= 0 || value > 1000000) {
      return res.status(400).json({ error: 'bad_amount' });
    }
    if (!return_url || !/^https?:\/\//.test(String(return_url))) {
      return res.status(400).json({ error: 'bad_return_url' });
    }

    // Ключ идемпотентности — защита от дублей платежа
    const idemKey = (order_id ? String(order_id).slice(0, 40) : 'ord') + '-' + Date.now();
    const auth = Buffer.from(SHOP_ID + ':' + SECRET).toString('base64');

    const r = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idemKey,
        'Authorization': 'Basic ' + auth,
      },
      body: JSON.stringify({
        amount: { value: value.toFixed(2), currency: 'RUB' },
        capture: true,
        confirmation: { type: 'redirect', return_url: String(return_url) },
        description: String(description || 'Заказ Суши Шторм').slice(0, 128),
        metadata: { order_id: order_id ? String(order_id) : '' },
        // Чек для 54-ФЗ можно добавить здесь в поле "receipt" — см. документацию ЮKassa
      }),
    });

    const data = await r.json();
    const url = data && data.confirmation && data.confirmation.confirmation_url;
    if (url) {
      return res.status(200).json({ ok: true, url, payment_id: data.id });
    }

    console.error('YooKassa error:', data);
    return res.status(502).json({ error: 'yookassa_error', detail: (data && data.description) || 'unknown' });
  } catch (e) {
    console.error('Payment handler error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
}
