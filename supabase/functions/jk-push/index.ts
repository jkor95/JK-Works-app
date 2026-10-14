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

const categories=['hours','photos','quoteCreate','quoteSend','invoiceCreate','invoiceSend','paymentReminder'] as const;
type Action={key:string;category:string;title:string};
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
 const add=(key:string,category:string,title:string)=>{if(on(category)&&!dismissed[key])out.push({key,category,title});};
 for(const j of jobs){
  if(!j?.id)continue;
  const start=String(j.startTime||j.from||j.start||j.timeFrom||j.beginTime||j.begin||j.start_time||'').slice(0,5);
  const end=String(j.endTime||j.to||j.end||j.timeTo||j.finishTime||j.finish||j.end_time||'').slice(0,5);
  const date=String(j.date||'').slice(0,10);
  const endDay=start&&end&&end<=start?new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10):date;
  const ended=j.status==='afgerond'||!!date&&(end?(endDay+'T'+end<=now):(date<day));
  const started=ended||!!date&&(date+'T'+(start||'08:00')<=now);
  const linked=docs.filter(d=>d?.meta?.jobId===j.id||(!d?.meta?.jobId&&date&&d?.meta?.workDate===date&&j.clientName&&String(d?.meta?.client?.name||'').trim().toLowerCase()===String(j.clientName).trim().toLowerCase()));
  const quotes=linked.filter(d=>folder(d)==='offerte'),invoices=linked.filter(d=>folder(d)==='factuur');
  const label=String(j.title||'Klus').slice(0,80);
  if(ended&&!j.completionPromptHandledAt)add('hours:'+j.id,'hours','Uren controleren: '+label);
  if((j.photoPolicy||'optional')==='required'){
   const has=(phase:string)=>photos.some(p=>p.jobId===j.id&&p.phase===phase);
   if(date&&date<=day&&!has('before'))add('photo:before:'+j.id,'photos','Foto vóór de klus: '+label);
   if(started&&!has('during'))add('photo:during:'+j.id,'photos','Foto tijdens de klus: '+label);
   if(ended&&!has('after'))add('photo:after:'+j.id,'photos','Foto na de klus: '+label);
  }
  if(j.quoteNeeded&&!quotes.length&&!ended)add('quoteCreate:'+j.id,'quoteCreate','Offerte opmaken: '+label);
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
async function runActionChecks(){
 if(!pub||!priv)return json({error:'Pushsleutels ontbreken'},503);
 const {data:subs,error:se}=await db.from('jk_push_subscriptions').select('endpoint,user_id,subscription');
 if(se)return json({error:'Abonnementen ophalen mislukt'},500);
 const grouped=new Map<string,any[]>();
 for(const sub of subs||[]){const arr=grouped.get(sub.user_id)||[];arr.push(sub);grouped.set(sub.user_id,arr);}
 let sent=0,checked=0;
 for(const [userId,userSubs] of grouped){
  // Geen stille wijziging aan lokaal niet-gesynchroniseerde appgegevens.
  const {data:records,error:re}=await db.from('app_records').select('store,data').eq('user_id',userId).in('store',['jobs','documents','jobPhotos','timeEntries','settings']);
  if(re){console.error('Actiecontrole: gegevens niet beschikbaar');continue;}
  const active=actionsFor(records||[]),keys=new Set(active.map(a=>a.key));
  const {data:previous,error:pe}=await db.from('jk_push_action_state').select('action_key,active').eq('user_id',userId);
  if(pe){console.error('Actiecontrole: status niet beschikbaar');continue;}
  const {data:initialized,error:ie}=await db.from('jk_push_user_state').select('user_id').eq('user_id',userId).maybeSingle();
  if(ie)continue;
  const seen=new Map((previous||[]).map(x=>[x.action_key,x.active]));
  const newActions=initialized?active.filter(a=>seen.get(a.key)!==true):[];
  // Schakel verdwenen acties uit zodat een later opnieuw ontstane actie opnieuw gemeld kan worden.
  const gone=(previous||[]).filter(x=>x.active&&!keys.has(x.action_key)).map(x=>x.action_key);
  if(gone.length){const {error:e}=await db.from('jk_push_action_state').update({active:false}).eq('user_id',userId).in('action_key',gone);if(e)continue;}
  for(const a of active){
   const {error:e}=await db.from('jk_push_action_state').upsert({user_id:userId,action_key:a.key,active:true},{onConflict:'user_id,action_key'});
   if(e){console.error('Actiestatus opslaan mislukt');continue;}
  }
  if(!initialized){await db.from('jk_push_user_state').upsert({user_id:userId});checked++;continue;}
  // Per actie één bericht; geen klantnamen, bedragen of andere persoonsgegevens in pushpayload.
  for(const a of newActions){
   for(const sub of userSubs){try{
    await webpush.sendNotification(sub.subscription,JSON.stringify({title:'Actie nodig',body:a.title,tag:'jkworks-action-'+a.key}));
    sent++;
   }catch(e:any){if([404,410].includes(e.statusCode))await db.from('jk_push_subscriptions').delete().eq('endpoint',sub.endpoint);}}
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
