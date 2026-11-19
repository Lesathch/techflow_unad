import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from '../core/store.mjs';
import { exportBackup, importBackup } from '../core/backup.mjs';
const [command, app, file] = process.argv.slice(2);
if (!['backup', 'restore'].includes(command) || !['securestock', 'techflow'].includes(app)) {
  console.error('Uso: node scripts/backup.mjs backup|restore securestock|techflow [archivo]');
  process.exit(1);
}
const phrase = process.env.BACKUP_PASSWORD;
if (!phrase || phrase.length < 12) throw Error('Define BACKUP_PASSWORD con al menos 12 caracteres');
const root = fileURLToPath(new URL('../', import.meta.url));
const keyHex =
  process.env.APP_KEY || process.env[app === 'securestock' ? 'SECURESTOCK_KEY' : 'TECHFLOW_KEY'];
const store = await openStore({
  app,
  dir: process.env.DATA_DIR || join(root, 'data'),
  databaseUrl: process.env.DATABASE_URL,
  keyHex,
  seed: () => {
    throw Error('Primero inicia la aplicación para crear sus datos');
  },
});
try {
  if (command === 'backup') {
    await mkdir(join(root, 'backups'), { recursive: true });
    const destination = resolve(
      file ||
        join(root, 'backups', app + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '.enc'),
    );
    await writeFile(destination, exportBackup(app, store.state, phrase), {
      flag: 'wx',
      mode: 0o600,
    });
    console.log('Respaldo cifrado: ' + destination);
  } else {
    if (!file) throw Error('Indica el archivo .enc. Detén la aplicación antes de restaurar.');
    const restored = importBackup(app, await readFile(resolve(file), 'utf8'), phrase);
    await store.replace(restored);
    console.log('Restauración completada. Inicia la aplicación.');
  }
} finally {
  await store.close();
}
