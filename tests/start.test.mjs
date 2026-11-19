import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const app = 'techflow';
const launcher = fileURLToPath(new URL('../scripts/start.mjs', import.meta.url));
function run(port, dir) {
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', launcher, '--no-browser'], {
    env: {...process.env, PORT: String(port), HOST: '127.0.0.1', ...(dir ? {DATA_DIR: dir} : {})},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  const ended = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolve({code, output}));
  });
  return {child, ended};
}
async function mock(appName) {
  const server = http.createServer((req,res) => {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'ok', app:appName}));
  });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  return {server, port:server.address().port, close:()=>new Promise(r=>{server.close(r);server.closeAllConnections()})};
}
test('Inicio repetido reutiliza el servidor del mismo proyecto', {timeout:10000}, async () => {
  const fixture = await mock(app);
  try {
    const result = await run(fixture.port).ended;
    assert.equal(result.code,0);
    assert.ok(result.output.includes('ya está funcionando'));
    assert.ok(!result.output.includes('EADDRINUSE'));
  } finally { await fixture.close(); }
});
test('Un puerto de otro programa no se cierra ni se confunde con este sistema', {timeout:10000}, async () => {
  const fixture = await mock('otra-aplicacion');
  try {
    const result = await run(fixture.port).ended;
    assert.equal(result.code,1);
    assert.ok(result.output.includes('ocupado por otra aplicación'));
    assert.equal((await fetch(`http://127.0.0.1:${fixture.port}`)).status,200);
  } finally { await fixture.close(); }
});
test('El iniciador arranca con puerto libre y soporta una segunda apertura', {timeout:15000}, async () => {
  const placeholder = await mock('reserva');
  const port = placeholder.port;
  await placeholder.close();
  const dir = await mkdtemp(join(tmpdir(),'grado-inicio-'));
  const first = run(port,dir);
  try {
    let ready = false;
    for(let i=0;i<100;i++) {
      try { const r=await fetch(`http://127.0.0.1:${port}/api/health`); const data=await r.json(); if(data.app===app){ready=true;break} } catch {}
      await new Promise(r=>setTimeout(r,50));
    }
    assert.ok(ready,'El iniciador debe arrancar la aplicación');
    const second=await run(port,dir).ended;
    assert.equal(second.code,0);
    assert.ok(second.output.includes('ya está funcionando'));
    assert.equal(first.child.exitCode,null,'La primera instancia debe seguir activa');
  } finally {
    if(first.child.exitCode===null)first.child.kill();
    await first.ended;
    await rm(dir,{recursive:true,force:true});
  }
});
