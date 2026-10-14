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
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 let body:any;try{body=await req.json();}catch{return json({error:'Invalid JSON'},400);}
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
