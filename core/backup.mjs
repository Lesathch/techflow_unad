import { scryptSync, randomBytes } from 'node:crypto';
import { seal, unseal } from './security.mjs';
export function exportBackup(app, state, password) {
  if (typeof password !== 'string' || password.length < 12)
    throw Error('El respaldo requiere una contraseña de al menos 12 caracteres');
  const salt = randomBytes(16).toString('hex');
  return JSON.stringify({
    format: 1,
    salt,
    payload: seal({ app, date: new Date().toISOString(), state }, scryptSync(password, salt, 32)),
  });
}
export function importBackup(app, encoded, password) {
  const envelope = JSON.parse(encoded);
  if (envelope.format !== 1 || !/^[a-f0-9]{32}$/.test(envelope.salt))
    throw Error('Formato de respaldo inválido');
  const backup = unseal(envelope.payload, scryptSync(password, envelope.salt, 32));
  if (
    backup.app !== app ||
    backup.state.app !== app ||
    backup.state.version !== 1 ||
    !Array.isArray(backup.state.users) ||
    !backup.state.users.length ||
    !Array.isArray(backup.state.audit)
  )
    throw Error('Respaldo incompatible');
  const collections =
    app === 'securestock'
      ? ['products', 'movements', 'suppliers']
      : ['documents', 'notifications', 'executions', 'reports'];
  if (collections.some((k) => !Array.isArray(backup.state[k])))
    throw Error('Datos de respaldo incompletos');
  return backup.state;
}
