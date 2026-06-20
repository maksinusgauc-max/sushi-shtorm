// ═══════════════════════════════════════════════════════════
// Серверная функция: ИИ-помощник по меню (Claude API)
// Путь в репозитории: api/chat.js
// Ключ хранится в переменной окружения Vercel: ANTHROPIC_API_KEY
// (Settings → Environment Variables). В браузер ключ не попадает.
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Сервер не настроен: нет ANTHROPIC_API_KEY' });
  }

  try {
    const { messages, menu } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Нет сообщений' });
    }
    // Ограничиваем длину истории для экономии токенов
    const trimmed = messages.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content).slice(0, 1000),
    }));

    // Краткий прайс для системного промпта (название + цена + категория)
    const menuText = Array.isArray(menu)
      ? menu.map(d => `${d.name} (${d.cat}) — ${d.price}₽`).join('\n').slice(0, 6000)
      : '';

    const system = `Ты — дружелюбный помощник по меню в ресторане доставки «Суши Шторм» (Кабардинка).
Помогаешь гостю выбрать блюда: подсказываешь по составу, советуешь сочетания, отвечаешь про размеры порций и остроту.
Отвечай КОРОТКО (1-3 предложения), по-русски, тепло и по делу. Не выдумывай блюд, которых нет в меню.
Если спрашивают то, чего ты не знаешь (точный состав, аллергены) — посоветуй уточнить у официанта.
Цены и доставка: роллы на 20% больше обычного, доставка ~60 мин, работаем 10:00–23:00.

МЕНЮ (название, категория, цена):
${menuText}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // быстрая и дешёвая модель
        max_tokens: 400,
        system,
        messages: trimmed,
      }),
    });

    const data = await r.json();
    if (data.content && data.content[0] && data.content[0].text) {
      return res.status(200).json({ reply: data.content[0].text });
    }
    console.error('Claude API error:', data);
    return res.status(502).json({ error: 'Ошибка ИИ', detail: data.error?.message || 'unknown' });
  } catch (e) {
    console.error('Chat handler error:', e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
