// Exercises the real browser modules with a wholly fictitious Supabase client.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async(browser,origin)=>{
  const context=await browser.newContext({serviceWorkers:'block'}), requests=[];
  await context.route('**/*',async route=>{
    const r=route.request(),u=new URL(r.url());
    if(u.origin===origin&&['GET','HEAD'].includes(r.method())){
      if(u.pathname==='/app/app.js')return route.fulfill({contentType:'application/javascript',body:''});
      return route.continue();
    }
    // External assets are stubbed; no production request, including reads, can escape.
    requests.push(r.method()+' '+u.hostname);
    return route.fulfill({status:200,contentType:'application/javascript',body:''});
  });
  const page=await context.newPage();
  try{
    await page.goto(origin+'/app/',{waitUntil:'networkidle'});
    await page.evaluate(async()=>{
      window.fixture={writes:0,failCloud:false,failDownload:false,readCount:0,mutateCloud:false};
      const pdf=new Blob(['%PDF-1.4\nfixture invoice'],{type:'application/pdf'}),photo=new File([new Uint8Array([255,216,255,217])],'origineel.jpg',{type:'image/jpeg',lastModified:1700000000000});
      const records=[{store:'clients',record_id:'cloud-client',data:{id:'cloud-client',name:'Cloud fixture'},updated_at:'2026-10-10T10:00:00Z'},
        {store:'documents',record_id:'cloud-doc',data:{id:'cloud-doc',filename:'cloud.pdf',kind:'Factuur',blob:{__storagePath:'owner/cloud.pdf',__mime:'application/pdf'},meta:{paid:true,sent:true}},updated_at:'2026-10-10T10:00:00Z'},
        {store:'websitePublic',record_id:'main',data:{id:'main',siteImages:{hero:'https://ercqiavruotoclhvfzud.supabase.co/storage/v1/object/public/jkworks-website-assets/owner/hero.jpg'}},updated_at:'2026-10-10T10:00:00Z'}];
      const files={'jkworks-files':{'owner/cloud.pdf':pdf,'owner/orphan.pdf':pdf},'jkworks-request-files':{'owner/request.jpg':photo},'jkworks-website-assets':{'owner/hero.jpg':photo}};
      fixture.records=records;fixture.files=files;
      window.supabase={createClient:()=>({
        auth:{getSession:async()=>({data:{session:{user:{id:'fixture-owner',email:'fixture@example.invalid'}}}}),onAuthStateChange:()=>{},signInWithPassword:async()=>({data:{session:{user:{id:'fixture-owner'}}}})},
        from:table=>{
          const q={select:()=>q,eq:()=>q,order:()=>q,range:async(first,last)=>{
            fixture.readCount++;
            if(fixture.failCloud)return {error:{message:'sensitive fixture detail must not escape'}};
            let data=table==='app_records'?records:table==='app_deletions'?[]:[{id:'request',photo_paths:['owner/request.jpg'],status:'new'}];
            if(fixture.mutateCloud)data=[...data,{id:'changed',store:'clients',record_id:'changed',data:{id:'changed'},updated_at:new Date().toISOString()}];
            return {data:structuredClone(data.slice(first,Math.min(last+1,first+(fixture.smallPages?100:500)))),count:data.length};
          },then:resolve=>resolve({data:table==='app_records'?structuredClone(records):[],error:null}),
          upsert:()=>{fixture.writes++;if(fixture.allowSync)return Promise.resolve({error:null});throw Error('Unexpected write');},delete:()=>{fixture.writes++;throw Error('Unexpected delete');},update:()=>{fixture.writes++;throw Error('Unexpected update');}};return q;
        },
        storage:{from:bucket=>({list:async(prefix,{offset,limit})=>{
          if(fixture.failCloud)return {error:{}};
          let data=!prefix?[{name:'owner',id:null}]:Object.entries(files[bucket]).map(([p,b])=>({name:p.split('/').pop(),id:p,metadata:{size:b.size},updated_at:'2026-10-10T10:00:00Z'}));
          return {data:data.slice(offset,offset+limit)};
        },download:async p=>fixture.failDownload?{error:{}}:{data:files[bucket][p]},upload:()=>{fixture.writes++;if(fixture.allowSync)return Promise.resolve({error:null});throw Error('Unexpected upload');},remove:()=>{fixture.writes++;throw Error('Unexpected removal');}})}
      })};
      await JKCloud.init();
      for(const s of JKDB.stores)await JKDB.clear(s);
      await JKDB.putLocal('settings',{id:'seedVersion',value:6});
      await JKDB.putLocal('settings',{id:'company',companyName:'Fictieve JK Works',defaultRate:42});
      await JKDB.putLocal('settings',{id:'notifications',badges:false});
      await JKDB.putLocal('clients',{id:'local-client',name:'Local fixture',email:'fixture@example.invalid'});
      await JKDB.putLocal('jobs',{id:'job',title:'Fixture klus',pricingType:'fixed',agreedAmount:150,extraIncluded:true,clientId:'local-client',materials:[{name:'hout',amount:2}]});
      await JKDB.putLocal('timeEntries',{id:'hours',jobId:'job',minutes:60,rate:42,actualConfirmed:true,autoFromJobSchedule:true});
      await JKDB.putLocal('documents',{id:'local-doc',filename:'fixture.pdf',kind:'Offerte',blob:pdf,meta:{paid:false,confirmed:true}});
      await JKDB.putLocal('jobPhotos',{id:'photo',jobId:'job',blob:photo,name:photo.name,originalSize:photo.size});
      await JKDB.putLocal('expenses',{id:'receipt',amountIncl:12,receiptBlob:pdf});
      await JKDB.putLocal('tools',{id:'tool',name:'Fictief gereedschap',serial:'test'});
      await JKDB.putLocal('mboxes',{id:'box',name:'Test Mbox',items:['tool'],checked:{tool:true}});
      await JKDB.putLocal('checklists',{id:'check',items:['Test'],checked:{Test:true}});
      await JKDB.putLocal('settings',{id:'fixture-payment',kind:'jkPayment',jobId:'job',amount:100,date:'2026-10-10',method:'bank'});
      fixture.before=await JKDB.snapshot();fixture.backup=await JKCloud.withBackupRead(()=>JKBackup.make());
    });
    const results=await page.evaluate(async()=>{
      const passed=[];
      const check=(condition,label)=>{if(!condition)throw Error('Fixture assertion: '+label);passed.push(label);};
      const rejects=async(action,label)=>{let rejected=false;try{await action();}catch{rejected=true;}check(rejected,label);};
      check(JKDB.snapshotKey(fixture.before)===JKDB.snapshotKey(await JKDB.snapshot()),'Export wijzigt geen gegevens of syncwachtrij');
      check(fixture.writes===0,'Cloud uitsluitend gelezen');
      check(fixture.backup.scope.cloudChecked&&fixture.backup.counts.clients===2&&fixture.backup.counts.documents===2,'Lokale en uitsluitend in cloud aanwezige records gecombineerd');
      check(fixture.backup.cloud.files.length===4,'Alle drie Storage-buckets inclusief los bestand meegenomen');
      const validated=await JKBackup.validate(fixture.backup);
      check(validated.stores.settings.find(r=>r.id==='fixture-payment')?.amount===100&&validated.stores.jobs.find(r=>r.id==='job')?.agreedAmount===150&&validated.stores.timeEntries.find(r=>r.id==='hours')?.actualConfirmed===true,'Prijsafspraak, deelbetaling en bevestigde uren in herstelkopie behouden');
      check(validated.stores.documents.find(r=>r.id==='cloud-doc').blob instanceof Blob,'Cloud-PDF ingebed');
      check(validated.stores.jobPhotos[0].blob instanceof File&&validated.stores.jobPhotos[0].blob.name==='origineel.jpg'&&validated.stores.jobPhotos[0].blob.lastModified===1700000000000,'Originele bestandsmetadata behouden waar aanwezig');
      const password=crypto.randomUUID()+crypto.randomUUID();
      const encrypted=await JKBackup.pack(fixture.backup,password);
      check(!(await encrypted.text()).includes('Local fixture'),'Versleutelde inhoud onleesbaar');
      const opened=await JKBackup.read(encrypted,password);
      check(opened.counts.photos===1,'AES-GCM/PBKDF2 ontsleuteling');
      await rejects(()=>JKBackup.read(encrypted,crypto.randomUUID()),'Verkeerd wachtwoord afgewezen');
      const corrupt=structuredClone(fixture.backup);corrupt.stores.clients[0].name='changed';
      await rejects(()=>JKBackup.validate(corrupt),'Metadata-checksum herkent beschadiging');
      const missing=structuredClone(fixture.backup);delete missing.files[Object.keys(missing.files)[0]];
      await rejects(()=>JKBackup.validate(missing),'Ontbrekend bestand afgewezen');
      const incomplete=structuredClone(fixture.backup);delete incomplete.stores.jobs;
      await rejects(()=>JKBackup.validate(incomplete),'Ontbrekend apponderdeel afgewezen');
      const fileCorrupt=structuredClone(fixture.backup);fileCorrupt.files[Object.keys(fileCorrupt.files)[0]].data=btoa('broken');
      await rejects(()=>JKBackup.validate(fileCorrupt),'Beschadigde bestandsinhoud afgewezen');
      fixture.failCloud=true;
      await rejects(()=>JKBackup.make(),'Cloudstoring geeft geen volledige back-up');
      const local=await JKBackup.make({localOnly:true});check(!local.scope.cloudChecked&&local.counts.clients===1,'Offline lokale kopie expliciet onvolledig voor cloud');
      fixture.failCloud=false;fixture.failDownload=true;
      await rejects(()=>JKBackup.make(),'Ontbrekende cloud-PDF voorkomt succes');fixture.failDownload=false;
      const beforeCancel=JKDB.snapshotKey(await JKDB.snapshot());
      check(!await JKBackup.restore(opened,{confirm:async()=>false,safetyCopy:async()=>{throw Error('must not run');}}),'Herstel vraagt bevestiging');
      check(beforeCancel===JKDB.snapshotKey(await JKDB.snapshot()),'Annuleren behoudt bestaande gegevens');
      check(!await JKBackup.restore(opened,{confirm:async()=>true,safetyCopy:async()=>false}),'Herstel stopt zonder bewaarde veiligheidskopie');
      check(beforeCancel===JKDB.snapshotKey(await JKDB.snapshot()),'Afgebroken veiligheidskopie behoudt gegevens');
      await rejects(()=>JKBackup.restore(opened,{confirm:async()=>true,safetyCopy:async()=>{await JKDB.putLocal('clients',{id:'new-during-restore',name:'Behouden'});return true;}}),'Wijziging tijdens herstel blokkeert overschrijven');
      check(!!await JKDB.get('clients','new-during-restore'),'Gelijktijdige nieuwe gegevens behouden');
      let safety;
      check(await JKBackup.restore(opened,{confirm:async()=>true,safetyCopy:async p=>{safety=p;await JKBackup.read(await JKBackup.pack(p));return true;}}),'Volledig gecontroleerd lokaal herstel');
      check(safety.purpose==='safety-before-restore'&&safety.stores.clients.some(x=>x.id==='new-during-restore'),'Veiligheidskopie bevat huidige lokale gegevens');
      check((await JKDB.get('settings','fixture-payment'))?.amount===100&&(await JKDB.get('jobs','job'))?.pricingType==='fixed'&&(await JKDB.get('timeEntries','hours'))?.actualConfirmed===true,'Prijsafspraak, deelbetaling en bevestigde uren werkelijk hersteld');
      check((await JKDB.all('clients')).length===2&&(await JKDB.get('documents','cloud-doc')).meta.paid===true,'Klanten en betaalstatus hersteld');
      check(await (await JKDB.get('documents','local-doc')).blob.text()==='%PDF-1.4\nfixture invoice','PDF exact hersteld');
      check((await JKDB.get('jobPhotos','photo')).blob.size===4,'Foto exact hersteld');
      check((await JKDB.get('tools','tool')).serial==='test'&&(await JKDB.get('checklists','check')).checked.Test,'Materiaal en checklists hersteld');
      check((await JKDB.get('settings','notifications')).badges===false,'Voorkeuren hersteld');
      await rejects(()=>JKCloud.syncNow(),'Oude back-up niet overschreven door sync');
      await rejects(()=>JKCloud.pruneCloudToLocal(),'Cloudopschoning geblokkeerd na herstel');
      await JKCloud.init();await rejects(()=>JKCloud.syncNow(),'Herstelbescherming overleeft opnieuw initialiseren');
      check(fixture.writes===0,'Herstel schrijft nooit naar productie of cloud');
      const legacy={format:'JKWORKS_BACKUP_V2',createdAt:'2026-10-11T12:00:00Z',stores:{}};
      for(const s of JKDB.stores)legacy.stores[s]=[];
      legacy.stores.clients=[{id:'legacy',name:'Older fixture'}];
      legacy.stores.documents=[{id:'legacy-pdf',blob:{__blob:true,type:'application/pdf',data:'data:application/pdf;base64,'+btoa('%PDF-1.4 fixture legacy')}}];
      const older=await JKBackup.read(new Blob([JSON.stringify(legacy)]));
      check(older.legacy&&older.stores.documents[0].blob instanceof Blob,'JKWORKS_BACKUP_V2 van 11 oktober ondersteund met fixture');
      check(await JKBackup.restore(older,{confirm:async()=>true,safetyCopy:async()=>true}),'Oudere V2-back-up lokaal hersteld');
      const brokenLegacy=structuredClone(legacy);delete brokenLegacy.stores.timeEntries;
      await rejects(()=>JKBackup.read(new Blob([JSON.stringify(brokenLegacy)])),'Onvolledige oudere back-up afgewezen zonder leegmaken');
      const refs=structuredClone(legacy);refs.stores.documents[0].blob={__storagePath:'owner/missing.pdf'};
      await rejects(()=>JKBackup.read(new Blob([JSON.stringify(refs)])),'Losse cloudverwijzing is geen bestand');
      const savedRecords=structuredClone(fixture.records);
      for(let i=0;i<501;i++)fixture.records.push({store:'clients',record_id:'paged-'+i,data:{id:'paged-'+i,name:'Paged fixture'},updated_at:'2026-10-10T10:00:00Z'});
      fixture.smallPages=true;
      const paged=await JKBackup.make();check(paged.counts.clients===503,'Gepagineerde cloudrecords volledig gelezen, ook met kleinere serverlimiet');
      fixture.records.splice(0,fixture.records.length,...savedRecords);fixture.smallPages=false;
      await rejects(()=>JKBackup.make({progress:message=>{if(message.startsWith('Controleren of cloud'))fixture.mutateCloud=true;}}),'Gelijktijdige cloudwijziging voorkomt volledigheidsclaim');fixture.mutateCloud=false;
      // Restore protection is deliberately lifted ONLY in this fictitious test account.
      await JKDB.removeLocal('settings','backupRestoreGuard');fixture.allowSync=true;
      await JKCloud.syncNow();
      check((await JKDB.get('documents','cloud-doc')).blob instanceof Blob&&!!(await JKDB.get('settings','cloudStatus')).lastSync&&fixture.writes>0,'Bestaande handmatige sync werkt buiten beschermd herstel met fictieve uploads');
      fixture.allowSync=false;
      await JKDB.putLocal('settings',{id:'backupRestoreGuard',active:true});
      return passed;
    });
    for(const result of results)console.log('PASS: '+result);
    // Real app UI in the same isolated fixture account; DOMContentLoaded is suppressed.
    const app=await fs.readFile(path.join(__dirname,'../app/app.js'),'utf8');
    await page.addScriptTag({content:app.replace("document.addEventListener('DOMContentLoaded',()=>App.init());",'')});
    await page.evaluate(()=>App.init());
    for(const route of ['dashboard','jobs','gear','documents','more']){
      await page.evaluate(route=>App.go(route),route);assert.ok(await page.locator('#view').textContent());
    }
    await page.locator('#backupMenu').click();
    await page.locator('#exportBackup').waitFor();
    assert.match(await page.locator('#modalRoot').textContent(),/Herstelkopie beschermd/);
    assert.equal(await page.locator('#backupPasswords').isVisible(),false);
    await page.locator('#backupEncrypt').check();
    assert.equal(await page.locator('#backupPasswords').isVisible(),true);
    const download=page.waitForEvent('download');
    await page.locator('#backupEncrypt').uncheck();
    await page.locator('#exportBackup').click();
    const exported=await download;
    assert.match(exported.suggestedFilename(),/^JK-Works-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.jkbackup\.json$/);
    await page.locator('#shareBackup').waitFor();
    assert.match(await page.locator('#backupProgress').textContent(),/gecontroleerd/);
    for(const size of [{width:390,height:844},{width:768,height:1024},{width:1280,height:900}]){
      await page.setViewportSize(size);
      assert.equal(await page.locator('#exportBackup').isVisible(),true);
      assert.equal(await page.locator('#importBackup').isVisible(),true);
      assert.equal(await page.locator('.modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    }
    // The actual file picker, preview confirmations and safety download must work.
    const restoreInput=await page.evaluate(async()=>JSON.stringify(await JKBackup.make({localOnly:true})));
    let confirmations=0;page.on('dialog',async dialog=>{assert.equal(dialog.type(),'confirm');confirmations++;await dialog.accept();});
    const safetyDownload=page.waitForEvent('download');
    await page.locator('#hiddenBackupInput').setInputFiles({name:'fixture.jkbackup.json',mimeType:'application/json',buffer:Buffer.from(restoreInput)});
    assert.match((await safetyDownload).suggestedFilename(),/JK-Works-veiligheidskopie-/);
    await page.waitForFunction(()=>document.querySelector('#backupProgress')?.textContent.includes('lokaal hersteld'));
    assert.equal(confirmations,2);
    // Simulate a quota/clone failure after clears: the IndexedDB transaction must roll back.
    assert.equal(await page.evaluate(async()=>{
      const before=await JKDB.snapshot(),bad=structuredClone(before);bad.clients=[{id:'valid-before-failure'},{id:'invalid-clone',fn:()=>{}}];
      let failed=false;try{await JKDB.replaceFromBackup(bad,before,{active:true});}catch{failed=true;}
      return failed&&JKDB.snapshotKey(before)===JKDB.snapshotKey(await JKDB.snapshot());
    }),true);
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.evaluate(()=>JKCloud.restoreProtected()),true);
    const other=await context.newPage();await other.goto(origin+'/app/',{waitUntil:'networkidle'});
    await other.evaluate(()=>{window.hold=navigator.locks.request('jkworks-data-operation',()=>new Promise(resolve=>{window.releaseFixtureLock=resolve;}));});
    await other.waitForFunction(()=>!!window.releaseFixtureLock);
    assert.equal(await page.evaluate(async()=>{try{await JKCloud.withBackupRead(()=>Promise.resolve());return false;}catch{return true;}}),true);
    await other.evaluate(()=>window.releaseFixtureLock());await other.close();
    assert.ok(requests.every(x=>x.startsWith('GET ')), 'No outgoing mutation even to fixtures');
    console.log(`PASS: ${results.length} back-up-/herstelcontroles; appnavigatie, echte download/herstelbediening, mobiel/tablet/desktop-layout, tab-lock en atomaire rollback`);
  }finally{await context.close();}
};
