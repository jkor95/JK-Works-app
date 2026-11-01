import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { handler, readJson } from './server.mjs';

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

test('invalid database config fails closed and never exposes credentials', async () => {
  const prev = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://demo:super-private-password@127.0.0.1:1/staging';
  try {
    await withServer(async url => {
      const r=await fetch(url+'/api/v1/status');
      const body=await r.text();
      assert.equal(r.status,200);
      assert.equal(JSON.parse(body).database_connected,false);
      assert.equal(JSON.parse(body).production_sync_enabled,false);
      assert.equal(body.includes('super-private-password'),false);
    });
  } finally {
    if(prev===undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL=prev;
  }
});
test('database URL without database fails closed', async () => {
  const prev=process.env.DATABASE_URL;
  process.env.DATABASE_URL='postgres://test:secret@localhost/';
  try {
    await withServer(async url => {
      const data=await (await fetch(url+'/api/v1/status')).json();
      assert.equal(data.database_reason,'invalid_configuration');
    });
  } finally {
    if(prev===undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL=prev;
  }
});

test('authentication and writes disabled without explicit feature switch', async()=>withServer(async url=>{
  const r=await fetch(url+'/api/v1/auth/login',{method:'POST',headers:{origin:'https://test.jkworks.nl','content-type':'application/json'},body:JSON.stringify({email:'demo@example.invalid',password:'fictional-password'})});
  assert.equal(r.status,503);
  const write=await fetch(url+'/api/v1/records/clients/demo',{method:'PUT',headers:{origin:'https://test.jkworks.nl','content-type':'application/json'},body:'{}'});
  assert.equal(write.status,503);
}));


test('JSON reader reports 413-compatible error on oversized body without destroying stream', async () => {
  const req=Readable.from([Buffer.alloc(65537,120)]);
  await assert.rejects(readJson(req), /body_too_large/);
  assert.equal(req.destroyed,true);
});
test('JSON reader rejects malformed body', async () => {
  await assert.rejects(readJson(Readable.from(['{broken'])), /invalid_json/);
});
test('JSON reader handles a valid JSON payload', async () => {
  assert.deepEqual(await readJson(Readable.from(['{"ok":true}'])),{ok:true});
});
