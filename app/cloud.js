const JKCloud = (() => {
  const SUPABASE_URL = 'https://ercqiavruotoclhvfzud.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_z4kkYgzjr-bYDEcSZlVciw_cP8MfOuX';
  const BUCKET = 'jkworks-files';
  const LOCAL_ONLY_STORES = new Set();
  // Never upload legacy copies of private calendar bearer URLs from IndexedDB.
  const LOCAL_ONLY_SETTINGS = new Set(['calendarFeedLocal']);
  let client = null, session = null, syncing = false, backupBusy = false;
  const BACKUP_BUCKETS=['jkworks-files','jkworks-request-files','jkworks-website-assets'];
  async function restoreProtected(){return !!(await JKDB.get('settings','backupRestoreGuard'))?.active;}
  async function withBackupRead(action){
    if(syncing||backupBusy)throw new Error('Wacht tot de huidige synchronisatie of back-up klaar is.');
    backupBusy=true;
    try{
      if(navigator.locks)return await navigator.locks.request('jkworks-data-operation',{ifAvailable:true},lock=>{
        if(!lock)throw new Error('Een andere app-tab is bezig. Sluit die eerst.');return action();
      });
      return await action();
    }finally{backupBusy=false;}
  }
  async function readBackupSnapshot(){
    if(!isSignedIn()||!navigator.onLine)throw new Error('Cloud kon niet volledig worden gecontroleerd.');
    const owner=user().id;
    async function rows(table,columns,own=false){
      const all=[];
      let expectedCount=null;
      for(let offset=0;offset<100000;){
        let q=client.from(table).select(columns,{count:'exact'});
        if(own)q=q.eq('user_id',owner).order('store').order('record_id');else q=q.order('id');
        const {data,error,count}=await q.range(offset,offset+499);
        if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0||count>100000)throw new Error('Cloudgegevens konden niet volledig worden gelezen.');
        if(expectedCount!==null&&count!==expectedCount)throw new Error('Cloudgegevens gewijzigd tijdens de back-up.');
        expectedCount=count;all.push(...data);offset+=data.length;
        if(all.length===count)return all;
        if(!data.length||all.length>count)throw new Error('Cloudgegevens zijn onvolledig gelezen.');
      }
      throw new Error('Te veel gegevens voor een browserback-up.');
    }
    const records=await rows('app_records','store,record_id,data,updated_at',true);
    const deletions=await rows('app_deletions','store,record_id,deleted_at',true);
    const requests=await rows('public_requests','*');
    const files=[];
    for(const bucket of BACKUP_BUCKETS){
      const folders=[''];let visited=0;
      while(folders.length){
        if(++visited>10000)throw new Error('Te veel bestanden voor een browserback-up.');
        const prefix=folders.shift();
        for(let offset=0;offset<100000;offset+=500){
          const {data,error}=await client.storage.from(bucket).list(prefix,{limit:500,offset,sortBy:{column:'name',order:'asc'}});
          if(error||!Array.isArray(data))throw new Error('Cloudbestanden konden niet volledig worden gecontroleerd.');
          for(const item of data){
            if(!item.name||item.name.includes('/')||['.','..'].includes(item.name))throw new Error('Ongeldige bestandslijst.');
            const path=prefix?prefix+'/'+item.name:item.name;
            if(item.id)files.push({bucket,path,metadata:item.metadata||{},updatedAt:item.updated_at||null});else folders.push(path);
          }
          if(data.length<500)break;
          if(offset===99500)throw new Error('Te veel bestanden voor een browserback-up.');
        }
      }
    }
    if(user()?.id!==owner)throw new Error('Sessie gewijzigd tijdens back-up.');
    return {owner,records,deletions,requests,files};
  }
  async function downloadBackupFile(bucket,path){
    if(!isSignedIn()||!BACKUP_BUCKETS.includes(bucket)||typeof path!=='string'||!path||path.split('/').some(x=>!x||x==='.'||x==='..'))throw new Error('Ongeldige bestandsverwijzing.');
    const {data,error}=await client.storage.from(bucket).download(path);
    if(error||!(data instanceof Blob))throw new Error('Een cloudbestand kon niet worden gelezen. Back-up niet compleet.');
    return data;
  }

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
      if(event==='SIGNED_IN' || event==='TOKEN_REFRESHED'){scheduleNotificationProjection();window.JKCalendarFeed?.schedule();}
    });
    // v33: geen automatische sync op openen, focus, online worden of timer.
    // Synchronisatie gebeurt alleen na inloggen of wanneer de gebruiker op Sync drukt.
    window.addEventListener('online',()=>{scheduleNotificationProjection();window.JKCalendarFeed?.schedule();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){scheduleNotificationProjection();window.JKCalendarFeed?.schedule();}else{publishNotificationProjection().catch(()=>{});window.JKCalendarFeed?.publish().catch(()=>{});}});
    scheduleNotificationProjection();
    return true;
  }
  function user(){ return session?.user || null; }
  function isSignedIn(){ return !!user(); }
  async function signIn(email,password){
    if(!client) throw new Error('Cloudmodule is niet geladen. Controleer internet.');
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error) throw error; session=data.session; if(!await restoreProtected())await syncNow(); scheduleNotificationProjection();window.JKCalendarFeed?.schedule(); return data;
  }
  async function signUp(email,password){
    if(!client) throw new Error('Cloudmodule is niet geladen. Controleer internet.');
    const {data,error}=await client.auth.signUp({email,password});
    if(error) throw error; session=data.session||null;
    if(session&&!await restoreProtected()) await syncNow();
    return data;
  }
  async function signOut(){ if(client) await client.auth.signOut(); session=null; }

  // v71.13.20: beperkte, afgeschermde meldingsprojectie. Geen foto's, PDF's,
  // klantnamen of volledige klusrecords uploaden om achtergrondpush mogelijk te maken.
  const NOTIFICATION_STORES=new Set(['jobs','documents','timeEntries','jobPhotos']);
  const NOTIFICATION_SETTINGS=new Set(['notificationPrefs','dismissedActions']);
  const relevantOp=op=>op&&(NOTIFICATION_STORES.has(op.store)||
    (op.store==='settings'&&NOTIFICATION_SETTINGS.has(op.recordId)));
  let mirrorTimer=null,mirrorBusy=false,mirrorPending=false;
  const clientAlias=name=>{
    const value=String(name||'').trim().toLowerCase();
    let hash=2166136261;
    for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
    return value?'alias-'+(hash>>>0).toString(16):'';
  };
  // Only future, timed jobs may expose the minimum private details required
  // for the explicitly enabled one-hour reminder. Existing manual sync stays unchanged.
  function jobReminderDetails(j,prefs){
    if(prefs?.jobReminder===false||['afgerond','geannuleerd','cancelled','completed'].includes(String(j.status||'').toLowerCase()))return undefined;
    const localDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const days=Array.isArray(j.workDays)?j.workDays:[{date:j.date,startTime:j.startTime}];
    if(!days.some(d=>String(d?.date||'')>=localDay&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(d?.startTime||''))))return undefined;
    const execution=j.executionAddress;
    const place=execution&&(execution.street||execution.postal||execution.city)?execution:j;
    const address=[place.street||place.address||'',[place.postal||'',place.city||''].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const short=(value,max)=>String(value||'').replace(/[\r\n]+/g,' ').trim().slice(0,max);
    return {clientName:short(j.clientName,120),title:short(j.title,120),address:short(address,200)};
  }
  async function notificationProjection(){
    const [jobs,documents,photos,entries,prefs,dismissed]=await Promise.all([
      JKDB.all('jobs'),JKDB.all('documents'),JKDB.all('jobPhotos'),JKDB.all('timeEntries'),
      JKDB.get('settings','notificationPrefs'),JKDB.get('settings','dismissedActions')
    ]);
    const allowedPrefs=['jobReminder','hours','photos','quoteCreate','quoteSend','invoiceCreate','invoiceSend','paymentReminder'];
    return {
      schema:1,
      records:[
        ...jobs.map(j=>({store:'jobs',data:{
          id:j.id,date:j.date,startTime:j.startTime,endTime:j.endTime,status:j.status,
          workDays:Array.isArray(j.workDays)?j.workDays.map(d=>({date:d.date,startTime:d.startTime,endTime:d.endTime})):undefined,
          completionPromptHandledAt:j.completionPromptHandledAt||null,
          photoPolicy:j.photoPolicy||'optional',quoteNeeded:!!j.quoteNeeded,paymentType:j.paymentType||'invoice',
          clientName:clientAlias(j.clientName),reminder:jobReminderDetails(j,prefs)
        }})),
        ...documents.map(d=>({store:'documents',data:{
          id:d.id,folder:d.folder,kind:d.kind,meta:{
            jobId:d.meta?.jobId||null,workDate:d.meta?.workDate||null,
            client:{name:clientAlias(d.meta?.client?.name)},
            sent:!!d.meta?.sent,paid:!!d.meta?.paid,deadline:d.meta?.deadline||null
          }
        }})),
        ...photos.map(p=>({store:'jobPhotos',data:{jobId:p.jobId,phase:p.phase}})),
        ...entries.map(e=>({store:'timeEntries',data:{
          jobId:e.jobId,date:e.date,start:e.start,autoFromJobSchedule:!!e.autoFromJobSchedule,
          actualConfirmed:!!e.actualConfirmed
        }})),
        {store:'settings',data:{id:'notificationPrefs',
          ...Object.fromEntries(allowedPrefs.map(k=>[k,prefs?.[k]!==false]))}},
        {store:'settings',data:{id:'dismissedActions',items:dismissed?.items||{}}}
      ]
    };
  }
  async function subscribedForPush(){
    if(!isSignedIn()||!navigator.onLine||!('serviceWorker' in navigator)||
       !('PushManager' in window)||!('Notification' in window)||Notification.permission!=='granted')return false;
    try{
      const reg=await navigator.serviceWorker.ready;
      return !!(await reg.pushManager.getSubscription());
    }catch{return false;}
  }
  async function publishNotificationProjection(){
    if(!isSignedIn()||!navigator.onLine||syncing||backupBusy||mirrorBusy||
       await restoreProtected()||!await subscribedForPush())return {sent:false,skipped:true};
    mirrorBusy=true;
    try{
      const snapshot=await notificationProjection();
      const record={user_id:user().id,store:'notificationSnapshot',record_id:'active',
        data:snapshot,updated_at:new Date().toISOString()};
      const {error}=await client.from('app_records').upsert(record,{onConflict:'user_id,store,record_id'});
      if(error)throw error;
      return {sent:true};
    }catch(e){
      console.warn('Meldingsgegevens niet bijgewerkt op server');
      return {sent:false,failed:true};
    }finally{
      mirrorBusy=false;
      if(mirrorPending){mirrorPending=false;scheduleNotificationProjection();}
    }
  }
  function scheduleNotificationProjection(){
    if(mirrorBusy){mirrorPending=true;return;}
    if(mirrorTimer!==null)return;
    mirrorTimer=setTimeout(()=>{
      mirrorTimer=null;
      publishNotificationProjection().catch(()=>{});
    },250);
  }
  async function queueOp(op){
    const q={id:`q_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,...op,queuedAt:new Date().toISOString()};
    await JKDB.putLocal('syncQueue',q);
    document.dispatchEvent(new CustomEvent('jkcloud-queue'));
    if(relevantOp(q))scheduleNotificationProjection();
    if(q.store==='jobs')window.JKCalendarFeed?.schedule();
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
    if(!JKDB.stores.includes(store) || store==='settings' && (['cloudStatus','backup','backupRestoreGuard'].includes(obj.id)||LOCAL_ONLY_SETTINGS.has(obj.id))) return;
    if(await hasLocalDelete(store,obj.id)) return;
    // v33: elke wijziging blijft lokaal staan tot de gebruiker handmatig synchroniseert.
    // Houd per record alleen de nieuwste PUT in de wachtrij.
    await removePendingPuts(store,obj.id);
    await queueOp({type:'put',store,recordId:obj.id});
  }
  async function queueDelete(store,id){
    if(LOCAL_ONLY_STORES.has(store)) return;
    if(!JKDB.stores.includes(store) || store==='settings'&&LOCAL_ONLY_SETTINGS.has(id)) return;
    await JKDB.markDeleteLocal(store,id);
    await removePendingPuts(store,id);
    const existing=(await JKDB.all('syncQueue')).find(q=>q.type==='delete'&&q.store===store&&q.recordId===id);
    if(!existing) await queueOp({type:'delete',store,recordId:id});
    else document.dispatchEvent(new CustomEvent('jkcloud-queue'));
    if(store==='jobs')window.JKCalendarFeed?.schedule();
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
    if(store==='settings'&&LOCAL_ONLY_SETTINGS.has(obj?.id))return;
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
      if(q.store==='settings'&&LOCAL_ONLY_SETTINGS.has(q.recordId)){
        await JKDB.removeLocal('syncQueue',q.id);continue;
      }
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
    if(navigator.locks)return navigator.locks.request('jkworks-data-operation',{ifAvailable:true},lock=>{
      if(!lock)throw new Error('Een andere app-tab maakt een back-up of synchroniseert.');return syncUnlocked();
    });
    return syncUnlocked();
  }
  async function syncUnlocked(){
    if(backupBusy)throw new Error('Wacht tot de back-upcontrole klaar is.');
    if(await restoreProtected())throw new Error('Herstelkopie beschermd: synchronisatie is geblokkeerd op dit apparaat. Open Back-up en herstellen.');
    if(backupBusy)throw new Error('Wacht tot de back-upcontrole klaar is.');
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
      const remote=new Map((recordsRes.data||[]).filter(r=>!r?.data?.__deleted && !LOCAL_ONLY_STORES.has(r.store) && !(r.store==='settings'&&LOCAL_ONLY_SETTINGS.has(r.record_id))).map(r=>[`${r.store}|${r.record_id}`,r]));
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
        if(store==='settings'&&['backup','backupRestoreGuard'].includes(id))continue;
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
          if(store==='settings'&&(['backup','backupRestoreGuard'].includes(obj.id)||LOCAL_ONLY_SETTINGS.has(obj.id)))continue;
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
        if(rr.store==='settings'&&(['backup','backupRestoreGuard'].includes(rr.record_id)||LOCAL_ONLY_SETTINGS.has(rr.record_id)))continue;
        if(!JKDB.stores.includes(rr.store)) continue;
        const key=`${rr.store}|${rr.record_id}`;
        if(deletedKeys.has(key)) continue;
        const decoded=await decodeRecord(rr.data);
        decoded._syncUpdatedAt=rr.updated_at;
        await JKDB.putLocal(rr.store,decoded); localChanged=true;
      }
      await JKDB.putLocal('settings',{id:'cloudStatus',lastSync:new Date().toISOString(),email:user().email});
      document.dispatchEvent(new CustomEvent('jkcloud-sync',{detail:{state:'done',changed:localChanged}}));
    }finally{ syncing=false; document.dispatchEvent(new CustomEvent('jkcloud-queue')); scheduleNotificationProjection();window.JKCalendarFeed?.schedule(); }
  }

  async function pruneCloudToLocal(stores=['documents','timeEntries','jobs']){
    if(backupBusy||await restoreProtected())throw new Error('Cloudopschoning geblokkeerd tijdens back-up of beschermd herstel.');
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
  return {readBackupSnapshot,downloadBackupFile,withBackupRead,restoreProtected,getAccessToken:async()=>{const {data}=await client.auth.getSession();return data?.session?.access_token||null;},init,status,user,isSignedIn,signIn,signUp,signOut,syncNow,publishNotificationProjection,hasPushSubscription:subscribedForPush,queuePut,queueDelete,pruneCloudToLocal,pendingCount,getWebsiteContent,saveWebsiteContent,getWebsiteRequests,updateWebsiteRequest,downloadRequestPhoto,deleteWebsiteRequest};
})();
