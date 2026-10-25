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
 // Use confirmed time entries in preference to the original job plan. A planned
 // workday without confirmed hours remains visible; an unplanned worked day is
 // also included. Tentative/auto-generated hours never overwrite the plan.
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value);
 const validTime=value=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
 function entriesFor(jobs,timeEntries=[]){
  const actualByJob=new Map();
  for(const entry of timeEntries||[]){
   if(!entry?.jobId || entry.autoFromJobSchedule===true && !entry.actualConfirmed)continue;
   const date=String(entry.date||entry.start||'').slice(0,10);
   const startTime=String(entry.from||String(entry.start||'').slice(11,16));
   const endTime=String(entry.to||String(entry.end||'').slice(11,16));
   if(!validDate(date)||!validTime(startTime)||!validTime(endTime))continue;
   const id=String(entry.jobId),byDate=actualByJob.get(id)||new Map();
   // An existing same-day registration should be used only once.
   byDate.set(date,{date,startTime,endTime,actual:true});
   actualByJob.set(id,byDate);
  }
  const events=[];
  for(const j of jobs){
   if(!j?.id||['geannuleerd','cancelled'].includes(String(j.status||'').toLowerCase()))continue;
   const execution=j.executionAddress||{},isExecution=!!(execution.street||execution.postal||execution.city);
   const place=isExecution?execution:j;
   const addr=[place.street||place.address||'',[place.postal,place.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
   const days=new Map();
   for(const planned of jobDays(j)){
    const date=String(planned.date||'').slice(0,10);
    if(!validDate(date))continue;
    days.set(date,{date,startTime:String(planned.startTime||'').slice(0,5),endTime:String(planned.endTime||'').slice(0,5)});
   }
   const actual=actualByJob.get(String(j.id))||new Map();
   // If a single-day job was worked on a different date, the actual day
   // replaces its original planned slot, instead of creating a duplicate.
   if(days.size===1&&actual.size===1&&!days.has([...actual.keys()][0]))days.clear();
   for(const [date,worked] of actual)days.set(date,worked);
   for(const d of [...days.values()].sort((a,b)=>a.date.localeCompare(b.date))){
    const startTime=validTime(d.startTime)&&validTime(d.endTime)?d.startTime:'';
    const endTime=startTime?d.endTime:'';
    events.push({id:String(j.id),date:d.date,startTime,endTime,
     title:String(j.title||'Klus'),clientName:String(j.clientName||''),
     address:addr,status:String(j.status||'')});
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
 async function snapshot(){
  const [jobs,timeEntries]=await Promise.all([JKDB.all('jobs'),JKDB.all('timeEntries')]);
  return entriesFor(jobs,timeEntries);
 }
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
