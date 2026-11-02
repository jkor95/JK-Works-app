import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHandler } from '../src/server.mjs';

async function request(handler, path) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + path);
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}
test('liveness does not depend on database', async () => {
  const result = await request(createHandler({ query: () => { throw Error('unexpected'); } }), '/health/live');
  assert.equal(result.status, 200);
});
test('readiness checks database', async () => {
  const result = await request(createHandler({ query: async () => ({ rows: [{ '?column?': 1 }] }) }), '/health/ready');
  assert.equal(result.status, 200);
});
test('readiness hides database error details', async () => {
  const result = await request(createHandler({ query: async () => { throw Error('secret'); } }), '/health/ready');
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { status: 'unavailable' });
});
test('unknown routes are not exposed', async () => {
  const result = await request(createHandler({}), '/customers');
  assert.equal(result.status, 404);
});
