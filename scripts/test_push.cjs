// Actual Edge handler and browser modules; fictitious DB, virtual server clock,
// mocked Web Push transport. Never contacts Supabase or a real push endpoint.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const edgeSource=fs.readFileSync(path.join(root,'supabase/functions/jk-push/index.ts'),'utf8');
function edge(options={}){
 let now=Date.parse('2026-10-14T12:00:00Z'),handler;
 const timers=[],background=[],sent=[],queries=[],rows=[];
 const webhookSecret=randomUUID();
 const subscriptions=[{user_id:'alice',endpoint:'https://push.invalid/alice-1',subscription:{endpoint:'https://push.invalid/alice-1'}},{user_id:'alice',endpoint:'https://push.invalid/alice-2',subscription:{endpoint:'https://push.invalid/alice-2'}},{user_id:'bob',endpoint:'https://push.invalid/bob',subscription:{endpoint:'https://push.invalid/bob'}}];
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const db={auth:{getUser:async token=>token==='fixture-session'?{data:{user:{id:'alice'}},error:null}:{data:{user:null},error:{}}},from(table){
  const filters=[];let operation='select',value,one=false,limit=Infinity;
  const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,values){filters.push(r=>values.includes(r[k]));return q;},lte(k,v){filters.push(r=>r[k]<=v);return q;},limit(n){limit=n;return q;},insert(v){operation='insert';value=v;return q;},upsert(v){operation='upsert';value=v;return q;},update(v){operation='update';value=v;return q;},delete(){throw Error('Unexpected deletion');},maybeSingle(){one=true;return q;},then(resolve,reject){
   try{
    queries.push({table,operation});
    if(table==='jk_push_test_requests'&&options.missingTable)return Promise.resolve(resolve({data:null,error:{code:'42P01'}}));
    const dataSource=table==='jk_push_subscriptions'?subscriptions:table==='jk_push_test_requests'?rows:[];
    if(operation==='insert'){
     if(rows.some(r=>r.user_id===value.user_id&&r.request_id===value.request_id))return Promise.resolve(resolve({data:null,error:{code:'23505'}}));
     rows.push(structuredClone(value));return Promise.resolve(resolve({data:null,error:null}));
    }
    const matches=dataSource.filter(r=>filters.every(f=>f(r))).slice(0,limit);
    if(operation==='update')for(const r of matches)Object.assign(r,value);
    return Promise.resolve(resolve({data:structuredClone(one?matches[0]||null:matches),error:null}));
   }catch(e){return Promise.reject(e).catch(reject);}
  }};return q;
 }};
 const context={Response,Request,Date:Clock,Intl,Map,Set,JSON,Promise,
  setTimeout:(callback,ms)=>{timers.push({at:now+ms,callback});return timers.length;},
  console:{error:()=>{}},
  webpush:{setVapidDetails:()=>{},sendNotification:async(subscription,payload,config)=>{
   sent.push({endpoint:subscription.endpoint,payload:JSON.parse(payload),config});if(options.transportFail)throw Error('private provider details');
  }},createClient:()=>db,
  Deno:{env:{get:key=>key==='JK_PUSH_WEBHOOK_SECRET'?webhookSecret:options.missingKeys&&key.startsWith('JK_VAPID')?'':randomUUID()},serve:callback=>{handler=callback;}},
  ...(options.noBackground?{}:{EdgeRuntime:{waitUntil:promise=>{background.push(promise);}}})};
 vm.runInNewContext(stripTypeScriptTypes(edgeSource.replace(/^import .*;\n/gm,'')),context);
 const call=async(body,token='fixture-session',extra={})=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},body:JSON.stringify(body)}));
 return {call,rows,subscriptions,background,sent,queries,webhookSecret,advance:ms=>{now+=ms;for(const t of timers.splice(0)){if(t.at<=now)t.callback();else timers.push(t);}}};
}
async function serverTests(){
 const e=edge(),requestId=randomUUID(),body={action:'test',requestId,user_id:'bob',subscription:{endpoint:'https://push.invalid/bob'},title:'injected'};
 assert.equal((await e.call(body,null)).status,401);
 assert.equal((await e.call(body,'invalid')).status,401);
 assert.equal(e.rows.length,0);
 assert.equal((await e.call({action:'test',requestId:'bad'})).status,400);
 const reply=await e.call(body);assert.equal(reply.status,202);
 const accepted=await reply.json();assert.equal(accepted.status,'scheduled');assert.equal(accepted.requestId,requestId);assert.equal(accepted.scheduledFor,'2026-10-14T12:00:30.000Z');
 assert.equal(e.sent.length,0);assert.equal(e.background.length,1);assert.equal(e.rows[0].user_id,'alice');
 const duplicate=await e.call(body);assert.equal(duplicate.status,202);assert.equal((await duplicate.json()).duplicate,true);assert.equal(e.rows.length,1);
 e.advance(29000);assert.equal(e.sent.length,0);
 e.advance(1000);await Promise.all(e.background);
 assert.deepEqual(e.sent.map(x=>x.endpoint).sort(),['https://push.invalid/alice-1','https://push.invalid/alice-2']);
 for(const message of e.sent){assert.equal(message.payload.title,'JK Works – Testmelding');assert.equal(message.payload.body,'Je pushmeldingen werken! ✅');assert.equal(message.payload.tag,'jkworks-test-'+requestId);assert.equal(message.config.TTL,300);}
 assert.equal(e.rows[0].status,'completed');assert.equal(e.rows[0].delivered,2);
 await e.call(body);assert.equal(e.sent.length,2);assert.equal(e.rows.length,1);
 const second=randomUUID();assert.equal((await e.call({action:'test',requestId:second})).status,202);
 e.advance(30000);await Promise.all(e.background);assert.equal(e.sent.length,4);
 assert.notEqual(e.sent[0].payload.tag,e.sent[2].payload.tag);
 assert.ok(e.queries.every(q=>['jk_push_subscriptions','jk_push_test_requests'].includes(q.table)));
 assert.ok(e.queries.filter(q=>q.table==='jk_push_subscriptions').every(q=>q.operation==='select'));
 const unavailable=edge({noBackground:true});assert.equal((await unavailable.call({action:'test',requestId:randomUUID()})).status,503);assert.equal(unavailable.rows.length,0);
 const missing=edge({missingTable:true});assert.equal((await missing.call({action:'test',requestId:randomUUID()})).status,503);assert.equal(missing.background.length,0);
 const keys=edge({missingKeys:true});assert.equal((await keys.call({action:'test',requestId:randomUUID()})).status,503);assert.equal(keys.rows.length,0);
 const noOwn=edge();noOwn.subscriptions.splice(0,2);assert.equal((await noOwn.call({action:'test',requestId:randomUUID()})).status,409);assert.equal(noOwn.rows.length,0);
 const failed=edge({transportFail:true}),id=randomUUID();await failed.call({action:'test',requestId:id});failed.advance(30000);await Promise.all(failed.background);
 assert.equal(failed.rows[0].status,'failed');assert.equal(failed.sent.length,2);assert.equal((await failed.call({action:'test',requestId:id})).status,409);assert.equal(failed.sent.length,2);
 const webhook=edge();
 assert.equal((await webhook.call({type:'INSERT',schema:'public',table:'public_requests',record:{id:'fixture'}},null)).status,401);
 const old=await webhook.call({type:'INSERT',schema:'public',table:'public_requests',record:{id:'fixture'}},null,{'x-jk-push-secret':webhook.webhookSecret});
 assert.equal(old.status,200);assert.equal(webhook.sent.length,3);assert.ok(webhook.sent.every(x=>x.payload.title==='Nieuwe klantaanvraag'));
 assert.equal((await edge().call({action:'scheduled-actions'},null)).status,401);
 const scheduled=edge();assert.equal((await scheduled.call({action:'scheduled-actions'},null,{'x-jk-push-secret':scheduled.webhookSecret})).status,200);assert.equal(scheduled.sent.length,0);
 // Run the real serviceworker with no open browser window.
 const listeners={},notifications=[];
 vm.runInNewContext(fs.readFileSync(path.join(root,'app/service-worker.js'),'utf8'),{self:{addEventListener:(type,callback)=>{listeners[type]=callback;},registration:{showNotification:async(title,opts)=>{notifications.push({title,opts});}}}});
 let completion;
 listeners.push({data:{json:()=>e.sent[0].payload},waitUntil:p=>{completion=p;}});await completion;
 assert.equal(notifications[0].title,'JK Works – Testmelding');assert.equal(notifications[0].opts.body,'Je pushmeldingen werken! ✅');assert.equal(notifications[0].opts.renotify,false);
 listeners.push({data:{json:()=>({title:'Nieuwe klantaanvraag',body:'Fictieve aanvraag'})},waitUntil:p=>{completion=p;}});await completion;
 assert.equal(notifications[1].title,'JK Works - Nieuwe klantaanvraag');assert.equal(notifications[1].opts.renotify,true);
 console.log('PASS: Edge-auth, uitsluitend eigen apparaten, serververtraging 30 s, blijvende deduplicatie, geen herhaalpoging bij onzekere verzending, bestaande webhook/planning en achtergrond-serviceworker');
}
async function browserTests(browser,origin){
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 let calls=0,release,pendingBody,mode='ok';
 try{
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());
   if(u.origin===origin){if(u.pathname==='/__push-fixture')return route.fulfill({status:200,contentType:'text/html',body:'<div id="modalRoot"></div>'});return route.continue();}
   assert.equal(u.href,'https://ercqiavruotoclhvfzud.supabase.co/functions/v1/jk-push');assert.equal(request.method(),'POST');assert.equal(request.headers().authorization,'Bearer fixture-session');
   calls++;pendingBody=request.postDataJSON();assert.equal(pendingBody.action,'test');assert.match(pendingBody.requestId,/^[0-9a-f-]{36}$/);assert.deepEqual(Object.keys(pendingBody).sort(),['action','requestId']);
   await new Promise(resolve=>{release=resolve;});
   await route.fulfill({status:mode==='ok'?202:503,contentType:'application/json',body:JSON.stringify(mode==='ok'?{ok:true,requestId:pendingBody.requestId,status:'scheduled',scheduledFor:new Date(Date.now()+30000).toISOString()}:{error:'sensitive fixture provider error'})});
  });
  await page.goto(origin+'/__push-fixture');
  await page.evaluate(()=>{
   window.fixtureToken='fixture-session';window.JKCloud={getAccessToken:async()=>window.fixtureToken};
   window.$=selector=>document.querySelector(selector);window.modal=html=>{$('#modalRoot').innerHTML=html;};window.modalHead=title=>'<h2>'+title+'</h2>';
   window.getNotificationPrefs=async()=>({});window.getDismissedActions=async()=>({});
   const due=new Date(Date.now()+2*86400000).toISOString();
   window.getActionSnoozes=async()=>({'quoteCreate:job-fixture':due,'invoiceSend:doc-fixture':due});
   window.JKDB={all:async store=>store==='jobs'?[{id:'job-fixture',title:'Keuken monteren',clientName:'Voorbeeldbedrijf',date:'2026-10-18'}]:store==='documents'?[{id:'doc-fixture',meta:{number:'F2026-044'}}]:[]};
   window.collectActionItems=async opts=>opts.includeSnoozed?[{key:'quoteCreate:job-fixture',type:'quoteCreate',jobId:'job-fixture',title:'Offerte opmaken',detail:'Voorbeeldbedrijf'}]:[];
   window.nlDate=date=>date.split('-').reverse().join('-');
   window.notificationPermissionLabel=()=>['Test',''];window.esc=x=>x;
   window.requestNotificationAccess=()=>{};window.testSystemNotification=()=>{};window.refreshActionBadges=()=>{};
  });
  await page.addScriptTag({url:origin+'/app/push.js'});
  await page.evaluate(()=>{JKPush.status=async()=> 'Fictieve abonnementsstatus';});
  const app=fs.readFileSync(path.join(root,'app/app.js'),'utf8'),start=app.indexOf('  async function showNotificationSettings(){'),end=app.indexOf('  async function ensureJobTimeEntry',start);
  assert.ok(start>=0&&end>start);
  await page.addScriptTag({content:app.slice(start,end)});await page.evaluate(()=>showNotificationSettings());
  // Herinneringen tonen de actie, klus en klant en geen interne sleutel.
  const snoozedRows=page.locator('[data-unsnooze]').locator('xpath=..');
  assert.equal(await snoozedRows.count(),2);
  const rowTexts=await snoozedRows.allTextContents();
  assert.match(rowTexts[0],/Offerte opmaken/);
  assert.match(rowTexts[0],/Keuken monteren/);
  assert.match(rowTexts[0],/Voorbeeldbedrijf/);
  assert.match(rowTexts[1],/Factuur versturen/);
  assert.match(rowTexts[1],/F2026-044/);
  assert.ok(rowTexts.every(t=>!t.includes('quoteCreate')&&!t.includes('invoiceSend')));
  assert.equal(await page.locator('#testRealPush').textContent(),'Test pushmelding versturen');
  await page.locator('#testRealPush').click();await page.waitForFunction(()=>document.querySelector('#testRealPush').disabled);
  while(!release)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(calls,1);await page.evaluate(()=>document.querySelector('#testRealPush').dispatchEvent(new Event('click')));assert.equal(calls,1);
  release();await page.waitForFunction(()=>document.querySelector('#realPushStatus').textContent.startsWith('Testmelding ingepland.'));
  assert.match(await page.locator('#realPushStatus').textContent(),/30 seconden.*sluiten.*vergrendelen/);assert.equal(await page.locator('#testRealPush').isDisabled(),false);
  const first=pendingBody.requestId;mode='error';release=null;await page.locator('#testRealPush').click();while(!release)await new Promise(resolve=>setTimeout(resolve,10));release();
  await page.waitForFunction(()=>document.querySelector('#realPushStatus').textContent.startsWith('Inplannen niet bevestigd'));
  assert.notEqual(first,pendingBody.requestId);assert.ok(!(await page.locator('#realPushStatus').textContent()).includes('sensitive'));
  await page.evaluate(()=>{window.fixtureToken=null;});await page.locator('#testRealPush').click();
  await page.waitForFunction(()=>document.querySelector('#realPushStatus').textContent.startsWith('Log eerst in'));assert.equal(calls,2);
  assert.ok(!/setTimeout|setInterval/.test(fs.readFileSync(path.join(root,'app/push.js'),'utf8')));
  console.log('PASS: echte testknop, sessieheader, unieke aanvraag per druk, dubbele tik geblokkeerd, planningbevestiging, veilige foutmelding en geen browsertimer');
 }finally{await context.close();}
}
module.exports={serverTests,browserTests};
