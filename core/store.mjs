import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { seal, unseal } from './security.mjs';
/** Requiere una sola instancia: cada proceso mantiene su copia del estado en memoria. */
export async function openStore({ app, dir, databaseUrl, keyHex, seed }) {
  await mkdir(dir, { recursive: true });
  let key;
  if (keyHex) {
    if (!/^[a-f0-9]{64}$/i.test(keyHex))
      throw Error('APP_KEY debe tener 64 caracteres hexadecimales');
    key = Buffer.from(keyHex, 'hex');
  } else {
    const file = join(dir, '.key');
    try {
      key = await readFile(file);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      key = randomBytes(32);
      await writeFile(file, key, { flag: 'wx', mode: 0o600 });
    }
  }
  let get, save, close, mode;
  if (databaseUrl) {
    const { Client } = await import('pg');
    const db = new Client({ connectionString: databaseUrl });
    await db.connect();
    await db.query(
      'CREATE TABLE IF NOT EXISTS app_state (app TEXT PRIMARY KEY, payload TEXT NOT NULL)',
    );
    get = async () =>
      (await db.query('SELECT payload FROM app_state WHERE app=$1', [app])).rows[0]?.payload;
    save = async (payload) => {
      await db.query(
        'INSERT INTO app_state(app,payload) VALUES($1,$2) ON CONFLICT(app) DO UPDATE SET payload=excluded.payload',
        [app, payload],
      );
    };
    close = () => db.end();
    mode = 'PostgreSQL';
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(join(dir, 'app.sqlite'));
    db.exec(
      'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_state (app TEXT PRIMARY KEY, payload TEXT NOT NULL)',
    );
    get = async () => db.prepare('SELECT payload FROM app_state WHERE app=?').get(app)?.payload;
    save = async (payload) => {
      db.prepare(
        'INSERT INTO app_state(app,payload) VALUES(?,?) ON CONFLICT(app) DO UPDATE SET payload=excluded.payload',
      ).run(app, payload);
    };
    close = async () => db.close();
    mode = 'SQLite local';
  }
  let raw = await get();
  let state = raw ? unseal(raw, key) : await seed();
  if (!raw) await save(seal(state, key));
  return {
    get state() {
      return state;
    },
    key,
    mode,
    async change(fn) {
      const draft = structuredClone(state);
      const result = await fn(draft);
      await save(seal(draft, key));
      state = draft;
      return result;
    },
    async replace(next) {
      await save(seal(next, key));
      state = next;
    },
    async ping() {
      await get();
    },
    close,
  };
}
