import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { uid, now, verify, hash, fail, text, audit } from './security.mjs';
const base = dirname(fileURLToPath(import.meta.url));
export async function createApp({
  app,
  domain,
  port = 0,
  dir,
  databaseUrl,
  keyHex,
  demo = true,
  password = 'Demo2026!!',
  idleMs = 900000,
  lockMs = 300000,
  workflowToken = '',
  n8nUrl = '',
  secureCookie = false,
  host = '127.0.0.1',
}) {
  if (app !== 'techflow') throw Error('Este servidor pertenece a techflow');
  if (!demo && password === 'Demo2026!!')
    throw Error('Configure ADMIN_PASSWORD fuera del modo demostración');
  if (password.length < 10) throw Error('ADMIN_PASSWORD requiere 10 caracteres');
  const store = await openStore({
    app,
    dir,
    databaseUrl,
    keyHex,
    seed: () => domain.seed(password),
  });
  const sessions = new Map(),
    attempts = new Map();
  let tail = Promise.resolve();
  const serial = (fn) => {
    const next = tail.then(fn);
    tail = next.catch(() => {});
    return next;
  };
  const cookieName = app + '_sid';
  function userFor(req) {
    const id = (req.headers.cookie || '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1);
    const session = sessions.get(id);
    if (!session || Date.now() - session.last > idleMs) {
      sessions.delete(id);
      fail('La sesión terminó. Inicia sesión de nuevo.', 401);
    }
    const user = store.state.users.find((u) => u.id === session.userId);
    if (!user) {
      sessions.delete(id);
      fail('Usuario inexistente', 401);
    }
    session.last = Date.now();
    return { user, session, id };
  }
  function serviceUser(req) {
    if (!workflowToken || req.headers['x-workflow-token'] !== workflowToken)
      fail('Token de integración inválido', 401);
    return { username: 'integracion-n8n', name: 'n8n', role: 'gestor', id: 'integration' };
  }
  async function body(req) {
    let size = 0,
      chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1500000) fail('La solicitud supera el límite de 1 MB por archivo', 413);
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString() || '{}');
    } catch {
      fail('JSON inválido');
    }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, data, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type });
      res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.pathname;
      const method = req.method;
      const mutation = !['GET', 'HEAD'].includes(method);
      if (mutation) {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) fail('Origen no permitido', 403);
        if (!(req.headers['content-type'] || '').startsWith('application/json'))
          fail('Se requiere application/json', 415);
      }
      if (route === '/api/health') {
        await store.ping();
        return send(200, { status: 'ok', app, storage: store.mode });
      }
      if (route === '/api/config' && method === 'GET')
        return send(200, {
          app,
          demo,
          storage: store.mode,
          orchestration: n8nUrl ? 'n8n' : 'local',
          roles: domain.roles,
        });
      if (route === '/api/login' && method === 'POST') {
        const b = await body(req);
        return await serial(async () => {
          const username = text(b.username, 'Usuario', 50).toLowerCase();
          const password = text(b.password, 'Contraseña', 200);
          const ip = req.socket.remoteAddress;
          const a = attempts.get(ip) || { count: 0, since: Date.now() };
          if (Date.now() - a.since > 60000) {
            a.count = 0;
            a.since = Date.now();
          }
          if (++a.count > 30) fail('Demasiados intentos. Espera un minuto.', 429);
          attempts.set(ip, a);
          let result;
          await store.change((s) => {
            const u = s.users.find((u) => u.username === username);
            if (u && u.lockedUntil > Date.now()) {
              result = {
                error: 'Cuenta bloqueada temporalmente. Intenta en cinco minutos.',
                status: 429,
              };
              return;
            }
            if (!u || !verify(password, u.password)) {
              if (u) {
                u.failures++;
                if (u.failures >= 5) {
                  u.lockedUntil = Date.now() + lockMs;
                  u.failures = 0;
                }
                audit(s, u, 'LOGIN_FALLIDO', 'Intento rechazado');
              } else {
                verify(password, s.users[0].password);
              }
              result = { error: 'Credenciales incorrectas', status: 401 };
              return;
            }
            u.failures = 0;
            u.lockedUntil = 0;
            audit(s, u, 'LOGIN', 'Inicio de sesión');
            result = { user: u };
          });
          if (result.error) return send(result.status, { error: result.error });
          const id = uid();
          const session = { userId: result.user.id, last: Date.now(), csrf: uid() };
          sessions.set(id, session);
          res.setHeader(
            'Set-Cookie',
            cookieName +
              '=' +
              id +
              '; HttpOnly; SameSite=Strict; Path=/' +
              (secureCookie ? '; Secure' : ''),
          );
          return send(200, { ok: true });
        });
      }
      if (route === '/api/me' && method === 'GET') {
        const { user, session } = userFor(req);
        return send(200, {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          csrf: session.csrf,
        });
      }
      const integration = route.startsWith('/api/integration/');
      const auth = integration ? { user: serviceUser(req) } : userFor(req);
      const { user, session, id } = auth;
      if (mutation && !integration && req.headers['x-csrf-token'] !== session.csrf)
        fail('Token de sesión inválido. Recarga la página.', 403);
      if (route === '/api/logout' && method === 'POST') {
        sessions.delete(id);
        res.setHeader('Set-Cookie', cookieName + '=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/');
        return send(200, { ok: true });
      }
      if (route === '/api/state' && method === 'GET')
        return send(200, domain.snapshot(store.state, user));
      if (route === '/api/password' && method === 'POST') {
        const b = await body(req);
        const next = text(b.newPassword, 'Contraseña nueva', 200);
        if (next.length < 10 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next))
          fail('Usa al menos 10 caracteres, mayúscula, minúscula y número');
        await serial(() =>
          store.change((s) => {
            const u = s.users.find((u) => u.id === user.id);
            if (!verify(b.currentPassword || '', u.password)) fail('Contraseña actual incorrecta');
            u.password = hash(next);
            audit(s, u, 'PASSWORD', 'Contraseña actualizada');
          }),
        );
        for (const [sid, v] of sessions) if (v.userId === user.id) sessions.delete(sid);
        return send(200, { ok: true });
      }
      if (route === '/api/report.csv' && method === 'GET') {
        res.setHeader('Content-Disposition', 'attachment; filename="' + app + '-reporte.csv"');
        return send(
          200,
          domain.report(store.state, url.searchParams.get('kind')),
          'text/csv; charset=utf-8',
        );
      }
      if (app === 'techflow' && route === '/api/download' && method === 'GET') {
        const d = store.state.documents.find((d) => d.id === url.searchParams.get('id'));
        if (!d) fail('Documento inexistente', 404);
        res.setHeader(
          'Content-Disposition',
          "attachment; filename*=UTF-8''" + encodeURIComponent(d.filename),
        );
        return send(200, Buffer.from(d.content, 'base64'), 'application/octet-stream');
      }
      if (app === 'techflow' && route === '/api/dispatch' && method === 'POST') {
        if (user.role === 'consulta') fail('Tu rol solo permite consultar', 403);
        if (!n8nUrl) fail('No se ha configurado n8n', 409);
        const b = await body(req);
        const upstream = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Workflow-Token': workflowToken },
          body: JSON.stringify(b),
          signal: AbortSignal.timeout(60000),
        });
        if (!upstream.ok)
          fail('n8n no completó el proceso. Revisa las ejecuciones y reintenta.', 502);
        return send(200, { ok: true });
      }
      if (route.startsWith('/api/')) {
        const b = mutation ? await body(req) : {};
        const actual = integration ? route.replace('/api/integration/', '/api/') : route;
        if (
          integration &&
          (![
            '/api/documents/receive',
            '/api/documents/stage',
            '/api/documents/error',
            '/api/reports/generate',
          ].includes(actual) ||
            app !== 'techflow')
        )
          fail('Ruta de integración no permitida', 403);
        let result;
        await serial(() =>
          store.change((s) => {
            try {
              result = domain.action(s, user, actual, method, b);
              return result;
            } catch (e) {
              throw e;
            }
          }),
        );
        if (result === undefined) fail('Ruta inexistente', 404);
        return send(200, result);
      }
      fail('Ruta inexistente', 404);
    } catch (e) {
      if (e.status === 401 && req.url === '/' && req.method === 'GET') {
      }
      if (!res.headersSent)
        send(e.status || 500, {
          error: e.status ? e.message : 'Error interno. Revisa la consola del servidor.',
        });
      if (!e.status) console.error(e);
    }
  });
  const handler = server.listeners('request')[0];
  server.removeAllListeners('request');
  server.on('request', async (req, res) => {
    const routes = {
      '/': ['index.html', 'text/html; charset=utf-8'],
      '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
      '/style.css': ['style.css', 'text/css; charset=utf-8'],
      '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
    };
    const asset = routes[req.url?.split('?')[0]];
    if (asset && req.method === 'GET') {
      try {
        const data = await readFile(join(base, 'public', asset[0]));
        res.writeHead(200, {
          'Content-Type': asset[1],
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      } catch {
        res.writeHead(500);
        res.end('Recurso no disponible');
      }
      return;
    }
    await handler(req, res);
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, resolve);
    });
  } catch (error) {
    await store.close();
    throw error;
  }
  return {
    server,
    store,
    sessions,
    url: 'http://' + host + ':' + server.address().port,
    close: async () => {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeIdleConnections();
      });
      await store.close();
    },
  };
}
export async function launch(app, domain, defaultPort) {
  const dir = process.env.DATA_DIR || join(base, '..', 'data');
  const instance = await createApp({
    app,
    domain,
    dir,
    port: Number(process.env.PORT || defaultPort),
    databaseUrl: process.env.DATABASE_URL,
    keyHex: process.env.APP_KEY,
    demo: process.env.DEMO_MODE !== 'false',
    password: process.env.ADMIN_PASSWORD || 'Demo2026!!',
    workflowToken: process.env.WORKFLOW_TOKEN || '',
    n8nUrl: process.env.N8N_WEBHOOK_URL || '',
    secureCookie: process.env.SECURE_COOKIE === 'true',
    host: process.env.HOST || '127.0.0.1',
  });
  console.log(app + ' listo en ' + instance.url + ' · ' + instance.store.mode);
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => instance.close().then(() => process.exit(0)));
  return instance;
}
