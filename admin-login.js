// ═══════════════════════════════════════════════════════════
// Серверная функция Vercel: вход сотрудника (киоск)
// Путь в репозитории: api/admin-login.js
// Пароль хранится ТОЛЬКО в переменных окружения Vercel:
//   ADMIN_PASS   — пароль сотрудника (обязательно)
//   ADMIN_LOGIN  — логин (необязательно, по умолчанию 'admin')
// (Settings → Environment Variables). В код и в браузер пароль НЕ попадает.
//
// Пока ADMIN_PASS не задан — вход выключен (возвращаем not_configured).
// ═══════════════════════════════════════════════════════════

// Антибрутфорс: лимит попыток на IP (best-effort, в памяти инстанса)
const RL_WINDOW = 60 * 1000;
const RL_MAX = 8;
const _hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const arr = (_hits.get(ip) || []).filter(function (t) { return now - t < RL_WINDOW; });
  arr.push(now);
  _hits.set(ip, arr);
  if (_hits.size > 2000) {
    for (const [k, v] of _hits) {
      if (!v.length || now - v[v.length - 1] > RL_WINDOW) _hits.delete(k);
    }
  }
  return arr.length > RL_MAX;
}

// Сравнение строк за постоянное время (без утечки через тайминг)
function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS;
  if (!ADMIN_PASS) {
    return res.status(503).json({ error: 'not_configured' });
  }

  const fwd = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const ip = String(fwd).split(',')[0].trim();
  if (tooMany(ip)) {
    return res.status(429).json({ error: 'too_many' });
  }

  try {
    const { login, pass } = req.body || {};
    const ok =
      safeEqual(String(login || '').toLowerCase(), String(ADMIN_LOGIN).toLowerCase()) &&
      safeEqual(String(pass || ''), ADMIN_PASS);

    // небольшая задержка усложняет перебор
    await new Promise(function (r) { setTimeout(r, 250); });

    if (ok) return res.status(200).json({ ok: true });
    return res.status(401).json({ ok: false });
  } catch (e) {
    console.error('Admin login error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
}
