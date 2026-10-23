// Actual forms, PDF templates, IndexedDB, sync serialization and backups; fictitious data only.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async(browser,origin)=>{
 const root=path.join(__dirname,'..'),cloudSource=(await fs.readFile(path.join(root,'app/cloud.js'),'utf8')).replace('return {readBackupSnapshot,','return {encodeRecord,decodeRecord,readBackupSnapshot,');
 const source=(await fs.readFile(path.join(root,'app/app.js'),'utf8')).replace('return {init,go};','return {init,go,state,editJob,showJob,showDocument,showPayments,renderJobs,renderDashboard,refreshFinance,jobMinutes,jobFinancial,financialEvents,periodBuckets,customerStatBuckets,simpleStatsChartHtml,statsComparisonChartHtml,paymentMethodOverview,paymentMethodOverviewHtml,openPaymentLabelData,showClientHistory,showTimeStats,generateAnnualInvoiceReport,createBusinessDoc,setInvoiceJobLink};').replace("document.addEventListener('DOMContentLoaded',()=>App.init());",'');
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
  // Betaalwijze 'Pin' is voortaan 'Betaalverzoek'; bestaande opslagcode 'card' blijft compatibel.
  await page.locator('[data-edit-payment]').first().click();
  const methodSelect=page.locator('#paymentForm [name=method]');
  assert.equal(await methodSelect.locator('option[value=card]').innerText(),'Betaalverzoek','Betaalverzoek is de zichtbare naam');
  assert.equal(await methodSelect.locator('option').filter({hasText:'Pin'}).count(),0,'Pin staat niet meer in de keuzes');
  await methodSelect.selectOption('card');
  await page.locator('#paymentForm button.primary').click();
  await page.waitForFunction(()=>!document.querySelector('#paymentForm'));
  assert.match(await page.locator('#modalRoot [data-edit-payment]').first().innerText(),/Betaalverzoek/,'Betaalverzoek in betalingshistorie');
  assert.doesNotMatch(await page.locator('#modalRoot [data-edit-payment]').first().innerText(),/Pin/,'Geen Pin-label in de historie');
  assert.equal(await page.evaluate(()=>JKDB.all('settings').then(xs=>xs.find(x=>x.kind==='jkPayment'&&!x.legacy&&!x.voided)?.method)),'card',
    'Bestaande opslagcode blijft intact, geen gegevensmigratie');
  await page.evaluate(()=>App.renderDashboard());assert.match(await page.locator('#dashOpenPayments').innerText(),/50,00/);assert.equal(await page.locator('#view .finance-kpis').count(),0,'Dashboard toont geen financiële statistiekkaarten');
  const detailLabels=['Berekende urenwaarde','Afgesproken omzet','Gefactureerd incl. btw','Ontvangen','Effectief afgesproken / uur','Effectief ontvangen / uur'];
  for(const label of detailLabels)assert.ok(!(await page.locator('#view').innerText()).includes(label),label+' niet op dashboard');
  await page.locator('[data-close]').click();await page.evaluate(()=>App.renderJobs());
  assert.equal(await page.locator('#view .finance-kpis').count(),0,'Klussenoverzicht heeft geen detailkaarten');
  assert.equal(await page.locator('#view .jobs-summary-card').count(),0,'Klussenoverzicht heeft geen uitgebreide samenvatting');
  const row=page.locator('[data-job=fixed]');assert.match(await row.innerText(),/Montage kast/);assert.match(await row.innerText(),/Fictieve klant/);assert.doesNotMatch(await row.innerText(),/Berekende urenwaarde|Referentie-uurtarief|Effectief/);assert.match(await row.innerText(),/50,00/);
  // De nieuwe Openstaand-knop gebruikt dezelfde echte schuld (geen afboekingen).
  await page.locator('[data-jpf="open"]').click();
  await page.locator('#openPaymentsPrint').click();
  await page.waitForFunction(()=>document.querySelector('#openLabelPreview')?.naturalWidth===1200);
  assert.equal(await page.locator('#openLabelPreview').evaluate(img=>img.naturalWidth),1200);
  assert.equal(await page.locator('#openLabelPreview').evaluate(img=>img.naturalHeight),1800);
  assert.match(await page.locator('#openLabelSummary').innerText(),/50,00/,'Openstaand label gebruikt bestaande €50 schuld');
  assert.match(await page.locator('#openLabelForm [name="client"]').first().inputValue(),/Fictieve klant/);
  assert.match(await page.locator('#openLabelForm [name="job"]').first().inputValue(),/Montage kast/);
  assert.equal(await page.locator('#openLabelForm [name="include"]').count()>0,true);
  const beforeWorklabel=await page.evaluate(async()=>JSON.stringify({jobs:await JKDB.all('jobs'),payments:(await JKDB.all('settings')).filter(x=>x.kind==='jkPayment')}));
  await page.locator('#openLabelTitle').fill('Openstaand - eigen overzicht');
  await page.locator('#openLabelRefresh').click();
  assert.match(await page.locator('#openLabelPageCount').innerText(),/Pagina 1 van 1/);
  const initialTotal=await page.locator('#openLabelSummary').innerText();
  const firstRow=page.locator('[data-open-label-row]').first();
  const savedAmount=await firstRow.locator('[name="amount"]').inputValue();
  await firstRow.locator('[name="amount"]').fill('€ 25,00');
  await page.locator('#openLabelRefresh').click();
  assert.notEqual(await page.locator('#openLabelSummary').innerText(),initialTotal,'Handmatig aangepast printbedrag wijzigt voorbeeldtotaal');
  await firstRow.locator('[name="amount"]').fill(savedAmount);
  await page.locator('#openLabelRefresh').click();
  await page.evaluate(()=>{
    window.openLabelShared=null;
    Object.defineProperty(navigator,'canShare',{configurable:true,value:x=>Array.isArray(x.files)&&x.files.length>0});
    Object.defineProperty(navigator,'share',{configurable:true,value:async x=>{
      window.openLabelShared={count:x.files.length,type:x.files[0].type,bytes:x.files[0].size};
    }});
  });
  await page.locator('#openLabelShare').click();
  await page.waitForFunction(()=>!!window.openLabelShared);
  const sharedLabel=await page.evaluate(()=>window.openLabelShared);
  assert.equal(sharedLabel.count,1,'Eén werkbon als losse PNG via iPhone-deelkaart');
  assert.equal(sharedLabel.type,'image/png');
  assert.ok(sharedLabel.bytes>1500,'Deelkaart krijgt echte afdrukbare PNG-bytes');
  const pngDownload=page.waitForEvent('download');
  await page.locator('#openLabelDownload').click();
  assert.match((await pngDownload).suggestedFilename(),/JK-Works-openstaand-\d{4}-\d{2}-\d{2}-01\.png/);
  const unchangedWorklabel=await page.evaluate(async()=>JSON.stringify({jobs:await JKDB.all('jobs'),payments:(await JKDB.all('settings')).filter(x=>x.kind==='jkPayment')}));
  assert.equal(unchangedWorklabel,beforeWorklabel,'Printeditor verandert geen klussen of betalingen');
  await page.locator('#openLabelBack').click();
  // Veel open posten passen automatisch op meerdere losse 4x6 PNG-stickers.
  const pagesFixture=await page.evaluate(()=>{
    const raw=Array.from({length:16},(_,i)=>({id:'j-'+i,include:true,
      client:'Klant '+(i+1),job:'Kluswerk / evenement '+(i+1),
      date:'01-10-2026',times:'10:00 - 16:00',amount:'€ 12,50'}));
    const total=JKOpenPaymentsLabel.selectedRows({items:raw}).reduce((sum,row)=>sum+row.amount,0);
    const written=[];let page=0;
    const original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(value,...args){
      if(String(value).startsWith('PAGINA '))page++;
      written.push([page,String(value)]);
      return original.call(this,value,...args);
    };
    let canvases;
    try{canvases=JKOpenPaymentsLabel.pages({title:'Openstaande betalingen Kade32',items:raw});}
    finally{CanvasRenderingContext2D.prototype.fillText=original;}
    const withoutFirst=JKOpenPaymentsLabel.selectedRows({items:raw.map((r,i)=>({...r,include:i>0}))});
    let invalid=false;
    try{JKOpenPaymentsLabel.pages({items:raw.map(r=>({...r,include:false}))});}catch(e){invalid=/minimaal één/.test(e.message);}
    return {total,pageCount:canvases.length,dims:canvases.map(c=>[c.width,c.height]),
      lines:written,pageLabels:written.filter(x=>x[1].startsWith('PAGINA ')).map(x=>x[1]),
      subtotal:withoutFirst.reduce((sum,r)=>sum+r.amount,0),invalid};
  });
  assert.equal(pagesFixture.total,20000,'16 fictieve posten van €12,50 tellen op tot €200,00');
  assert.ok(pagesFixture.pageCount>1,'Groot overzicht wordt in meerdere stickers opgesplitst');
  assert.ok(pagesFixture.dims.every(dim=>dim[0]===1200&&dim[1]===1800));
  assert.deepEqual(pagesFixture.pageLabels,Array.from({length:pagesFixture.pageCount},(_,i)=>'PAGINA '+(i+1)+' / '+pagesFixture.pageCount));
  const overallTotals=pagesFixture.lines.filter(x=>x[1]==='TOTAAL OPENSTAAND');
  assert.equal(overallTotals.length,1,'Grand total precies eenmaal op de serie');
  assert.equal(overallTotals[0][0],pagesFixture.pageCount,'Grand total staat op laatste sticker');
  assert.ok(pagesFixture.lines.some(x=>/200,00/.test(x[1])),'Totaal €200,00 zichtbaar');
  assert.equal(pagesFixture.subtotal,18750,'Uitvinken verlaagt afdruktotaal zonder betaling te wijzigen');
  assert.equal(pagesFixture.invalid,true,'Lege selectie kan niet worden opgeslagen');
  await page.locator('[data-jpf="all"]').click();
  await page.locator('[data-job=fixed]').click();await page.locator('#paymentsThisJob').waitFor();
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
  assert.equal(stats.month.find(b=>b.key.endsWith('-01')).amount,270);assert.equal(stats.month.find(b=>b.key.endsWith('-01')).received,200,'Februari-betaling en oude ongedateerde betaling horen bij januari-uitvoering');assert.equal(stats.month.find(b=>b.key.endsWith('-02')).received,0);assert.equal(stats.year.find(b=>b.key===String(stats.fixtureYear)).received,200);
  assert.equal(stats.quarter.find(b=>b.key===`${stats.fixtureYear}-Q1`).received,200);assert.equal(stats.quarter.find(b=>b.key===`${stats.fixtureYear}-Q1`).amount,270);assert.equal(stats.week.reduce((n,b)=>n+(b.received||0),0),0,'February payment never leaks into recent weeks');
  assert.equal(stats.clients[0].received,200);assert.equal(stats.clients[0].amount,270);
  await page.evaluate(()=>App.showClientHistory('client'));assert.match(await page.locator('#modalRoot').innerText(),/Ontvangen/);
  // Gecombineerde vergelijking: klanten eerst; uren en geld op één scherm.
  await page.evaluate(()=>App.showTimeStats());
  await page.locator('[data-stat-mode="client"].active').waitFor();
  assert.equal(await page.locator('[data-stat-mode="week"]').count(),0,'Tab Per week is verwijderd');
  assert.equal(await page.locator('[data-stat-mode]').first().getAttribute('data-stat-mode'),'client','Per klant staat vooraan');
  assert.equal(await page.locator('#modalRoot .stats-client-combined').count(),1,'Eén gecombineerd klantoverzicht');
  const combined=page.locator('#modalRoot .stats-client-combined').first();
  assert.match(await combined.innerText(),/Fictieve klant/);
  assert.match(await combined.innerText(),/u/,'De uren staan bij dezelfde klant');
  assert.match(await combined.innerText(),/200,00/,'Ontvangen bedrag vermeld');
  assert.match(await combined.innerText(),/50,00/,'Werkelijk openstaand zichtbaar in dezelfde grafiek');
  assert.doesNotMatch(await combined.innerText(),/270,00|afgesproken/i,'Afgesproken bedrag niet getoond bij klant');
  assert.match(await page.locator('#modalRoot .stats-comparison-summary').innerText(),/Ontvangen[\s\S]*200,00[\s\S]*Nog te ontvangen[\s\S]*50,00/);
  assert.doesNotMatch(await page.locator('#modalRoot').innerText(),/afgesproken|270,00/i,'Alleen ontvangen en nog te ontvangen zichtbaar in klantstatistieken');
  assert.equal(await combined.locator('.stats-client-hours-fill').count(),1);
  // Eén bedrag vóór en één bedrag ná de balk, allebei rechts.
  const upper=combined.locator('.stats-client-money-label');
  const lower=combined.locator('.stats-client-open-caption');
  assert.match(await upper.innerText(),/Verdiensten[\s\S]*€\s+200,00 ontvangen/,'Ontvangen rechts naast Verdiensten');
  assert.doesNotMatch(await upper.innerText(),/open|nog te ontvangen|50,00/i,'Openstaand niet dubbel boven de balk');
  assert.equal(await lower.count(),1,'Een afzonderlijk label onder de balk');
  assert.equal(await lower.locator('span').count(),1,'Geen dubbele ontvangsten onder de balk');
  assert.match(await lower.innerText(),/€\s+50,00 nog te ontvangen/,'Alleen openstaand onder de balk');
  assert.doesNotMatch(await lower.innerText(),/200,00|ontvangen(?!$)/i,'Ontvangen niet herhaald onder de balk');
  const onlyReceived=await page.evaluate(()=>App.statsComparisonChartHtml([{label:'Volledig betaald',received:335,open:0,minutes:660}],true));
  assert.match(onlyReceived,/€\s+335,00 ontvangen/,'Bij volledig betaald blijft bovenlabel zichtbaar');
  assert.doesNotMatch(onlyReceived,/stats-client-open-caption/,'Geen lege onderregel als niets openstaat');
  const pos=await combined.evaluate(el=>{
    const top=el.querySelector('.stats-client-money-label'),title=top.querySelector('span'),paid=top.querySelector('strong'),bar=el.querySelector('.stats-client-money-track'),unpaid=el.querySelector('.stats-client-open-caption span');
    const a=title.getBoundingClientRect(),b=paid.getBoundingClientRect(),c=bar.getBoundingClientRect(),d=unpaid.getBoundingClientRect();
    return {sameLine:Math.abs(a.top-b.top)<14,rightAligned:Math.abs(c.right-b.right)<3&&Math.abs(c.right-d.right)<3,below:d.top>=c.bottom};
  });
  assert.equal(pos.sameLine,true,'Titel Verdiensten en ontvangen staan op dezelfde regel');
  assert.equal(pos.rightAligned,true,'Beide bedragen staan rechts langs de balk');
  assert.equal(pos.below,true,'Openstaand staat onder de balk');
    assert.equal(await combined.locator('.stats-client-chart-fill').count(),1);
  assert.equal(await combined.locator('.stats-client-chart-open').count(),1);
  const heights=await combined.evaluate(el=>({
    hours:getComputedStyle(el.querySelector('.stats-client-hours-track')).height,
    money:getComputedStyle(el.querySelector('.stats-client-money-track')).height
  }));
  assert.equal(heights.hours,'14px','Urenbalk op 14 pixels');
  assert.equal(heights.money,heights.hours,'Geldbalk exact even dik als urenbalk');
  assert.match(await page.locator('#modalRoot .stats-chart-legend').innerText(),/Ontvangen[\s\S]*Nog te ontvangen/);
  assert.equal(await page.locator('#modalRoot .stats-chart-card').count(),1,'Eén gezamenlijke grafiek per klant');
  assert.equal(await page.locator('#modalRoot .finance-kpis').count(),0,'Geen uitgebreide financiële KPI-kaarten');
  assert.equal(await page.locator('#modalRoot .dual-stats-chart').count(),0,'Geen oude dubbele periodegrafieken');
  assert.doesNotMatch(await page.locator('#modalRoot').innerText(),/Berekende urenwaarde|Gefactureerd incl\\. btw|Effectief afgesproken|Effectief ontvangen|Afgesproken omzet/);
  await page.locator('[data-stat-mode="month"]').click();
  assert.equal(await page.locator('#modalRoot .stats-period-chart-col').count(),12,'12 maanden in een gecombineerde grafiek');
  const jan=page.locator('#modalRoot .stats-period-chart-col[aria-label*="jan"]');
  assert.match(await jan.getAttribute('aria-label'),/200,00.*50,00/);
  assert.doesNotMatch(await page.locator('#modalRoot').innerText(),/afgesproken|270,00/i,'Maandstatistieken bevatten geen afgesproken bedragen');
  assert.match(await jan.innerText(),/200,00[\s\S]*50,00/,'Ontvangen en nog te ontvangen beide zichtbaar boven staaf');
  assert.equal(await jan.locator('.stats-period-chart-open').count(),1,'Nog niet ontvangen als deel van dezelfde staaf');
  assert.equal(await page.evaluate(()=>{const c=document.querySelector('.stats-period-chart-scroll');return c.scrollWidth>c.clientWidth}),true,'Grafiek schuift horizontaal op mobiel');
  assert.equal(await page.locator('#modalRoot .stats-client-combined').count(),0);
  assert.doesNotMatch(await page.locator('#modalRoot').innerText(),/Zonder betaaldatum/,'Betaaldatum stuurt maand niet meer');
  await page.locator('[data-stat-mode="quarter"]').click();
  assert.equal(await page.locator('#modalRoot .stats-period-chart-col').count(),8,'8 kwartalen met gecombineerde balken');
  assert.match(await page.locator('#modalRoot .stats-period-chart-col[aria-label*="Q1"]').last().getAttribute('aria-label'),/200,00.*50,00/);
  assert.doesNotMatch(await page.locator('#modalRoot').innerText(),/afgesproken|270,00/i,'Kwartaal zonder afgesproken');
  await page.locator('[data-stat-mode="year"]').click();
  assert.equal(await page.locator('#modalRoot .stats-period-chart-col').count(),1,'Jaarweergave met beide bedragen');
  assert.match(await page.locator('#modalRoot .stats-period-chart-value').innerText(),/200,00[\s\S]*50,00/);
  assert.doesNotMatch(await page.locator('#modalRoot').innerText(),/afgesproken|270,00/i,'Jaar zonder afgesproken');
  await page.locator('[data-stat-mode="client"]').click();
  assert.match(await page.locator('#modalRoot .stats-client-combined').innerText(),/Fictieve klant/);
  await page.locator('[data-stat-mode="payment"]').click();
  assert.equal(await page.locator('#modalRoot [data-payment-group="cash"]').count(),1);
  assert.equal(await page.locator('#modalRoot [data-payment-group="bank"]').count(),1);
  assert.equal(await page.locator('#modalRoot .payment-invoice-values > div').count(),2);
  assert.match(await page.locator('#modalRoot .payment-invoice-detail').innerText(),/Ontvangen via facturen[\s\S]*Waarvan ontvangen btw/);
  assert.equal(await page.locator('#customerStatsYear').inputValue(),String(stats.fixtureYear));
  assert.equal(await page.locator('#modalRoot .stats-comparison-summary').count(),0,'Nieuwe betaalwijze-tab vervangt niet de andere statistieken');
  await page.locator('[data-stat-mode="client"]').click();
  assert.match(await page.locator('#modalRoot .stats-client-combined').innerText(),/Fictieve klant/);

  console.log('PASS: uren per klant en uitsluitend ontvangen/openstaande verdiensten in klanten-, maand-, kwartaal- en jaaroverzichten');
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
  assert.equal(await page.locator('#view #clientsDash').count(),0,'Klanten niet meer als dashboardknop');
  assert.equal(await page.locator('#view .quick[data-go="gear"]').count(),0,'Materiaal niet meer als dashboardknop');
  for(const id of ['#newJobDash','#addHours','#newQuote','#newInvoice','#timeStatsDash'])assert.equal(await page.locator('#view '+id).count(),1,'Overige dashboardknop blijft: '+id);
  assert.equal(await page.locator('.bottom-nav [data-route="gear"]').count(),1,'Materiaal blijft via hoofdnavigatie bereikbaar');
  assert.equal(await page.locator('.bottom-nav [data-route="more"]').count(),1,'Klanten blijven via Meer bereikbaar');
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
  const baseline={open:await numeric('#jobOpenTotal'),cash:await numeric('.job-totals [data-payment-group="cash"] strong'),bank:await numeric('.job-totals [data-payment-group="bank"] strong')};
  assert.equal(await page.locator('.job-totals [data-payment-group="bank"] span').innerText(),'Bank','Alleen Bank als label op Klussen');
  assert.equal(await page.locator('.job-totals .payment-invoice-detail').count(),0,'Factuur-btw alleen in Statistieken');
  assert.equal(await page.locator('.job-totals .payment-method-box').count(),2,'Twee betalingenkaarten in Klussen');
  const recordsBefore=await page.evaluate(async()=>JSON.stringify({hours:await JKDB.all('timeEntries'),docs:await JKDB.all('documents'),payments:(await JKDB.all('settings')).filter(r=>r.kind==='jkPayment')}));
  await page.evaluate(async()=>{
    await JKDB.putLocal('jobs',{id:'settlement',clientId:'client',clientName:'Fictieve klant',title:'Vaste afspraak later klaar',pricingType:'fixed',agreedAmount:150,paymentType:'invoice',status:'gepland',date:'2026-10-01',workDays:[{date:'2026-10-01',startTime:'08:00',endTime:'16:00'},{date:'2026-10-25',startTime:'08:00',endTime:'16:00'}]});
    await JKDB.putLocal('jobs',{id:'settlement-cash',title:'Contante afspraak',pricingType:'fixed',agreedAmount:200,paymentType:'cash',status:'open',date:'2026-10-01'});
    await App.renderJobs();
  });
  assert.equal(await numeric('#jobOpenTotal'),baseline.open);assert.equal(await numeric('.job-totals [data-payment-group="cash"] strong'),baseline.cash);assert.equal(await numeric('.job-totals [data-payment-group="bank"] strong'),baseline.bank);
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
  for(const filter of ['cash','invoice','all']){await page.locator(`[data-jpf="${filter}"]`).click();await page.waitForFunction(value=>document.querySelector(`[data-jpf="${value}"]`).classList.contains('active'),filter);assert.equal(await numeric('#jobOpenTotal'),baseline.open+150);assert.equal(await numeric('.job-totals [data-payment-group="cash"] strong'),baseline.cash);assert.equal(await numeric('.job-totals [data-payment-group="bank"] strong'),baseline.bank);}
  for(const width of [390,1024]){
    await page.setViewportSize({width,height:844});
    const layout=await page.locator('.job-totals').evaluate(e=>{
      const open=e.querySelector('.job-open-filter'),methods=[...e.querySelectorAll('.payment-method-box')],
        style=getComputedStyle(open),cash=methods[0].getBoundingClientRect(),bank=methods[1].getBoundingClientRect();
      const first=open.getBoundingClientRect();
      return {fits:e.scrollWidth<=e.clientWidth,center:style.textAlign,color:style.color,bg:style.backgroundColor,
        fullWidth:first.width>Math.max(cash.width,bank.width)*1.9,below:cash.top>=first.bottom&&Math.abs(cash.top-bank.top)<2,
        noInvoices:e.querySelectorAll('.payment-invoice-detail').length===0,note:e.querySelectorAll('p').length};
    });
    assert.ok(layout.fits&&layout.fullWidth&&layout.below&&layout.noInvoices);
    assert.equal(layout.center,'center');assert.equal(layout.bg,'rgb(254, 228, 226)');
    assert.equal(layout.color,'rgb(180, 35, 24)');assert.equal(layout.note,0);
  }await page.setViewportSize({width:390,height:844});
  const preserved=await page.evaluate(async()=>JSON.stringify({hours:await JKDB.all('timeEntries'),docs:await JKDB.all('documents'),payments:(await JKDB.all('settings')).filter(r=>r.kind==='jkPayment')}));assert.equal(preserved,recordsBefore,'Changing settlement status never rewrites hours, invoices or payments');
  await page.evaluate(async()=>{await JKDB.putLocal('settings',{id:'settlement-payment',kind:'jkPayment',jobId:'settlement',amount:100,date:'2026-10-21',method:'bank'});await App.renderJobs();});assert.equal((await settlementMetrics()).open,50);assert.equal((await settlementMetrics()).received,100);assert.equal((await settlementMetrics()).paid,false);assert.equal(await numeric('#jobOpenTotal'),baseline.open+50);assert.equal(await numeric('.job-totals [data-payment-group="bank"] strong'),baseline.bank+100);
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
  assert.equal(await numeric('.job-totals [data-payment-group="cash"] strong'),baseline.cash+50);assert.equal(await numeric('.job-totals [data-payment-group="bank"] strong'),baseline.bank+130);
  assert.equal(await numeric('.job-totals [data-payment-group="bank"] strong'),baseline.bank+130);assert.equal(await numeric('#jobOpenTotal'),baseline.open+50,'Only orphan invoice remainder is newly outstanding');
  await page.evaluate(async()=>{const p=await JKDB.get('settings','settlement-payment');await JKDB.putLocal('settings',{...p,invoiceId:'received-linked',amount:150});await App.renderJobs();});
  assert.equal(await numeric('.job-totals [data-payment-group="bank"] strong'),baseline.bank+180);assert.equal(await page.locator('.job-totals .payment-invoice-detail').count(),0,'Geen factuur-specificatie op Klussen');assert.equal(await numeric('.job-totals [data-payment-group="cash"] strong'),baseline.cash+50);
  await page.evaluate(async()=>{const p=await JKDB.get('settings','received-cash');await JKDB.putLocal('settings',{...p,voided:true});await App.renderJobs();});assert.equal(await numeric('.job-totals [data-payment-group="cash"] strong'),baseline.cash);assert.equal(await numeric('.job-totals [data-payment-group="bank"] strong'),baseline.bank+180);assert.equal(await page.locator('.job-totals .payment-invoice-detail').count(),0);
  console.log('PASS: uitsluitend ontvangen contant/bank, deelbetalingen, onbetaalde afspraken uitgesloten, gekoppelde/losse facturen, wijzigen en verwijderen; gecentreerd rood openstaand en witte totalen zonder toelichting');
  console.log('PASS: compact klussaldo en betaalwijzeverdeling zonder factuurblok; openstaand uitsluitend afgerond én laatste einde voorbij; dashboard, filters, toekomst/heropenen, deelbetaling, nachtwerk/middernacht en bytegelijk behoud uren/facturen/betalingen');
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

  // Alle uitsluitend fictieve registraties: materiaalvergoedingen zijn geen eigen inkomsten.
  const earnings=await page.evaluate(async()=>{
    const year=fixtureYear;
    const mkJob=(id,agreedAmount,extraAmount=0,extraIncluded=false)=>({
      id,clientId:'client',clientName:'Fictieve klant',date:year+'-01-15',
      pricingType:'fixed',agreedAmount,extraAmount,extraIncluded
    });
    const mkDoc=(id,jobId,total,lines)=>({
      id,folder:'factuur',meta:{jobId,docDate:year+'-01-15',workDate:year+'-01-15',total,korApplied:true,lines}
    });
    const mkPay=(id,amount,jobId,invoiceId,date)=>({
      id,kind:'jkPayment',amount,jobId:invoiceId?'':jobId,invoiceId,date,method:'bank'
    });
    const run=(jobs,documents,settings)=>{
      const snapshot=JKFinance.snapshot(jobs,documents,settings,j=>JKFinance.price(j,0,35));
      const before=JSON.stringify({jobs,documents,settings});
      const events=App.financialEvents([],jobs,{},snapshot);
      return {ownAgreed:events.reduce((n,e)=>n+(e.amount||0),0),
        ownReceived:events.reduce((n,e)=>n+(e.received||0),0),
        receipts:events.filter(e=>e.received||e.undatedReceived).map(e=>({date:e.date,received:e.received})),
        oldGrossReceived:snapshot.receipts.reduce((n,p)=>n+p.amount,0),
        unchanged:before===JSON.stringify({jobs,documents,settings})};
    };
    const job=mkJob('profit',150,40);
    const doc=mkDoc('invoice-profit','profit',190,[{qty:1,price:150,description:'Montage'},{qty:1,price:40,description:'Bon',expenseId:'bon-1'}]);
    const full=run([job],[doc],[mkPay('profit-p1',100,'profit','',year+'-01-20'),mkPay('profit-p2',90,'profit','invoice-profit',year+'-02-20')]);
    const included=run([mkJob('included',150,40,true)],[],[mkPay('inc-pay',150,'included','',year+'-02-20')]);
    const receiptOnly=run([mkJob('receipt',150)],[mkDoc('receipt-doc','receipt',190,[{qty:1,price:150,description:'Montage'},{qty:1,price:40,description:'Bon',expenseId:'bon-2'}])],
      [mkPay('receipt-pay',190,'receipt','receipt-doc',year+'-02-20')]);
    const allIn=run([mkJob('all-in',190)],[mkDoc('all-in-doc','all-in',190,[{qty:1,price:150,description:'Montage'},{qty:1,price:40,description:'Bon',expenseId:'bon-3'}])],
      [mkPay('all-in-pay',190,'all-in','all-in-doc',year+'-02-20')]);
    const extraLine=run([mkJob('extra-line',150,40)],[mkDoc('extra-line-doc','extra-line',210,[
      {qty:1,price:150,description:'Montage'},
      {qty:1,price:40,description:'Bon',expenseId:'bon-4'},
      {qty:1,price:20,description:'Extra kosten / materiaal'}
    ])],[mkPay('extra-line-pay',210,'extra-line','extra-line-doc',year+'-02-20')]);
    const orphan=run([],[mkDoc('orphan-profit','',190,[{qty:1,price:150,description:'Montage'},{qty:1,price:40,description:'Bon',expenseId:'bon-orphan'}])],
      [mkPay('orphan-p',190,'','orphan-profit',year+'-02-20')]);
    const partial=run([job],[doc],[mkPay('partial-p',100,'profit','invoice-profit',year+'-01-20')]);
    const tip=run([job],[doc],[mkPay('tip-p',200,'profit','invoice-profit',year+'-02-20')]);
    const noCost=run([mkJob('labor',150)],[],[mkPay('labor-p',150,'labor','',year+'-02-20')]);
    return {year,full,included,receiptOnly,allIn,extraLine,orphan,partial,tip,noCost};
  });
  assert.equal(earnings.full.ownAgreed,150);
  assert.equal(earnings.full.oldGrossReceived,190,'Betalingsregister bevat nog steeds de volledige ontvangst');
  assert.equal(earnings.full.ownReceived,150,'Eigen verdiensten tellen geen €40 bonvergoeding');
  assert.deepEqual(earnings.full.receipts,[{date:earnings.year+'-01-15',received:100},{date:earnings.year+'-01-15',received:50}],
    'Beide betalingen horen bij de uitvoerdatum, zonder dubbel tellen');
  for(const [key,agreed,received] of [
    ['included',110,110],['receiptOnly',150,150],['allIn',150,150],['extraLine',150,150],['noCost',150,150]
  ]){
    assert.equal(earnings[key].ownAgreed,agreed,key+' Afgesproken zonder materiaal');
    assert.equal(earnings[key].ownReceived,received,key+' Ontvangen zonder materiaal');
    assert.equal(earnings[key].unchanged,true,key+' registraties niet gemuteerd');
  }
  assert.equal(earnings.orphan.ownReceived,150,'Losse factuur: ook bonvergoeding uitsluiten');
  assert.equal(earnings.partial.ownReceived,100,'Deelbetaling niet verlagen met nog niet ontvangen materiaalvergoeding');
  assert.equal(earnings.tip.ownReceived,160,'Meerbetaling boven klussom hoort bij eigen inkomsten');

  // Fictieve KOR-/21%-facturen, deelbetalingen, bank + betaalverzoek en
  // voorschotbonnen: de factuurspecificatie is geen extra inkomstencategorie.
  const methodFixture=await page.evaluate(()=>{
    const year=fixtureYear, next=String(year+1);
    const jobs=[
      {id:'tax',date:year+'-02-01',pricingType:'fixed',agreedAmount:121,clientId:'client'},
      {id:'cash',date:year+'-02-02',pricingType:'fixed',agreedAmount:70,paymentType:'cash'},
      {id:'reimburse',date:year+'-02-03',pricingType:'fixed',agreedAmount:190,extraAmount:40,extraIncluded:true,paymentType:'invoice'},
      {id:'next',date:next+'-02-01',pricingType:'fixed',agreedAmount:30,paymentType:'cash'}
    ];
    const docs=[
      {id:'tax-invoice',folder:'factuur',meta:{jobId:'tax',total:121,vatAmount:21,korApplied:false,workDate:year+'-02-01'}},
      {id:'kor-invoice',folder:'factuur',meta:{jobId:'reimburse',total:190,vatAmount:0,korApplied:true,workDate:year+'-02-03',
        lines:[{qty:1,price:150,description:'Werk'},{qty:1,price:40,description:'Bon',expenseId:'bon-1'}]}}
    ];
    const pay=[
      {id:'tax-p1',kind:'jkPayment',invoiceId:'tax-invoice',amount:60.5,method:'card',date:year+'-02-15'},
      {id:'tax-p2',kind:'jkPayment',jobId:'tax',amount:60.5,method:'bank',date:year+'-03-01'},
      {id:'cash-p',kind:'jkPayment',jobId:'cash',amount:70,method:'cash',date:year+'-02-10'},
      {id:'kor-p',kind:'jkPayment',invoiceId:'kor-invoice',amount:190,method:'bank',date:year+'-03-10'},
      {id:'next-p',kind:'jkPayment',jobId:'next',amount:30,method:'cash',date:next+'-02-20'}
    ];
    const f=JKFinance.snapshot(jobs,docs,pay,j=>JKFinance.price(j,0,10),()=>true);
    const yearly=App.paymentMethodOverview([],jobs,{},f,year);
    const all=App.paymentMethodOverview([],jobs,{},f);
    const partial=JKFinance.snapshot(jobs,docs,pay.filter(x=>x.id!=='tax-p2'),j=>JKFinance.price(j,0,10),()=>true);
    const partialResult=App.paymentMethodOverview([],jobs,{},partial,year);
    return {yearly,all,partialResult,original:JSON.stringify({jobs,docs,pay}),
      sumEarned:App.financialEvents([],jobs,{},f).reduce((n,e)=>n+(e.received||0),0)};
  });
  assert.equal(methodFixture.yearly.cash,70,'Contant telt alleen contante ontvangsten');
  assert.equal(methodFixture.yearly.bankAndRequest,271,'Bank en betaalverzoek samen, geen € 40 voorschotbon');
  assert.equal(methodFixture.yearly.invoiceGross,311,'Factuurontvangsten inclusief btw, geen dubbeltelling van algemene klusbetaling');
  assert.equal(methodFixture.yearly.invoiceVat,21,'Werkelijk ontvangen btw bij volledig betaalde 21%-factuur, KOR €0');
  assert.equal(methodFixture.partialResult.invoiceGross,250.5,'Deelfactuur + KOR-factuur correct');
  assert.equal(methodFixture.partialResult.invoiceVat,10.5,'Btw bij halfbetaalde factuur slechts half meegeteld');
  assert.equal(methodFixture.all.cash,100,'Alle jaren samen telt contant 2027 ook mee');
  assert.equal(methodFixture.yearly.cash+methodFixture.yearly.bankAndRequest,methodFixture.sumEarned-30,'Betaalwijzevergelijking gebruikt exact dezelfde eigen ontvangen verdiensten');
  const methodHtml=await page.evaluate(()=>App.paymentMethodOverviewHtml({cash:70,bankAndRequest:271,other:0,unknown:0,invoiceGross:311,invoiceVat:21}));
  assert.match(methodHtml,/Bank \+ betaalverzoek/);
  assert.doesNotMatch(methodHtml,/data-payment-group="other"/,'Geen lege restcategorie');
  console.log('PASS: contant apart, bank en betaalverzoek samen, btw naar betaalde factuurdelen, KOR nul en voorschotten uitgesloten');

  // Eigen verdiensten en openstaand volgen de LAATSTE uitvoerdag, nooit de betaling.
  const endDateStats=await page.evaluate(()=>{
    const workDays=[{id:'d1',date:'2026-05-31'},{id:'d2',date:'2026-06-02'}];
    const job={id:'lastday',title:'Twee werkdagen',clientId:'client',clientName:'Fictieve klant',date:'2026-05-31',workDays,status:'afgerond',pricingType:'fixed',agreedAmount:150,extraAmount:40};
    const p=(amount,date)=>({id:'paid-'+amount,kind:'jkPayment',jobId:'lastday',amount,date,method:'bank'});
    const snap=rows=>JKFinance.snapshot([job],[],rows,j=>JKFinance.price(j,0,10),()=>true);
    const view=rows=>{
      const f=snap(rows),events=App.financialEvents([], [job], {},f),own=events.filter(e=>e.date==='2026-06-02'),moneyEvents=own.filter(e=>e.received||e.open||e.amount);
      const chart=App.simpleStatsChartHtml([{key:'2026-06',label:'jun',sort:'2026-06',received:own.reduce((n,e)=>n+(e.received||0),0),open:own.reduce((n,e)=>n+(e.open||0),0)}],'received');
      return {gross:f.job(job).received,openGross:f.job(job).open,earned:own.reduce((n,e)=>n+(e.received||0),0),ownOpen:own.reduce((n,e)=>n+(e.open||0),0),agreed:own.reduce((n,e)=>n+(e.amount||0),0),moneyEvents:moneyEvents.length,
        otherDates:events.filter(e=>e.received||e.open||e.amount).map(e=>e.date),chart};
    };
    const partial=view([p(130,'2026-07-21')]);
    const allPaid=view([p(190,'2026-08-21')]);
    const costsOnlyOpen=view([p(150,'2026-08-21')]);
    const undatedPaid=view([p(130,'')]);
    const waived=view([p(130,'2026-07-21'),{id:'settled-60',kind:'jkWriteoff',jobId:job.id,amount:60}]);
    const future={...job,id:'crossyear',date:'2026-12-30',workDays:[{date:'2026-12-30'},{date:'2027-01-02'}],extraAmount:0};
    const crossSnapshot=JKFinance.snapshot([future],[],[{id:'cross-payment',kind:'jkPayment',jobId:'crossyear',date:'2027-03-03',amount:100}],j=>JKFinance.price(j,0,10),()=>true);
    const crossYear=App.financialEvents([], [future],{},crossSnapshot).filter(e=>e.received||e.amount).map(e=>({date:e.date,received:e.received||0,amount:e.amount||0}));
    const orphan={id:'orphan-two',folder:'factuur',meta:{jobId:'',workDate:'02-06-2026',docDate:'2026-07-21',total:190,korApplied:true,lines:[{qty:1,price:150,description:'Werk'},{qty:1,price:40,expenseId:'bon-x',description:'Bon'}]}};
    const orphanPay={id:'orphan-paid',kind:'jkPayment',invoiceId:'orphan-two',amount:190,date:'2026-08-01'};
    const orphanFinance=JKFinance.snapshot([], [orphan],[orphanPay],()=>JKFinance.price({},0,10),()=>true);
    const orphanEvents=App.financialEvents([], [],{},orphanFinance).filter(e=>e.received||e.amount).map(e=>({date:e.date,received:e.received||0,amount:e.amount||0}));
    const withoutDate={...orphan,id:'orphan-undated',meta:{...orphan.meta,workDate:''}};
    const withoutPay={...orphanPay,id:'orphan-unpaid-date',invoiceId:'orphan-undated'};
    const noDateFinance=JKFinance.snapshot([], [withoutDate],[withoutPay],()=>JKFinance.price({},0,10),()=>true);
    const noDateEvents=App.financialEvents([],[],{},noDateFinance);
    const noDate={datedTotal:noDateEvents.reduce((n,e)=>n+(e.received||0),0),undatedTotal:noDateEvents.reduce((n,e)=>n+(e.undatedReceived||0),0)};
    const onlyOpenChart=App.simpleStatsChartHtml([{key:'2026-06',label:'jun',received:0,open:50}],'received');
    const noCostChart=App.simpleStatsChartHtml([{key:'2026-06',label:'jun',received:150,open:0}],'received');
    return {partial,allPaid,costsOnlyOpen,undatedPaid,waived,crossYear,orphanEvents,noDate,onlyOpenChart,noCostChart};
  });
  assert.equal(endDateStats.partial.gross,130);
  assert.equal(endDateStats.partial.openGross,60,'Bruto openstaand bevat 40 euro voorgeschoten kosten');
  assert.equal(endDateStats.partial.agreed,150,'Afgesproken uitsluitend eigen werkzaamheden');
  assert.equal(endDateStats.partial.earned,130,'Betaald in juli, als eigen inkomen in juni');
  assert.equal(endDateStats.partial.ownOpen,20,'Rood bevat geen 40 euro openstaande materialen');
  assert.ok(endDateStats.partial.otherDates.every(d=>d==='2026-06-02'),'Alle inkomsten en openstanden op laatste uitvoerdag');
  assert.match(endDateStats.partial.chart,/stats-period-chart-open/);
  assert.match(endDateStats.partial.chart,/20,00 openstaand/);
  assert.equal(endDateStats.allPaid.earned,150,'Volledig betaalde 190 euro levert 150 euro eigen verdiensten op');
  assert.equal(endDateStats.allPaid.ownOpen,0,'Openstaand rood verdwijnt na volledige betaling');
  assert.equal(endDateStats.costsOnlyOpen.ownOpen,0,'Alleen nog kosten open: geen rood deel in verdiensten');
  assert.equal(endDateStats.undatedPaid.earned,130,'Ongedateerde oude betaling hoort bij bekende uitvoerdatum');
  assert.equal(endDateStats.waived.earned,130);
  assert.equal(endDateStats.waived.ownOpen,0,'Kwijtgescholden restant verschijnt niet als achterstallige eigen omzet');
  assert.deepEqual(endDateStats.crossYear,[{date:'2027-01-02',received:0,amount:150},{date:'2027-01-02',received:100,amount:0}],
    'Werk afgelopen in januari 2027 blijft in 2027, ook bij latere betaling');
  assert.deepEqual(endDateStats.orphanEvents,[{date:'2026-06-02',received:150,amount:0},{date:'2026-06-02',received:0,amount:150}],
    'Losse factuur met expliciete werkdatum telt eigen verdiensten en geen bonkosten');
  assert.deepEqual(endDateStats.noDate,{datedTotal:0,undatedTotal:150},'Ontbrekende uitvoerdatum valt niet terug op factuur-/betaaldatum');
  assert.match(endDateStats.onlyOpenChart,/stats-period-chart-open/,'Niets betaald: toch volledig rode staaf');
  assert.doesNotMatch(endDateStats.noCostChart,/stats-period-chart-open/,'Geen rood bij volledig betaald eigen werk');
  // Afgerond bedrag wordt niet opnieuw als openstaande schuld getoond.
  // Voorbeeld: afgesproken 150, ontvangen 112,50, handmatig afgerond 37,50.
  const roundedStats=await page.evaluate(()=>{
    const job={id:'rounded-test',title:'Afgeronde klus',clientId:'client',clientName:'Testklant',date:'2026-06-02',status:'afgerond',pricingType:'fixed',agreedAmount:150};
    const payment={id:'testpayment',kind:'jkPayment',jobId:job.id,amount:112.50,date:'2026-06-18'};
    const writeoff={id:'writeoff:job:rounded-test',kind:'jkWriteoff',jobId:job.id,amount:37.50,date:'2026-06-19'};
    const calc=rows=>{
      const fin=JKFinance.snapshot([job],[],rows,j=>JKFinance.price(j,0,0),()=>true);
      const events=App.financialEvents([], [job], {}, fin);
      const totals=events.reduce((a,e)=>({amount:a.amount+(e.amount||0),received:a.received+(e.received||0),open:a.open+(e.open||0),waived:a.waived+(e.waived||0)}),{amount:0,received:0,open:0,waived:0});
      const bucket={...totals,key:'2026-06',label:'jun',minutes:180};
      return {financeOpen:fin.job(job).open,financeWaived:fin.job(job).waived,totals,
        client:App.statsComparisonChartHtml([bucket],true),
        period:App.statsComparisonChartHtml([bucket],false)};
    };
    return {rounded:calc([payment,writeoff]),unrounded:calc([payment]),reversed:calc([payment,{...writeoff,voided:true}])};
  });
  assert.equal(roundedStats.rounded.financeOpen,0,'Klus is niet langer openstaand');
  assert.equal(roundedStats.rounded.financeWaived,37.5,'Afronding volgens het financiële register');
  assert.deepEqual(roundedStats.rounded.totals,{amount:150,received:112.5,open:0,waived:37.5},'Statistieken kennen eigen afgeronde bedrag');
  assert.match(roundedStats.rounded.client,/112,50 ontvangen/,'Werkelijk ontvangen bedrag blijft zichtbaar');
  assert.doesNotMatch(roundedStats.rounded.client,/150,00|afgesproken/i,'Afspraak verschijnt nergens in klantgrafiek');
  assert.doesNotMatch(roundedStats.rounded.client,/37,50|afgerond|afgeboekt|kwijtgescholden|stats-client-chart-waived|stats-chart-dot-waived|stats-comparison-writtenoff/i,
    'In klantstatistieken nergens een afgeboekt bedrag, tekst of grijs segment');
  assert.doesNotMatch(roundedStats.rounded.client,/class="stats-client-chart-open"/,'Geen rode restschuld voor afgeronde klant');
  assert.doesNotMatch(roundedStats.rounded.client,/37,50 nog te ontvangen/,'Niet opnieuw als schuld presenteren');
  assert.match(roundedStats.rounded.period,/112,50/,'Maand behoudt werkelijk ontvangen bedrag');
  assert.doesNotMatch(roundedStats.rounded.period,/150,00|afgesproken/i,'Maand toont geen afgesproken bedrag');
  assert.doesNotMatch(roundedStats.rounded.period,/37,50|afgerond|afgeboekt|kwijtgescholden|stats-period-chart-waived|stats-chart-dot-waived/i,
    'In periodegrafiek nergens een afgeboekt bedrag, tekst of grijs segment');
  assert.doesNotMatch(roundedStats.rounded.period,/stats-period-chart-open/,'Per maand geen rode restschuld');
  assert.equal(roundedStats.unrounded.financeOpen,37.5,'Zonder afronding is er wel restschuld');
  assert.equal(roundedStats.unrounded.totals.open,37.5,'Restschuld uit Klussen overgenomen');
  assert.match(roundedStats.unrounded.client,/37,50 nog te ontvangen/);
  assert.match(roundedStats.unrounded.client,/class="stats-client-chart-open"/);
  assert.equal(roundedStats.reversed.totals.waived,0,'Geannuleerde afboeking wordt niet meer weergegeven');
  assert.equal(roundedStats.reversed.totals.open,37.5,'Schuld komt terug als de afboeking is geannuleerd');
  console.log('PASS: afgeboekt bedrag volledig verborgen bij klant en periode, alleen werkelijk openstaande schulden rood, klantbalken 14 px');
  console.log('PASS: alleen eigen verdiensten en transparant rood openstaand per laatste uitvoerdag, ook meerdaags, over jaargrens, los, ongedateerd en kwijtschelding');
  console.log('PASS: alleen eigen verdiensten zonder voorgeschoten bonnetjes/extra kosten, incl. KOR, factuurregels, deelbetaling, losse factuur en ongewijzigde betaalrecords');
  // Apart en alleen op de klus: afwijkende werklocatie bij klant uit Zwijndrecht.
  // Zowel offerte als factuur moeten gewoon klantadres blijven gebruiken.
  await page.evaluate(async()=>{
    await JKDB.putLocal('clients',{id:'address-client',name:'Bedrijf Zwijndrecht',street:'Klantstraat 10',postal:'3331 AA',city:'Zwijndrecht',email:'adres@example.org'});
    await JKDB.putLocal('jobs',{id:'address-job',title:'Montage in Barendrecht',clientId:'address-client',clientName:'Bedrijf Zwijndrecht',street:'Klantstraat 10',postal:'3331 AA',city:'Zwijndrecht',date:'2026-10-20',status:'gepland',pricingType:'fixed',agreedAmount:100});
    await App.editJob('address-job');
  });
  assert.equal(await page.locator('#jobExecutionDifferent').isChecked(),false,'Nieuw uitvoeringsadres staat standaard uit');
  assert.equal(await page.locator('#jobExecutionAddressFields').isVisible(),false,'Adresvelden zijn standaard ingeklapt');
  await page.locator('#jobExecutionDifferent').check();
  assert.equal(await page.locator('#jobExecutionAddressFields').isVisible(),true,'Adresvelden klappen direct uit bij aanvinken');
  await page.locator('[name=executionStreet]').fill('Klusstraat 25');
  await page.locator('[name=executionPostal]').fill('2991 BB');
  await page.locator('[name=executionCity]').fill('Barendrecht');
  assert.equal(await page.locator('[name=street]').inputValue(),'Klantstraat 10','Klantadres is apart en ongewijzigd');
  await page.locator('#jobForm button.primary').click();
  await page.waitForFunction(()=>!document.querySelector('#jobForm'));
  const executionStored=await page.evaluate(async()=>{
    const j=await JKDB.get('jobs','address-job'),c=await JKDB.get('clients','address-client');
    return {job:j.executionAddress,jobClientStreet:j.street,client:{street:c.street,postal:c.postal,city:c.city}};
  });
  assert.deepEqual(executionStored,{job:{street:'Klusstraat 25',postal:'2991 BB',city:'Barendrecht'},jobClientStreet:'Klantstraat 10',client:{street:'Klantstraat 10',postal:'3331 AA',city:'Zwijndrecht'}},'Alleen klus krijgt het uitvoeringsadres, niet de klant');
  await page.evaluate(()=>App.showJob('address-job'));
  assert.match(await page.locator('#modalRoot .job-execution-summary').innerText(),/Klusstraat 25[\s\S]*2991 BB Barendrecht/,'Uitvoeringsadres staat op klusdetail');
  assert.match(await page.locator('#modalRoot').innerText(),/Klantstraat 10/,'Klantgegevens blijven zichtbaar');
  await page.evaluate(()=>App.createBusinessDoc('Offerte',{jobId:'address-job'}));
  assert.equal(await page.locator('[name=address]').inputValue(),'Klantstraat 10','Offerte gebruikt klantadres');
  assert.match(await page.locator('[name=postalCity]').inputValue(),/3331 AA.*Zwijndrecht/,'Offerte gebruikt klantplaats');
  assert.doesNotMatch(await page.locator('#businessDocForm').innerText(),/Klusstraat 25|2991 BB/,'Uitvoeringsadres niet op offerte');
  await page.evaluate(()=>App.createBusinessDoc('Factuur',{jobId:'address-job'}));
  assert.equal(await page.locator('[name=address]').inputValue(),'Klantstraat 10','Factuur gebruikt klantadres');
  assert.match(await page.locator('[name=postalCity]').inputValue(),/3331 AA.*Zwijndrecht/,'Factuur gebruikt klantplaats');
  assert.doesNotMatch(await page.locator('#businessDocForm').innerText(),/Klusstraat 25|2991 BB/,'Uitvoeringsadres niet op factuur');
  await page.evaluate(()=>App.editJob('address-job'));
  assert.equal(await page.locator('#jobExecutionDifferent').isChecked(),true,'Bij heropenen staat afwijkend adres nog aangevinkt');
  assert.equal(await page.locator('[name=executionStreet]').inputValue(),'Klusstraat 25','Uitvoeringsadres wordt teruggeladen');
  await page.locator('#jobExecutionDifferent').uncheck();
  assert.equal(await page.locator('#jobExecutionAddressFields').isVisible(),false,'Adresveld klapt weer in');
  await page.locator('#jobForm button.primary').click();
  await page.waitForFunction(()=>!document.querySelector('#jobForm'));
  const cleared=await page.evaluate(async()=>({job:await JKDB.get('jobs','address-job'),client:await JKDB.get('clients','address-client')}));
  assert.equal(cleared.job.executionAddress,null,'Uitvinken wist het afwijkende uitvoeringsadres');
  assert.equal(cleared.client.street,'Klantstraat 10','Klantadres blijft na uitvinken intact');
  await page.evaluate(async()=>{await JKDB.remove('jobs','address-job');await JKDB.remove('clients','address-client');});
  console.log('PASS: optioneel uitvoeringsadres klapt uit, bewaart los op klus, toont op detail en blijft weg van offerte/factuur');
  // 4x6-label: bewerkbare printkopie zonder opgeslagen klus / factuur te wijzigen.
  await page.evaluate(async()=>{
    await App.showJob('fixed');
  });
  assert.equal(await page.locator('#labelThisJob').count(),1,'Werkbonknop in klusdetails');
  await page.locator('#labelThisJob').click();
  await page.locator('#jobLabelForm [name=number]').waitFor();
  assert.match(await page.locator('#jobLabelForm [name=number]').inputValue(),/^K-2026-\d{3,}$/,'Klusnummer automatisch ingevuld met jaar');
  await page.evaluate(async()=>{
    window.workLabelOriginal=JSON.stringify(await JKDB.get('jobs','fixed'));
    window.workLabelOriginalClient=JSON.stringify(await JKDB.get('clients','client'));
  });
  assert.equal(await page.locator('#jobLabelForm [name=items]').count(),0,'Meeneemlijst niet meer in het bewerkscherm');
  assert.equal(await page.locator('#jobLabelPreview').count(),1);
  await page.waitForFunction(()=>document.querySelector('#jobLabelPreview').naturalWidth===1200);
  const initialImage=await page.locator('#jobLabelPreview').getAttribute('src');
  assert.match(initialImage,/^data:image\/png;base64,/);
  assert.equal(await page.locator('#jobLabelPreview').evaluate(img=>img.naturalHeight),1800,'Label staand 4x6');
  await page.locator('#jobLabelForm [name=title]').fill('Montage kast - werkbonvariant');
  await page.locator('#jobLabelForm [name=notes]').fill('Alleen eigen notitie\nNiet printen');
  await page.locator('#jobLabelForm [name=notes]').fill('Alleen eigen notitie');
  await page.locator('#jobLabelForm [name=payment]').fill('Betaalverzoek');
  await page.locator('#jobLabelRefresh').click();
  const updatedImage=await page.locator('#jobLabelPreview').getAttribute('src');
  assert.notEqual(updatedImage,initialImage,'Bewerkingen komen in bijgewerkt afbeeldingsvoorbeeld');
  assert.equal(await page.locator('#jobLabelError').isVisible(),false,'Geen renderfout');
  assert.deepEqual(await page.evaluate(async()=>({
    job:JSON.stringify(await JKDB.get('jobs','fixed')),client:JSON.stringify(await JKDB.get('clients','client'))
  })),await page.evaluate(()=>({job:window.workLabelOriginal,client:window.workLabelOriginalClient})),'Werkbonwijzigingen wijzigen geen opgeslagen klus of klant');
  await page.evaluate(()=>{
    window.sharedLabelTest=null;
    Object.defineProperty(navigator,'canShare',{configurable:true,value:files=>!!files.files?.length});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
      const file=data.files?.[0];
      window.sharedLabelTest={type:file?.type,name:file?.name,byteLength:file?.size};
    }});
  });
  await page.locator('#jobLabelShare').click();
  await page.waitForFunction(()=>!!window.sharedLabelTest);
  const shared=await page.evaluate(()=>window.sharedLabelTest);
  assert.equal(shared.type,'image/png','Deelkaart ontvangt PNG');
  assert.match(shared.name,/^JK-Works-werkbon-/);
  assert.ok(shared.byteLength>1500,'Deelkaart ontvangt echte PNG-bestandsbytes');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#jobLabelDownload').click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/^JK-Works-werkbon-.+\.png$/,'De printerapp krijgt een PNG');
  await page.locator('#jobLabelForm [name=notes]').fill('Bijzonder lange notitie\n'.repeat(180));
  await page.locator('#jobLabelRefresh').click();
  assert.equal(await page.locator('#jobLabelError').isVisible(),true,'Te lange werkbon wordt niet afgeknipt');
  assert.equal(await page.locator('#jobLabelPreview').getAttribute('src'),null,'Geen misleidend afgeknipte afbeelding');
  const labelFixtures=await page.evaluate(()=>{
    const f=(job,days,entries,today)=>JKJobLabelEditor.defaultData({job,days,entries,today,jobs:[job]});
    const one={id:'job_lame_abc',title:'Dag verplaatst',status:'afgerond'};
    const replaced=f(one,[{date:'2026-10-19',startTime:'09:00',endTime:'12:00'}],
      [{jobId:one.id,date:'2026-10-20',from:'08:30',to:'16:00',minutes:420,actualConfirmed:true}],
      '2026-10-21');
    const mixed=f(one,[{date:'2026-10-19',startTime:'09:00',endTime:'12:00'},{date:'2026-10-24',startTime:'10:00',endTime:'13:00'}],
      [{jobId:one.id,date:'2026-10-20',from:'08:30',to:'16:00',minutes:420,actualConfirmed:true}],
      '2026-10-21');
    const tentative=f(one,[{date:'2026-10-24',startTime:'10:00',endTime:'13:00'}],
      [{jobId:one.id,date:'2026-10-24',from:'10:00',to:'13:00',minutes:180,autoFromJobSchedule:true,actualConfirmed:false}],
      '2026-10-21');
    const abc=[
      {id:'legacy-2025-a',title:'Eerste klus 2025',createdAt:'2025-02-01T10:00:00Z',jobNumber:'K-001'},
      {id:'legacy-2025-b',title:'Tweede klus 2025',createdAt:'2025-06-01T10:00:00Z',jobNumber:'K-002'},
      {id:'legacy-2026-a',title:'Eerste klus 2026',createdAt:'2026-01-02T10:00:00Z',jobNumber:'K-003'},
      {id:'legacy-2026-b',title:'Tweede klus 2026',createdAt:'2026-04-02T10:00:00Z',jobNumber:'K-004'}
    ];
    return JKJobLabelEditor.ensureJobNumbers([abc[3],abc[1],abc[2],abc[0]],j=>j).then(async numbered=>{
      const reversed=await JKJobLabelEditor.ensureJobNumbers(numbered.filter(j=>j.id!==abc[0].id),j=>j);
      const future=await JKJobLabelEditor.ensureJobNumbers([...numbered,{id:'new-year-2027',createdAt:'2027-01-05T08:00:00Z'}],j=>j);
      const moved=JKJobLabelEditor.jobYear({...numbered[2],date:'2028-02-20'});
      const afterLastDeleted=await JKJobLabelEditor.ensureJobNumbers(
        [{...numbered[2]},{id:'new-2026-after-deletion',createdAt:'2026-12-30T11:00:00Z'}],
        j=>j,{'2026':2}
      );
      const preserved=await JKJobLabelEditor.ensureJobNumbers([
        {id:'already-2026',createdAt:'2026-07-01',jobNumber:'K-2026-010'},
        {id:'new-2026-late',createdAt:'2026-08-01'}
      ],j=>j);
      const noPacking=JKJobLabel.render({...mixed,items:'Mag niet afdrukken'}).toDataURL('image/png').slice(0,32);
      return {replaced,mixed,tentative,numbered:numbered.map(j=>[j.id,j.jobNumber]),reversed:reversed.map(j=>j.jobNumber),
        future:future.map(j=>j.jobNumber),moved,afterLastDeleted:afterLastDeleted.map(j=>j.jobNumber),preserved:preserved.map(j=>j.jobNumber),noPacking};
    });
  });
  assert.match(labelFixtures.replaced.planning,/Gewerkt.*20 okt\.? 2026.*08:30 - 16:00/,'Werkelijke dag vervangt verlopen geplande dag');
  assert.doesNotMatch(labelFixtures.replaced.planning,/19 okt|09:00/,'Vervallen plandag wordt niet afgebeeld');
  assert.equal(labelFixtures.replaced.workedHours,'7 uur','Netto bevestigde uren op de bon');
  assert.match(labelFixtures.mixed.planning,/Gepland.*24 okt\.? 2026.*10:00 - 13:00/,'Toekomstige resterende planning blijft');
  assert.equal(labelFixtures.mixed.plannedHours,'3 uur','Nog geplande uren afzonderlijk');
  assert.match(labelFixtures.tentative.planning,/Gepland/,'Onbevestigde automatische uren blijven uitsluitend planning');
  assert.equal(labelFixtures.tentative.workedHours,'','Onbevestigde uren zijn geen gewerkt uur');
  assert.deepEqual(labelFixtures.numbered.map(x=>x[1]),['K-2025-001','K-2025-002','K-2026-001','K-2026-002'],'Per jaar beginnen nummers bij 001, oude nummers worden chronologisch gemigreerd');
  assert.deepEqual(labelFixtures.reversed,['K-2025-002','K-2026-001','K-2026-002'],'Nummers schuiven niet na verwijderen');
  assert.deepEqual(labelFixtures.future,['K-2025-001','K-2025-002','K-2026-001','K-2026-002','K-2027-001'],'Het volgende jaar begint bij 001');
  assert.equal(labelFixtures.moved,2026,'Veranderde uitvoeringsdatum verandert het klusjaar niet');
  assert.deepEqual(labelFixtures.afterLastDeleted,['K-2026-001','K-2026-003'],'Na verwijderen van hoogste nummer gaat teller toch verder');
  assert.deepEqual(labelFixtures.preserved,['K-2026-010','K-2026-011'],'Bestaande jaarcodes blijven behouden');
  assert.match(labelFixtures.noPacking,/^data:image\/png/);
  assert.equal(await page.locator('#jobLabelForm [name=items]').count(),0,'Geen meeneemlijst na bewerken');
  console.log('PASS: werkelijk gewerkte vervangingsdagen, nog geplande dagen, automatische blijvende klusnummers, geen meeneemlijst, PNG-deling en behoud klant-/klusdata');
  // iOS: minimaal 16px voorkomt automatische Safari-focuszoom, zonder pinch-zoom te blokkeren.
  await page.evaluate(()=>App.editJob('fixed'));
  await page.locator('#jobForm').waitFor();
  for(const width of [390,430]){
    await page.setViewportSize({width,height:844});
    const values=await page.evaluate(()=>{
      document.documentElement.classList.add('ios-standalone');
      const frm=document.querySelector('#jobForm');
      const selectors=['[name="title"]','[name="clientName"]','[name="agreedAmount"]','[name="dayDate"]','[name="dayStart"]','[name="email"]','[name="notes"]','[name="status"]','[name="pricingType"]'];
      const inputs=selectors.map(sel=>{
        const el=frm.querySelector(sel);
        if(!el)throw Error('Ontbrekend mobiel invoerveld: '+sel);
        const fontSize=parseFloat(getComputedStyle(el).fontSize);
        el.focus({preventScroll:true});
        const rect=el.getBoundingClientRect(),container=el.closest('.field')?.getBoundingClientRect();
        return {selector:sel,fontSize,fits:!container||rect.right<=container.right+1};
      });
      const modal=document.querySelector('.modal');
      return {inputs,viewport:window.innerWidth,bodyScroll:document.documentElement.scrollWidth,modalScroll:modal.scrollWidth,modalClient:modal.clientWidth,
        scale:window.visualViewport?.scale||1,checkboxSize:parseFloat(getComputedStyle(frm.querySelector('#jobExecutionDifferent')).fontSize)};
    });
    assert.ok(values.inputs.every(i=>i.fontSize>=16),JSON.stringify(values.inputs));
    assert.ok(values.inputs.every(i=>i.fits),'Invoervelden blijven binnen de formulierbreedte: '+JSON.stringify(values.inputs));
    assert.ok(values.bodyScroll<=values.viewport+1,'Geen extra horizontale pagina-zoom/scroll bij '+width+'px');
    assert.ok(values.modalScroll<=values.modalClient+1,'Klusformulier blijft binnen mobiel modal bij '+width+'px');
    assert.ok(values.scale<=1.01,'Geen browserfocuszoom bij '+width+'px');
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{document.documentElement.classList.remove('ios-standalone');App.renderJobs()});
  console.log('PASS: mobiele tekst, cijfers, datums, tijden, selecties en notities minstens 16px zonder inzoomen of horizontale overflow');
  // Vrijwillige vergoeding bij klus van €0 (bijv. familie): correct Betaald,
  // originele afspraak blijft nul en werkbon toont het ontvangen bedrag.
  await page.evaluate(async()=>{
    await JKDB.putLocal('jobs',{id:'gift-job',title:'Familieklus zonder rekening',date:'2026-10-20',status:'afgerond',
      pricingType:'fixed',agreedAmount:0,paymentType:'cash',clientName:'Fictieve familie'});
    await JKDB.putLocal('timeEntries',{id:'gift-work',jobId:'gift-job',date:'2026-10-20',
      from:'09:30',to:'12:00',breakMinutes:0,actualConfirmed:true});
    await JKDB.putLocal('settings',{id:'gift-pay',kind:'jkPayment',jobId:'gift-job',
      amount:75,date:'2026-10-20',method:'cash'});
    await App.refreshFinance();
  });
  const gift=await page.evaluate(async()=>{
    const job=await JKDB.get('jobs','gift-job'),f=App.state.finance.job(job);
    return {agreed:f.agreed,received:f.received,open:f.open,balance:f.balance,paid:f.paid,
      minutes:App.jobMinutes(job,await JKDB.all('timeEntries'))};
  });
  assert.deepEqual(gift,{agreed:0,received:75,open:0,balance:0,paid:true,minutes:150},
    'Ontvangen gift bij gratis 2,5-uurs klus is volledig betaald zonder prijsafspraak te wijzigen');
  await page.evaluate(()=>App.showJob('gift-job'));
  const giftDetail=await page.locator('#modalRoot').innerText();
  assert.match(giftDetail,/€\s*0,00[\s\S]*€\s*75,00[\s\S]*Status:\s*Betaald/,'Details tonen afgesproken €0, ontvangen €75 en Betaald');
  assert.doesNotMatch(giftDetail,/Status:\s*Deels betaald/,'Geen deels betaald bij nul openstaand');
  await page.locator('#labelThisJob').click();
  await page.locator('#jobLabelForm [name=requestedAmount]').waitFor();
  assert.match(await page.locator('#jobLabelForm [name=requestedAmount]').inputValue(),/0,00/,'Op werkbon blijft €0 gevraagd staan');
  assert.match(await page.locator('#jobLabelForm [name=receivedAmount]').inputValue(),/75,00/,'Op werkbon staat daarnaast €75 ontvangen');
  const labelNumbers=await page.evaluate(()=>{
    const form=document.querySelector('#jobLabelForm');
    const snapshot=JKJobLabelEditor.dataFromForm(form);
    const shown=[];
    const previous=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){shown.push(String(text));return previous.call(this,text,...args);};
    try{JKJobLabel.render(snapshot)}finally{CanvasRenderingContext2D.prototype.fillText=previous;}
    return {snapshot,shown};
  });
  assert.match(labelNumbers.snapshot.difference,/^\+\s*€\s*75,00/,'Extra ontvangst toont positief verschil');
  for(const label of ['Gevraagd:','Ontvangen:','Verschil:'])assert.ok(labelNumbers.shown.includes(label),'Werkbon print aparte regel '+label);
  assert.equal(labelNumbers.shown.some(x=>x==='Bedrag:'),false,'Oude enkele bedragregel is verwijderd');
  const comparisons=await page.evaluate(()=>{
    const fn=JKJobLabelEditor.differenceText;
    return {
      more:fn('€ 0,00','€ 75,00'),
      less:fn('€ 100,00','€ 75,00'),
      equal:fn('€ 75,00','€ 75,00'),
      decimals:fn('€ 1.200,50','€ 1.250,75'),
      unknown:fn('Nog te bepalen','€ 75,00')
    };
  });
  assert.match(comparisons.more,/^\+\s*€\s*75,00/,'Meer ontvangen toont plus');
  assert.match(comparisons.less,/^−\s*€\s*25,00/,'Minder ontvangen toont min');
  assert.match(comparisons.equal,/€\s*0,00/,'Gelijk ontvangen toont nulverschil');
  assert.match(comparisons.decimals,/^\+\s*€\s*50,25/,'Duizendtallen en centen correct');
  assert.equal(comparisons.unknown,'','Bij onbekende prijs geen fictief verschil');
  const beforeEdit=await page.locator('#jobLabelPreview').getAttribute('src');
  await page.locator('#jobLabelForm [name=requestedAmount]').fill('€ 100,00');
  await page.locator('#jobLabelRefresh').click();
  const edited=await page.evaluate(()=>JKJobLabelEditor.dataFromForm(document.querySelector('#jobLabelForm')));
  assert.match(edited.difference,/^−\s*€\s*25,00/,'Bewerkte printafspraak geeft meteen minverschil');
  assert.notEqual(await page.locator('#jobLabelPreview').getAttribute('src'),beforeEdit,'Voorbeeld verandert na aanpassen bedragen');
  assert.match(await page.locator('#jobLabelPreview').getAttribute('src'),/^data:image\/png;base64,/,'Aangepaste werkbon rendert een PNG');
  assert.equal(await page.locator('#jobLabelPreview').evaluate(img=>img.naturalHeight),1800,'Werkbon blijft 4x6 portrait');
  const giftAfter=await page.evaluate(async()=>({job:await JKDB.get('jobs','gift-job'),payment:await JKDB.get('settings','gift-pay')}));
  assert.equal(giftAfter.job.agreedAmount,0,'Prijsafspraak blijft echt nul na labelbewerking');
  assert.equal(giftAfter.payment.amount,75,'Ontvangen gift blijft correct geboekt');
  // Een normale afgesproken prijs met een echte restschuld mag niet ineens betaald zijn.
  const notPaid=await page.evaluate(()=>JKFinance.snapshot(
    [{id:'partial-gift-test',pricingType:'fixed',agreedAmount:100}],[],
    [{id:'partial-payment',kind:'jkPayment',jobId:'partial-gift-test',amount:75,method:'cash'}],
    j=>JKFinance.price(j,0,0)).job({id:'partial-gift-test',pricingType:'fixed',agreedAmount:100}));
  assert.equal(notPaid.paid,false,'Deels betaald blijft voor normale schuld van €25');
  assert.equal(notPaid.balance,25);
  console.log('PASS: nulprijs en vrijwillige €75 is Betaald, 2,5 uur behouden; 4x6 werkbon gevraagd/ontvangen/verschil met plus/min, geen prijswijziging');
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(await page.evaluate(()=>alerts),[]);
  console.log('PASS: flexibele prijzen, 17u/€170/€150, deelbetalingen via beide routes, alle PDF-/btw-varianten, 20 uur, extra kosten, maand/jaar/klant, legacybehoud, bevestigde uren, sync- en back-upformaat');
 }finally{await context.close();}
};
