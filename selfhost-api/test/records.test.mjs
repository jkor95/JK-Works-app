import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordRepository } from '../src/records.mjs';

test('owner scoped, parameterized list', async () => {
  const calls = [];
  const repo = createRecordRepository({ query: async (...args) => { calls.push(args); return { rows: [{ record_id: 'a' }] }; } });
  assert.deepEqual(await repo.list('123e4567-e89b-12d3-a456-426614174000', 'clients'), [{ record_id: 'a' }]);
  assert.match(calls[0][0], /owner_id = \$1 AND store = \$2/);
  assert.equal(calls[0][1][1], 'clients');
});
test('rejects invalid stores and record IDs before SQL', async () => {
  const repo = createRecordRepository({ query: async () => { throw Error('should not query'); } });
  await assert.rejects(repo.list('123e4567-e89b-12d3-a456-426614174000', 'settings'), TypeError);
  await assert.rejects(repo.get('123e4567-e89b-12d3-a456-426614174000', 'jobs', "x'; DROP TABLE jk_records;--"), TypeError);
});
test('missing record returns null', async () => {
  const repo = createRecordRepository({ query: async () => ({ rows: [] }) });
  assert.equal(await repo.get('123e4567-e89b-12d3-a456-426614174000', 'jobs', 'job-1'), null);
});
