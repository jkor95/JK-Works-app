import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handler } from './server.mjs';

async function withServer(fn) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port;
    await fn(url);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('health endpoint works without secrets', async () => withServer(async url => {
  const r = await fetch(url + '/health');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'ok');
}));
test('staging status says production sync is disabled', async () => withServer(async url => {
  const r = await fetch(url + '/api/v1/status');
  const data = await r.json();
  assert.equal(data.production_sync_enabled, false);
  assert.equal(data.database_connected, false);
}));
test('business endpoints fail closed', async () => withServer(async url => {
  for (const [method, path] of [['GET','/api/v1/clients'],['POST','/api/v1/records'],
    ['DELETE','/api/v1/clients/1'],['GET','/api/v1/files/private']]) {
    const r = await fetch(url + path, {method});
    assert.equal(r.status, 503);
  }
}));
test('unknown routes cannot expose files', async () => withServer(async url => {
  const r = await fetch(url + '/etc/passwd');
  assert.equal(r.status, 404);
}));
