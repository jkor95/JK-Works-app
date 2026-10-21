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
  await page.evaluate(()=>App.showJob('fixed'));assert.match(await page.locator('#modalRoot').innerText(),/150,00/);
  assert.equal(await page.evaluate(()=>document.querySelector('.modal').scrollWidth<=document.querySelector('.modal').clientWidth+1),true);
  await page.locator('#paymentsThisJob').click();await page.locator('#addPayment').click();
  await page.locator('[name=amount]').fill('100');await page.locator('[name=date]').fill(`${await page.evaluate(()=>fixtureYear)}-02-10`);await page.locator('[name=method]').selectOption('bank');
  await page.evaluate(()=>{const f=document.querySelector('#paymentForm');f.requestSubmit();f.requestSubmit();});await page.waitForFunction(()=>!document.querySelector('#paymentForm'));
  m=await metrics();assert.equal(m.received,100);assert.equal(m.open,50);assert.equal(m.paid,false);
  await page.evaluate(()=>App.renderDashboard());assert.match(await page.locator('#dashOpenPayments').innerText(),/50,00/);assert.equal(await page.locator('#view .finance-kpis').count(),0,'Dashboard toont geen financiële statistiekkaarten');
  const detailLabels=['Berekende urenwaarde','Afgesproken omzet','Gefactureerd incl. btw','Ontvangen','Effectief afgesproken / uur','Effectief ontvangen / uur'];
  for(const label of detailLabels)assert.ok(!(await page.locator('#view').innerText()).includes(label),label+' niet op dashboard');
  await page.locator('[data-close]').click();await page.evaluate(()=>App.renderJobs());
  assert.equal(await page.locator('#view .finance-kpis').count(),0,'Klussenoverzicht heeft geen detailkaarten');
  assert.equal(await page.locator('#view .jobs-summary-card').count(),0,'Klussenoverzicht heeft geen uitgebreide samenvatting');
  const row=page.locator('[data-job=fixed]');assert.match(await row.innerText(),/Montage kast/);assert.match(await row.innerText(),/Fictieve klant/);assert.doesNotMatch(await row.innerText(),/Berekende urenwaarde|Referentie-uurtarief|Effectief/);assert.match(await row.innerText(),/50,00/);
  await row.click();await page.locator('#paymentsThisJob').waitFor();
  for(const label of ['Gewerkt','Afgesproken','Ontvangen','Nog te ontvangen'])assert.ok((await page.locator('#modalRoot').innerText()).includes(label),label+' zichtbaar in compacte kluskaart');
  for(const label of ['Referentie-uurtarief','Gefactureerd incl. btw','Effectief afgesproken / uur'])assert.ok(!(await page.locator('#modalRoot').innerText()).includes(label),label+' verborgen in compacte kluskaart');
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
  assert.equal(legacy.metrics.received,100);assert.equal(legacy.metrics.open,0);assert.equal(legacy.metrics.balance,20);assert.equal(legacy.payments[0].date,'');
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
  // Compacte weergave: precies één geselecteerd getal per maand/klant en één totaal.
  await page.evaluate(()=>App.showTimeStats());
  await page.locator('[data-stat-metric="received"].active').waitFor();
  assert.match(await page.locator('#modalRoot .stats-simple-total').innerText(),/100,00/);
  assert.equal(await page.locator('#modalRoot .stats-simple-row').count(),1,'Alleen maanden met ontvangsten tonen');
  assert.match(await page.locator('#modalRoot .stats-simple-row').first().innerText(),/feb[\s\S]*100,00/i);
  assert.equal(await page.locator('#modalRoot .finance-kpis').count(),0,'Geen zesdelige financiële kaarten');
  assert.equal(await page.locator('#modalRoot .dual-stats-chart').count(),0,'Geen dubbele uren/geldgrafieken');
  assert.doesNotMatch(await page.locator('#modalRoot').innerText(),/Berekende urenwaarde|Gefactureerd incl\\. btw|Effectief afgesproken|Effectief ontvangen|Afgesproken omzet/);
  assert.match(await page.locator('#modalRoot').innerText(),/Zonder betaaldatum/,'Ongedateerde ontvangst niet stilzwijgend bij periode optellen');
  await page.locator('[data-stat-metric="agreed"]').click();
  assert.match(await page.locator('#modalRoot .stats-simple-total').innerText(),/270,00/,'Afspraken blijven gebaseerd op bestaande bedragen');
  assert.equal(await page.locator('#modalRoot .stats-simple-row').count(),1);
  await page.locator('[data-stat-mode="client"]').click();
  assert.equal(await page.locator('#modalRoot .stats-simple-row').count(),1);
  assert.match(await page.locator('#modalRoot .stats-simple-row').first().innerText(),/Fictieve klant.*270,00/s);
  await page.locator('[data-stat-metric="received"]').click();
  assert.match(await page.locator('#modalRoot .stats-simple-row').first().innerText(),/Fictieve klant.*100,00/s);
  await page.locator('[data-stat-mode="quarter"]').click();
  assert.match(await page.locator('#modalRoot .stats-simple-total').innerText(),/100,00/);
  await page.locator('[data-stat-mode="year"]').click();
  assert.match(await page.locator('#modalRoot .stats-simple-total').innerText(),/100,00/);
  await page.locator('[data-stat-metric="hours"]').click();
  assert.match(await page.locator('#modalRoot .stats-simple-total').innerText(),/u/);
  assert.equal(await page.locator('#modalRoot .finance-kpis').count(),0);
  await page.locator('[data-stat-mode="week"]').click();
  assert.match(await page.locator('#modalRoot .stats-simple-total').innerText(),/0 u/);
  console.log('PASS: compacte statistieken ontvangen/afgesproken/uren per maand, kwartaal, jaar en klant zonder KPI-overvloed');
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
  await page.evaluate(async()=>JKDB.putLocal('documents',{id:'unassigned',folder:'factuur',filename:'Losse factuur.pdf',blob:new Blob(['%PDF fixture'],{type:'application/pdf'}),meta:{total:50,sent:true,paid:false}}));
  await page.locator('[data-close]').click();await page.evaluate(()=>App.renderJobs());await page.locator('[data-unassigned-invoice=unassigned]').waitFor();await page.locator('[data-unassigned-invoice=unassigned]').click();await page.locator('#documentPayments').waitFor();
  // Simple multi-day workflow: actual hours -> hourly/fixed -> extra -> live total.
  await page.evaluate(async()=>{
    window.workflowQueued=[];JKCloud.queuePut=async(store,record)=>workflowQueued.push({store,id:record.id});
    await JKDB.putLocal('jobs',{id:'simple',title:'Eenvoudige montage',clientId:'client',clientName:'Fictieve klant',date:'2026-03-01',hourlyRate:10,workDays:[{id:'planned',date:'2026-03-01',startTime:'08:00',endTime:'17:00'}]});
  });
  await page.evaluate(()=>App.showJob('simple'));await page.locator('#hoursThisJob').click();await page.locator('#jobCalculationForm').waitFor();
  assert.equal(await page.locator('[name=actualFrom]').inputValue(),'','No planned times copied to actual work');
  assert.equal(await page.evaluate(()=>JKDB.all('timeEntries').then(es=>es.filter(e=>e.jobId==='simple').length)),0);
  const actualRow=page.locator('[data-actual-row]').first();await actualRow.locator('[name=actualDate]').fill('2026-03-01');await actualRow.locator('[name=actualFrom]').fill('08:00');await actualRow.locator('[name=actualTo]').fill('17:00');await actualRow.locator('[name=actualBreak]').fill('60');
  await page.locator('#addActualDay').click();const secondRow=page.locator('[data-actual-row]').nth(1);await secondRow.locator('[name=actualDate]').fill('2026-03-02');await secondRow.locator('[name=actualFrom]').fill('08:00');await secondRow.locator('[name=actualTo]').fill('17:00');
  assert.match(await page.locator('#actualHoursTotal').innerText(),/17 u/);assert.match(await page.locator('#calculationTotal').innerText(),/170,00/);assert.equal(await page.evaluate(()=>document.querySelector('.modal').scrollWidth<=document.querySelector('.modal').clientWidth+1),true,'Multi-day form fits an iPhone width');
  await page.locator('[name=calculationType]').selectOption('fixed');await page.locator('[name=calculationFixed]').fill('150');assert.equal(await page.locator('[name=calculationRate]').isVisible(),false);assert.match(await page.locator('#calculationTotal').innerText(),/150,00/);
  await page.locator('[name=calculationExtra]').fill('20');assert.match(await page.locator('#calculationTotal').innerText(),/170,00/);
  await page.locator('[name=calculationIncluded]').check();assert.match(await page.locator('#calculationTotal').innerText(),/150,00/);
  await page.locator('[name=calculationExtra]').fill('0');await page.locator('[name=calculationIncluded]').uncheck();
  await page.evaluate(()=>{const f=document.querySelector('#jobCalculationForm');f.requestSubmit();f.requestSubmit();});await page.locator('#paymentsThisJob').waitFor();
  const simpleData=()=>page.evaluate(async()=>{const job=await JKDB.get('jobs','simple'),es=(await JKDB.all('timeEntries')).filter(e=>e.jobId==='simple'),f=await App.refreshFinance();return {job,entries:es,minutes:App.jobMinutes(job,es),financial:f.job(job)};});
  const firstSave=await simpleData();assert.equal(firstSave.entries.length,2);assert.equal(firstSave.minutes,1020);assert.equal(firstSave.financial.hoursValue,170);assert.equal(firstSave.financial.agreed,150);assert.ok(firstSave.entries.every(e=>e.actualConfirmed===true));
  assert.equal(await page.evaluate(()=>workflowQueued.filter(x=>x.store==='timeEntries').length),2,'One synced record per actual day despite double submission');
  await page.evaluate(async()=>{
    await JKDB.putLocal('timeEntries',{id:'simple-unconfirmed',jobId:'simple',date:'2026-03-03',from:'08:00',to:'17:00',autoFromJobSchedule:true,actualConfirmed:false,note:'Niet automatisch bevestigen'});
    await JKDB.putLocal('documents',{id:'simple-invoice',folder:'factuur',filename:'bestaand.pdf',blob:new Blob(['%PDF fixture'],{type:'application/pdf'}),meta:{jobId:'simple',total:150,lines:[{qty:1,price:150,description:'Bestaande factuur'}],paid:false}});
    window.workflowOriginal=JSON.stringify((await JKDB.all('timeEntries')).filter(e=>e.jobId==='simple'));window.workflowQueued=[];
  });
  await page.locator('[data-close]').click();await page.evaluate(()=>App.renderDashboard());await page.locator('#addHours').click();await page.locator('[name=calculationJob]').selectOption('simple');await page.locator('#chooseCalculationJob button.primary').click();await page.locator('[name=calculationType]').selectOption('hourly');await page.locator('[name=calculationExtra]').fill('25');
  assert.match(await page.locator('#actualHoursTotal').innerText(),/17 u/);assert.match(await page.locator('#calculationTotal').innerText(),/195,00/);
  assert.equal(await page.locator('[name=confirmActual]').isChecked(),false);assert.ok(await page.locator('[name=confirmActual]').evaluate(e=>e.getBoundingClientRect().width<=24),'Confirmation checkbox remains compact');
  await page.locator('#saveJobCalculation').click();await page.locator('#paymentsThisJob').waitFor();
  assert.equal((await simpleData()).financial.agreed,195);
  assert.equal(await page.evaluate(async()=>JSON.stringify((await JKDB.all('timeEntries')).filter(e=>e.jobId==='simple'))===workflowOriginal),true,'Price-only changes preserve every hour and confirmation flag byte-for-byte');
  assert.equal(await page.evaluate(()=>workflowQueued.filter(x=>x.store==='timeEntries').length),0);
  assert.equal(await page.evaluate(()=>JKDB.get('documents','simple-invoice').then(d=>d.meta.total)),150,'Existing invoice is not rewritten by the new form');
  // Invalid duplicate dates cannot partially save the first valid row.
  const beforeInvalid=JSON.stringify(await simpleData());await page.locator('#hoursThisJob').click();await page.locator('#addActualDay').click();
  const duplicate=page.locator('[data-actual-row]').last();await duplicate.locator('[name=actualDate]').fill('2026-03-01');await duplicate.locator('[name=actualFrom]').fill('10:00');await duplicate.locator('[name=actualTo]').fill('11:00');
  await page.locator('#saveJobCalculation').click();await page.waitForFunction(()=>alerts.length>0);assert.match(await page.evaluate(()=>alerts.pop()),/datum staat al/);assert.equal(JSON.stringify(await simpleData()),beforeInvalid);await page.locator('[data-close]').click();
  await page.evaluate(()=>App.showJob('simple'));await page.locator('#hoursThisJob').click();
  await page.evaluate(async()=>{const e=await JKDB.get('timeEntries','time_workday_simple_2026-03-01');await JKDB.putLocal('timeEntries',{...e,note:'Gewijzigd op ander apparaat'});});
  await page.locator('[name=calculationExtra]').fill('99');await page.locator('#saveJobCalculation').click();await page.waitForFunction(()=>alerts.length>0);assert.match(await page.evaluate(()=>alerts.pop()),/intussen gewijzigd/);
  assert.equal((await simpleData()).financial.agreed,195);assert.equal((await simpleData()).entries.find(e=>e.date==='2026-03-01').note,'Gewijzigd op ander apparaat');await page.locator('[data-close]').click();
  // A conflicting ID belonging to another job aborts the entire local transaction.
  const protectedSave=await page.evaluate(async()=>{
    const j=await JKDB.get('jobs','simple'),es=(await JKDB.all('timeEntries')).filter(e=>e.jobId==='simple');
    await JKDB.putLocal('timeEntries',{id:'foreign-hour',jobId:'other',date:'2026-03-04',from:'08:00',to:'09:00',actualConfirmed:true});
    try{await JKDB.saveJobWork({...j,extraAmount:999},[{id:'foreign-hour',jobId:'simple',date:'2026-03-04',from:'08:00',to:'10:00'}],j,es);return false;}catch{return (await JKDB.get('jobs','simple')).extraAmount===25&&(await JKDB.get('timeEntries','foreign-hour')).jobId==='other';}
  });assert.equal(protectedSave,true,'Atomic rollback protects job and foreign hours');
  await page.evaluate(()=>App.showJob('simple'));await page.locator('#hoursThisJob').click();await page.locator('[name=confirmActual]').check();
  assert.match(await page.locator('#actualHoursTotal').innerText(),/26 u/);await page.locator('#saveJobCalculation').click();await page.locator('#paymentsThisJob').waitFor();
  assert.equal((await simpleData()).entries.length,3);assert.equal((await simpleData()).entries.find(e=>e.id==='simple-unconfirmed').actualConfirmed,true,'Only explicitly confirmed old hours become actual');
  const deletedJobProtected=await page.evaluate(async()=>{const j=await JKDB.get('jobs','simple'),es=(await JKDB.all('timeEntries')).filter(e=>e.jobId==='simple');await JKDB.markDeleteLocal('jobs','simple');try{await JKDB.saveJobWork({...j,extraAmount:999},[],j,es);return false;}catch{return (await JKDB.get('jobs','simple')).extraAmount===25;}});assert.equal(deletedJobProtected,true,'A pending job deletion cannot be undone by a stale form');
  console.log('PASS: eenvoudige meerdaagse invoer, uren/vast bedrag, extra/inbegrepen kosten, direct totaal, dubbele submit, ongewijzigde bevestigde uren, oude onbevestigde uren en atomaire conflictafhandeling');
  // One upload from the camera roll, optional categorization afterwards, same records everywhere.
  await page.evaluate(async()=>{
    await JKDB.putLocal('jobPhotos',{id:'old-photo',jobId:'fixed',phase:'before',name:'bestaand.jpg',blob:new Blob(['old photo'],{type:'image/jpeg'}),createdAt:'2025-01-01T10:00:00Z'});
    window.oldPhoto=await JKDB.get('jobPhotos','old-photo');
    await App.showJob('fixed');
  });
  assert.equal(await page.locator('[data-upload-input]').count(),1);assert.equal(await page.locator('[data-upload-input]').getAttribute('multiple'),'');
  assert.equal(await page.locator('[data-photo-category="old-photo"]').inputValue(),'before');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDVkAAAAASUVORK5CYII=','base64');
  await page.locator('[data-upload-input]').setInputFiles([{name:'dag-1.png',mimeType:'image/png',buffer:png},{name:'dag-2.png',mimeType:'image/png',buffer:png},{name:'dag-3.png',mimeType:'image/png',buffer:png}]);
  await page.waitForFunction(()=>document.querySelectorAll('[data-photo-category]').length===4);
  const photoIds=await page.evaluate(async()=>(await JKDB.all('jobPhotos')).filter(p=>p.id!=='old-photo').map(p=>p.id));
  assert.equal(photoIds.length,3);assert.equal(new Set(photoIds).size,3);
  for(const id of photoIds)assert.equal(await page.locator(`[data-photo-category="${id}"]`).inputValue(),'general');
  for(const [i,phase] of ['before','during','after'].entries()){
    await page.locator(`[data-photo-category="${photoIds[i]}"]`).selectOption(phase);
    await page.waitForFunction(async([id,phase])=>(await JKDB.get('jobPhotos',id)).phase===phase,[photoIds[i],phase]);
  }
  assert.equal(await page.evaluate(()=>document.querySelector('.modal').scrollWidth<=document.querySelector('.modal').clientWidth+1),true,'Photo folder fits mobile screen');
  const preservedPhoto=await page.evaluate(async()=>{const p=await JKDB.get('jobPhotos','old-photo');return p.phase===oldPhoto.phase&&p.createdAt===oldPhoto.createdAt&&await p.blob.text()===await oldPhoto.blob.text();});assert.equal(preservedPhoto,true);
  await page.locator(`[data-job-photo="${photoIds[0]}"]`).click();await page.locator('#backPhotoJob').waitFor();await page.locator('[data-photo-category]').selectOption('general');
  await page.waitForFunction(async id=>(await JKDB.get('jobPhotos',id)).phase==='general',photoIds[0]);
  await page.locator('#backPhotoJob').click();await page.locator(`[data-photo-category="${photoIds[0]}"]`).waitFor();
  assert.equal(await page.locator(`[data-photo-category="${photoIds[0]}"]`).inputValue(),'general');
  await page.locator('[data-close]').click();await page.evaluate(()=>App.go('documents'));await page.locator('[data-folder="klusfotos"]').click();
  await page.locator('[data-photo-doc]').first().waitFor();assert.equal(await page.locator('.photo-doc-job').count(),1);assert.equal(await page.locator('[data-photo-doc]').count(),4,'Uncategorized and old photos appear together in one job folder');
  assert.equal(await page.locator('.photo-doc-phase').count(),0);
  await page.locator(`[data-photo-doc="${photoIds[0]}"]`).click();await page.locator('#deletePhotoDoc').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-photo-doc]').length===3);
  await page.evaluate(()=>App.showJob('fixed'));assert.equal(await page.locator('[data-job-photo]').count(),3,'Deleting a document photo removes the same job record');
  const photoBackup=await page.evaluate(async()=>{const b=await JKBackup.make({localOnly:true}),p=await JKBackup.validate(b);return p.stores.jobPhotos.map(r=>({id:r.id,phase:r.phase,size:r.blob.size,jobId:r.jobId}));});
  assert.equal(photoBackup.length,3);assert.ok(photoBackup.every(p=>p.jobId==='fixed'&&p.size>0));assert.ok(photoBackup.some(p=>p.id==='old-photo'&&p.phase==='before'));
  assert.equal(await page.evaluate(ids=>ids.every(id=>workflowQueued.filter(r=>r.store==='jobPhotos'&&r.id===id).length===2),photoIds.slice(1)),true,'Upload and recategorization synchronize the same photo IDs');
  console.log('PASS: één multi-upload/fotomap per klus, categorie achteraf/optioneel, behoud oude foto’s, mobiele weergave, gedeelde Documenten-verwijdering, sync-ID en back-upformaat');
  // Replanning hides only the premature payment highlight; financial records stay intact.
  await page.evaluate(async()=>{
    await JKDB.putLocal('jobs',{id:'badge',title:'Een lange omschrijving van de klus voor mobiele uitlijning',clientName:'Testklant',date:'2026-10-01',startTime:'08:00',endTime:'16:00',pricingType:'fixed',agreedAmount:150,status:'afgerond'});
    await App.renderJobs();
  });
  const badgeRow=page.locator('[data-job="badge"]');assert.equal(await badgeRow.locator('.job-payment-badge').count(),1);
  const badgeAmount=await page.evaluate(async()=>{await App.refreshFinance();return App.jobFinancial(await JKDB.get('jobs','badge'),[],{}).balance;});
  await page.evaluate(()=>App.editJob('badge'));await page.locator('#addWorkDay').click();await page.locator('[name=dayDate]').last().fill('2026-10-25');await saveJob();
  await page.evaluate(()=>App.renderJobs());assert.equal(await badgeRow.locator('.danger').count(),0);assert.ok(!(await badgeRow.getAttribute('class')).includes('payment-unpaid'));assert.equal(await badgeRow.locator('.job-status').innerText(),'afgerond');
  assert.equal(await page.evaluate(async()=>{await App.refreshFinance();return App.jobFinancial(await JKDB.get('jobs','badge'),[],{}).balance;}),badgeAmount);
  for(const width of [390,1024]){
    await page.setViewportSize({width,height:844});
    const layout=await badgeRow.evaluate(row=>{const title=row.querySelector('.title').getBoundingClientRect(),status=row.querySelector('.job-status').getBoundingClientRect();return {sameTop:Math.abs(title.top-status.top)<2,right:status.left>=title.right,gap:status.left-title.right,fits:row.scrollWidth<=row.clientWidth};});
    assert.ok(layout.sameTop&&layout.right&&layout.fits,JSON.stringify(layout));
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>App.editJob('badge'));await page.locator('[name=dayDate]').last().fill('2026-10-15');await saveJob();await page.evaluate(()=>App.renderJobs());
  assert.equal(await badgeRow.locator('.danger').count(),1);
  assert.equal(await badgeRow.evaluate(row=>row.querySelector('.job-payment-badge').getBoundingClientRect().top>row.querySelector('.job-row-heading').getBoundingClientRect().bottom),true,'Payment badge below title/status');
  await page.evaluate(()=>App.editJob('badge'));await page.locator('[name=dayDate]').first().fill('2026-10-26');await page.locator('[name=status]').selectOption('gepland');await saveJob();await page.evaluate(()=>App.renderJobs());
  assert.equal(await badgeRow.locator('.danger').count(),0);assert.equal(await badgeRow.locator('.job-status').innerText(),'gepland');
  await page.evaluate(()=>App.renderDashboard());
  const dashboardGap=await page.evaluate(()=>document.querySelector('.dashboard-first-title').getBoundingClientRect().top-document.querySelector('#dashboardJobOpen').getBoundingClientRect().bottom);assert.ok(dashboardGap>=24,'Dashboard gap: '+dashboardGap);
  await page.evaluate(async()=>{const j=await JKDB.get('jobs','badge');await JKDB.putLocal('jobs',{...j,workDays:undefined,date:'2026-10-20',startTime:'20:00',endTime:'02:00',status:'afgerond'});});
  await page.clock.setFixedTime(new Date('2026-10-20T23:00:00Z'));await page.evaluate(()=>App.renderJobs());assert.equal(await badgeRow.locator('.danger').count(),0,'Night shift still running');
  await page.clock.setFixedTime(new Date('2026-10-21T01:00:00Z'));await page.evaluate(()=>App.renderJobs());assert.equal(await badgeRow.locator('.danger').count(),1,'Night shift ended');
  await page.evaluate(async()=>{await JKDB.putLocal('settings',{id:'badge-payment',kind:'jkPayment',jobId:'badge',amount:150,date:'2026-10-21',method:'bank'});});await page.evaluate(()=>App.renderJobs());assert.equal(await badgeRow.locator('.danger').count(),0,'Paid past job stays neutral');
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
  console.log('PASS: toekomstige datum toevoegen/verplaatsen verwijdert voortijdige betaalbadge; status rechts naast omschrijving mobiel/desktop, betaalbadge eronder, dashboardafstand, nachtwerk en behoud financieel saldo');
  // Agreement amounts only become outstanding when BOTH status and all planned end times qualify.
  await page.evaluate(()=>App.renderJobs());
  const numeric=async selector=>Number((await page.locator(selector).innerText()).replace(/[^0-9,-]/g,'').replace(',','.'));
  const baseline={open:await numeric('#jobOpenTotal'),cash:await numeric('#jobCashTotal'),invoice:await numeric('#jobInvoiceTotal')};
  const recordsBefore=await page.evaluate(async()=>JSON.stringify({hours:await JKDB.all('timeEntries'),docs:await JKDB.all('documents'),payments:(await JKDB.all('settings')).filter(r=>r.kind==='jkPayment')}));
  await page.evaluate(async()=>{
    await JKDB.putLocal('jobs',{id:'settlement',clientId:'client',clientName:'Fictieve klant',title:'Vaste afspraak later klaar',pricingType:'fixed',agreedAmount:150,paymentType:'invoice',status:'gepland',date:'2026-10-01',workDays:[{date:'2026-10-01',startTime:'08:00',endTime:'16:00'},{date:'2026-10-25',startTime:'08:00',endTime:'16:00'}]});
    await JKDB.putLocal('jobs',{id:'settlement-cash',title:'Contante afspraak',pricingType:'fixed',agreedAmount:200,paymentType:'cash',status:'open',date:'2026-10-01'});
    await App.renderJobs();
  });
  assert.equal(await numeric('#jobOpenTotal'),baseline.open);assert.equal(await numeric('#jobCashTotal'),baseline.cash);assert.equal(await numeric('#jobInvoiceTotal'),baseline.invoice);
  const setSettlement=async changes=>page.evaluate(async changes=>{const j=await JKDB.get('jobs','settlement');await JKDB.putLocal('jobs',{...j,...changes});await App.renderJobs();},changes);
  const settlementMetrics=()=>page.evaluate(()=>App.state.finance.job(App.state.finance.jobs.find(j=>j.id==='settlement')));
  await setSettlement({status:'afgerond'});assert.equal((await settlementMetrics()).open,0,'Completed alone is insufficient with a future workday');assert.equal((await settlementMetrics()).agreed,150);assert.equal((await settlementMetrics()).paid,false);
  await page.evaluate(()=>App.showJob('settlement'));assert.match(await page.locator('#modalRoot').innerText(),/Na afronding af te rekenen/);await page.locator('[data-close]').click();
  await setSettlement({status:'gepland',workDays:[{date:'2026-10-01',startTime:'08:00',endTime:'16:00'},{date:'2026-10-15',startTime:'08:00',endTime:'16:00'}]});assert.equal((await settlementMetrics()).open,0,'Past end alone is insufficient while planned');
  await setSettlement({status:'open'});assert.equal((await settlementMetrics()).open,0);
  await page.evaluate(()=>App.editJob('settlement'));await page.locator('[name=status]').selectOption('afgerond');await saveJob();await page.evaluate(()=>App.renderJobs());
  assert.equal((await settlementMetrics()).open,150);assert.equal(await numeric('#jobOpenTotal'),baseline.open+150);
  await page.evaluate(()=>App.renderDashboard());assert.equal(await numeric('#dashOpenPayments strong'),baseline.open+150);
  await page.evaluate(()=>App.renderJobs());
  for(const filter of ['cash','invoice','all']){await page.locator(`[data-jpf="${filter}"]`).click();await page.waitForFunction(value=>document.querySelector(`[data-jpf="${value}"]`).classList.contains('active'),filter);assert.equal(await numeric('#jobOpenTotal'),baseline.open+150);assert.equal(await numeric('#jobCashTotal'),baseline.cash);assert.equal(await numeric('#jobInvoiceTotal'),baseline.invoice);}
  for(const width of [390,1024]){
    await page.setViewportSize({width,height:844});
    const layout=await page.locator('.job-totals').evaluate(e=>{const cards=[...e.querySelectorAll('.kpi')],boxes=cards.map(c=>c.getBoundingClientRect()),style=getComputedStyle(cards[0]);return {fits:e.scrollWidth<=e.clientWidth,center:style.textAlign,color:style.color,bg:style.backgroundColor,others:cards.slice(1).map(c=>getComputedStyle(c).backgroundColor),fullWidth:boxes[0].width>boxes[1].width*1.9,below:boxes.slice(1).every(b=>b.top>=boxes[0].bottom),note:e.querySelectorAll('p').length};});
    assert.ok(layout.fits&&layout.fullWidth&&layout.below);assert.equal(layout.center,'center');assert.equal(layout.bg,'rgb(254, 228, 226)');assert.equal(layout.color,'rgb(180, 35, 24)');assert.deepEqual(layout.others,['rgb(255, 255, 255)','rgb(255, 255, 255)']);assert.equal(layout.note,0);
  }await page.setViewportSize({width:390,height:844});
  const preserved=await page.evaluate(async()=>JSON.stringify({hours:await JKDB.all('timeEntries'),docs:await JKDB.all('documents'),payments:(await JKDB.all('settings')).filter(r=>r.kind==='jkPayment')}));assert.equal(preserved,recordsBefore,'Changing settlement status never rewrites hours, invoices or payments');
  await page.evaluate(async()=>{await JKDB.putLocal('settings',{id:'settlement-payment',kind:'jkPayment',jobId:'settlement',amount:100,date:'2026-10-21',method:'bank'});await App.renderJobs();});assert.equal((await settlementMetrics()).open,50);assert.equal((await settlementMetrics()).received,100);assert.equal((await settlementMetrics()).paid,false);assert.equal(await numeric('#jobOpenTotal'),baseline.open+50);assert.equal(await numeric('#jobInvoiceTotal'),baseline.invoice+100);
  await page.evaluate(()=>App.editJob('settlement'));await page.locator('#addWorkDay').click();await page.locator('[name=dayDate]').last().fill('2026-10-27');await saveJob();await page.evaluate(()=>App.renderJobs());assert.equal((await settlementMetrics()).open,0);assert.equal((await settlementMetrics()).balance,50);assert.equal((await settlementMetrics()).received,100);assert.equal(await numeric('#jobOpenTotal'),baseline.open);
  // Exact end boundary and overnight work use Europe/Amsterdam, including an untimed date.
  await setSettlement({status:'afgerond',workDays:[{date:'2026-10-20',startTime:'20:00',endTime:'02:00'}]});
  await page.clock.setFixedTime(new Date('2026-10-20T23:59:59Z'));await page.evaluate(()=>App.renderJobs());assert.equal((await settlementMetrics()).open,0);
  await page.clock.setFixedTime(new Date('2026-10-21T00:00:00Z'));await page.evaluate(()=>App.renderJobs());assert.equal((await settlementMetrics()).open,50);
  await setSettlement({workDays:[{date:'2026-10-21'}]});assert.equal((await settlementMetrics()).open,0);
  await page.clock.setFixedTime(new Date('2026-10-21T22:00:00Z'));await page.evaluate(()=>App.renderJobs());assert.equal((await settlementMetrics()).open,50,'Untimed workday becomes past at Dutch midnight');
  await setSettlement({status:'gepland'});assert.equal((await settlementMetrics()).open,0,'Reopening removes it even after all dates');
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
  // Received totals exclude unpaid agreements and count linked invoice payments only once.
  await page.evaluate(async()=>{
    await JKDB.putLocal('settings',{id:'received-cash',kind:'jkPayment',jobId:'settlement-cash',amount:50,date:'2026-10-21',method:'cash'});
    await JKDB.putLocal('documents',{id:'received-linked',folder:'factuur',meta:{jobId:'settlement',total:150},blob:new Blob(['%PDF fixture'],{type:'application/pdf'})});
    await JKDB.putLocal('documents',{id:'received-orphan',folder:'factuur',meta:{total:80},blob:new Blob(['%PDF fixture'],{type:'application/pdf'})});
    await JKDB.putLocal('settings',{id:'received-orphan-payment',kind:'jkPayment',invoiceId:'received-orphan',amount:30,date:'2026-10-21',method:'bank'});
    await App.renderJobs();
  });
  assert.equal(await numeric('#jobCashTotal'),baseline.cash+50);assert.equal(await numeric('#jobInvoiceTotal'),baseline.invoice+130);assert.equal(await numeric('#jobOpenTotal'),baseline.open+50,'Only orphan invoice remainder is newly outstanding');
  await page.evaluate(async()=>{const p=await JKDB.get('settings','settlement-payment');await JKDB.putLocal('settings',{...p,invoiceId:'received-linked',amount:150});await App.renderJobs();});
  assert.equal(await numeric('#jobInvoiceTotal'),baseline.invoice+180,'Moving and editing the same payment through its linked invoice never duplicates received totals');assert.equal(await numeric('#jobCashTotal'),baseline.cash+50);
  await page.evaluate(async()=>{const p=await JKDB.get('settings','received-cash');await JKDB.putLocal('settings',{...p,voided:true});await App.renderJobs();});assert.equal(await numeric('#jobCashTotal'),baseline.cash);assert.equal(await numeric('#jobInvoiceTotal'),baseline.invoice+180);
  console.log('PASS: uitsluitend ontvangen contant/factuur, deelbetalingen, onbetaalde afspraken uitgesloten, gekoppelde/losse facturen, wijzigen en verwijderen; gecentreerd rood openstaand en witte totalen zonder toelichting');
  console.log('PASS: compacte drie klustotalen; openstaand uitsluitend afgerond én laatste einde voorbij; dashboard, filters, toekomst/heropenen, deelbetaling, nachtwerk/middernacht en bytegelijk behoud uren/facturen/betalingen');
  // Issue #35: clickable outstanding filter, rounding without creating revenue and reversible settlement.
  await page.evaluate(async()=>{
    await JKDB.putLocal('jobs',{id:'issue35',title:'Afronding bij montage',clientName:'Proefklant',date:'2026-10-01',status:'afgerond',pricingType:'fixed',agreedAmount:105,hourlyRate:15,paymentType:'cash'});
    await JKDB.putLocal('settings',{id:'issue35-pay',kind:'jkPayment',jobId:'issue35',date:'2026-10-21',amount:102.5,method:'cash'});
    await App.renderJobs();
  });
  assert.equal(await page.locator('[data-job=issue35] .danger').count(),1);
  assert.match(await page.locator('[data-job=issue35]').innerText(),/2,50/);
  await page.locator('#jobOpenFilter').click();await page.locator('[data-jpf=open].active').waitFor();
  assert.equal(await page.locator('[data-job=issue35]').count(),1);
  assert.equal(await page.locator('[data-job="settlement-cash"]').count(),0,'Open filter hides unfinished jobs');
  await page.locator('[data-job=issue35]').click();await page.locator('#paymentsThisJob').waitFor();
  const issueCard=await page.locator('#modalRoot').innerText();
  assert.match(issueCard,/Afgesproken/);assert.match(issueCard,/Ontvangen/);
  assert.doesNotMatch(issueCard,/Berekende urenwaarde|Gefactureerd incl. btw|Effectief ontvangen/);
  await page.locator('#paymentsThisJob').click();
  await page.locator('#settleRounding').click();
  await page.waitForFunction(()=>document.querySelector('#revokeRounding'));
  let issue=await page.evaluate(async()=>{const f=await App.refreshFinance();return f.job(await JKDB.get('jobs','issue35'));});
  assert.equal(issue.received,102.5);assert.equal(issue.waived,2.5);assert.equal(issue.open,0);assert.equal(issue.paid,true);
  await page.locator('#revokeRounding').click();
  await page.waitForFunction(()=>document.querySelector('#settleRounding'));
  issue=await page.evaluate(async()=>{const f=await App.refreshFinance();return f.job(await JKDB.get('jobs','issue35'));});
  assert.equal(issue.received,102.5);assert.equal(issue.open,2.5);assert.equal(issue.paid,false);
  await page.locator('[data-close]').click();await page.evaluate(()=>App.renderJobs());
  await page.locator('[data-jpf="open"]').click();
  await page.locator('#showAllJobs').click();
  await page.locator('[data-job="settlement-cash"]').waitFor();
  assert.equal(await page.locator('[data-job="settlement-cash"]').count(),1,'All jobs restored');
  console.log('PASS: issue #35 - open filter, compact price card, partial vs rounded paid, actual receipts and reversal');
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(await page.evaluate(()=>alerts),[]);
  console.log('PASS: flexibele prijzen, 17u/€170/€150, deelbetalingen via beide routes, alle PDF-/btw-varianten, 20 uur, extra kosten, maand/jaar/klant, legacybehoud, bevestigde uren, sync- en back-upformaat');
 }finally{await context.close();}
};
