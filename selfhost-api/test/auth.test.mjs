import test from 'node:test';
import assert from 'node:assert/strict';
import {createTokenVerifier,signTestToken} from '../src/auth.mjs';
const secret='unit-test-only-secret-0123456789abcdef';
const owner='123e4567-e89b-12d3-a456-426614174000';
const now=()=>1700000000000;
test('accepts a correctly signed unexpired token',async()=>{
 const token=signTestToken(secret,owner,1700000300);
 assert.deepEqual(await createTokenVerifier(secret,{now})({headers:{authorization:'Bearer '+token}}),{ownerId:owner});
});
test('rejects tampering, expiry, absent token and invalid secret',async()=>{
 const verify=createTokenVerifier(secret,{now});
 const token=signTestToken(secret,owner,1700000300);
 assert.equal(await verify({headers:{authorization:'Bearer '+token+'x'}}),null);
 assert.equal(await verify({headers:{authorization:'Bearer '+signTestToken(secret,owner,1699999999)}}),null);
 assert.equal(await verify({headers:{}}),null);
 assert.throws(()=>createTokenVerifier('weak'));
});
