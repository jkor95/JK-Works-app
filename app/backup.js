// Manual application backups. No service-role key, SQL, cloud writes or auth tokens.
const JKBackup = (() => {
  'use strict';
  const FORMAT='JKWORKS_BACKUP_V3', ENCRYPTED='JKWORKS_ENCRYPTED_V1';
  const MAX_BYTES=150*1024*1024, ITERATIONS=600000;
  const excludedSettings=new Set(['backupRestoreGuard','cloudStatus','backup']);
  const fail=message=>{const error=new Error(message);error.safeBackupMessage=true;throw error;};
  function canonical(v){
    if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
    if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
    return JSON.stringify(v);
  }
  function base64(bytes){let result='';for(let i=0;i<bytes.length;i+=32768)result+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(result);}
  function unbase64(s){
    if(typeof s!=='string'||s.length>MAX_BYTES*1.4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))fail('Ongeldige bestandsinhoud.');
    return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  }
  async function hash(data){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');}
  function counts(stores){return {clients:stores.clients.length,jobs:stores.jobs.length,timeEntries:stores.timeEntries.length,documents:stores.documents.length,photos:stores.jobPhotos.length};}
  function validateStores(stores){
    if(!stores||Object.keys(stores).length!==JKDB.stores.length)fail('Onvolledige back-up: niet alle apponderdelen zijn aanwezig.');
    for(const s of JKDB.stores){
      if(!Array.isArray(stores[s]))fail('Onvolledige back-up: een apponderdeel ontbreekt.');
      const ids=new Set();
      for(const r of stores[s]){
        if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id||ids.has(r.id))fail('Ongeldig of dubbel record in back-up.');
        ids.add(r.id);
        if((s==='documents'||s==='jobPhotos')&&!r.blob)fail('Onvolledige back-up: een PDF of foto ontbreekt.');
      }
    }
  }
  async function make({localOnly=false,progress=()=>{},purpose='manual'}={}){
    progress('Lokale gegevens lezen…');
    const before=await JKDB.snapshot();
    const payload={format:FORMAT,appVersion:'v71.8.1',createdAt:new Date().toISOString(),purpose,
      scope:{cloudChecked:false,description:'Lokale kopie; cloudgegevens niet volledig gecontroleerd.'},stores:{},files:{},cloud:null};
    const downloads=new Map();let totalBytes=0;
    async function addFile(blob){
      const bytes=new Uint8Array(await blob.arrayBuffer()),id=await hash(bytes);
      if(!payload.files[id]){
        totalBytes+=bytes.length;if(totalBytes>MAX_BYTES/2)fail('Te veel bestanden voor een veilige browserback-up.');
        payload.files[id]={bytes:bytes.length,sha256:id,data:base64(bytes)};
      }
      const ref={__file:id,type:blob.type};
      if(blob instanceof File){ref.name=blob.name;ref.lastModified=blob.lastModified;}
      return ref;
    }
    async function storage(bucket,path){
      const key=bucket+'|'+path;
      if(!downloads.has(key))downloads.set(key,await JKCloud.downloadBackupFile(bucket,path));
      return downloads.get(key);
    }
    async function encode(value){
      if(value instanceof Blob)return addFile(value);
      if(value&&typeof value==='object'&&value.__storagePath){const blob=await storage(value.__bucket||'jkworks-files',value.__storagePath);return addFile(new Blob([blob],{type:value.__mime||blob.type}));}
      if(Array.isArray(value))return Promise.all(value.map(encode));
      if(value&&typeof value==='object'){
        const out={};for(const [k,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))fail('Ongeldig gegevensveld.');out[k]=await encode(v);}return out;
      }
      if(typeof value==='string'&&/^blob:/.test(value))fail('Een tijdelijk bestand kan niet veilig worden geëxporteerd.');
      return value===undefined?null:value;
    }
    let cloud;
    if(!localOnly){progress('Cloudgegevens en bestandslijsten uitsluitend lezen…');cloud=await JKCloud.readBackupSnapshot();}
    const deleted=new Set((before.deleteMarkers||[]).map(x=>x.store+'|'+x.recordId));
    for(const q of before.syncQueue||[])if(q.type==='delete')deleted.add(q.store+'|'+q.recordId);
    const pending=new Set((before.syncQueue||[]).filter(x=>x.type==='put').map(x=>x.store+'|'+x.recordId));
    if(cloud){
      for(const d of cloud.deletions)deleted.add(d.store+'|'+d.record_id);
      for(const r of cloud.records)if(r.data?.__deleted)deleted.add(r.store+'|'+r.record_id);
    }
    for(const s of JKDB.stores){
      const merged=new Map(before[s].map(r=>[r.id,r]));
      if(cloud)for(const r of cloud.records.filter(r=>r.store===s&&!r.data?.__deleted)){
        const old=merged.get(r.record_id);
        if(!old||!pending.has(s+'|'+r.record_id)&&Date.parse(r.updated_at)>Date.parse(old._syncUpdatedAt||'1970-01-01'))merged.set(r.record_id,{...r.data,id:r.record_id,_syncUpdatedAt:r.updated_at});
      }
      payload.stores[s]=[];
      for(const r of merged.values()){
        if(deleted.has(s+'|'+r.id)||s==='settings'&&excludedSettings.has(r.id))continue;
        payload.stores[s].push(await encode(r));
      }
    }
    if(cloud){
      payload.cloud={owner:cloud.owner,records:cloud.records,deletions:cloud.deletions,requests:cloud.requests,files:[]};
      for(let i=0;i<cloud.files.length;i++){
        const f=cloud.files[i];progress(`Cloudbestanden controleren: ${i+1} van ${cloud.files.length}…`);
        const blob=await storage(f.bucket,f.path);
        if(f.metadata.size!=null&&Number(f.metadata.size)!==blob.size)fail('Een cloudbestand heeft een onverwachte grootte.');
        payload.cloud.files.push({...f,file:await addFile(blob)});
      }
      // Validate referenced request photos even if Storage list silently omits them (RLS).
      for(const request of cloud.requests)for(const path of request.photo_paths||[]){
        if(!payload.cloud.files.some(f=>f.bucket==='jkworks-request-files'&&f.path===path))fail('Een aanvraagfoto ontbreekt in de bestandslijst.');
      }
      function checkReferences(v){
        if(v&&typeof v==='object'){
          if(v.__storagePath&&!payload.cloud.files.some(f=>f.bucket===(v.__bucket||'jkworks-files')&&f.path===v.__storagePath))fail('Een cloudbestandsverwijzing ontbreekt in de back-up.');
          for(const x of Object.values(v))checkReferences(x);
        }else if(typeof v==='string'&&v.includes('.supabase.co/storage/v1/object/')){
          let u;try{u=new URL(v);}catch{fail('Ongeldige cloudbestandsverwijzing.');}
          const match=u.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/(jkworks-[^/]+)\/(.+)$/);
          if(!match||u.origin!=='https://ercqiavruotoclhvfzud.supabase.co'||!payload.cloud.files.some(f=>f.bucket===match[1]&&f.path===decodeURIComponent(match[2])))fail('Een cloudafbeelding ontbreekt in de back-up.');
        }
      }
      checkReferences(cloud.records);checkReferences(cloud.requests);
      progress('Controleren of cloudgegevens tijdens de back-up gelijk bleven…');
      if(canonical(cloud)!==canonical(await JKCloud.readBackupSnapshot()))fail('Cloudgegevens zijn gewijzigd tijdens de back-up. Probeer later opnieuw.');
      payload.scope={cloudChecked:true,description:'Appgegevens en bestanden die met jouw sessie leesbaar zijn; geen volledige Supabase-database of Auth-back-up.'};
    }
    if(JKDB.snapshotKey(before)!==JKDB.snapshotKey(await JKDB.snapshot()))fail('Lokale gegevens zijn gewijzigd tijdens de back-up. Probeer opnieuw.');
    validateStores(payload.stores);
    payload.counts=counts(payload.stores);
    payload.integrity={algorithm:'SHA-256',sha256:await hash(new TextEncoder().encode(canonical(payload)))};
    progress('Bestanden en checksums controleren…');await validate(payload);
    return payload;
  }
  async function validate(payload){
    if(!payload||![FORMAT,'JKWORKS_BACKUP_V1','JKWORKS_BACKUP_V2'].includes(payload.format))fail('Onbekend back-upformaat.');
    validateStores(payload.stores);
    if(!Number.isFinite(Date.parse(payload.createdAt)))fail('Ongeldige back-updatum.');
    const modern=payload.format===FORMAT;
    if(modern){
      const {integrity,...body}=payload;
      if(integrity?.algorithm!=='SHA-256'||await hash(new TextEncoder().encode(canonical(body)))!==integrity.sha256)fail('Back-up beschadigd: checksum komt niet overeen.');
      if(!payload.files||!payload.scope||canonical(payload.counts)!==canonical(counts(payload.stores)))fail('Onvolledige back-up.');
      for(const [id,f] of Object.entries(payload.files)){
        const bytes=unbase64(f.data);
        if(f.bytes!==bytes.length||f.sha256!==id||await hash(bytes)!==id)fail('Een bestand is beschadigd of ontbreekt.');
      }
      if(payload.scope.cloudChecked){
        const c=payload.cloud;
        if(!c||typeof c.owner!=='string'||!c.owner||!['files','records','requests','deletions'].every(k=>Array.isArray(c[k])))fail('Cloudonderdelen ontbreken.');
        const paths=new Set();
        for(const f of c.files){
          if(!['jkworks-files','jkworks-request-files','jkworks-website-assets'].includes(f.bucket)||typeof f.path!=='string'||!f.path||!f.file?.__file||!payload.files[f.file.__file]||paths.has(f.bucket+'|'+f.path))fail('Cloudbestand ontbreekt of is ongeldig.');
          paths.add(f.bucket+'|'+f.path);
        }
        function refs(v){
          if(v&&typeof v==='object'){
            if(v.__storagePath&&!paths.has((v.__bucket||'jkworks-files')+'|'+v.__storagePath))fail('Een cloudbestand ontbreekt in de back-up.');
            for(const x of Object.values(v))refs(x);
          }
        }
        for(const r of c.records)if(!r.data?.__deleted)refs(r.data);
        for(const r of c.requests){
          if(r.photo_paths!=null&&!Array.isArray(r.photo_paths))fail('Ongeldige aanvraagbestanden.');
          for(const p of r.photo_paths||[])if(!paths.has('jkworks-request-files|'+p))fail('Een aanvraagfoto ontbreekt.');
        }
      }
    }
    async function decode(v){
      if(v&&typeof v==='object'&&v.__file){
        const f=payload.files?.[v.__file];if(!f)fail('Een bestand ontbreekt in de back-up.');
        const bytes=unbase64(f.data);
        return typeof v.name==='string'?new File([bytes],v.name,{type:v.type,lastModified:v.lastModified}):new Blob([bytes],{type:v.type});
      }
      if(v&&typeof v==='object'&&v.__blob){
        const match=typeof v.data==='string'&&v.data.match(/^data:([^;,]*);base64,(.*)$/s);
        if(!match)fail('Ongeldig bestand in oudere back-up.');
        return new Blob([unbase64(match[2])],{type:v.type||match[1]||'application/octet-stream'});
      }
      if(v&&typeof v==='object'&&v.__storagePath)fail('Back-up bevat alleen een cloudverwijzing, zonder het bestand.');
      if(Array.isArray(v))return Promise.all(v.map(decode));
      if(v&&typeof v==='object'){
        const out={};for(const [k,x] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))fail('Ongeldig gegevensveld.');out[k]=await decode(x);}return out;
      }
      return v;
    }
    const stores=await decode(payload.stores);
    for(const s of ['documents','jobPhotos'])for(const r of stores[s])if(!(r.blob instanceof Blob))fail('Een PDF of foto ontbreekt.');
    if(modern&&payload.cloud)for(const f of payload.cloud.files||[])await decode(f.file);
    stores.settings=stores.settings.filter(x=>!excludedSettings.has(x.id));
    return {payload,stores,counts:counts(stores),legacy:!modern};
  }
  async function key(password,salt){
    const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function pack(payload,password=''){
    const text=JSON.stringify(payload);if(new TextEncoder().encode(text).length>MAX_BYTES)fail('Back-up te groot voor deze browser.');
    if(!password)return new Blob([text],{type:'application/json'});
    if(password.length<12)fail('Gebruik een wachtwoord van minstens 12 tekens. Bewaar dit apart.');
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(password,salt),new TextEncoder().encode(text));
    const blob=new Blob([JSON.stringify({format:ENCRYPTED,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:base64(salt),iv:base64(iv),data:base64(new Uint8Array(data))})],{type:'application/json'});
    if(blob.size>MAX_BYTES)fail('Versleutelde back-up te groot voor deze browser.');
    return blob;
  }
  async function read(file,password=''){
    if(!file.size||file.size>MAX_BYTES)fail('Back-up leeg of te groot voor deze browser.');
    let p;try{p=JSON.parse(await file.text());}catch{fail('Dit bestand is geen geldige back-up.');}
    if(p?.format===ENCRYPTED){
      if(!password)fail('Vul het wachtwoord van deze back-up in.');
      if(p.kdf!=='PBKDF2-SHA256'||p.iterations!==ITERATIONS)fail('Onbekende versleuteling.');
      const salt=unbase64(p.salt),iv=unbase64(p.iv);if(salt.length!==16||iv.length!==12)fail('Ongeldige versleuteling.');
      try{p=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},await key(password,salt),unbase64(p.data))));}catch{fail('Wachtwoord onjuist of versleutelde back-up beschadigd.');}
    }
    return validate(p);
  }
  function filename(prefix='JK-Works-backup',date=new Date()){
    const pad=n=>String(n).padStart(2,'0');return `${prefix}-${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.jkbackup.json`;
  }
  async function download(blob,name){
    const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function restore(prepared,{confirm,safetyCopy,progress=()=>{}}){
    // Revalidate before confirmation; callers cannot bypass checks with a prepared object.
    const checked=await validate(prepared.payload);
    if(!await confirm(checked))return false;
    progress('Veiligheidskopie van de huidige lokale gegevens maken…');
    const expected=await JKDB.snapshot();
    const safety=await make({localOnly:true,purpose:'safety-before-restore',progress});
    if(!await safetyCopy(safety))return false;
    progress('Gecontroleerde gegevens in één lokale transactie herstellen…');
    await JKDB.replaceFromBackup(checked.stores,expected,{active:true,restoredAt:new Date().toISOString(),sourceCreatedAt:checked.payload.createdAt});
    return true;
  }
  return {make,validate,pack,read,restore,filename,download,counts};
})();
