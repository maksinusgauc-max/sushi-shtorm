// ═══════════════════════════════════════════════════════════
// Серверная функция Vercel: онлайн-оплата через Т-Бизнес (Т-Банк / Тинькофф)
// Путь в репозитории: api/payment.js
// Ключи хранятся в переменных окружения Vercel:
//   TBANK_TERMINAL_KEY  — Terminal Key (из личного кабинета Т-Бизнес)
//   TBANK_PASSWORD      — пароль терминала (Secret)
// (Settings → Environment Variables). В браузер ключи НЕ попадают.
//
// Пока ключи не заданы — функция возвращает {error:'not_configured'},
// и сайт мягко откатывается на «оплату при получении».
//
// Документация: https://www.tbank.ru/kassa/dev/payments/  (метод Init)
// ═══════════════════════════════════════════════════════════

import crypto from 'node:crypto';

// Подпись запроса Т-Банка (Token):
// берём корневые НЕ-объектные параметры + Password, сортируем по ключу,
// склеиваем значения и считаем SHA-256.
function genToken(params, password) {
  const data = Object.assign({}, params, { Password: password });
  const keys = Object.keys(data).filter(function (k) {
    const v = data[k];
    return v !== undefined && v !== null && typeof v !== 'object';
  }).sort();
  const concat = keys.map(function (k) { return String(data[k]); }).join('');
  return crypto.createHash('sha256').update(concat, 'utf8').digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const TERMINAL = process.env.TBANK_TERMINAL_KEY;
  const PASSWORD = process.env.TBANK_PASSWORD;
  if (!TERMINAL || !PASSWORD) {
    // Эквайринг ещё не подключён
    return res.status(503).json({ error: 'not_configured' });
  }

  try {
    const { amount, description, return_url, order_id } = req.body || {};

    // Валидация суммы (рубли → копейки)
    const rub = Number(amount);
    if (!rub || rub <= 0 || rub > 1000000) {
      return res.status(400).json({ error: 'bad_amount' });
    }
    if (!return_url || !/^https?:\/\//.test(String(return_url))) {
      return res.status(400).json({ error: 'bad_return_url' });
    }
    const kopecks = Math.round(rub * 100);

    // SuccessURL — куда вернуть после оплаты; FailURL — при неуспехе
    const successUrl = String(return_url);
    const failUrl = successUrl.indexOf('paid=') !== -1
      ? successUrl.split('paid=').join('payfail=')
      : successUrl;

    const params = {
      TerminalKey: TERMINAL,
      Amount: kopecks,
      OrderId: order_id ? String(order_id).slice(0, 36) : ('ord-' + Date.now()),
      Description: String(description || 'Заказ Суши Шторм').slice(0, 140),
      SuccessURL: successUrl,
      FailURL: failUrl,
    };
    params.Token = genToken(params, PASSWORD);

    const r = await fetch('https://securepay.tinkoff.ru/v2/Init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await r.json();
    if (data && data.Success && data.PaymentURL) {
      return res.status(200).json({ ok: true, url: data.PaymentURL, payment_id: data.PaymentId });
    }

    console.error('T-Bank error:', data);
    return res.status(502).json({ error: 'tbank_error', detail: (data && (data.Message || data.Details)) || 'unknown' });
  } catch (e) {
    console.error('Payment handler error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
}
