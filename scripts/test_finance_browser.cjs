// Actual forms, PDF templates, IndexedDB, sync serialization and backups; fictitious data only.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async(browser,origin)=>{
 const root=path.join(__dirname,'..'),cloudSource=(await fs.readFile(path.join(root,'app/cloud.js'),'utf8')).replace('return {readBackupSnapshot,','return {encodeRecord,decodeRecord,readBackupSnapshot,');
 const source=(await fs.readFile(path.join(root,'app/app.js'),'utf8')).replace('return {init,go};','return {init,go,state,editJob,showJob,showDocument,showPayments,renderJobs,renderDashboard,refreshFinance,jobMinutes,jobFinancial,periodBuckets,customerStatBuckets,showClientHistory,showTimeStats,generateAnnualInvoiceReport,createBusinessDoc,setInvoiceJobLink};').replace("document.addEventListener('DOMContentLoaded',()=>App.init());",'');
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],writes=[];
 page.setDefaultTimeout(15000);
 await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin===origin&&r.method()==='GET'){
   if(u.pathname==='/app/app.js')return route.fulfill({contentType:'application/javascript',body:''});
   if(u.pathname==='/app/cloud.js')return route.fulfill({contentType:'application/javascript',body:cloudSource});
   return route.continue();
  }
  if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+u.hostname);
  return route.fulfill({status:200,contentType:'application/javascript',body:''});
 });
 try{
  await page.goto(origin+'/app/',{waitUntil:'networkidle'});
  await page.addScriptTag({content:await fs.readFile(require.resolve('pdf-lib/dist/pdf-lib.min.js'),'utf8')});
  await page.addScriptTag({content:source});
  await page.evaluate(async()=>{
   document.querySelector('#appShell').hidden=false;document.querySelector('#authGate').hidden=true;document.body.classList.remove('auth-locked');
   window.alerts=[];window.alert=x=>alerts.push(String(x));window.confirm=()=>true;window.JKCloud=JKCloud;JKCloud.isSignedIn=()=>false;JKCloud.queuePut=async()=>{};JKCloud.queueDelete=async()=>{};
   const year=new Date().getFullYear();window.fixtureYear=year;
   await JKDB.putLocal('settings',{id:'company',defaultRate:10,kor:true});
   await JKDB.putLocal('clients',{id:'client',name:'Fictieve klant'});
   await JKDB.putLocal('jobs',{id:'fixed',title:'Montage kast',clientId:'client',clientName:'Fictieve klant',date:`${year}-01-15`,startTime:'08:00',endTime:'17:00',hourlyRate:10,pricingType:'fixed',agreedAmount:150,status:'afgerond'});
   await JKDB.putLocal('timeEntries',{id:'confirmed',jobId:'fixed',date:`${year}-01-15`,from:'08:00',to:'17:00',actualConfirmed:true,autoFromJobSchedule:true});
   await JKDB.putLocal('timeEntries',{id:'manual',jobId:'fixed',date:`${year}-01-16`,from:'08:00',to:'16:00',note:'Handmatig bewaard'});
   await JKDB.putLocal('timeEntries',{id:'not-confirmed',jobId:'fixed',date:`${year}-01-17`,from:'08:00',to:'16:00',autoFromJobSchedule:true,actualConfirmed:false});
   await JKDB.putLocal('jobs',{id:'legacy',title:'Bestaande klus',clientId:'client',clientName:'Fictieve klant',date:`${year}-01-01`,hourlyRate:10,paymentPaid:true});
   await JKDB.putLocal('timeEntries',{id:'old-hours',jobId:'legacy',date:`${year}-01-01`,from:'08:00',to:'18:00',actualConfirmed:true});
   window.originalHours=JSON.stringify(await JKDB.all('timeEntries'));
  });
  const metrics=()=>page.evaluate(async()=>{const f=await App.refreshFinance();return {...f.job(await JKDB.get('jobs','fixed')),minutes:App.jobMinutes(await JKDB.get('jobs','fixed'),await JKDB.all('timeEntries'))};});
  let m=await metrics();assert.equal(m.minutes,1020);assert.equal(m.hoursValue,170);assert.equal(m.agreed,150);assert.equal(m.open,150);
  await page.evaluate(()=>App.showJob('fixed'));assert.match(await page.locator('#modalRoot').innerText(),/8,82/);
  assert.equal(await page.evaluate(()=>document.querySelector('.modal').scrollWidth<=document.querySelector('.modal').clientWidth+1),true);
  await page.locator('#paymentsThisJob').click();await page.locator('#addPayment').click();
  await page.locator('[name=amount]').fill('100');await page.locator('[name=date]').fill(`${await page.evaluate(()=>fixtureYear)}-02-10`);await page.locator('[name=method]').selectOption('bank');
  await page.evaluate(()=>{const f=document.querySelector('#paymentForm');f.requestSubmit();f.requestSubmit();});await page.waitForFunction(()=>!document.querySelector('#paymentForm'));
  m=await metrics();assert.equal(m.received,100);assert.equal(m.open,50);assert.equal(m.paid,false);
  await page.evaluate(()=>App.renderDashboard());assert.match(await page.locator('#dashOpenPayments').innerText(),/50,00/);assert.match(await page.locator('#view').innerText(),/Ontvangen/);
  await page.evaluate(()=>App.createBusinessDoc('Factuur',{jobId:'fixed'}));
  assert.equal(await page.locator('[name=qty0]').inputValue(),'1');assert.equal(await page.locator('[name=price0]').inputValue(),'150');assert.equal(await page.locator('[name=desc0]').inputValue(),'Montagewerkzaamheden');
  await page.locator('#businessDocForm button.primary').last().click();await page.waitForFunction(()=>document.querySelector('#documentPayments'));
  const invoice=await page.evaluate(()=>JKDB.all('documents').then(ds=>ds.find(d=>d.meta?.jobId==='fixed')));
  assert.equal(invoice.meta.total,150);assert.equal(invoice.meta.paid,false);assert.equal(invoice.meta.lines.filter(l=>l.description||l.qty||l.price).length,1);assert.equal(Number(invoice.meta.lines[0].qty),1);assert.equal(Number(invoice.meta.lines[0].price),150);
  assert.equal(await page.evaluate(async id=>(await JKDB.get('documents',id)).blob.size>1000,invoice.id),true);
  await page.locator('#documentPayments').click();await page.locator('[data-edit-payment]').first().waitFor();assert.equal(await page.locator('[data-edit-payment]').count(),1);
  await page.locator('[data-edit-payment]').click();await page.locator('[name=amount]').fill('150');
  await page.locator('[name=invoiceId]').selectOption(invoice.id);await page.locator('#paymentForm button.primary').click();await page.waitForFunction(()=>!document.querySelector('#paymentForm'));
  m=await metrics();assert.equal(m.received,150);assert.equal(m.open,0);assert.equal(m.paid,true);
  assert.equal(await page.evaluate(id=>JKDB.get('documents',id).then(d=>d.meta.paid),invoice.id),true);
  await page.evaluate(()=>App.showPayments('fixed'));await page.locator('[data-edit-payment]').click();await page.locator('[name=amount]').fill('100');await page.locator('#paymentForm button.primary').click();await page.waitForFunction(()=>!document.querySelector('#paymentForm'));
  assert.equal((await metrics()).open,50);assert.equal(await page.evaluate(id=>JKDB.get('documents',id).then(d=>d.meta.paid),invoice.id),false);
  assert.equal(await page.evaluate(()=>JKDB.all('settings').then(rs=>rs.filter(r=>r.kind==='jkPayment'&&!r.legacy&&!r.voided).length)),1,'Both routes edit the same payment');
  const invoiceBefore=await page.evaluate(id=>JKDB.get('documents',id).then(d=>JSON.stringify(d.meta)),invoice.id);
  const saveJob=async()=>{await page.locator('#jobForm button.primary').click();await page.waitForFunction(()=>!document.querySelector('#jobForm'));};
  await page.evaluate(()=>App.editJob('fixed'));await page.locator('[name=extraAmount]').fill('20');await page.locator('[name=extraIncluded]').selectOption('true');await saveJob();assert.equal((await metrics()).agreed,150);
  await page.evaluate(()=>App.editJob('fixed'));await page.locator('[name=extraIncluded]').selectOption('false');await saveJob();assert.equal((await metrics()).agreed,170);
  await page.evaluate(()=>App.createBusinessDoc('Offerte',{jobId:'fixed'}));assert.equal(await page.locator('[name=qty0]').inputValue(),'1');assert.equal(await page.locator('[name=price0]').inputValue(),'150');assert.equal(await page.locator('[name=price1]').inputValue(),'20');
  await page.locator('#docKor').uncheck();assert.match(await page.locator('#grandTotal').innerText(),/205,70/);
  // Actually generate all four PDF variants; manual lines and VAT/KOR remain functional.
  await page.locator('#businessDocForm button.primary').last().click();await page.waitForFunction(()=>document.querySelector('#quoteToInvoice'));
  await page.locator('#quoteToInvoice').click();assert.equal(await page.locator('[name=qty0]').inputValue(),'1');assert.equal(await page.locator('[name=price0]').inputValue(),'150');
  await page.locator('[name=desc0]').fill('Handmatig bewerkte regel');await page.locator('#businessDocForm button.primary').last().click();await page.waitForFunction(()=>document.querySelector('#documentPayments'));
  assert.equal(await page.evaluate(()=>JKDB.all('documents').then(ds=>ds.filter(d=>d.folder==='factuur').find(d=>d.meta.total===205.7)?.meta.lines[0].description)),'Handmatig bewerkte regel');
  await page.evaluate(()=>App.createBusinessDoc('Offerte',{jobId:'fixed'}));await page.locator('#docKor').check();await page.locator('#businessDocForm button.primary').last().click();await page.waitForFunction(()=>document.querySelector('#quoteToInvoice'));
  assert.equal(await page.evaluate(id=>JKDB.get('documents',id).then(d=>JSON.stringify(d.meta)),invoice.id),invoiceBefore,'Price changes never rewrite existing invoices');
  // Frozen old paid amounts survive switching legacy jobs to a fixed price, without invented dates.
  await page.evaluate(()=>App.editJob('legacy'));await page.locator('[name=pricingType]').selectOption('fixed');await page.locator('[name=agreedAmount]').fill('120');await saveJob();
  const legacy=await page.evaluate(async()=>{const f=await App.refreshFinance();return {metrics:f.job(await JKDB.get('jobs','legacy')),payments:f.receipts.filter(p=>p.resolvedJobId==='legacy')};});
  assert.equal(legacy.metrics.received,100);assert.equal(legacy.metrics.open,20);assert.equal(legacy.payments[0].date,'');
  await page.evaluate(()=>App.editJob('fixed'));await page.locator('[name=pricingType]').selectOption('manual');await page.locator('[name=agreedAmount]').fill('');await saveJob();assert.equal((await metrics()).pending,true);
  await page.evaluate(()=>App.editJob('fixed'));await page.locator('[name=pricingType]').selectOption('hourly');await page.locator('[name=extraAmount]').fill('0');await saveJob();assert.equal((await metrics()).agreed,170);
  await page.evaluate(async()=>{await JKDB.putLocal('timeEntries',{id:'three-more',jobId:'fixed',date:`${fixtureYear}-01-18`,from:'08:00',to:'11:00',actualConfirmed:true});});
  assert.equal((await metrics()).agreed,200);assert.equal((await metrics()).minutes,1200);
  await page.evaluate(()=>App.createBusinessDoc('Factuur',{jobId:'fixed'}));assert.equal(await page.locator('[name=qty0]').inputValue(),'20');assert.equal(await page.locator('[name=price0]').inputValue(),'10');
  // Restore fixed agreement for independent January / February / year / customer amounts.
  await page.evaluate(()=>App.editJob('fixed'));await page.locator('[name=pricingType]').selectOption('fixed');await page.locator('[name=agreedAmount]').fill('150');await saveJob();
  const stats=await page.evaluate(async()=>{await App.refreshFinance();const es=await JKDB.all('timeEntries'),js=await JKDB.all('jobs'),cs=await JKDB.all('clients');return {fixtureYear,week:App.periodBuckets(es,js,{},'week'),quarter:App.periodBuckets(es,js,{},'quarter'),month:App.periodBuckets(es,js,{},'month'),year:App.periodBuckets(es,js,{},'year'),clients:App.customerStatBuckets(es,js,cs,{},fixtureYear)};});
  assert.equal(stats.month.find(b=>b.key.endsWith('-01')).amount,270);assert.equal(stats.month.find(b=>b.key.endsWith('-02')).received,100);assert.equal(stats.year.find(b=>b.key===String(stats.fixtureYear)).received,100);
  assert.equal(stats.quarter.find(b=>b.key===`${stats.fixtureYear}-Q1`).received,100);assert.equal(stats.quarter.find(b=>b.key===`${stats.fixtureYear}-Q1`).amount,270);assert.equal(stats.week.reduce((n,b)=>n+(b.received||0),0),0,'February payment never leaks into recent weeks');
  assert.equal(stats.clients[0].received,100);assert.equal(stats.clients[0].amount,270);
  await page.evaluate(()=>App.showClientHistory('client'));assert.match(await page.locator('#modalRoot').innerText(),/Ontvangen/);
  await page.evaluate(()=>App.showTimeStats());assert.match(await page.locator('#modalRoot').innerText(),/betaaldatum/);
  await page.evaluate(()=>App.generateAnnualInvoiceReport(fixtureYear));
  // Financial records use the unchanged existing cloud format and backup schema.
  const encoded=await page.evaluate(async()=>{const rs=(await JKDB.all('settings')).filter(r=>r.kind==='jkPayment');return {records:await Promise.all(rs.map(r=>JKCloud.encodeRecord('settings',r))),jobs:await JKDB.all('jobs'),hours:await JKDB.all('timeEntries')};});
  const remote=await browser.newContext({serviceWorkers:'block'});
  try{
   await remote.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin){if(u.pathname==='/app/app.js')return r.fulfill({contentType:'application/javascript',body:''});if(u.pathname==='/app/cloud.js')return r.fulfill({contentType:'application/javascript',body:cloudSource});return r.continue();}return r.fulfill({status:200,body:''});});
   const other=await remote.newPage();await other.goto(origin+'/app/',{waitUntil:'networkidle'});
   const back=await other.evaluate(async data=>{for(const r of data.records)await JKDB.putLocal('settings',await JKCloud.decodeRecord(r));for(const j of data.jobs)await JKDB.putLocal('jobs',j);for(const e of data.hours)await JKDB.putLocal('timeEntries',e);const p=(await JKDB.all('settings')).find(r=>r.kind==='jkPayment'&&!r.legacy);p.amount=125;await JKDB.putLocal('settings',p);return JKCloud.encodeRecord('settings',p);},JSON.parse(JSON.stringify(encoded)));
   await page.evaluate(async data=>JKDB.putLocal('settings',await JKCloud.decodeRecord(data)),JSON.parse(JSON.stringify(back)));
   assert.equal((await metrics()).received,125);
  }finally{await remote.close();}
  const backup=await page.evaluate(async()=>{const b=await JKBackup.make({localOnly:true});const prepared=await JKBackup.validate(b);return {payments:prepared.stores.settings.filter(r=>r.kind==='jkPayment'),job:prepared.stores.jobs.find(j=>j.id==='fixed'),confirmed:prepared.stores.timeEntries.find(e=>e.id==='confirmed'),preserved:JSON.parse(originalHours).every(old=>JSON.stringify(prepared.stores.timeEntries.find(e=>e.id===old.id))===JSON.stringify(old))};});
  assert.equal(backup.payments.some(p=>p.amount===125),true);assert.equal(backup.job.pricingType,'fixed');assert.equal(backup.confirmed.actualConfirmed,true);assert.equal(backup.preserved,true,'All original hour records, including confirmed flags, remain byte-identical');
  // Explicit linking, unlinking and relinking move the same invoice payment; no mirror receipts.
  await page.evaluate(async id=>App.setInvoiceJobLink(await JKDB.get('documents',id),'legacy'),invoice.id);
  assert.equal((await metrics()).received,0);
  await page.evaluate(async id=>App.setInvoiceJobLink(await JKDB.get('documents',id),''),invoice.id);
  assert.equal(await page.evaluate(async id=>(await App.refreshFinance()).document(await JKDB.get('documents',id)).received,invoice.id),125);
  await page.evaluate(async id=>App.setInvoiceJobLink(await JKDB.get('documents',id),'fixed'),invoice.id);
  assert.equal((await metrics()).received,125);
  assert.equal(await page.evaluate(async id=>App.setInvoiceJobLink(await JKDB.get('documents',id),'fixed'),invoice.id),false);
  assert.equal(await page.evaluate(async id=>{try{await App.setInvoiceJobLink(await JKDB.get('documents',id),'missing');return false;}catch{return true;}},invoice.id),true);
  await page.evaluate(()=>App.showPayments('fixed'));await page.locator('[data-edit-payment]').click();await page.locator('#voidPayment').click();await page.waitForFunction(()=>!document.querySelector('#paymentForm'));
  assert.equal((await metrics()).received,0);assert.equal(await page.evaluate(()=>JKDB.all('settings').then(rs=>rs.filter(r=>r.kind==='jkPayment'&&r.voided).length)),1);
  await page.evaluate(async()=>JKDB.putLocal('documents',{id:'unassigned',folder:'factuur',filename:'Losse factuur.pdf',meta:{total:50,sent:true,paid:false}}));
  await page.locator('[data-close]').click();await page.evaluate(()=>App.renderJobs());await page.locator('[data-unassigned-invoice=unassigned]').waitFor();await page.locator('[data-unassigned-invoice=unassigned]').click();await page.locator('#documentPayments').waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(await page.evaluate(()=>alerts),[]);
  console.log('PASS: flexibele prijzen, 17u/€170/€150, deelbetalingen via beide routes, alle PDF-/btw-varianten, 20 uur, extra kosten, maand/jaar/klant, legacybehoud, bevestigde uren, sync- en back-upformaat');
 }finally{await context.close();}
};
