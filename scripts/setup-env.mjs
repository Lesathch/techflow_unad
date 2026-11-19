import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const token = () => randomBytes(32).toString('hex');
const env =
  [
    'DB_PASSWORD=' + token(),
    'APP_KEY=' + token(),
    'N8N_ENCRYPTION_KEY=' + token(),
    'WORKFLOW_TOKEN=' + token(),
    'ADMIN_PASSWORD=Demo2026!!',
    'DEMO_MODE=true',
    'N8N_IMAGE=docker.n8n.io/n8nio/n8n:2.47.4',
  ].join('\n') + '\n';
try {
  await writeFile(new URL('../.env', import.meta.url), env, { flag: 'wx', mode: 0o600 });
  console.log('.env creado con claves únicas. Consérvalo fuera de Git.');
} catch (e) {
  if (e.code === 'EEXIST') console.log('.env ya existe; se conserva.');
  else throw e;
}
