import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
test('Workflows n8n: JSON, conexiones y autenticación declaradas', async () => {
  const dir = new URL('../flows/', import.meta.url);
  const files = await readdir(dir);
  assert.equal(files.filter((f) => f.startsWith('flujo-')).length, 5);
  for (const file of files) {
    const w = JSON.parse(await readFile(new URL(file, dir), 'utf8'));
    assert.equal(w.active, false);
    const names = new Set(w.nodes.map((n) => n.name));
    assert.equal(names.size, w.nodes.length);
    for (const [from, c] of Object.entries(w.connections)) {
      assert.ok(names.has(from));
      for (const branch of c.main) for (const target of branch) assert.ok(names.has(target.node));
    }
    for (const node of w.nodes) {
      if (node.type === 'n8n-nodes-base.httpRequest')
        assert.equal(node.parameters.authentication, 'genericCredentialType');
      if (node.type === 'n8n-nodes-base.webhook')
        assert.equal(node.parameters.authentication, 'headerAuth');
    }
  }
});
