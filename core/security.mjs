import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
export const uid = () => randomBytes(12).toString('hex');
export const now = () => new Date().toISOString();
export function hash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 32).toString('hex');
}
export function verify(password, encoded) {
  const [salt, value] = encoded.split(':');
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(value, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function seal(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  });
}
export function unseal(text, key) {
  const e = JSON.parse(text);
  if (e.v !== 1) throw Error('Formato de respaldo desconocido');
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(e.iv, 'base64'));
  cipher.setAuthTag(Buffer.from(e.tag, 'base64'));
  return JSON.parse(
    Buffer.concat([cipher.update(Buffer.from(e.data, 'base64')), cipher.final()]).toString('utf8'),
  );
}
export function fail(message, status = 400) {
  const e = Error(message);
  e.status = status;
  throw e;
}
export function text(value, label, max = 150) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    fail(label + ': ingrese entre 1 y ' + max + ' caracteres');
  return value.trim();
}
export function integer(value, label, min = 0) {
  if (!Number.isSafeInteger(value) || value < min || value > 100000000)
    fail(label + ': número entero fuera de rango');
  return value;
}
export function audit(s, user, action, detail) {
  s.audit.unshift({ id: uid(), user: user.username, action, detail, date: now() });
}
export function csv(rows) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let cell = String(value ?? '');
            if (/^[=+@\-\t\r]/.test(cell)) cell = "'" + cell;
            return '"' + cell.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n')
  );
}
