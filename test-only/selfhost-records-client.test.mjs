import test from 'node:test';
import assert from 'node:assert/strict';
import { createIsolatedRecordsClient } from './selfhost-records-client.mjs';

const baseUrl = 'http://127.0.0.1:19091/';
const accessToken = 'fixture-token-never-real';

test('rejects production URLs, missing token, and unsupported stores before HTTP', async () => {
  const noNetwork = async () => { throw new Error('unexpected_network_call'); };
  assert.throws(() => createIsolatedRecordsClient({
    baseUrl:'https://ercqiavruotoclhvfzud.supabase.co/',accessToken,fetchImpl:noNetwork
  }), /isolated_loopback_configuration_required/);
  assert.throws(() => createIsolatedRecordsClient({
    baseUrl:'http://127.0.0.1:19091/',accessToken:'',fetchImpl:noNetwork
  }), /isolated_loopback_configuration_required/);
  const client = createIsolatedRecordsClient({baseUrl,accessToken,fetchImpl:noNetwork});
  assert.throws(() => client.list('settings'), /unsupported_store/);
  assert.throws(() => client.get('jobs','../foo'), /invalid_record_id/);
  assert.throws(() => client.update('jobs','job-1',{},undefined), /expected_version_required/);
});

test('maps session, pagination, reads, creation, versioned updates to fixed v1 API', async () => {
  const seen=[];
  const client=createIsolatedRecordsClient({
    baseUrl,accessToken,
    fetchImpl:async (url,options)=>{
      seen.push({url:String(url),...options});
      return {ok:true,status:200,json:async()=>({ok:true,version:'rev-1'})};
    }
  });
  await client.session();
  await client.list('clients',{limit:20,after:'client-1'});
  await client.get('jobs','job-2');
  await client.create('timeEntries','entry-1',{duration:2});
  await client.update('timeEntries','entry-1',{duration:3},'rev-1');
  assert.deepEqual(seen.map(x=>[new URL(x.url).pathname,x.method]),[
    ['/v1/session','GET'],
    ['/v1/records/clients','GET'],
    ['/v1/records/jobs/job-2','GET'],
    ['/v1/records/timeEntries','POST'],
    ['/v1/records/timeEntries/entry-1','PUT']
  ]);
  assert.equal(new URL(seen[1].url).search,'?limit=20&after=client-1');
  assert.equal(seen[0].headers.Authorization,'Bearer '+accessToken);
  assert.deepEqual(JSON.parse(seen[3].body),{record_id:'entry-1',data:{duration:2}});
  assert.deepEqual(JSON.parse(seen[4].body),{data:{duration:3},expected_version:'rev-1'});
  assert.ok(seen.every(x=>new URL(x.url).hostname==='127.0.0.1'));
  assert.ok(seen.every(x=>x.redirect==='error'));
});

test('HTTP conflicts and auth denials fail closed; no hidden retry or write', async () => {
  const calls=[];
  const client=createIsolatedRecordsClient({
    baseUrl,accessToken,
    fetchImpl:async (url,options)=>{
      calls.push(options.method);
      return {ok:false,status:options.method==='PUT'?409:401,json:async()=>({error:'not_authorized'})};
    }
  });
  await assert.rejects(client.session(),err=>err.status===401);
  await assert.rejects(client.update('jobs','job-2',{},'rev-1'),err=>err.status===409);
  assert.deepEqual(calls,['GET','PUT']);
});
