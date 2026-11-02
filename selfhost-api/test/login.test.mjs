import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,createLoginService} from '../src/login.mjs';
const owner='123e4567-e89b-12d3-a456-426614174000';
const secret='test-secret-only-0123456789abcdef012345';
test('scrypt hashes password with random salt',async()=>{
 const a=await hashPassword('secure-password-example-123');
 const b=await hashPassword('secure-password-example-123');
 assert.notEqual(a,b);
 assert.equal(await verifyPassword('secure-password-example-123',a),true);
 assert.equal(await verifyPassword('wrong-password',a),false);
});
test('login verifies database account and returns short lived token',async()=>{
 const password_hash=await hashPassword('secure-password-example-123');
 const calls=[];
 const login=createLoginService({query:async(...args)=>{calls.push(args);return {rows:[{owner_id:owner,password_hash}]};}},secret,{now:()=>1700000000000});
 const result=await login({email:'TEST@EXAMPLE.COM',password:'secure-password-example-123'});
 assert.equal(result.expires_in,900);
 assert.equal(calls[0][1][0],'test@example.com');
 assert.ok(result.access_token.includes('.'));
 assert.equal(await login({email:'test@example.com',password:'wrong-password'}),null);
});
