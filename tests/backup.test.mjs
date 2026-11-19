import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../core/store.mjs';
import { exportBackup, importBackup } from '../core/backup.mjs';
import * as flow from '../domain.mjs';
for (const [app, domain] of [['techflow', flow]])
  test(app + ' · respaldo y restauración persistente', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'grado-backup-'));
    let store;
    try {
      store = await openStore({ app, dir, seed: () => domain.seed('Demo2026!!') });
      const original = structuredClone(store.state);
      const backup = exportBackup(app, store.state, 'ClaveRespaldo2026!');
      assert.ok(!backup.includes('admin'));
      assert.throws(() => importBackup(app, backup, 'ContraseñaErrada'));
      assert.throws(() =>
        importBackup(app === 'techflow' ? 'securestock' : 'techflow', backup, 'ClaveRespaldo2026!'),
      );
      await store.change((s) => {
        s.users[0].name = 'Nombre alterado';
      });
      await store.replace(importBackup(app, backup, 'ClaveRespaldo2026!'));
      await store.close();
      store = await openStore({ app, dir, seed: () => assert.fail('No reinicializar') });
      assert.deepEqual(store.state, original);
    } finally {
      if (store) await store.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
