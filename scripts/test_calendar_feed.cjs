// Isolated calendar feed tests: in-memory Edge DB; no real requests or user data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto}=require('node:crypto');
module.exports=async()=>{
 const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(root,'supabase/functions/jk-calendar-feed/index.ts'),'utf8');
 let handler;const rows=[];
 const db={
  auth:{getUser:async token=>({data:{user:token==='alice'?{id:'alice'}:token==='bob'?{id:'bob'}:null},error:null})},
  from:table=>{
   assert.equal(table,'jk_calendar_feeds');
   let op='select',values=null,filters=[];
   const query={
    select(){return query;},eq(k,v){filters.push(r=>r[k]===v);return query;},
    upsert(x){op='upsert';values=x;return query;},update(x){op='update';values=x;return query;},
    delete(){op='delete';return query;},
    maybeSingle(){return Promise.resolve(execute(true));},
    then(resolve){return Promise.resolve(execute(false)).then(resolve);}
   };
   function execute(single){
    const selected=rows.filter(r=>filters.every(fn=>fn(r)));
    if(op==='upsert'){
     const i=rows.findIndex(r=>r.user_id===values.user_id);
     if(i<0)rows.push({...values});else Object.assign(rows[i],values);
     return {data:null,error:null};
    }
    if(op==='update'){for(const r of selected)Object.assign(r,values);}
    if(op==='delete'){for(const r of selected){const i=rows.indexOf(r);rows.splice(i,1);}}
    return {data:single?(selected[0]||null):selected,error:null};
   }
   return query;
  }
 };
 const context={createClient:()=>db,crypto:webcrypto,Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://fixture.supabase.co':'fixture'},serve:fn=>{handler=fn;}},Request,Response,URL,TextEncoder,Date,Set,Array,JSON,console};
 vm.runInNewContext(stripTypeScriptTypes(src.replace(/^import .*;\r?\n/gm,'')),context);
 const call=(method,action,token='alice',url='https://fixture.supabase.co/functions/v1/jk-calendar-feed')=>
  handler(new Request(url,{method,headers:token?{'Authorization':'Bearer '+token}:{},...(method==='POST'?{body:JSON.stringify(action)}:{})}));
 assert.equal((await call('GET',null,null)).status,404);
 assert.equal((await call('POST',{action:'status'},null)).status,401);
 assert.equal((await call('POST',{action:'status'},'bob')).status,200);
 const events=[
  {id:'job_1',date:'2026-10-27',startTime:'09:00',endTime:'16:00',title:'Keuken, montage',
   clientName:'Voorbeeldklant',address:'Uitvoerstraat 2, Dordrecht',status:'gepland'},
  {id:'job_1',date:'2026-10-28',startTime:'22:00',endTime:'02:00',title:'Keuken, montage',
   clientName:'Voorbeeldklant',address:'Uitvoerstraat 2, Dordrecht',status:'gepland'},
  {id:'job_2',date:'2026-10-30',startTime:'',endTime:'',title:'Tuin',clientName:'Andere klant',address:'',status:'open'}
 ];
 assert.equal((await call('POST',{action:'enable',events:events.concat(events)})).status,400,'Duplicated workdays rejected');
 const enabled=await (await call('POST',{action:'enable',events})).json();
 assert.equal(enabled.ok,true);
 assert.match(enabled.url,/^https:\/\/fixture.supabase.co\/functions\/v1\/jk-calendar-feed\?token=[a-f0-9]{64}$/);
 assert.equal(rows.length,1);
 assert.ok(!JSON.stringify(rows).includes(enabled.url.split('token=')[1]),'Raw token never in database');
 assert.equal((await call('POST',{action:'status'},'bob').then(r=>r.json())).enabled,false,'Cannot inspect another user');
 const publicResponse=await call('GET',null,null,enabled.url);
 assert.equal(publicResponse.status,200);
 assert.match(publicResponse.headers.get('Content-Type'),/text\/calendar/);
 const ics=await publicResponse.text();
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,3);
 assert.match(ics,/UID:job_1-2026-10-27@jkworks.nl/);
 assert.match(ics,/DTSTART;TZID=Europe\/Amsterdam:20261027T090000/);
 assert.match(ics,/DTEND;TZID=Europe\/Amsterdam:20261029T020000/,'Overnight appointment');
 assert.match(ics,/DTSTART;VALUE=DATE:20261030/,'All-day appointment');
 assert.match(ics,/Uitvoerstraat 2/);
 assert.doesNotMatch(ics,/betaald|factuur|IBAN/i);
 const changed=[{...events[0],startTime:'10:00',title:'Keuken repareren'}];
 const saved=await call('POST',{action:'publish',events:changed});
 assert.equal(saved.status,200);
 const changedFeed=await (await call('GET',null,null,enabled.url)).text();
 assert.equal((changedFeed.match(/BEGIN:VEVENT/g)||[]).length,1,'Deleted workdays removed');
 assert.match(changedFeed,/UID:job_1-2026-10-27@jkworks.nl/,'Same UID after edit');
 assert.match(changedFeed,/DTSTART;TZID=Europe\/Amsterdam:20261027T100000/);
 const rotated=await (await call('POST',{action:'rotate',events:changed})).json();
 assert.notEqual(rotated.url,enabled.url);
 assert.equal((await call('GET',null,null,enabled.url)).status,404,'Old link is invalid');
 assert.equal((await call('GET',null,null,rotated.url)).status,200);
 assert.equal((await call('POST',{action:'disable'})).status,200);
 assert.equal((await call('GET',null,null,rotated.url)).status,404,'Disabled feed is inaccessible');
 const client=fs.readFileSync(path.join(root,'app/calendar-sync.js'),'utf8');
 const window={};
 const rowsLocal=[{id:'job_f',date:'2026-10-28',title:'Horeca',clientName:'Bedrijf',
  street:'Klantstraat 1',executionAddress:{street:'Werkstraat 4',postal:'3311 AA',city:'Dordrecht'},
  workDays:[{date:'2026-10-29',startTime:'22:00',endTime:'02:00'},{date:'2026-10-28',startTime:'10:00',endTime:'14:00'}],
  notes:'PRIVÉ_NOTITIES',agreedAmount:280,phone:'PRIVÉ_TEL',status:'gepland'}];
 const storage=new Map(),localChanges=[];
 const legacySecret={id:'calendarFeedLocal',enabled:true,url:'https://fixture.invalid/?token=secret-only-local'};
 const browserStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const calendar=vm.runInNewContext(client+';JKCalendarFeed;',{
  window,localStorage:browserStorage,
  JKDB:{get:async(store,id)=>store==='settings'&&id==='calendarFeedLocal'?legacySecret:null,
   removeLocal:async(store,id)=>{localChanges.push([store,id]);},putLocal:async()=>{throw Error('Do not put calendar tokens in synced IndexedDB');},all:async()=>rowsLocal},
  JKCloud:{isSignedIn:()=>false},navigator:{onLine:false},setTimeout:()=>0,console
 });
 const localLink=await calendar.own();
 assert.equal(localLink.url,legacySecret.url,'Legacy token migrated to non-synced browser storage');
 assert.equal(localChanges.length,1,'Legacy synced setting removed locally');
 assert.ok(storage.has('jkworks-private-calendar-subscription'));
 const cloud=fs.readFileSync(path.join(root,'app/cloud.js'),'utf8');
 assert.match(cloud,/LOCAL_ONLY_SETTINGS = new Set\(\['calendarFeedLocal'\]\)/);
 assert.match(cloud,/if\(store==='settings'&&LOCAL_ONLY_SETTINGS.has\(obj\?\.id\)\)return/);
 assert.match(cloud,/if\(q.store==='settings'&&LOCAL_ONLY_SETTINGS.has\(q.recordId\)\)/);

 const projected=calendar.entriesFor(rowsLocal);
 assert.equal(projected.length,2);
 assert.deepEqual(Array.from(projected.map(x=>x.date)),['2026-10-28','2026-10-29']);
 assert.equal(projected[0].address,'Werkstraat 4, 3311 AA Dordrecht');
 assert.ok(!JSON.stringify(projected).includes('PRIVÉ_NOTITIES'));
 assert.ok(!JSON.stringify(projected).includes('PRIVÉ_TEL'));
 assert.ok(!JSON.stringify(projected).includes('280'));
 const app=fs.readFileSync(path.join(root,'app/app.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
 assert.match(app,/id="calendarSyncMenu"/);
 assert.match(html,/calendar-sync\.js\?v=71\.13\.30/);
 console.log('PASS: beveiligde agenda-link, JWT, hash, afscherming, verwijderen, nachtwerk, dagafspraken, rotatie/intrekken en privacyprojectie');
};
