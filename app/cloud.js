const JKCloud = (() => {
  const SUPABASE_URL = 'https://ercqiavruotoclhvfzud.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_z4kkYgzjr-bYDEcSZlVciw_cP8MfOuX';
  const BUCKET = 'jkworks-files';
  const LOCAL_ONLY_STORES = new Set();
  let client = null, session = null, syncing = false;

  function available(){ return !!window.supabase?.createClient; }
  async function init(){
    if(!available()) return false;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    const {data} = await client.auth.getSession();
    session = data.session || null;
    client.auth.onAuthStateChange((event,s)=>{
      session=s||null;
      // Een stille token-refresh mag de interface niet opnieuw opbouwen.
      if(event==='SIGNED_IN' || event==='SIGNED_OUT' || event==='USER_UPDATED')
        document.dispatchEvent(new CustomEvent('jkcloud-auth'));
    });
    // v33: geen automatische sync op openen, focus, online worden of timer.
    // Synchronisatie gebeurt alleen na inloggen of wanneer de gebruiker op Sync drukt.
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
    document.dispatchEvent(new CustomEvent('jkcloud-queue'));
    return q;
  }
  async function hasLocalDelete(store,id){
    return !!(await JKDB.get('deleteMarkers',`${store}|${id}`));
  }
  async function removePendingPuts(store,id){
    const qs=await JKDB.all('syncQueue');
    for(const q of qs){
      if(q.type==='put' && q.store===store && q.recordId===id) await JKDB.removeLocal('syncQueue',q.id);
    }
  }
  async function queuePut(store,obj){
    if(LOCAL_ONLY_STORES.has(store)) return;
    if(!JKDB.stores.includes(store) || store==='settings' && obj.id==='cloudStatus') return;
    if(await hasLocalDelete(store,obj.id)) return;
    // v33: elke wijziging blijft lokaal staan tot de gebruiker handmatig synchroniseert.
    // Houd per record alleen de nieuwste PUT in de wachtrij.
    await removePendingPuts(store,obj.id);
    await queueOp({type:'put',store,recordId:obj.id});
  }
  async function queueDelete(store,id){
    if(LOCAL_ONLY_STORES.has(store)) return;
    if(!JKDB.stores.includes(store)) return;
    await JKDB.markDeleteLocal(store,id);
    await removePendingPuts(store,id);
    const existing=(await JKDB.all('syncQueue')).find(q=>q.type==='delete'&&q.store===store&&q.recordId===id);
    if(!existing) await queueOp({type:'delete',store,recordId:id});
    else document.dispatchEvent(new CustomEvent('jkcloud-queue'));
    // Cloud-delete wordt pas uitgevoerd bij handmatige synchronisatie.
  }

  async function encodeRecord(store,obj){
    const data={...obj};
    for(const [k,v] of Object.entries(data)){
      if(v instanceof Blob){
        const ext=v.type==='application/pdf'?'pdf':v.type==='image/jpeg'?'jpg':v.type==='image/png'?'png':'bin';
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
    if(await hasLocalDelete(store,obj.id)) return;
    const data=await encodeRecord(store,obj);
    // Nogmaals controleren na eventuele Storage-upload: een delete kan tijdens
    // de upload zijn gestart. In dat geval verwijderen we de upload weer via
    // markDeleted en schrijven we geen levend metadatarecord terug.
    if(await hasLocalDelete(store,obj.id)){ await markDeleted(store,obj.id); return; }
    const row={user_id:user().id,store,record_id:obj.id,data,updated_at:obj._syncUpdatedAt||new Date().toISOString()};
    const {error}=await client.from('app_records').upsert(row,{onConflict:'user_id,store,record_id'});
    if(error) throw error;
  }
  async function markDeleted(store,id){
    if(!isSignedIn()) return;
    const when=(await JKDB.get('deleteMarkers',`${store}|${id}`))?.deletedAt||new Date().toISOString();

    // 1. Eerst de delete in een aparte cloudtabel vastleggen. Deze tabel kan
    // niet door een oude app_records-upsert worden overschreven.
    const delRow={user_id:user().id,store,record_id:id,deleted_at:when};
    const {error:delError}=await client.from('app_deletions').upsert(delRow,{onConflict:'user_id,store,record_id'});
    if(delError) throw delError;

    // 2. Daarna het levende record echt verwijderen.
    const {error:recordError}=await client.from('app_records').delete().eq('user_id',user().id).eq('store',store).eq('record_id',id);
    if(recordError) throw recordError;

    // 3. En tenslotte eventuele PDF/blob-bestanden uit Storage verwijderen.
    const prefix=`${user().id}/${store}/${id}/`;
    const folder=`${user().id}/${store}/${id}`;
    const {data:list,error:listError}=await client.storage.from(BUCKET).list(folder);
    if(listError) console.warn('Storage-list bij verwijderen mislukt',listError);
    if(list?.length){
      const {error:removeError}=await client.storage.from(BUCKET).remove(list.map(x=>prefix+x.name));
      if(removeError) console.warn('Storage-bestand verwijderen mislukt',removeError);
    }
  }

  async function purgeLocalOnlyCloudData(){ return; }

  async function flushQueue(){
    if(!isSignedIn() || !navigator.onLine) return;
    const qs=await JKDB.all('syncQueue');
    // Deletes eerst. Zo kan een oude put in dezelfde queue nooit na een delete
    // hetzelfde record opnieuw schrijven.
    const ordered=[...qs].sort((a,b)=>(a.type==='delete'?0:1)-(b.type==='delete'?0:1));
    for(const q of ordered){
      try{
        if(q.type==='delete') await markDeleted(q.store,q.recordId);
        else {
          if(await hasLocalDelete(q.store,q.recordId)){ await JKDB.removeLocal('syncQueue',q.id); continue; }
          const obj=await JKDB.get(q.store,q.recordId); if(obj) await pushRecord(q.store,obj);
        }
        await JKDB.removeLocal('syncQueue',q.id);
      }catch(e){ console.warn('Sync queue item failed',q,e); }
    }
  }
  async function syncNow(){
    if(syncing || !isSignedIn() || !navigator.onLine) return;
    syncing=true; document.dispatchEvent(new CustomEvent('jkcloud-sync',{detail:{state:'syncing'}}));
    let localChanged=false;
    try{
      await purgeLocalOnlyCloudData();
      await flushQueue();
      const [recordsRes,deletionsRes]=await Promise.all([
        client.from('app_records').select('store,record_id,data,updated_at').eq('user_id',user().id),
        client.from('app_deletions').select('store,record_id,deleted_at').eq('user_id',user().id)
      ]);
      if(recordsRes.error) throw recordsRes.error;
      if(deletionsRes.error) throw deletionsRes.error;

      const legacyDeleted=(recordsRes.data||[]).filter(r=>r?.data?.__deleted);
      const remote=new Map((recordsRes.data||[]).filter(r=>!r?.data?.__deleted && !LOCAL_ONLY_STORES.has(r.store)).map(r=>[`${r.store}|${r.record_id}`,r]));
      const deletedKeys=new Set();

      // Lokale markers blijven bewust bewaard, zodat een oude lokale kopie ook
      // na browserherstart niet opnieuw kan worden geupload.
      for(const m of await JKDB.all('deleteMarkers')) deletedKeys.add(`${m.store}|${m.recordId}`);
      for(const q of (await JKDB.all('syncQueue')).filter(q=>q.type==='delete')) deletedKeys.add(`${q.store}|${q.recordId}`);
      for(const d of deletionsRes.data||[]) if(!LOCAL_ONLY_STORES.has(d.store)) deletedKeys.add(`${d.store}|${d.record_id}`);
      for(const r of legacyDeleted) if(!LOCAL_ONLY_STORES.has(r.store)) deletedKeys.add(`${r.store}|${r.record_id}`);

      // Migreer tombstones uit oudere appversies naar de nieuwe aparte
      // verwijdertabel en ruim het oude app_records-record op.
      for(const r of legacyDeleted){
        if(LOCAL_ONLY_STORES.has(r.store)) continue;
        try{
          await JKDB.markDeleteLocal(r.store,r.record_id,r?.data?.deleted_at||r.updated_at);
          await markDeleted(r.store,r.record_id);
        }catch(e){ console.warn('Oude tombstone migreren mislukt',r,e); }
      }

      // Een verwijdering wint altijd, op ieder apparaat.
      for(const key of deletedKeys){
        const sep=key.indexOf('|'), store=key.slice(0,sep), id=key.slice(sep+1);
        if(JKDB.stores.includes(store)){
          if(await JKDB.get(store,id)){ await JKDB.removeLocal(store,id); localChanged=true; }
          // Cloud-delete ook lokaal onthouden wanneer deze op een ander apparaat
          // is uitgevoerd.
          if(!(await JKDB.get('deleteMarkers',key))){
            await JKDB.putLocal('deleteMarkers',{id:key,store,recordId:id,deletedAt:new Date().toISOString()});
          }
        }
        remote.delete(key);
      }

      const hasSyncedBefore=!!(await JKDB.get('settings','cloudStatus'))?.lastSync;
      for(const store of JKDB.stores){
        if(LOCAL_ONLY_STORES.has(store)) continue;
        const local=await JKDB.all(store);
        for(const obj of local){
          const key=`${store}|${obj.id}`;
          if(deletedKeys.has(key)){ await JKDB.removeLocal(store,obj.id); localChanged=true; continue; }
          const rr=remote.get(key);
          if(!rr){ await pushRecord(store,obj); continue; }
          const lt=new Date(obj._syncUpdatedAt||0).getTime(), rt=new Date(rr.updated_at||0).getTime();
          if(!hasSyncedBefore){
            const decoded=await decodeRecord(rr.data); decoded._syncUpdatedAt=rr.updated_at; await JKDB.putLocal(store,decoded); localChanged=true;
          } else if(lt>rt+1000) await pushRecord(store,obj);
          else if(rt>lt+1000){
            const decoded=await decodeRecord(rr.data); decoded._syncUpdatedAt=rr.updated_at; await JKDB.putLocal(store,decoded); localChanged=true;
          }
          remote.delete(key);
        }
      }
      for(const rr of remote.values()){
        if(!JKDB.stores.includes(rr.store)) continue;
        const key=`${rr.store}|${rr.record_id}`;
        if(deletedKeys.has(key)) continue;
        const decoded=await decodeRecord(rr.data);
        decoded._syncUpdatedAt=rr.updated_at;
        await JKDB.putLocal(rr.store,decoded); localChanged=true;
      }
      await JKDB.putLocal('settings',{id:'cloudStatus',lastSync:new Date().toISOString(),email:user().email});
      document.dispatchEvent(new CustomEvent('jkcloud-sync',{detail:{state:'done',changed:localChanged}}));
    }finally{ syncing=false; document.dispatchEvent(new CustomEvent('jkcloud-queue')); }
  }

  async function pruneCloudToLocal(stores=['documents','timeEntries','jobs']){
    if(!isSignedIn()) throw new Error('Niet ingelogd.');
    if(!navigator.onLine) throw new Error('Geen internetverbinding.');
    const allowed=stores.filter(s=>JKDB.stores.includes(s) && !LOCAL_ONLY_STORES.has(s));
    const {data:rows,error}=await client.from('app_records').select('store,record_id').eq('user_id',user().id).in('store',allowed);
    if(error) throw error;
    const localIds=new Map();
    for(const store of allowed){
      localIds.set(store,new Set((await JKDB.all(store)).map(x=>x.id)));
    }
    let removed=0;
    for(const row of rows||[]){
      if(localIds.get(row.store)?.has(row.record_id)) continue;
      await JKDB.markDeleteLocal(row.store,row.record_id);
      await markDeleted(row.store,row.record_id);
      removed++;
    }
    await syncNow();
    return {removed,stores:allowed};
  }
  async function getWebsiteContent(){
    if(!isSignedIn()) throw new Error('Niet ingelogd.');
    const {data,error}=await client.from('app_records').select('data,updated_at').eq('user_id',user().id).eq('store','websitePublic').eq('record_id','main').maybeSingle();
    if(error) throw error;
    return data?.data||null;
  }
  async function saveWebsiteContent(content){
    if(!isSignedIn()) throw new Error('Niet ingelogd.');
    if(!navigator.onLine) throw new Error('Geen internetverbinding.');
    const row={user_id:user().id,store:'websitePublic',record_id:'main',data:content,updated_at:new Date().toISOString()};
    const {error}=await client.from('app_records').upsert(row,{onConflict:'user_id,store,record_id'});
    if(error) throw error;
    return true;
  }
  async function getWebsiteRequests(){
    if(!isSignedIn()) throw new Error('Niet ingelogd.');
    const {data,error}=await client.from('public_requests').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    return data||[];
  }
  async function updateWebsiteRequest(id,patch){
    if(!isSignedIn()) throw new Error('Niet ingelogd.');
    const {data,error}=await client.from('public_requests').update({...patch,updated_at:new Date().toISOString()}).eq('id',id).select().maybeSingle();
    if(error) throw error;
    return data;
  }
  async function downloadRequestPhoto(path){
    if(!isSignedIn()) throw new Error('Niet ingelogd.');
    const {data,error}=await client.storage.from('jkworks-request-files').download(path);
    if(error) throw error;
    return data;
  }
  async function deleteWebsiteRequest(id){
    if(!isSignedIn()) throw new Error('Niet ingelogd.');
    const {data:row,error:readError}=await client.from('public_requests').select('photo_paths').eq('id',id).maybeSingle();
    if(readError) throw readError;
    const paths=Array.isArray(row?.photo_paths)?row.photo_paths:[];
    if(paths.length){const {error:storageError}=await client.storage.from('jkworks-request-files').remove(paths);if(storageError)console.warn('Aanvraagfoto’s verwijderen mislukt',storageError);}
    const {error}=await client.from('public_requests').delete().eq('id',id);
    if(error) throw error;
    return true;
  }
  async function pendingCount(){ return (await JKDB.all('syncQueue')).filter(q=>!LOCAL_ONLY_STORES.has(q.store)).length; }
  function status(){ return {available:available(),signedIn:isSignedIn(),email:user()?.email||'',syncing}; }
  return {init,status,user,isSignedIn,signIn,signUp,signOut,syncNow,queuePut,queueDelete,pruneCloudToLocal,pendingCount,getWebsiteContent,saveWebsiteContent,getWebsiteRequests,updateWebsiteRequest,downloadRequestPhoto,deleteWebsiteRequest};
})();
