import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../core/server.mjs';
import * as flow from '../domain.mjs';
import { seal, unseal, csv } from '../core/security.mjs';
import { randomBytes } from 'node:crypto';
const password = 'Demo2026!!';
async function fixture(app, domain, opts = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'grado-test-'));
  const instance = await createApp({ app, domain, dir, ...opts });
  return {
    ...instance,
    dir,
    async cleanup() {
      await instance.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
function client(base) {
  let cookie = '',
    csrf = '';
  return {
    async call(route, body, extra = {}) {
      const r = await fetch(base + route, {
        method: body ? 'POST' : 'GET',
        headers: {
          ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}),
          Cookie: cookie,
          ...extra,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
      const data = (r.headers.get('content-type') || '').includes('application/json')
        ? await r.json()
        : await r.text();
      return { status: r.status, data };
    },
    async login(username = 'admin', pass = password) {
      const result = await this.call('/api/login', { username, password: pass });
      if (result.status === 200) {
        const { data } = await this.call('/api/me');
        csrf = data.csrf;
      }
      return result;
    },
  };
}
const document = (filename, subject = filename, content = 'Documento académico ' + filename) => ({
  filename,
  subject,
  content: Buffer.from(content).toString('base64'),
  source: 'manual',
});
test('TechFlow · cinco etapas documentales', async (t) => {
  const f = await fixture('techflow', flow, { workflowToken: 'test-integration-token' });
  t.after(() => f.cleanup());
  const admin = client(f.url),
    viewer = client(f.url);
  await admin.login();
  await viewer.login('consulta');
  let id, review;
  await t.test('TF-CP01 · recorrido completo y clasificación', async () => {
    const r = await admin.call('/api/documents', document('factura-001.txt'));
    assert.equal(r.status, 200);
    id = r.data.id;
    assert.equal(r.data.type, 'Factura');
    assert.equal(r.data.area, 'Contabilidad');
    assert.equal(r.data.status, 'completado');
    assert.ok(r.data.storageName.includes('Contabilidad/'));
    assert.equal(r.data.step, 5);
  });
  await t.test('TF-CP02 · duplicados por contenido sin doble aviso', async () => {
    const r = await admin.call('/api/documents', document('factura-001.txt'));
    assert.equal(r.data.id, id);
    const s = (await admin.call('/api/state')).data;
    assert.equal(s.documents.length, 1);
    assert.equal(s.notifications.length, 1);
  });
  await t.test('TF-CP03 · formatos, tamaño y firma PDF', async () => {
    for (const b of [
      document('virus.exe'),
      document('../factura.txt'),
      { ...document('factura.txt'), content: '' },
      document('falso.pdf'),
      { ...document('factura.txt'), content: '!!!!' },
    ])
      assert.equal((await admin.call('/api/documents', b)).status, 400);
    const huge = {
      ...document('grande.txt'),
      content: Buffer.alloc(1048577, 65).toString('base64'),
    };
    assert.equal((await admin.call('/api/documents', huge)).status, 400);
  });
  await t.test('TF-CP04 · documento desconocido va a revisión', async () => {
    const r = await admin.call('/api/documents', document('memorando.txt'));
    review = r.data.id;
    assert.equal(r.data.status, 'revision');
    assert.equal(r.data.step, 1);
  });
  await t.test('TF-CP05 · resuelve revisión y continúa etapas 3 a 5', async () => {
    const r = await admin.call('/api/documents/review', { id: review, type: 'Solicitud' });
    assert.equal(r.data.status, 'completado');
    assert.equal(r.data.area, 'Operaciones');
    assert.equal(
      (await admin.call('/api/documents/review', { id: review, type: 'Solicitud' })).status,
      400,
    );
  });
  await t.test('TF-CP06 · ambigüedad y clasificación por asunto', async () => {
    assert.equal(
      (await admin.call('/api/documents', document('factura-contrato.txt'))).data.status,
      'revision',
    );
    assert.equal(
      (await admin.call('/api/documents', document('nuevo.txt', 'Contrato de soporte'))).data.type,
      'Contrato',
    );
  });
  await t.test('TF-CP07 · descarga y RBAC', async () => {
    assert.equal((await viewer.call('/api/documents', document('solicitud.txt'))).status, 403);
    assert.equal(
      (await viewer.call('/api/documents/review', { id: review, type: 'Factura' })).status,
      403,
    );
    assert.equal(
      (await viewer.call('/api/download?id=' + id)).data,
      'Documento académico factura-001.txt',
    );
    assert.deepEqual((await viewer.call('/api/state')).data.audit, []);
    assert.ok(!(await viewer.call('/api/state')).data.documents[0].content);
  });
  await t.test('TF-CP08 · notificación con marca de tiempo menor a 5 min', async () => {
    const s = (await admin.call('/api/state')).data;
    const d = s.documents.find((d) => d.id === id),
      n = s.notifications.find((n) => n.documentId === id);
    assert.ok(Date.parse(n.date) - Date.parse(d.date) < 300000);
    assert.equal(n.channel, 'bandeja interna');
    assert.equal((await viewer.call('/api/notifications/read', { id: n.id })).status, 200);
  });
  await t.test('TF-CP09 · API de integración autenticada y orden de etapas', async () => {
    const service = client(f.url),
      headers = { 'X-Workflow-Token': 'test-integration-token' };
    assert.equal(
      (await service.call('/api/integration/documents/receive', document('contrato-api.txt')))
        .status,
      401,
    );
    const d = (
      await service.call(
        '/api/integration/documents/receive',
        document('contrato-api.txt'),
        headers,
      )
    ).data;
    assert.equal(
      (await service.call('/api/integration/documents/stage', { id: d.id, step: 4 }, headers))
        .status,
      409,
    );
    for (let step = 2; step <= 5; step++)
      assert.equal(
        (await service.call('/api/integration/documents/stage', { id: d.id, step }, headers))
          .status,
        200,
      );
    assert.equal(
      (await service.call('/api/integration/documents/stage', { id: d.id, step: 4 }, headers)).data
        .status,
      'completado',
    );
    assert.equal(
      (
        await service.call(
          '/api/integration/documents/review',
          { id: d.id, type: 'Factura' },
          headers,
        )
      ).status,
      403,
    );
  });
  await t.test(
    'TF-CP10 · n8n puede detener la clasificación desconocida sin perder el documento',
    async () => {
      const service = client(f.url),
        headers = { 'X-Workflow-Token': 'test-integration-token' };
      const d = (
        await service.call('/api/integration/documents/receive', document('oficio.txt'), headers)
      ).data;
      for (let step = 2; step <= 5; step++)
        assert.equal(
          (await service.call('/api/integration/documents/stage', { id: d.id, step }, headers)).data
            .status,
          'revision',
        );
    },
  );
  await t.test('TF-CP11 · reporte y auditoría con cinco etapas', async () => {
    assert.equal((await admin.call('/api/reports/generate', {})).status, 200);
    assert.ok((await admin.call('/api/report.csv')).data.includes('factura-001.txt'));
    const s = (await admin.call('/api/state')).data;
    assert.equal(s.executions.filter((e) => e.documentId === id && e.status === 'ok').length, 5);
    assert.equal(s.reports.length, 1);
  });
  await t.test('TF-CP12 · contenido cifrado sin texto legible', async () => {
    const disk = await readFile(join(f.dir, 'app.sqlite'));
    assert.equal(disk.includes(Buffer.from('factura-001.txt')), false);
    assert.equal(disk.includes(Buffer.from('Documento académico')), false);
  });
});
test('Controles compartidos · bloqueo, expiración y contraseña', async (t) => {
  const f = await fixture('techflow', flow, { idleMs: 40, lockMs: 30 });
  t.after(() => f.cleanup());
  const c = client(f.url);
  for (let i = 0; i < 5; i++) assert.equal((await c.login('gestor', 'incorrecta')).status, 401);
  assert.equal((await c.login('gestor')).status, 429);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal((await c.login('gestor')).status, 200);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal((await c.call('/api/state')).status, 401);
  await c.login();
  assert.equal(
    (await c.call('/api/password', { currentPassword: password, newPassword: 'NuevaClave2026!' }))
      .status,
    200,
  );
  assert.equal((await c.call('/api/state')).status, 401);
  assert.equal((await c.login('admin', 'NuevaClave2026!')).status, 200);
});
test('Cifrado autenticado detecta manipulación y contraseña incorrecta', () => {
  const key = randomBytes(32),
    payload = seal({ secret: 'documento' }, key);
  assert.deepEqual(unseal(payload, key), { secret: 'documento' });
  assert.throws(() => unseal(payload, randomBytes(32)));
  const changed = JSON.parse(payload);
  changed.data = Buffer.from('falso').toString('base64');
  assert.throws(() => unseal(JSON.stringify(changed), key));
});
test('CSV neutraliza fórmulas y preserva comillas', () => {
  const result = csv([['=1+1', '+cmd', '@SUM(A1)', 'a"b']]);
  assert.ok(result.includes('"\'=1+1"'));
  assert.ok(result.includes('"a""b"'));
});

test('CSV genera BOM y separadores de fila reales', () => {
  const result = csv([['uno'], ['dos']]);
  assert.equal(result.charCodeAt(0), 0xfeff);
  assert.equal(result.split('\r\n').length, 2);
  assert.ok(!result.includes('\\r\\n'));
});
test('TechFlow · recuperación de error sin duplicar notificación', () => {
  const s = flow.seed('Demo2026!!'),
    user = s.users[0];
  const d = flow.processDocument(s, user, document('factura-recuperacion.txt'));
  flow.action(s, user, '/api/documents/error', 'POST', { id: d.id, reason: 'Fallo simulado' });
  assert.equal(d.status, 'revision');
  flow.action(s, user, '/api/documents/review', 'POST', { id: d.id, type: 'Factura' });
  assert.equal(d.status, 'completado');
  assert.equal(s.notifications.filter((n) => n.documentId === d.id).length, 1);
});

test('La página y todos sus recursos están disponibles', async t => {
  const app = 'techflow';
  const fixtureApp = await fixture(app, flow);
  t.after(() => fixtureApp.cleanup());
  for (const route of ['/', '/app.js', '/style.css', '/favicon.svg']) {
    const response = await fetch(fixtureApp.url + route);
    assert.equal(response.status, 200, route + ' debe estar disponible');
    const content = await response.text();
    assert.ok(content.length > 20, route + ' no debe estar vacío');
    assert.ok(!content.includes('Recurso no disponible'));
    if (route === '/') assert.ok(content.toLowerCase().includes('<html'));
  }
});
