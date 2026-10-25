// JK Works private subscription calendar: URL-token read; account JWT writes.
// Deliberately isolated from the jk-push function and manual cloud sync.
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const origin='https://jkworks.nl';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,GET,HEAD,OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const deny=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
const rxTime=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const rxDate=/^\d{4}-\d{2}-\d{2}$/;
const clean=(value:unknown,max=200)=>String(value||'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max);
async function hashToken(token:string){
 const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');
}
function issueToken(){
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
type Event={id:string,date:string,startTime:string,endTime:string,title:string,clientName:string,address:string,status:string};
function validatedEvents(raw:unknown):Event[]|null{
 if(!Array.isArray(raw)||raw.length>2000)return null;
 const keys=new Set<string>(),output:Event[]=[];
 for(const e of raw){
  if(!e||typeof e!=='object'||typeof e.id!=='string'||e.id.length>110||!/^[-_a-zA-Z0-9]+$/.test(e.id))return null;
  if(typeof e.date!=='string'||!rxDate.test(e.date)||Number.isNaN(Date.parse(e.date+'T12:00:00Z')))return null;
  const start=clean(e.startTime,5),end=clean(e.endTime,5);
  if((start&&!rxTime.test(start))||(end&&!rxTime.test(end))||Boolean(start)!==Boolean(end))return null;
  const key=e.id+'@'+e.date;
  if(keys.has(key))return null;
  keys.add(key);
  output.push({id:e.id,date:e.date,startTime:start,endTime:end,title:clean(e.title,180)||'Klus',
   clientName:clean(e.clientName,120),address:clean(e.address,220),status:clean(e.status,20)});
 }
 return output;
}
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,m=>'\\'+m);
function calendarStamp(instant:Date){return instant.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');}
const addDay=(s:string)=>new Date(Date.parse(s+'T12:00:00Z')+86400000).toISOString().slice(0,10);
function ics(events:Event[],updated:string){
 const stamp=calendarStamp(new Date(updated));
 const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//JK Works Dordrecht//Klussenagenda//NL',
  'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:JK Works - Klussen','X-WR-TIMEZONE:Europe/Amsterdam'];
 for(const e of [...events].sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime))){
  const uid=e.id+'-'+e.date+'@jkworks.nl';
  rows.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp,'LAST-MODIFIED:'+stamp,'SUMMARY:'+esc(e.title),
    'DESCRIPTION:'+esc(e.clientName?'Klant: '+e.clientName:'JK Works Dordrecht'));
  if(e.address)rows.push('LOCATION:'+esc(e.address));
  if(e.startTime&&e.endTime){
   rows.push('DTSTART;TZID=Europe/Amsterdam:'+e.date.replaceAll('-','')+'T'+e.startTime.replace(':','')+'00');
   rows.push('DTEND;TZID=Europe/Amsterdam:'+(e.endTime<=e.startTime?addDay(e.date):e.date).replaceAll('-','')+'T'+e.endTime.replace(':','')+'00');
  }else{
   rows.push('DTSTART;VALUE=DATE:'+e.date.replaceAll('-',''),'DTEND;VALUE=DATE:'+addDay(e.date).replaceAll('-',''));
  }
  rows.push('STATUS:CONFIRMED','END:VEVENT');
 }
 rows.push('END:VCALENDAR');
 // RFC5545 line folding at 75 UTF-8 bytes. Do not split within a codepoint.
 const fold=(line:string)=>{
  let out='',bytes=0;
  for(const c of line){
   const length=new TextEncoder().encode(c).length;
   if(bytes+length>74){out+='\r\n ';bytes=1;}
   out+=c;bytes+=length;
  }
  return out;
 };
 return rows.map(fold).join('\r\n')+'\r\n';
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const requestUrl=new URL(req.url);
 if(req.method==='GET'||req.method==='HEAD'){
  const token=requestUrl.searchParams.get('token')||'';
  if(!/^[a-f0-9]{64}$/.test(token))return deny();
  const {data,error}=await db.from('jk_calendar_feeds').select('events,updated_at').eq('token_hash',await hashToken(token)).maybeSingle();
  if(error||!data)return deny();
  const body=ics(data.events||[],data.updated_at);
  return new Response(req.method==='HEAD'?null:body,{status:200,headers:{
   'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="jk-works-klussen.ics"',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
  }});
 }
 if(req.method!=='POST')return reply({error:'Methode niet toegestaan'},405);
 const bearer=req.headers.get('Authorization')||'';
 if(!bearer.startsWith('Bearer '))return reply({error:'Log eerst in'},401);
 const {data:{user},error:authError}=await db.auth.getUser(bearer.slice(7));
 if(authError||!user)return reply({error:'Ongeldige sessie'},401);
 let body:any;try{body=await req.json();}catch{return reply({error:'Ongeldig verzoek'},400);}
 if(body?.action==='status'){
  const {data,error}=await db.from('jk_calendar_feeds').select('updated_at').eq('user_id',user.id).maybeSingle();
  return error?reply({error:'Agendastatus niet beschikbaar'},503):reply({enabled:!!data,updatedAt:data?.updated_at||null});
 }
 if(body?.action==='disable'){
  const {error}=await db.from('jk_calendar_feeds').delete().eq('user_id',user.id);
  return error?reply({error:'Agenda kon niet worden uitgezet'},503):reply({ok:true,enabled:false});
 }
 if(!['enable','rotate','publish'].includes(body?.action))return reply({error:'Onbekende actie'},400);
 const events=validatedEvents(body.events);
 if(!events)return reply({error:'Ongeldige of te omvangrijke agenda'},400);
 if(body.action==='publish'){
  const {data,error}=await db.from('jk_calendar_feeds').update({events,updated_at:new Date().toISOString()})
   .eq('user_id',user.id).select('updated_at').maybeSingle();
  if(error)return reply({error:'Agenda bijwerken mislukt'},503);
  return data?reply({ok:true,updatedAt:data.updated_at}):reply({error:'Agenda niet geactiveerd'},409);
 }
 const token=issueToken();
 const {error}=await db.from('jk_calendar_feeds').upsert({
  user_id:user.id,token_hash:await hashToken(token),events,updated_at:new Date().toISOString()
 },{onConflict:'user_id'});
 if(error)return reply({error:'Agenda-link maken mislukt'},503);
 const base=Deno.env.get('SUPABASE_URL')!;
 return reply({ok:true,enabled:true,url:base+'/functions/v1/jk-calendar-feed?token='+token});
});