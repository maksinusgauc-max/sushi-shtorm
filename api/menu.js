// ═══════════════════════════════════════════════════════════
// Серверная функция Vercel: меню сайта через Supabase
// Путь в репозитории: api/menu.js
//
// GET   — публичное чтение меню (сайту нужно показывать блюда всем).
// PATCH — правка позиции (цена / наличие / порядок). Только с паролем
//         администратора в заголовке x-admin-pass === ADMIN_PASS.
//
// Переменные окружения Vercel:
//   SUPABASE_URL          — Project URL
//   SUPABASE_ANON_KEY     — публичный ключ (для чтения)
//   SUPABASE_SERVICE_KEY  — секретный ключ (для записи, обходит RLS)
//   ADMIN_PASS            — пароль администратора (тот же, что для входа)
//
// Пока Supabase не настроен — возвращаем not_configured, и сайт
// откатывается на статический menu.js.
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  const SERVICE = process.env.SUPABASE_SERVICE_KEY;

  if (!URL || !ANON) {
    return res.status(503).json({ error: 'not_configured' });
  }
  const base = URL.replace(/\/+$/, '') + '/rest/v1/menu';

  // ── Публичное чтение меню ──
  if (req.method === 'GET') {
    try {
      const r = await fetch(base + '?select=*&order=cat.asc,sort.asc', {
        headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
      });
      const data = await r.json();
      if (!Array.isArray(data)) {
        console.error('Supabase read error:', data);
        return res.status(502).json({ error: 'bad_response' });
      }
      // короткий кэш на CDN, чтобы не дёргать БД на каждый заход
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
      return res.status(200).json(data);
    } catch (e) {
      console.error('Menu GET error:', e);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  // ── Правка позиции (только администратор) ──
  if (req.method === 'PATCH') {
    if (!SERVICE) return res.status(503).json({ error: 'not_configured' });
    const ADMIN_PASS = process.env.ADMIN_PASS;
    const pass = req.headers['x-admin-pass'];
    if (!ADMIN_PASS || pass !== ADMIN_PASS) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    try {
      const body = req.body || {};
      const id = parseInt(body.id, 10);
      if (!id) return res.status(400).json({ error: 'no_id' });

      const patch = {};
      if (body.price !== undefined)     patch.price = Math.max(0, parseInt(body.price, 10) || 0);
      if (body.available !== undefined) patch.available = !!body.available;
      if (body.sort !== undefined)      patch.sort = parseInt(body.sort, 10) || 0;
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing_to_update' });
      patch.updated_at = new Date().toISOString();

      const r = await fetch(base + '?id=eq.' + id, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE,
          Authorization: 'Bearer ' + SERVICE,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patch),
      });
      const data = await r.json();
      if (r.ok) return res.status(200).json({ ok: true, row: Array.isArray(data) ? data[0] : data });
      console.error('Supabase write error:', data);
      return res.status(502).json({ error: 'supabase_error', detail: (data && data.message) || 'unknown' });
    } catch (e) {
      console.error('Menu PATCH error:', e);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
