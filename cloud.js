const JKCloud = (() => {
  const SUPABASE_URL = 'https://ercqiavruotoclhvfzud.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_z4kkYgzjr-bYDEcSZlVciw_cP8MfOuX';
  const BUCKET = 'jkworks-files';
  let client = null, session = null, syncing = false, autoSyncTimer = null;

  function available(){ return !!window.supabase?.createClient; }
  async function init(){
    if(!available()) return false;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    const {data} = await client.auth.getSession();
    session = data.session || null;
    client.auth.onAuthStateChange((_event,s)=>{session=s||null; document.dispatchEvent(new CustomEvent('jkcloud-auth'));});
    if(session && navigator.onLine) setTimeout(()=>syncNow().catch(console.warn),300);
    window.addEventListener('online',()=>{ if(session) syncNow().catch(()=>{}); });
    window.addEventListener('focus',()=>{ if(session && navigator.onLine) syncNow().catch(()=>{}); });
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible' && session && navigator.onLine) syncNow().catch(()=>{});
    });
    if(!autoSyncTimer){
      autoSyncTimer=setInterval(()=>{
        if(session && navigator.onLine && document.visibilityState==='visible') syncNow().catch(()=>{});
      },30000);
    }
    return true;
  }
  function user(){ return session?.user || null; }
  function isSignedIn(){ return !!user(); }
  async function signIn(email,password){
    if(!client) throw new Error('Cloudmodule is niet geladen. Controleer internet.');
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error) throw error; session=data.session; await syncNow(); return data;
  }
  async function signUp(email,password){
    if(!client) throw new Error('Cloudmodule is niet geladen. Controleer internet.');
    const {data,error}=await client.auth.signUp({email,password});
    if(error) throw error; session=data.session||null;
    if(session) await syncNow();
    return data;
  }
  async function signOut(){ if(client) await client.auth.signOut(); session=null; }

  async function queueOp(op){
    const q={id:`q_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,...op,queuedAt:new Date().toISOString()};
    await JKDB.putLocal('syncQueue',q);
    return q;
  }
  async function queuePut(store,obj){
    if(!JKDB.stores.includes(store) || store==='settings' && obj.id==='cloudStatus') return;
    if(!isSignedIn() || !navigator.onLine){ await queueOp({type:'put',store,recordId:obj.id}); return; }
    try{ await pushRecord(store,obj); }catch(e){ await queueOp({type:'put',store,recordId:obj.id}); throw e; }
  }
  async function queueDelete(store,id){
    if(!JKDB.stores.includes(store)) return;
    // Altijd eerst een tombstone/wachtrij-item opslaan. Hierdoor weet elke
    // volgende sync dat dit record verwijderd moet blijven, ook bij offline
    // gebruik of een tijdelijk mislukte netwerkrequest.
    const q=await queueOp({type:'delete',store,recordId:id});
    if(!isSignedIn() || !navigator.onLine) return;
    try{
      await deleteRecord(store,id);
      await JKDB.removeLocal('syncQueue',q.id);
    }catch(e){
      console.warn('Cloud delete uitgesteld',store,id,e);
      // q blijft staan en wordt bij een volgende sync opnieuw geprobeerd.
    }
  }

  async function encodeRecord(store,obj){
    const data={...obj};
    for(const [k,v] of Object.entries(data)){
      if(v instanceof Blob){
        const ext=v.type==='application/pdf'?'pdf':'bin';
        const path=`${user().id}/${store}/${obj.id}/${k}.${ext}`;
        const {error}=await client.storage.from(BUCKET).upload(path,v,{upsert:true,contentType:v.type||'application/octet-stream'});
        if(error) throw error;
        data[k]={__storagePath:path,__mime:v.type||'application/octet-stream'};
      }
    }
    return data;
  }
  async function decodeRecord(data){
    const obj={...data};
    for(const [k,v] of Object.entries(obj)){
      if(v && typeof v==='object' && v.__storagePath){
        const {data:blob,error}=await client.storage.from(BUCKET).download(v.__storagePath);
        if(error) throw error;
        obj[k]=new Blob([blob],{type:v.__mime||blob.type||'application/octet-stream'});
      }
    }
    return obj;
  }
  async function pushRecord(store,obj){
    if(!isSignedIn()) return;
    const data=await encodeRecord(store,obj);
    const row={user_id:user().id,store,record_id:obj.id,data,updated_at:obj._syncUpdatedAt||new Date().toISOString()};
    const {error}=await client.from('app_records').upsert(row,{onConflict:'user_id,store,record_id'});
    if(error) throw error;
  }
  async function deleteRecord(store,id){
    if(!isSignedIn()) return;
    const {error}=await client.from('app_records').delete().eq('user_id',user().id).eq('store',store).eq('record_id',id);
    if(error) throw error;
    const prefix=`${user().id}/${store}/${id}/`;
    const folder=`${user().id}/${store}/${id}`;
    const {data:list}=await client.storage.from(BUCKET).list(folder);
    if(list?.length) await client.storage.from(BUCKET).remove(list.map(x=>prefix+x.name));
  }
  async function flushQueue(){
    if(!isSignedIn() || !navigator.onLine) return;
    const qs=await JKDB.all('syncQueue');
    for(const q of qs){
      try{
        if(q.type==='delete') await deleteRecord(q.store,q.recordId);
        else { const obj=await JKDB.get(q.store,q.recordId); if(obj) await pushRecord(q.store,obj); }
        await JKDB.removeLocal('syncQueue',q.id);
      }catch(e){ console.warn('Sync queue item failed',q,e); }
    }
  }
  async function syncNow(){
    if(syncing || !isSignedIn() || !navigator.onLine) return;
    syncing=true; document.dispatchEvent(new CustomEvent('jkcloud-sync',{detail:{state:'syncing'}}));
    let localChanged=false;
    try{
      await flushQueue();
      const {data:rows,error}=await client.from('app_records').select('store,record_id,data,updated_at').eq('user_id',user().id);
      if(error) throw error;
      const remote=new Map((rows||[]).map(r=>[`${r.store}|${r.record_id}`,r]));
      // Records met een nog openstaande delete mogen nooit opnieuw lokaal
      // worden geimporteerd. De delete-wachtrij is hier de tombstone.
      const pendingDeletes=(await JKDB.all('syncQueue')).filter(q=>q.type==='delete');
      for(const q of pendingDeletes) remote.delete(`${q.store}|${q.recordId}`);
      const hasSyncedBefore=!!(await JKDB.get('settings','cloudStatus'))?.lastSync;
      for(const store of JKDB.stores){
        const local=await JKDB.all(store);
        for(const obj of local){
          const key=`${store}|${obj.id}`, rr=remote.get(key);
          if(!rr){ await pushRecord(store,obj); continue; }
          const lt=new Date(obj._syncUpdatedAt||0).getTime(), rt=new Date(rr.updated_at||0).getTime();
          if(!hasSyncedBefore){
            const decoded=await decodeRecord(rr.data); decoded._syncUpdatedAt=rr.updated_at; await JKDB.putLocal(store,decoded); localChanged=true;
          } else if(lt>rt+1000) await pushRecord(store,obj);
          else if(rt>lt+1000){
            const decoded=await decodeRecord(rr.data);
            decoded._syncUpdatedAt=rr.updated_at;
            await JKDB.putLocal(store,decoded); localChanged=true;
          }
          remote.delete(key);
        }
      }
      for(const rr of remote.values()){
        if(!JKDB.stores.includes(rr.store)) continue;
        const decoded=await decodeRecord(rr.data);
        decoded._syncUpdatedAt=rr.updated_at;
        await JKDB.putLocal(rr.store,decoded); localChanged=true;
      }
      await JKDB.putLocal('settings',{id:'cloudStatus',lastSync:new Date().toISOString(),email:user().email});
      document.dispatchEvent(new CustomEvent('jkcloud-sync',{detail:{state:'done',changed:localChanged}}));
    }finally{ syncing=false; }
  }
  function status(){ return {available:available(),signedIn:isSignedIn(),email:user()?.email||'',syncing}; }
  return {init,status,user,isSignedIn,signIn,signUp,signOut,syncNow,queuePut,queueDelete};
})();
