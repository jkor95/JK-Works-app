// Runs the actual app, IndexedDB and forms with fictitious records only.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
module.exports=async(browser,origin)=>{
 const cloudSource=(await fs.readFile(path.join(__dirname,'../app/cloud.js'),'utf8')).replace('return {readBackupSnapshot,','return {encodeRecord,decodeRecord,readBackupSnapshot,');
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin===origin&&r.method()==='GET'){
   if(u.pathname==='/app/cloud.js')return route.fulfill({contentType:'application/javascript',body:cloudSource});
   if(u.pathname==='/app/app.js')return route.fulfill({contentType:'application/javascript',body:''});
   return route.continue();
  }
  if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+u.hostname);
  return route.fulfill({status:200,contentType:'application/javascript',body:''});
 });
 try{
  await page.goto(origin+'/app/',{waitUntil:'networkidle'});
  let source=await fs.readFile(path.join(__dirname,'../app/app.js'),'utf8');
  source=source.replace('return {init,go};','return {init,go,state,editJob,showJob,editTimeEntry,showTimeEntries,createBusinessDoc,renderJobs,renderDashboard,collectActionItems,jobWorkDays,jobMinutes,jobOwnAmount,jobPlannedMinutes,entryMinutes,jobHasEnded,jobCalendarIcs,periodBuckets,businessDescriptionForJob};').replace("document.addEventListener('DOMContentLoaded',()=>App.init());",'');
  await page.addScriptTag({content:source});
  await page.evaluate(async()=>{
   window.alerts=[];window.alert=x=>alerts.push(String(x));window.confirm=()=>true;
   JKCloud.isSignedIn=()=>false;window.JKCloud=JKCloud;JKCloud.queuePut=async()=>{};JKCloud.queueDelete=async()=>{};
   await JKDB.putLocal('settings',{id:'company',name:'Fictief',defaultRate:35,kor:true});
   await JKDB.putLocal('clients',{id:'fixture-client',name:'Fictieve klant'});
   await JKDB.putLocal('jobs',{id:'legacy',title:'Montage kast',clientId:'fixture-client',clientName:'Fictieve klant',date:'2026-10-19',startTime:'08:00',endTime:'16:30',hourlyRate:35,status:'gepland'});
   await JKDB.putLocal('timeEntries',{id:'legacy-manual',jobId:'legacy',date:'2026-10-19',from:'08:00',to:'16:30',note:'Bestaande handmatige uren'});
   await JKDB.putLocal('jobPhotos',{id:'fixture-photo',jobId:'legacy',phase:'before',blob:new Blob(['fixture'],{type:'image/jpeg'})});
   await JKDB.putLocal('documents',{id:'fixture-document',kind:'Factuur',meta:{jobId:'legacy',paid:true,lines:[{description:'Oorspronkelijke factuur',qty:1,price:10}]}});
   window.originalEntry=await JKDB.get('timeEntries','legacy-manual');
  });
  const count=()=>page.evaluate(()=>JKDB.all('jobs').then(x=>x.length));
  const saveJob=async()=>{await page.locator('#jobForm button.primary').click();await page.waitForFunction(()=>!document.querySelector('#jobForm'));};
  await page.evaluate(()=>App.editJob(null,{title:'Eén dag',clientId:'fixture-client'}));
  await page.locator('[name=dayStart]').fill('08:00');await page.locator('[name=dayEnd]').fill('16:30');await saveJob();
  assert.equal(await count(),2);
  assert.equal(await page.evaluate(()=>JKDB.all('timeEntries').then(x=>x.length)),1,'Planning maakt geen werkelijke uren');
  console.log('PASS: nieuwe eendaagse planning zonder automatische werkelijke uren');
  await page.evaluate(()=>App.editJob(null,{title:'Vijf werkdagen',clientId:'fixture-client'}));
  const dates=['2026-10-19','2026-10-21','2026-10-23','2026-10-27','2026-10-30'];
  for(let i=0;i<dates.length;i++){
   if(i)await page.locator('#addWorkDay').click();
   const row=page.locator('[data-workday]').nth(i);await row.locator('[name=dayDate]').fill(dates[i]);await row.locator('[name=dayStart]').fill('08:00');await row.locator('[name=dayEnd]').fill('16:30');
  }
  await saveJob();
  const job=await page.evaluate(()=>JKDB.all('jobs').then(x=>x.find(j=>j.title==='Vijf werkdagen')));
  assert.equal(job.workDays.length,5);assert.deepEqual(job.workDays.map(d=>d.date),dates);
  assert.equal(await page.evaluate(j=>App.jobPlannedMinutes(j),job),2550);
  await page.evaluate(()=>App.editJob('legacy'));await page.locator('#addWorkDay').click();
  await page.locator('[name=dayDate]').last().fill('2026-10-21');await saveJob();
  assert.equal(await page.evaluate(()=>JKDB.get('jobs','legacy').then(j=>j.workDays.length)),2);
  assert.equal(await page.evaluate(async()=>JSON.stringify(await JKDB.get('timeEntries','legacy-manual'))===JSON.stringify(originalEntry)),true);
  await page.evaluate(id=>App.editJob(id),job.id);
  await page.locator('[data-remove-day]').last().click();await page.locator('[name=dayStart]').first().fill('07:30');await saveJob();
  assert.equal(await page.evaluate(id=>JKDB.get('jobs',id).then(j=>j.workDays.length),job.id),4);
  console.log('PASS: vijf losse werkdagen; bestaande klus omzetten; werkdagen toevoegen, wijzigen en verwijderen zonder uurverlies');
  for(const [date,from,to,pause] of [['2026-10-19','08:00','17:00',30],['2026-10-21','09:00','17:00',0],['2026-10-23','08:00','14:00',0]]){
   await page.evaluate(({id,date})=>App.editTimeEntry(null,id,date,id),{id:job.id,date});
   await page.locator('[name=from]').fill(from);await page.locator('[name=to]').fill(to);await page.locator('[name=breakMinutes]').fill(String(pause));
   await page.locator('#timeForm button.primary').click();await page.waitForFunction(()=>!document.querySelector('#timeForm'));
  }
  assert.equal(await page.evaluate(async id=>App.jobMinutes(await JKDB.get('jobs',id),await JKDB.all('timeEntries')),job.id),1350);
  assert.equal(await page.evaluate(async id=>App.jobOwnAmount(await JKDB.get('jobs',id),await JKDB.all('timeEntries'),{}),job.id),787.5);
  assert.equal(await page.locator('.workday-summary').count(),4);
  await page.evaluate(id=>App.editTimeEntry(null,id,'2026-10-19'),job.id);await page.locator('[name=breakMinutes]').fill('60');await page.locator('#timeForm button.primary').click();await page.waitForFunction(()=>!document.querySelector('#timeForm'));
  assert.equal(await page.evaluate(async id=>App.jobMinutes(await JKDB.get('jobs',id),await JKDB.all('timeEntries')),job.id),1320);
  await page.evaluate(id=>App.editTimeEntry(null,id,'2026-10-19',id),job.id);await page.locator('[name=breakMinutes]').fill('30');await page.locator('#timeForm button.primary').click();await page.waitForFunction(()=>!document.querySelector('#timeForm'));

  assert.equal(await page.evaluate(()=>document.querySelector('.modal').scrollWidth<=document.querySelector('.modal').clientWidth+1),true,'iPhone modal zonder horizontale overflow');
  // Open the same day again: saves the existing record, never another copy.
  await page.evaluate(id=>App.editTimeEntry(null,id,'2026-10-19'),job.id);
  await page.locator('[name=note]').fill('Gewijzigd vanuit Urenregistratie');await page.locator('#timeForm button.primary').click();await page.waitForFunction(()=>!document.querySelector('#timeForm'));
  assert.equal(await page.evaluate(id=>JKDB.all('timeEntries').then(es=>es.filter(e=>e.jobId===id).length),job.id),3);
  await page.evaluate(id=>App.showJob(id),job.id);assert.ok((await page.locator('.workday-list').innerText()).includes('Gewijzigd vanuit Urenregistratie'));
  const amounts=await page.evaluate(async id=>{const j=await JKDB.get('jobs',id),es=await JKDB.all('timeEntries');return {actual:App.jobMinutes(j,[...es,...es]),planned:App.jobPlannedMinutes(j),done:App.jobHasEnded(j),minutes:App.entryMinutes({date:'2026-10-23',from:'22:00',to:'02:00',breakMinutes:30}),unconfirmed:App.entryMinutes({date:'2026-10-23',from:'08:00',to:'16:00',autoFromJobSchedule:true})};},job.id);
  assert.equal(amounts.actual,1350);assert.equal(amounts.done,false);assert.equal(amounts.minutes,210);assert.equal(amounts.unconfirmed,0);
  console.log('PASS: werkelijke uren, pauzes, €787,50, beide bewerkingsroutes, nachtwerk en deduplicatie; geen automatische afronding');
  await page.evaluate(id=>App.createBusinessDoc('Factuur',{jobId:id}),job.id);
  await page.waitForFunction(()=>document.querySelector('[name=qty0]')?.value==='22,5');
  assert.equal(await page.locator('[name=price0]').inputValue(),'35');assert.equal(await page.locator('[name=desc0]').inputValue(),'Vijf werkdagen');
  assert.equal(await page.locator('[name=qty1]').inputValue(),'');
  await page.locator('[name=qty0]').fill('20');await page.locator('[name=price0]').fill('40');await page.locator('[name=desc0]').fill('Eigen omschrijving');
  assert.equal(await page.locator('[name=qty0]').inputValue(),'20');
  await page.locator('#docKor').uncheck();assert.match(await page.locator('#grandTotal').innerText(),/968,00/);
  await page.locator('#docKor').check();assert.match(await page.locator('#grandTotal').innerText(),/800,00/);
  await page.evaluate(id=>App.createBusinessDoc('Offerte',{jobId:id}),job.id);
  assert.equal(await page.locator('[name=qty0]').inputValue(),String(Math.round(amounts.planned/60*100)/100).replace('.',','));
  assert.match(await page.locator('#jobHoursBasis').innerText(),/Ureninschatting/);
  await page.locator('#docKor').uncheck();assert.equal(await page.locator('#docKor').isChecked(),false);
  const ics=await page.evaluate(async id=>App.jobCalendarIcs(await JKDB.get('jobs',id)),job.id);
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,4);assert.match(ics,/DTSTART:20261019T053000Z/);assert.doesNotMatch(ics,/\.\d{3}Z/);
  console.log('PASS: factuur met één regel en handmatige aanpassingen, offerte-inschatting, btw-keuze en ICS met alle werkdagen');
  await page.evaluate(async id=>{const j=await JKDB.get('jobs',id);j.workDays.push({date:'2020-01-01',startTime:'08:00',endTime:'16:00'});await JKDB.put('jobs',j);},job.id);
  const encoded=await page.evaluate(async id=>({job:await JKCloud.encodeRecord('jobs',await JKDB.get('jobs',id)),entries:await Promise.all((await JKDB.all('timeEntries')).filter(e=>e.jobId===id).map(e=>JKCloud.encodeRecord('timeEntries',e)))}),job.id);
  const remoteContext=await browser.newContext({serviceWorkers:'block'});
  try{
   await remoteContext.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin&&route.request().method()==='GET'){if(u.pathname==='/app/app.js')return route.fulfill({contentType:'application/javascript',body:''});if(u.pathname==='/app/cloud.js')return route.fulfill({contentType:'application/javascript',body:cloudSource});return route.continue();}return route.fulfill({status:200,body:''});});
   const remote=await remoteContext.newPage();await remote.goto(origin+'/app/',{waitUntil:'networkidle'});await remote.addScriptTag({content:source});
   const roundtrip=await remote.evaluate(async data=>{await JKDB.putLocal('jobs',await JKCloud.decodeRecord(data.job));for(const e of data.entries)await JKDB.putLocal('timeEntries',await JKCloud.decodeRecord(e));const j=await JKDB.get('jobs',data.job.id);const es=await JKDB.all('timeEntries');if(App.jobMinutes(j,es)!==1350||j.workDays.length!==5)throw Error('Sync-fixture verliest planning of uren');es[0].note='Ander apparaat';await JKDB.putLocal('timeEntries',es[0]);return JKCloud.encodeRecord('timeEntries',es[0]);},JSON.parse(JSON.stringify(encoded)));
   await page.evaluate(async data=>JKDB.putLocal('timeEntries',await JKCloud.decodeRecord(data)),JSON.parse(JSON.stringify(roundtrip)));
   assert.equal(await page.evaluate(id=>JKDB.get('timeEntries',id).then(e=>e.note),roundtrip.id),'Ander apparaat');
  }finally{await remoteContext.close();}
  const statistics=await page.evaluate(async()=>App.periodBuckets(await JKDB.all('timeEntries'),await JKDB.all('jobs'),{},'month'));
  assert.equal(statistics.reduce((n,b)=>n+b.minutes,0),1860);
  assert.equal(await page.evaluate(()=>App.businessDescriptionForJob({title:'Keuken monteren'},'Factuur')),'Montagewerkzaamheden');
  console.log('PASS: synchronisatieformaat heen en terug tussen geïsoleerde apparaten, urenstatistieken en werkzaamhedenherkenning');
  const actions=await page.evaluate(()=>App.collectActionItems());assert.ok(actions.some(a=>a.type==='hours'&&a.jobId===job.id));assert.ok(!actions.some(a=>a.type==='invoiceCreate'&&a.jobId===job.id));
  await page.evaluate(()=>App.renderDashboard());await page.evaluate(()=>App.renderJobs());
  assert.equal(await page.locator(`[data-job="${job.id}"]`).count(),1);
  assert.equal(await page.evaluate(()=>JKDB.get('documents','fixture-document').then(d=>d.meta.lines[0].description)),'Oorspronkelijke factuur');
  assert.equal(await page.evaluate(()=>JKDB.all('jobPhotos').then(x=>x.length)),1);
  const edge=await fs.readFile(path.join(__dirname,'../supabase/functions/jk-push/index.ts'),'utf8');
  const scope={Date,Intl};vm.runInNewContext(stripTypeScriptTypes(edge.slice(edge.indexOf('const folder='),edge.indexOf('const DURATION_MS:')))+';globalThis.actions=actionsFor;',scope);
  const records=[{store:'jobs',data:{id:'fixture',title:'Montage',status:'gepland',date:'2020-01-01',startTime:'08:00',endTime:'16:00',workDays:[{date:'2020-01-01',startTime:'08:00',endTime:'16:00'},{date:'2999-01-01',startTime:'08:00',endTime:'16:00'}]}}];
  assert.ok(scope.actions(records).some(a=>a.key==='hours:fixture'));assert.ok(!scope.actions(records).some(a=>a.key==='invoiceCreate:fixture'));
  records.push({store:'timeEntries',data:{id:'worked',jobId:'fixture',date:'2020-01-01',from:'08:00',to:'16:00',actualConfirmed:true}});
  assert.ok(!scope.actions(records).some(a=>a.key==='hours:fixture'));
  records[0].data.status='afgerond';assert.ok(scope.actions(records).some(a=>a.key==='invoiceCreate:fixture'));
  console.log('PASS: bestaande Edge-pushplanning herkent losse werkdagen en werkelijke uren; factuuractie pas na expliciete afronding');
  await page.evaluate(id=>App.editJob(id),job.id);
  await page.locator('[data-workday]:has([name=dayDate][value="2026-10-21"]) [data-remove-day]').click();await saveJob();
  assert.equal(await page.evaluate(id=>JKDB.all('timeEntries').then(es=>es.filter(e=>e.jobId===id).length),job.id),3,'Verwijderde planning wist geen werkelijke uren');
  assert.equal(await page.evaluate(async id=>App.jobMinutes(await JKDB.get('jobs',id),await JKDB.all('timeEntries')),job.id),1350);
  const singleId=await page.evaluate(()=>JKDB.all('jobs').then(js=>js.find(j=>j.title==='Eén dag').id));
  const enterExtra=async()=>{await page.evaluate(id=>App.editTimeEntry(null,id,'2026-11-01'),singleId);await page.locator('[name=from]').fill('08:00');await page.locator('[name=to]').fill('09:00');await page.locator('#timeForm button.primary').click();await page.waitForFunction(()=>!document.querySelector('#timeForm'));};
  await enterExtra();
  const removed=await page.evaluate(id=>JKDB.all('timeEntries').then(es=>es.find(e=>e.jobId===id).id),singleId);
  await page.evaluate(id=>App.editTimeEntry(id),removed);await page.locator('#delTime').click();await page.waitForFunction(()=>!document.querySelector('#timeForm'));
  await enterExtra();
  const recreated=await page.evaluate(id=>JKDB.all('timeEntries').then(es=>es.find(e=>e.jobId===id).id),singleId);assert.notEqual(recreated,removed);
  assert.equal(await page.evaluate(id=>JKDB.isDeletedLocal('timeEntries',id),removed),true);
  await page.evaluate(id=>App.editTimeEntry(id),recreated);await page.locator('[name=date]').fill('2026-11-02');await page.locator('#timeForm button.primary').click();await page.waitForFunction(()=>!document.querySelector('#timeForm'));
  await enterExtra();assert.equal(await page.evaluate(id=>JKDB.all('timeEntries').then(es=>es.filter(e=>e.jobId===id).length),singleId),2);
  console.log('PASS: verwijderen/herinvoeren respecteert sync-verwijdermarkeringen; verplaatsen overschrijft geen andere werkdag');
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log('PASS: dagherinnering zonder voortijdige factuuractie, dashboard en één klusrij; bestaande foto, factuur en handmatige uren behouden');
 }finally{await context.close();}
};
