// Supabase Edge Function: jk-push. Secrets: JK_VAPID_PUBLIC, JK_VAPID_PRIVATE, JK_PUSH_WEBHOOK_SECRET.
// Vereist dependency npm:web-push (compatibiliteit met Deno runtime vooraf testen).
import webpush from 'npm:web-push@3.6.7';
import {createClient} from 'npm:@supabase/supabase-js@2';
const url=Deno.env.get('SUPABASE_URL')!,admin=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,admin,{auth:{persistSession:false}});
const pub=Deno.env.get('JK_VAPID_PUBLIC')||'',priv=Deno.env.get('JK_VAPID_PRIVATE')||'';
if(pub&&priv)webpush.setVapidDetails('mailto:beheer@jkworks.nl',pub,priv);
const cors={'Access-Control-Allow-Origin':'https://jkworks.nl','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});

declare const EdgeRuntime:{waitUntil(promise:Promise<unknown>):void};
// One background task per durable request. Claim before delivery; no automatic
// retry after an ambiguous transport result, to prevent duplicate notifications.
async function deliverTest(userId:string,requestId:string,scheduledFor:string){
 try{
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(scheduledFor)-Date.now())));
  const {data:claimed,error:claimError}=await db.from('jk_push_test_requests')
   .update({status:'sending'}).eq('user_id',userId).eq('request_id',requestId)
   .eq('status','queued').lte('scheduled_for',new Date().toISOString()).select('request_id').maybeSingle();
  if(claimError||!claimed)return;
  const {data:subs,error}=await db.from('jk_push_subscriptions').select('endpoint,subscription').eq('user_id',userId);
  let delivered=0,failed=0;
  if(!error){
   const endpoints=new Set<string>();
   for(const sub of subs||[]){
    if(endpoints.has(sub.endpoint))continue;endpoints.add(sub.endpoint);
    try{await webpush.sendNotification(sub.subscription,JSON.stringify({kind:'test',title:'JK Works – Testmelding',body:'Je pushmeldingen werken! ✅',tag:'jkworks-test-'+requestId}),{TTL:300});delivered++;}
    catch{failed++;} // No endpoint/key/error payload in logs, and no retry or deletion.
   }
  }
  await db.from('jk_push_test_requests').update({status:error||!delivered?'failed':'completed',delivered,failed}).eq('user_id',userId).eq('request_id',requestId).eq('status','sending');
 }catch{console.error('Testpush kon niet worden afgerond.');}
}
async function scheduleTest(userId:string,requestId:unknown){
 if(typeof requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))return json({error:'Ongeldige aanvraagcode'},400);
 if(!pub||!priv)return json({error:'Pushdienst is nog niet ingesteld'},503);
 if(typeof EdgeRuntime==='undefined'||typeof EdgeRuntime.waitUntil!=='function')return json({error:'Achtergrondverzending is niet beschikbaar'},503);
 const {data:subs,error}=await db.from('jk_push_subscriptions').select('endpoint').eq('user_id',userId).limit(1);
 if(error)return json({error:'Apparaten controleren mislukt'},503);
 if(!subs?.length)return json({error:'Schakel eerst pushmeldingen in op een eigen apparaat'},409);
 const scheduledFor=new Date(Date.now()+30000).toISOString();
 const {error:insertError}=await db.from('jk_push_test_requests').insert({user_id:userId,request_id:requestId,scheduled_for:scheduledFor,status:'queued'});
 if(insertError){
  if(insertError.code!=='23505')return json({error:'Testmelding kon niet worden ingepland'},503);
  const {data:existing,error:readError}=await db.from('jk_push_test_requests').select('status,scheduled_for').eq('user_id',userId).eq('request_id',requestId).maybeSingle();
  if(readError||!existing||existing.status==='failed')return json({error:'Eerdere testaanvraag kon niet worden afgerond; er wordt geen extra melding verstuurd'},409);
  return json({ok:true,requestId,status:existing.status==='queued'?'scheduled':existing.status,scheduledFor:existing.scheduled_for,duplicate:true},202);
 }
 EdgeRuntime.waitUntil(deliverTest(userId,requestId,scheduledFor));
 return json({ok:true,requestId,status:'scheduled',scheduledFor},202);
}

type Action={key:string;category:string;title:string;pushTitle?:string};
const folder=(d:any)=>{const x=String(d?.folder||d?.kind||'').toLowerCase();return x.includes('offert')?'offerte':x.includes('fact')?'factuur':'other'};
const amsterdamNow=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(' ','T');
function actionsFor(records:any[]):Action[]{
 const byStore=(store:string)=>records.filter(r=>r.store===store).map(r=>r.data||{});
 const jobs=byStore('jobs'),docs=byStore('documents'),photos=byStore('jobPhotos'),entries=byStore('timeEntries');
 const settings=byStore('settings');
 const prefs=settings.find(x=>x.id==='notificationPrefs')||{};
 const dismissed=settings.find(x=>x.id==='dismissedActions')?.items||{};
 const on=(key:string)=>prefs[key]!==false;
 const now=amsterdamNow(),day=now.slice(0,10),out:Action[]=[];
 const add=(key:string,category:string,title:string,pushTitle?:string)=>{if(on(category)&&!dismissed[key])out.push({key,category,title,pushTitle});};
 for(const j of jobs){
  if(!j?.id)continue;
  // Each planned workday gets one short-lived, uniquely identified reminder.
  // Compare Amsterdam wall-clock minutes; this also covers midnight crossings.
  // Without the restricted client projection, never fall back to old full records.
  const status=String(j.status||'').toLowerCase();
  if(on('jobReminder')&&j.reminder&&!['afgerond','geannuleerd','cancelled','completed'].includes(status)){
   const planned=Array.isArray(j.workDays)?j.workDays:[{date:j.date,startTime:j.startTime||j.from||j.start}];
   const currentMinute=Date.parse(now+':00Z');
   for(const d of planned){
    const plannedDay=String(d?.date||'').slice(0,10),plannedTime=String(d?.startTime||'').slice(0,5);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(plannedDay)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(plannedTime))continue;
    const remaining=(Date.parse(plannedDay+'T'+plannedTime+':00Z')-currentMinute)/60000;
    // 5-minute server checks, with a small allowance for scheduler delays.
    if(!Number.isFinite(remaining)||remaining<=50||remaining>60)continue;
    const clean=(v:unknown,fallback:string,max:number)=>String(v||'').replace(/[\r\n]+/g,' ').trim().slice(0,max)||fallback;
    const detail=j.reminder;
    const body='Klant: '+clean(detail.clientName,'Niet ingevuld',120)+
     '\nKlus: '+clean(detail.title,'Klus',120)+
     '\nBegintijd: '+plannedTime+
     '\nUitvoeringsadres: '+clean(detail.address,'Niet opgegeven',200);
    const key='jobReminder:'+j.id+':'+plannedDay.replace(/-/g,'')+':'+plannedTime.replace(':','');
    add(key,'jobReminder',body,'Klus begint over 1 uur');
   }
  }
  const start=String(j.startTime||j.from||j.start||j.timeFrom||j.beginTime||j.begin||j.start_time||'').slice(0,5);
  const end=String(j.endTime||j.to||j.end||j.timeTo||j.finishTime||j.finish||j.end_time||'').slice(0,5);
  const date=String(j.date||'').slice(0,10);
  const endDay=date&&start&&end&&end<=start?new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10):date;
  const multi=Array.isArray(j.workDays);
  const ended=j.status==='afgerond'||!multi&&!!date&&(end?(endDay+'T'+end<=now):(date<day));
  const dueWorkDay=multi&&j.workDays.some((d:any)=>{
   const endDate=d.startTime&&d.endTime&&d.endTime<=d.startTime?new Date(Date.parse(d.date+'T12:00:00Z')+86400000).toISOString().slice(0,10):d.date;
   const due=d.endTime?endDate+'T'+d.endTime<=now:d.date<day;
   return due&&!entries.some((e:any)=>e.jobId===j.id&&(e.date||String(e.start||'').slice(0,10))===d.date&&(!e.autoFromJobSchedule||e.actualConfirmed));
  });
  const started=ended||!!date&&(date+'T'+(start||'08:00')<=now);
  const linked=docs.filter(d=>d?.meta?.jobId===j.id||(!d?.meta?.jobId&&date&&d?.meta?.workDate===date&&j.clientName&&String(d?.meta?.client?.name||'').trim().toLowerCase()===String(j.clientName).trim().toLowerCase()));
  const quotes=linked.filter(d=>folder(d)==='offerte'),invoices=linked.filter(d=>folder(d)==='factuur');
  const label='klus'; // Geen bedrijfs- of klantinformatie in een pushmelding.
  if(multi?dueWorkDay:ended&&!j.completionPromptHandledAt)add('hours:'+j.id,'hours','Uren controleren: '+label);
  if((j.photoPolicy||'optional')==='required'){
   const has=(phase:string)=>photos.some(p=>p.jobId===j.id&&p.phase===phase);
   if(date&&date<=day&&!has('before'))add('photo:before:'+j.id,'photos','Foto vóór de klus: '+label);
   if(started&&!has('during'))add('photo:during:'+j.id,'photos','Foto tijdens de klus: '+label);
   if(ended&&!has('after'))add('photo:after:'+j.id,'photos','Foto na de klus: '+label);
  }
  if(j.quoteNeeded&&!quotes.length)add('quoteCreate:'+j.id,'quoteCreate','Offerte opmaken: '+label);
  for(const d of quotes)if(!d.meta?.sent)add('quoteSend:'+d.id,'quoteSend','Offerte versturen');
  if((j.paymentType||'invoice')!=='cash'&&ended){
   if(!invoices.length)add('invoiceCreate:'+j.id,'invoiceCreate','Factuur opmaken: '+label);
   for(const d of invoices)if(!d.meta?.sent)add('invoiceSend:'+d.id,'invoiceSend','Factuur versturen');
  }
 }
 for(const d of docs.filter(d=>folder(d)==='factuur')){
  const m=d.meta||{},deadline=String(m.deadline||'').slice(0,10);
  if(m.sent&&!m.paid&&deadline&&deadline<day)add('paymentReminder:'+d.id,'paymentReminder','Betaalherinnering nodig');
 }
 return out;
}

const DURATION_MS:Record<string,number>={'1h':3600000,'12h':43200000,'7d':604800000,'14d':1209600000};
const allowedKey=/^(?:hours|photo:before|photo:during|photo:after|quoteCreate|quoteSend|invoiceCreate|invoiceSend|paymentReminder):[a-zA-Z0-9_-]{1,110}$/;
function dueAt(duration:string){
 const date=new Date();
 if(duration==='1m'){
  const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(day,last));return date.toISOString();
 }
 const ms=DURATION_MS[duration];
 if(!ms)return null;
 return new Date(date.getTime()+ms).toISOString();
}
function reminderTitle(key:string){
 const cat=key.split(':')[0];
 const names:Record<string,string>={hours:'Uren invoeren of controleren',photo:'Foto bij klus maken',quoteCreate:'Offerte opmaken',quoteSend:'Offerte versturen',invoiceCreate:'Factuur opmaken',invoiceSend:'Factuur versturen',paymentReminder:'Betaalherinnering'};
 return names[cat]||'Uitgestelde actie';
}
async function handleSnoozes(userId:string,body:any){
 if(body.action==='snoozes'){
  const {data,error}=await db.from('jk_push_action_snoozes').select('action_key,due_at,status').eq('user_id',userId).eq('status','pending').limit(500);
  return error?json({error:'Herinneringen ophalen mislukt'},503):json({ok:true,items:data||[]});
 }
 const key=body.key;
 if(typeof key!=='string'||!allowedKey.test(key))return json({error:'Ongeldige actie'},400);
 if(body.action==='unsnooze'){
  const {error}=await db.from('jk_push_action_snoozes').delete().eq('user_id',userId).eq('action_key',key);
  return error?json({error:'Uitstel annuleren mislukt'},503):json({ok:true,key});
 }
 const due=dueAt(body.duration);
 if(!due)return json({error:'Kies een geldige uitsteltijd'},400);
 const {error}=await db.from('jk_push_action_snoozes').upsert({user_id:userId,action_key:key,due_at:due,status:'pending',updated_at:new Date().toISOString(),notified_at:null},{onConflict:'user_id,action_key'});
 return error?json({error:'Herinnering plannen mislukt'},503):json({ok:true,key,dueAt:due});
}

async function notifyQuoteNeeded(userId:string,jobId:unknown){
 if(typeof jobId!=='string'||!/^job_[a-zA-Z0-9_-]{1,100}$/.test(jobId))return json({error:'Ongeldige klus'},400);
 const key='quoteCreate:'+jobId;
 const {data:snooze,error:se}=await db.from('jk_push_action_snoozes').select('due_at,status').eq('user_id',userId).eq('action_key',key).maybeSingle();
 if(se)return json({error:'Herinneringsstatus niet beschikbaar'},503);
 if(snooze?.status==='pending'&&Date.parse(snooze.due_at)>Date.now())return json({ok:true,suppressed:true});
 const {data:existing,error:xe}=await db.from('jk_push_action_state').select('active').eq('user_id',userId).eq('action_key',key).maybeSingle();
 if(xe)return json({error:'Actiestatus niet beschikbaar'},503);
 if(existing?.active===true)return json({ok:true,duplicate:true});
 const {data:subs,error}=await db.from('jk_push_subscriptions').select('endpoint,subscription').eq('user_id',userId);
 if(error)return json({error:'Pushapparaten niet beschikbaar'},503);
 let sent=0;
 for(const sub of subs||[]){
  try{await webpush.sendNotification(sub.subscription,JSON.stringify({title:'Offerte nodig',body:'Maak een offerte voor de bijgewerkte klus.',tag:'jkworks-action-'+key}),{TTL:3600});sent++;}
  catch(e:any){if([404,410].includes(e.statusCode))await db.from('jk_push_subscriptions').delete().eq('endpoint',sub.endpoint);}
 }
 if(sent)await db.from('jk_push_action_state').upsert({user_id:userId,action_key:key,active:true},{onConflict:'user_id,action_key'});
 return json({ok:true,delivered:sent});
}
async function runActionChecks(){
 if(!pub||!priv)return json({error:'Pushsleutels ontbreken'},503);
 const {data:subs,error:se}=await db.from('jk_push_subscriptions').select('endpoint,user_id,subscription');
 if(se)return json({error:'Abonnementen ophalen mislukt'},500);
 const grouped=new Map<string,any[]>();
 for(const sub of subs||[]){const arr=grouped.get(sub.user_id)||[];arr.push(sub);grouped.set(sub.user_id,arr);}
 let sent=0,checked=0;
 for(const [userId,userSubs] of grouped){
  // Geen stille wijziging aan lokaal niet-gesynchroniseerde appgegevens.
  const {data:records,error:re}=await db.from('app_records').select('store,record_id,data').eq('user_id',userId).in('store',['jobs','documents','jobPhotos','timeEntries','settings','notificationSnapshot']);
  if(re){console.error('Actiecontrole: gegevens niet beschikbaar');continue;}
  // Actuele privacy-arme projectie krijgt voorrang boven volledige records die
  // bewust pas bij handmatige synchronisatie worden bijgewerkt.
  const projection=(records||[]).find(r=>r.store==='notificationSnapshot'&&r.record_id==='active'&&
    r.data?.schema===1&&Array.isArray(r.data.records));
  const actionRecords=projection?projection.data.records:records||[];
  const active=actionsFor(actionRecords),keys=new Set(active.map(a=>a.key));
  const {data:previous,error:pe}=await db.from('jk_push_action_state').select('action_key,active').eq('user_id',userId);
  const {data:snoozes,error:snoozeError}=await db.from('jk_push_action_snoozes').select('action_key,due_at,status').eq('user_id',userId).eq('status','pending');
  if(snoozeError){console.error('Uitgestelde acties niet beschikbaar');continue;}
  const futureSnoozes=new Set((snoozes||[]).filter(s=>Date.parse(s.due_at)>Date.now()).map(s=>s.action_key));
  if(pe){console.error('Actiecontrole: status niet beschikbaar');continue;}
  const {data:initialized,error:ie}=await db.from('jk_push_user_state').select('user_id').eq('user_id',userId).maybeSingle();
  if(ie)continue;
  const seen=new Map((previous||[]).map(x=>[x.action_key,x.active]));
  const allSnoozed=new Set((snoozes||[]).map(s=>s.action_key));
  const newActions=initialized?active.filter(a=>seen.get(a.key)!==true&&!allSnoozed.has(a.key)):[];
  // Schakel verdwenen acties uit zodat een later opnieuw ontstane actie opnieuw gemeld kan worden.
  const gone=(previous||[]).filter(x=>x.active&&!keys.has(x.action_key)).map(x=>x.action_key);
  if(gone.length){const {error:e}=await db.from('jk_push_action_state').update({active:false}).eq('user_id',userId).in('action_key',gone);if(e)continue;}
  if(!initialized){
   for(const a of active)await db.from('jk_push_action_state').upsert({user_id:userId,action_key:a.key,active:true},{onConflict:'user_id,action_key'});
   const {error:initError}=await db.from('jk_push_user_state').upsert({user_id:userId});
   if(initError)console.error('Push-init mislukt');
   checked++;continue;
  }
  // Sla status pas na verzending op; bij tijdelijke storingen wordt opnieuw geprobeerd.
  for(const a of active){
   let delivered=true;
   if(newActions.some(x=>x.key===a.key)){
    for(const sub of userSubs){try{
     await webpush.sendNotification(sub.subscription,JSON.stringify({title:a.pushTitle||'Actie nodig',body:a.title,tag:'jkworks-action-'+a.key}));sent++;
    }catch(e:any){if([404,410].includes(e.statusCode))await db.from('jk_push_subscriptions').delete().eq('endpoint',sub.endpoint);else delivered=false;}}
   }
   if(delivered){const {error:e}=await db.from('jk_push_action_state').upsert({user_id:userId,action_key:a.key,active:true},{onConflict:'user_id,action_key'});if(e)console.error('Actiestatus opslaan mislukt');}
  }
  // Uitgestelde acties worden afzonderlijk gemeld, ook als de oorspronkelijke
  // actie al eerder als actief was geregistreerd. Bij een gesloten app loopt
  // deze controle op de server; een dubbele melding wordt op de iPhone
  // via de vaste notification-tag samengevoegd.
  for(const sn of snoozes||[]){
   if(Date.parse(sn.due_at)>Date.now())continue;
   // Niet in de actieve lijst = inmiddels afgehandeld (mits cloud up-to-date).
   // Bij handmatig nog niet gesynchroniseerde wijzigingen blijft cloud leidend.
   const act=active.find(a=>a.key===sn.action_key);
   // Een bewust uitgestelde actie kan nog uitsluitend lokaal staan doordat
   // synchronisatie handmatig is; stuur daarom ook zonder cloudactie een reminder.
   const {data:claimed,error:claimError}=await db.from('jk_push_action_snoozes')
     .update({status:'sending',updated_at:new Date().toISOString()})
     .eq('user_id',userId).eq('action_key',sn.action_key).eq('status','pending')
     .lte('due_at',new Date().toISOString()).select('action_key').maybeSingle();
   if(claimError||!claimed)continue;
   let delivered=0,transient=false;
   for(const sub of userSubs){
    try{
     await webpush.sendNotification(sub.subscription,JSON.stringify({kind:'reminder',title:'Uitgestelde herinnering',body:act?.title||reminderTitle(sn.action_key),tag:'jkworks-reminder-'+sn.action_key}),{TTL:3600});
     delivered++;sent++;
    }catch(e:any){
     if([404,410].includes(e.statusCode))await db.from('jk_push_subscriptions').delete().eq('endpoint',sub.endpoint);
     else transient=true;
    }
   }
   // Bij tijdelijke netwerkstoring opnieuw proberen op de volgende cron-run.
   // Als minstens één apparaat is bereikt, voorkom dubbele herinneringen.
   const status=delivered?'sent':transient?'pending':'failed';
   await db.from('jk_push_action_snoozes').update({status,notified_at:delivered?new Date().toISOString():null,updated_at:new Date().toISOString()})
     .eq('user_id',userId).eq('action_key',sn.action_key).eq('status','sending');
  }
  checked++;
 }
 return json({ok:true,usersChecked:checked,notificationsSent:sent});
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 let body:any;try{body=await req.json();}catch{return json({error:'Invalid JSON'},400);}
 if(body?.action==='scheduled-actions'){
   const secret=Deno.env.get('JK_PUSH_WEBHOOK_SECRET');
   const supplied=req.headers.get('x-jk-push-secret');
   const {data:scheduleAuth,error:authError}=await db.from('jk_push_schedule_auth').select('secret').eq('id',1).maybeSingle();
   if(authError||!supplied||!(supplied===secret&&!!secret||supplied===scheduleAuth?.secret))return json({error:'Unauthorized'},401);
   return await runActionChecks();
 }
 if(body?.type==='INSERT'){
   const secret=Deno.env.get('JK_PUSH_WEBHOOK_SECRET');
   if(!secret||req.headers.get('x-jk-push-secret')!==secret)return json({error:'Unauthorized'},401);
   if(body.type!=='INSERT'||body.table!=='public_requests'||body.schema!=='public'||!body.record?.id)return json({ok:true,skipped:true});
   const {data, error}=await db.from('jk_push_subscriptions').select('endpoint,subscription');
   if(error)return json({error:'Subscription query failed'},500);
   let delivered=0;for(const sub of data||[]){try{
     await webpush.sendNotification(sub.subscription,JSON.stringify({title:'Nieuwe klantaanvraag',body:'Er is een nieuwe aanvraag via jkworks.nl.',tag:'jkworks-request-'+body.record.id}));delivered++;
   }catch(e:any){if([404,410].includes(e.statusCode))await db.from('jk_push_subscriptions').delete().eq('endpoint',sub.endpoint);}}
   return json({ok:true,delivered});
 }
 const bearer=req.headers.get('Authorization')||'';
 if(!bearer.startsWith('Bearer '))return json({error:'Niet ingelogd'},401);
 const {data:{user},error}=await db.auth.getUser(bearer.slice(7));
 if(error||!user)return json({error:'Ongeldige sessie'},401);
 if(['snoozes','snooze','unsnooze'].includes(body?.action))return await handleSnoozes(user.id,body);
 if(body?.action==='quote-needed')return await notifyQuoteNeeded(user.id,body.jobId);
 if(body?.action==='test')return await scheduleTest(user.id,body.requestId);
 if(body.action==='config')return json({publicKey:pub});
 if(body.action==='subscribe'){
   const s=body.subscription;
   if(typeof s?.endpoint!=='string'||!s.endpoint.startsWith('https://')||!s.keys?.auth||!s.keys?.p256dh)return json({error:'Ongeldig abonnement'},400);
   const {error:e}=await db.from('jk_push_subscriptions').upsert({endpoint:s.endpoint,user_id:user.id,subscription:s});
   return e?json({error:'Opslaan mislukt'},500):json({ok:true});
 }
 if(body.action==='unsubscribe'){
   const endpoint=body.subscription?.endpoint;if(typeof endpoint!=='string')return json({error:'Ongeldig abonnement'},400);
   const {error:e}=await db.from('jk_push_subscriptions').delete().eq('endpoint',endpoint).eq('user_id',user.id);
   return e?json({error:'Uitschakelen mislukt'},500):json({ok:true});
 }
 return json({error:'Onbekende actie'},400);
});
