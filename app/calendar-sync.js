/* JK Works: private read-only calendar subscription.
   Calendar data is an explicit opt-in, distinct from manual cloud sync. */
const JKCalendarFeed=(()=>{
 const endpoint='https://ercqiavruotoclhvfzud.supabase.co/functions/v1/jk-calendar-feed';
 const publishable='sb_publishable_z4kkYgzjr-bYDEcSZlVciw_cP8MfOuX';
 const key='jkworks-private-calendar-subscription';
 let timer=null,busy=false,pending=false;
 // The subscription URL is a bearer credential. Keep it out of IndexedDB
 // 'settings' because the manual cloud sync can upload that entire store.
 async function own(){
  let row=null;
  try{row=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  if(row&&typeof row==='object'&&typeof row.url==='string')return row;
  // Upgrade any pre-existing local IndexedDB value without uploading it.
  const legacy=await JKDB.get('settings','calendarFeedLocal');
  if(legacy){
   const migrated={enabled:!!legacy.enabled,url:String(legacy.url||''),lastSentAt:legacy.lastSentAt||null};
   localStorage.setItem(key,JSON.stringify(migrated));
   await JKDB.removeLocal('settings','calendarFeedLocal');
   return migrated;
  }
  return {enabled:false,url:''};
 }
 async function save(local){
  localStorage.setItem(key,JSON.stringify({enabled:!!local.enabled,url:String(local.url||''),lastSentAt:local.lastSentAt||null}));
  await JKDB.removeLocal('settings','calendarFeedLocal');
 }
 const jobDays=j=>{
  const days=Array.isArray(j.workDays)?j.workDays:(j.date?[{date:j.date,startTime:j.startTime,endTime:j.endTime}]:[]);
  return [...days].filter(d=>d?.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 };
 function entriesFor(jobs){
  const events=[];
  for(const j of jobs){
   if(!j?.id||['geannuleerd','cancelled'].includes(String(j.status||'').toLowerCase()))continue;
   const execution=j.executionAddress||{},isExecution=!!(execution.street||execution.postal||execution.city);
   const place=isExecution?execution:j;
   const addr=[place.street||place.address||'',[place.postal,place.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
   for(const d of jobDays(j)){
    const date=String(d.date||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    const startTime=String(d.startTime||'').slice(0,5),endTime=String(d.endTime||'').slice(0,5);
    // A workday without an agreed pair of times is shown as an all-day event.
    events.push({id:String(j.id),date,startTime:startTime&&endTime?startTime:'',
     endTime:startTime&&endTime?endTime:'',title:String(j.title||'Klus'),
     clientName:String(j.clientName||''),address:addr,status:String(j.status||'')});
   }
  }
  return events;
 }
 async function api(action,extra={}){
  if(!JKCloud.isSignedIn()||!navigator.onLine)throw Error('Log eerst in bij Synchronisatie en maak verbinding met internet.');
  if(await JKCloud.restoreProtected())throw Error('Agenda synchroniseren is geblokkeerd tijdens beschermd herstel.');
  const token=await JKCloud.getAccessToken();
  if(!token)throw Error('Sessie is verlopen. Log opnieuw in.');
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',
   'Authorization':'Bearer '+token,'apikey':publishable},body:JSON.stringify({action,...extra})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Kalenderserver tijdelijk niet beschikbaar');
  return data;
 }
 async function snapshot(){return entriesFor(await JKDB.all('jobs'));}
 async function status(){return api('status');}
 async function create(action){
  const data=await api(action,{events:await snapshot()});
  if(data.ok!==true||typeof data.url!=='string'||!/^https:\/\//.test(data.url))throw Error('Agenda-link niet bevestigd.');
  await save({enabled:true,url:data.url,lastSentAt:new Date().toISOString()});
  return data;
 }
 async function enable(){return create('enable');}
 async function rotate(){return create('rotate');}
 async function disable(){
  const data=await api('disable');
  if(data.ok!==true)throw Error('Agenda uitschakelen is niet bevestigd.');
  await save({enabled:false,url:'',lastSentAt:null});
  return data;
 }
 async function publish(){
  if(busy){pending=true;return {skipped:true};}
  if(!JKCloud.isSignedIn()||!navigator.onLine)return {skipped:true};
  const local=await own();
  if(!local.enabled||await JKCloud.restoreProtected())return {skipped:true};
  busy=true;
  try{
   const data=await api('publish',{events:await snapshot()});
   if(data.ok!==true)throw Error('Agendagegevens niet bevestigd.');
   await save({...local,lastSentAt:data.updatedAt||new Date().toISOString()});
   return {sent:true};
  }catch(error){
   if(/Agenda niet geactiveerd/.test(String(error?.message||'')))await save({...local,enabled:false,url:''});
   console.warn('JK Works agenda is nog niet bijgewerkt.');
   return {sent:false,failed:true};
  }finally{
   busy=false;
   if(pending){pending=false;schedule();}
  }
 }
 function schedule(){
  if(timer!==null)return;
  timer=setTimeout(()=>{timer=null;publish().catch(()=>{});},350);
 }
 return {status,enable,rotate,disable,publish,schedule,own,entriesFor};
})();
window.JKCalendarFeed=JKCalendarFeed;
