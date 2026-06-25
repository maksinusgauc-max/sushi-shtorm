// ═══════════════════════════════════════════════════════════
// Vercel Edge Middleware: защита служебных страниц
// Путь в репозитории: middleware.js (в КОРНЕ, рядом с index.html)
//
// Закрывает /kiosk.html и /admin.html паролем на уровне сервера
// (HTTP Basic Auth) — ещё до загрузки страницы. Обойти через консоль
// браузера нельзя: без верных данных сервер просто не отдаёт страницу.
//
// Логин/пароль берутся из переменных окружения Vercel:
//   ADMIN_LOGIN  — логин (необязательно, по умолчанию 'admin')
//   ADMIN_PASS   — пароль (тот же, что для входа сотрудника)
// Пока ADMIN_PASS не задан — middleware ничего не блокирует
// (чтобы случайно не закрыть себе доступ). Обязательно задай ADMIN_PASS.
// ═══════════════════════════════════════════════════════════

export const config = {
  // Закрываем все варианты адреса: с .html, без (clean URL) и любые под-пути
  matcher: ['/kiosk', '/kiosk.html', '/admin', '/admin.html', '/kiosk/:p*', '/admin/:p*'],
};

export default function middleware(request) {
  const USER = process.env.ADMIN_LOGIN || 'admin';
  const PASS = process.env.ADMIN_PASS;

  // Защита не настроена — пропускаем (чтобы не залочить себя). Задай ADMIN_PASS в Vercel.
  if (!PASS) return;

  const auth = request.headers.get('authorization') || '';
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const i = decoded.indexOf(':');
      const u = decoded.slice(0, i);
      const p = decoded.slice(i + 1);
      if (u === USER && p === PASS) return; // доступ разрешён
    } catch (e) { /* кривой заголовок — ниже попросим авторизацию */ }
  }

  return new Response('Требуется авторизация', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Sushi Storm Staff", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
