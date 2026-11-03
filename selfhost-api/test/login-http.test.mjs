import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHandler } from '../src/server.mjs';
async function call(handler,path,options={}) {
 const server=createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {const r=await fetch('http://127.0.0.1:'+server.address().port+path,options);return {status:r.status,body:await r.json()};}
 finally {await new Promise(resolve=>server.close(resolve));}
}
test('login fails closed without configured service',async()=>{
 const r=await call(createHandler({query:async()=>({rows:[]})}),'/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'demo@example.com',password:'wrong'})});
 assert.equal(r.status,503);
});
test('login accepts only POST and rejects invalid credentials',async()=>{
 const handler=createHandler({query:async()=>({rows:[]})},null,async()=>null);
 assert.equal((await call(handler,'/v1/auth/login')).status,405);
 assert.equal((await call(handler,'/v1/auth/login',{method:'POST',body:JSON.stringify({email:'demo@example.com',password:'wrong'})})).status,401);
});
test('login throttles repeated attempts',async()=>{
 const handler=createHandler({query:async()=>({rows:[]})},null,async()=>null);
 let last;
 for(let i=0;i<6;i++)last=await call(handler,'/v1/auth/login',{method:'POST',body:'{}'});
 assert.equal(last.status,429);
});
