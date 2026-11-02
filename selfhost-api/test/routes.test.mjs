import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordsHandler } from '../src/routes.mjs';

function response() {
 return {status:null,headers:null,body:'',writeHead(code,headers){this.status=code;this.headers=headers;},end(text=''){this.body=text;}};
}
const url=new URL('http://localhost/v1/records/clients');
test('fails closed when no authentication verifier is configured',async()=>{
 let called=false;
 const handler=createRecordsHandler({query:async()=>{called=true;return {rows:[]}}},null);
 const res=response();
 await handler({method:'GET'},res,url);
 assert.equal(res.status,503);
 assert.equal(called,false);
});
test('rejects unauthenticated request before touching database',async()=>{
 let called=false;
 const handler=createRecordsHandler({query:async()=>{called=true;return {rows:[]}}},async()=>null);
 const res=response();await handler({method:'GET'},res,url);
 assert.equal(res.status,401);assert.equal(called,false);
});
test('verified identity is the only source of owner id',async()=>{
 let params;
 const handler=createRecordsHandler({query:async(_sql,p)=>{params=p;return {rows:[]}}},async()=>({ownerId:'123e4567-e89b-12d3-a456-426614174000'}));
 const res=response();
 await handler({method:'GET',headers:{'x-owner-id':'00000000-0000-0000-0000-000000000000'}},res,url);
 assert.equal(res.status,200);
 assert.equal(params[0],'123e4567-e89b-12d3-a456-426614174000');
});
