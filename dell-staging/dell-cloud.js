/* Isolated Dell preview adapter. Intentionally no Supabase and no cloud writes. */
const JKCloud = (()=>{
 let signedIn=false;let testUser=null;
 const unavailable=async()=>{throw Error('Deze functie is nog niet aangesloten op de Dell-server. Er zijn geen gegevens verstuurd.');};
 async function request(path,options){const r=await fetch('/api/v1/'+path,{credentials:'same-origin',cache:'no-store',...options});if(!r.ok)throw Error('Testaanmelding vereist');return r.json();}
 async function init(){try{const r=await request('auth/me');testUser={id:r.id,email:'Dell-testaccount'};signedIn=true;}catch{signedIn=false;}return true;}
 async function signIn(){return unavailable()}
 async function signUp(){return unavailable()}
 async function signOut(){await request('auth/logout',{method:'POST',headers:{'Content-Type':'application/json'}}).catch(()=>{});signedIn=false;testUser=null;}
 const noCloud=()=>false;
 return {init,user:()=>testUser,isSignedIn:()=>signedIn,signIn,signUp,signOut,status:()=>({available:true,signedIn,email:testUser?.email||'',syncing:false}),
 pendingCount:async()=>0,queuePut:async()=>{},queueDelete:async()=>{},syncNow:unavailable,pruneCloudToLocal:unavailable,
 restoreProtected:async()=>false,withBackupRead:unavailable,readBackupSnapshot:unavailable,downloadBackupFile:unavailable,
 getAccessToken:async()=>null,publishNotificationProjection:async()=>{},hasPushSubscription:noCloud,
 getWebsiteContent:unavailable,saveWebsiteContent:unavailable,getWebsiteRequests:async()=>[],
 updateWebsiteRequest:unavailable,downloadRequestPhoto:unavailable,deleteWebsiteRequest:unavailable};
})();
