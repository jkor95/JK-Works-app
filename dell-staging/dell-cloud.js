/* JK Works Dell staging adapter: owner-scoped manual sync, NO Supabase.
 * Uses existing IndexedDB stores and explicit manual synchronization.
 * This is test-only until binary storage, restore and conflict migration are verified. */
const JKCloud = (() => {
  const excludedSettings = new Set(['backup','backupRestoreGuard','cloudStatus','calendarFeedLocal']);
  const allowedStores = new Set(['clients','jobs','timeEntries','expenses','checklists','tools','mboxes','pdfTemplates','settings']);
  let identity=null, syncing=false, initialized=false;
  const emit=(name,detail)=>document.dispatchEvent(new CustomEvent(name,{detail}));
  const endpoint='/api/v1/';
  const pathFor=(store,id)=> {
    if(!/^[A-Za-z0-9_-]{1,64}$/.test(store)||!/^[A-Za-z0-9_.-]{1,128}$/.test(id)) throw Error('Deze record-ID kan nog niet worden gesynchroniseerd.');
    return 'records/'+encodeURIComponent(store)+'/'+encodeURIComponent(id);
  };
  const eligible=(store,id)=> allowedStores.has(store)&&!(store==='settings'&&excludedSettings.has(id));
  async function api(path,options={}){
    const response=await fetch(endpoint+path,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...options});
    if(!response.ok) throw Error(response.status===401?'Je Dell-testlogin is verlopen. Log opnieuw in.':'Dell-synchronisatie niet beschikbaar (HTTP '+response.status+').');
    return response.json();
  }
  const hasBlob=value=>{
    if(value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return true;
    if(!value||typeof value!=='object')return false;
    if(Array.isArray(value))return value.some(hasBlob);
    return Object.values(value).some(hasBlob);
  };
  async function pending(){return (await JKDB.all('syncQueue')).filter(x=>eligible(x.store,x.recordId)).length}
  async function addQueue(type,store,id){
    if(!eligible(store,id))return;
    const entries=await JKDB.all('syncQueue');
    for(const x of entries)if(x.store===store&&x.recordId===id)await JKDB.removeLocal('syncQueue',x.id);
    await JKDB.putLocal('syncQueue',{id:JKDB.id('dellq'),type,store,recordId:id,queuedAt:new Date().toISOString()});
    emit('jkcloud-queue');
  }
  async function applySnapshot(){
    const {records=[],deletions=[]}=await api('sync/snapshot');
    const queue=await JKDB.all('syncQueue');
    const pendingKeys=new Set(queue.map(q=>q.store+'|'+q.recordId));
    let changed=false;
    for(const d of deletions){
      if(!eligible(d.store,d.record_id))continue;
      const key=d.store+'|'+d.record_id;
      await JKDB.markDeleteLocal(d.store,d.record_id,d.deleted_at);
      // A server tombstone always wins, even over a pending local edit.
      if(pendingKeys.has(key)){
        for(const q of queue)if(q.store===d.store&&q.recordId===d.record_id)await JKDB.removeLocal('syncQueue',q.id);
      }
      if(await JKDB.get(d.store,d.record_id)){await JKDB.removeLocal(d.store,d.record_id);changed=true;}
    }
    for(const record of records){
      if(!eligible(record.store,record.record_id))continue;
      const key=record.store+'|'+record.record_id;
      if(pendingKeys.has(key)||await JKDB.isDeletedLocal(record.store,record.record_id))continue;
      if(!record.data||typeof record.data!=='object'||Array.isArray(record.data)||hasBlob(record.data))continue;
      const local=await JKDB.get(record.store,record.record_id);
      if(local && local._syncUpdatedAt && new Date(local._syncUpdatedAt)>new Date(record.updated_at)) continue;
      await JKDB.putLocal(record.store,record.data);
      changed=true;
    }
    return changed;
  }
  async function init(){
    try {
      const r=await api('auth/me');
      identity={id:r.id,email:'Dell-testaccount'};
      initialized=true;
      // Do not upload existing seeded/demo data. Download server state first.
      try{await applySnapshot()}catch(e){console.warn('Dell snapshot unavailable; no data uploaded',e.message)}
    }catch{identity=null}
    return !!identity;
  }
  async function syncNow(){
    if(!identity)throw Error('Niet aangemeld bij de Dell-testomgeving.');
    if(syncing)return;
    if((await JKDB.get('settings','backupRestoreGuard'))?.active)throw Error('Back-upherstel is beveiligd; synchronisatie is geblokkeerd.');
    if(!navigator.onLine)throw Error('Geen internetverbinding.');
    syncing=true;emit('jkcloud-sync',{state:'syncing'});
    try{
      // Check remote tombstones before sending local edits to avoid resurrecting old data.
      await applySnapshot();
      const jobs=await JKDB.all('syncQueue');
      for(const q of jobs){
        if(!eligible(q.store,q.recordId))continue;
        const path=pathFor(q.store,q.recordId);
        if(q.type==='delete'){
          await api(path,{method:'DELETE'});
        }else if(q.type==='put'){
          if(await JKDB.isDeletedLocal(q.store,q.recordId)) { await JKDB.removeLocal('syncQueue',q.id); continue; }
          const data=await JKDB.get(q.store,q.recordId);
          if(!data){await JKDB.removeLocal('syncQueue',q.id);continue}
          if(hasBlob(data))throw Error('Dit record bevat een foto of bestand. Bestandsopslag moet eerst worden aangesloten; wijzigingen blijven lokaal bewaard.');
          const result=await api(path,{method:'PUT',body:JSON.stringify(data)});
          if(result.deleted) {await JKDB.markDeleteLocal(q.store,q.recordId);await JKDB.removeLocal(q.store,q.recordId);}
        }else continue;
        await JKDB.removeLocal('syncQueue',q.id);
      }
      const changed=await applySnapshot();
      emit('jkcloud-sync',{state:'done',changed});
      emit('jkcloud-queue');
    }catch(e){emit('jkcloud-sync',{state:'error'});throw e}
    finally{syncing=false}
  }
  async function signOut(){await api('auth/logout',{method:'POST'}).catch(()=>{});identity=null;location.replace('/')}
  const unsupported=async()=>{throw Error('Deze functie is nog niet veilig beschikbaar op de Dell-testserver.')};
  return {
    init,user:()=>identity,isSignedIn:()=>!!identity,
    signIn:unsupported,signUp:unsupported,signOut,
    status:()=>({available:initialized,signedIn:!!identity,email:identity?.email||'',syncing}),
    pendingCount:pending,
    queuePut:async(store,obj)=>{if(obj?.id&&eligible(store,obj.id))await addQueue('put',store,obj.id)},
    queueDelete:async(store,id)=>{if(eligible(store,id))await addQueue('delete',store,id)},
    syncNow,pruneCloudToLocal:unsupported,
    restoreProtected:async()=>!!(await JKDB.get('settings','backupRestoreGuard'))?.active,
    withBackupRead:unsupported,readBackupSnapshot:unsupported,downloadBackupFile:unsupported,
    getAccessToken:async()=>null,publishNotificationProjection:async()=>{},hasPushSubscription:()=>false,
    getWebsiteContent:unsupported,saveWebsiteContent:unsupported,getWebsiteRequests:async()=>[],
    updateWebsiteRequest:unsupported,downloadRequestPhoto:unsupported,deleteWebsiteRequest:unsupported
  };
})();
