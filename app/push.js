/* JK Works Web Push - uitsluitend aanmelden met ingelogde Supabase sessie. */
const JKPush=(()=>{
 const URL='https://ercqiavruotoclhvfzud.supabase.co/functions/v1/jk-push';
 const KEY='sb_publishable_z4kkYgzjr-bYDEcSZlVciw_cP8MfOuX';
 const bytes=s=>{const x=(s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(x),c=>c.charCodeAt(0));};
 async function api(action,subscription,extra={}){
   const token=await JKCloud.getAccessToken();if(!token)throw Error('Log eerst in bij Synchronisatie.');
   const res=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':KEY},body:JSON.stringify({action,subscription,...extra})});
   const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||('Serverfout '+res.status));return data;
 }
 async function subscribe(){
   if(!('PushManager' in window)||!('serviceWorker' in navigator)||!('Notification' in window))throw Error('Dit apparaat ondersteunt geen webpush.');
   if(/iPhone|iPad|iPod/i.test(navigator.userAgent)&&!(navigator.standalone||matchMedia('(display-mode: standalone)').matches))throw Error('Voeg JK Works eerst toe aan het beginscherm en open het via dat pictogram.');
   const {publicKey}=await api('config');if(!publicKey)throw Error('Pushdienst is nog niet ingesteld.');
   const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Meldingstoestemming is niet verleend.');
   const reg=await navigator.serviceWorker.ready;
   let sub=await reg.pushManager.getSubscription();
   if(sub&&JSON.stringify(Array.from(new Uint8Array(sub.options.applicationServerKey||[])))!==JSON.stringify(Array.from(bytes(publicKey)))){await sub.unsubscribe();sub=null;}
   if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(publicKey)});
   await api('subscribe',sub.toJSON());
   // Pushregistratie is bevestigd. Publiceer meteen de huidige actiegegevens,
   // ook als oude wijzigingen nog bewust in de handmatige sync-wachtrij staan.
   if(window.JKCloud?.publishNotificationProjection){
     const result=await JKCloud.publishNotificationProjection();
     if(result?.failed)console.warn('Meldingsgegevens moeten nog opnieuw worden bijgewerkt.');
   }
   return true;
 }
 async function unsubscribe(){const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){await api('unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();}}
 async function status(){if(!('PushManager' in window))return 'Push niet ondersteund op dit apparaat.';const reg=await navigator.serviceWorker.ready;return await reg.pushManager.getSubscription()?'Dit apparaat heeft een pushabonnement. Controleer of de server is geactiveerd.':'Push nog niet ingeschakeld op dit apparaat.';}
 async function test(){
   const requestId=crypto.randomUUID();
   let data;try{data=await api('test',undefined,{requestId});}catch(e){
     // Responses expose only fixed messages. Never display raw endpoint/token errors.
     if(!await JKCloud.getAccessToken())throw Error('Log eerst in om een testmelding te plannen.');
     throw Error('Inplannen niet bevestigd. De melding kan toch al zijn ingepland. Wacht minstens 30 seconden voordat je opnieuw probeert.');
   }
   if(data?.ok!==true||data.requestId!==requestId||!['scheduled','sending','completed'].includes(data.status)||!Number.isFinite(Date.parse(data.scheduledFor)))throw Error('De server heeft het inplannen niet bevestigd.');
   return data;
 }
 async function snooze(key,duration){return api('snooze',undefined,{key,duration});}
 async function unsnooze(key){return api('unsnooze',undefined,{key});}
 async function snoozes(){return api('snoozes');}
 async function quoteNeeded(jobId){return api('quote-needed',undefined,{jobId});}
 return {subscribe,unsubscribe,status,test,snooze,unsnooze,snoozes,quoteNeeded};
})();