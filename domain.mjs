import { hash, uid, now, text, fail, audit, csv } from './core/security.mjs';
import { createHash } from 'node:crypto';
export const roles = ['admin', 'gestor', 'consulta'];
export function seed(password) {
  return {
    version: 1,
    app: 'techflow',
    users: roles.map((role, i) => ({
      id: uid(),
      username: ['admin', 'gestor', 'consulta'][i],
      name: ['Administrador demo', 'Gestor documental', 'Usuario de consulta'][i],
      role,
      password: hash(password),
      failures: 0,
      lockedUntil: 0,
    })),
    documents: [],
    notifications: [],
    executions: [],
    reports: [],
    audit: [],
  };
}
export const rules = [
  { type: 'Factura', area: 'Contabilidad', words: ['factura', 'invoice'] },
  { type: 'Contrato', area: 'Jurídica', words: ['contrato', 'contract'] },
  { type: 'Solicitud', area: 'Operaciones', words: ['solicitud', 'requerimiento', 'request'] },
];
const write = (user) => {
  if (user.role === 'consulta') fail('Tu rol solo permite consultar documentos', 403);
};
function event(s, doc, step, status, detail, user) {
  s.executions.unshift({ id: uid(), documentId: doc?.id || '', step, status, detail, date: now() });
  audit(s, user, 'FLUJO_' + step, detail);
}
export function receive(s, user, b) {
  write(user);
  const filename = text(b.filename, 'Nombre de archivo', 120);
  if (!/^[^\/\\]+\.(txt|pdf)$/i.test(filename))
    fail('Solo se permiten archivos .txt y .pdf sin rutas');
  if (
    typeof b.content !== 'string' ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b.content)
  )
    fail('Contenido base64 inválido');
  const bytes = Buffer.from(b.content, 'base64');
  if (!bytes.length || bytes.length > 1024 * 1024) fail('Archivo vacío o mayor de 1 MB');
  if (filename.toLowerCase().endsWith('.pdf') && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))
    fail('La firma del PDF es inválida');
  if (filename.toLowerCase().endsWith('.txt') && bytes.includes(0))
    fail('El texto contiene bytes no admitidos');
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const existing = s.documents.find((d) => d.checksum === checksum);
  if (existing) {
    event(s, existing, 1, 'duplicado', 'Documento duplicado: ' + filename, user);
    return existing;
  }
  const doc = {
    id: uid(),
    filename,
    content: b.content,
    checksum,
    bytes: bytes.length,
    subject: text(b.subject || filename, 'Asunto', 250),
    source: ['manual', 'webhook', 'correo'].includes(b.source) ? b.source : 'manual',
    status: 'recibido',
    type: 'Sin clasificar',
    area: 'Pendiente',
    reason: '',
    date: now(),
    user: user.username,
    step: 1,
  };
  s.documents.unshift(doc);
  event(s, doc, 1, 'ok', 'Recepción: ' + filename, user);
  return doc;
}
export function stage(s, user, id, step) {
  write(user);
  const d = s.documents.find((d) => d.id === id);
  if (!d) fail('Documento inexistente', 404);
  if (step <= d.step) return d;
  if (d.status === 'revision') return d;
  if (step !== d.step + 1) fail('Ejecute la etapa anterior primero', 409);
  if (step === 2) {
    const normalized = (d.filename + ' ' + d.subject)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const matches = rules.filter((r) => r.words.some((w) => normalized.includes(w)));
    if (matches.length !== 1) {
      d.status = 'revision';
      d.reason = matches.length ? 'Clasificación ambigua' : 'No se encontraron palabras clave';
      event(s, d, 2, 'revision', d.reason, user);
      return d;
    }
    d.type = matches[0].type;
    d.area = matches[0].area;
    d.status = 'clasificado';
  }
  if (step === 3) {
    d.storageName =
      d.area +
      '/' +
      d.date.slice(0, 7) +
      '/' +
      d.id +
      '_' +
      d.type.toLowerCase() +
      '.' +
      d.filename.split('.').at(-1).toLowerCase();
    d.status = 'almacenado';
  }
  if (step === 4) {
    if (!s.notifications.some((n) => n.documentId === d.id))
      s.notifications.unshift({
        id: uid(),
        documentId: d.id,
        area: d.area,
        message: d.type + ': ' + d.subject,
        date: now(),
        read: false,
        channel: 'bandeja interna',
      });
    d.status = 'notificado';
  }
  if (step === 5) {
    d.status = 'completado';
    d.completedAt = now();
  }
  d.step = step;
  event(s, d, step, 'ok', d.filename + ' → ' + d.status, user);
  return d;
}
export function processDocument(s, user, b) {
  const d = receive(s, user, b);
  for (let i = d.step + 1; i <= 5; i++) {
    stage(s, user, d.id, i);
    if (d.status === 'revision') break;
  }
  return d;
}
export function snapshot(s, user) {
  return {
    documents: s.documents.map(({ content, ...d }) => d),
    notifications: s.notifications,
    executions: s.executions,
    audit: user.role === 'admin' ? s.audit : [],
    rules,
    users:
      user.role === 'admin' ? s.users.map(({ password, failures, lockedUntil, ...u }) => u) : [],
    reports: s.reports,
    stats: {
      total: s.documents.length,
      completed: s.documents.filter((d) => d.status === 'completado').length,
      review: s.documents.filter((d) => d.status === 'revision').length,
      notifications: s.notifications.length,
    },
  };
}
export function action(s, user, route, method, b) {
  if (method !== 'POST') return undefined;
  if (route === '/api/documents') return processDocument(s, user, b);
  if (route === '/api/documents/receive') return receive(s, user, b);
  if (route === '/api/documents/stage') {
    if (!Number.isInteger(b.step) || b.step < 2 || b.step > 5) fail('Etapa inválida');
    return stage(s, user, b.id, b.step);
  }
  if (route === '/api/documents/error') {
    write(user);
    const d = s.documents.find((d) => d.id === b.id);
    if (!d) fail('Documento inexistente', 404);
    d.status = 'revision';
    d.reason = text(b.reason || 'Error de integración; revisar ejecución n8n', 'Motivo', 250);
    event(s, d, d.step, 'error', d.reason, user);
    return d;
  }
  if (route === '/api/documents/review') {
    write(user);
    const d = s.documents.find((d) => d.id === b.id);
    if (!d) fail('Documento inexistente', 404);
    if (d.status !== 'revision') fail('El documento no está en revisión');
    const rule = rules.find((r) => r.type === b.type);
    if (!rule) fail('Seleccione un tipo válido');
    d.type = rule.type;
    d.area = rule.area;
    d.status = 'clasificado';
    d.reason = 'Resuelto manualmente por ' + user.username;
    d.step = 2;
    event(s, d, 2, 'manual', d.reason, user);
    for (let i = 3; i <= 5; i++) stage(s, user, d.id, i);
    return d;
  }
  if (route === '/api/notifications/read') {
    const n = s.notifications.find((n) => n.id === b.id);
    if (!n) fail('Notificación inexistente', 404);
    n.read = true;
    audit(s, user, 'NOTIFICACION_LEIDA', n.id);
    return { ok: true };
  }
  if (route === '/api/reports/generate') {
    write(user);
    const report = {
      id: uid(),
      date: now(),
      total: s.documents.length,
      completed: s.documents.filter((d) => d.status === 'completado').length,
      review: s.documents.filter((d) => d.status === 'revision').length,
    };
    s.reports.unshift(report);
    audit(s, user, 'REPORTE_GENERADO', 'Total ' + report.total);
    return report;
  }
  return undefined;
}
export function report(s) {
  return csv([
    ['Fecha', 'Archivo', 'Tipo', 'Área', 'Estado', 'Origen', 'SHA256'],
    ...s.documents.map((d) => [d.date, d.filename, d.type, d.area, d.status, d.source, d.checksum]),
  ]);
}
