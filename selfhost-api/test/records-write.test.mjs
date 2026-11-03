import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordRepository } from '../src/records.mjs';
const owner = '123e4567-e89b-12d3-a456-426614174000';
test('create is parameterized and conflict safe', async () => {
 const calls=[]; const r=createRecordRepository({query:async (...args)=>{calls.push(args);return {rows:[]}}});
 assert.equal(await r.create(owner,'clients','test-1',{name:'Example'}),null);
 assert.match(calls[0][0],/ON CONFLICT DO NOTHING/);
 assert.equal(calls[0][1][0],owner);
 assert.equal(calls[0][1][3],'{"name":"Example"}');
});
test('update and delete are scoped to owner, store and record', async () => {
 const calls=[];const r=createRecordRepository({query:async (...args)=>{calls.push(args);return {rows:[{record_id:'test-1'}]}}});
 await r.update(owner,'jobs','test-1',{title:'Demo'});
 assert.match(calls[0][0],/owner_id = \$1 AND store = \$2 AND record_id = \$3/);
 assert.equal(await r.remove(owner,'jobs','test-1'),true);
 assert.match(calls[1][0],/owner_id = \$1 AND store = \$2 AND record_id = \$3/);
});
test('rejects oversized and non-object data',async()=>{
 const r=createRecordRepository({query:async()=>{throw Error('unexpected query')}});
 await assert.rejects(r.create(owner,'clients','test-1',[]),TypeError);
 await assert.rejects(r.update(owner,'jobs','test-1',{text:'x'.repeat(66000)}),TypeError);
});
