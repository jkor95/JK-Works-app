/* JK Works Dordrecht - persoonlijke PWA v68 */
const App = (() => {
  const state = {route:'dashboard',gearTab:'mboxes',jobPaymentFilter:'all',docFolder:null,importFolderTarget:'diversen',pdfLibPromise:null,pdfJsPromise:null,activeBlobUrl:null,reminderChecking:false,snoozedReminderJobs:new Set(),pendingCloudRefresh:false,pendingAuthRefresh:false,actionItems:[],notificationTimer:null};
  window.__JK_UI_BUSY=false;
  const PDFLIB_URL='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const PDFJS_URL='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDFJS_WORKER_URL='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const PDF_PARSE_VERSION=2;
  const DEFAULT_WEBSITE_CONTENT={
    heroTitle1:'Flexibele ondersteuning waar',
    heroTitle2:'extra handen nodig zijn.',
    heroCopy:'Vooral inzetbaar als extra mankracht in catering en horeca, bij evenementen en andere ondersteunende werkzaamheden. Daarnaast ook beschikbaar voor kleine montage- en praktische klussen in en om huis. Beschikbaar buiten kantooruren in Dordrecht en omgeving.',
    servicesTitle:'Ondersteuning staat voorop',
    servicesIntro:'JK Works is in de eerste plaats beschikbaar als flexibele extra kracht, met name in catering en horeca. Daarnaast kun je ook terecht voor kleine, overzichtelijke montage- en praktische klussen.',
    service1Title:'Catering & horeca',
    service1Text:'Flexibele inzet als extra mankracht bij catering, evenementen, feesten en andere horecawerkzaamheden. Denk aan op- en afbouw, uitgifte, bediening, voorbereiding en algemene ondersteuning.',
    service2Title:'Extra ondersteuning',
    service2Text:'Een extra paar handen nodig voor een tijdelijke opdracht of druk moment? JK Works kan praktisch ondersteunen waar extra capaciteit nodig is.',
    service3Title:'Kleine montage & klusjes',
    service3Text:'Overzichtelijke klussen zoals een schilderij of plank ophangen, iets monteren, afstellen, bevestigen of een kleine reparatie uitvoeren.',
    service4Title:'Kit- & afwerkwerk',
    service4Text:'Nette afwerking van onder andere plinten, naden en aansluitingen, passend bij de afgesproken klus.',
    service5Title:'Montage, verbouwing & sloop',
    service5Text:'Ondersteuning bij montage, voorbereiding, stripwerk en hand- en spandiensten tijdens een verbouwing of renovatie.',
    service6Title:'Andere praktische hulp',
    service6Text:'Staat je opdracht er niet tussen? Stuur een bericht. Kleine praktische klussen zijn welkom; volledig schilderwerk behoort in principe niet tot de diensten.',
    workflowTitle:'Van aanvraag naar duidelijke afspraak',
    workflowIntro:'Een eenvoudige aanpak, zodat vooraf duidelijk is wat er nodig is en wat je kunt verwachten.',
    step1Title:'Stuur je aanvraag door',
    step1Text:'Vertel kort waar je ondersteuning bij nodig hebt. Bij een kleine klus helpen foto\'s vaak om vooraf een goede inschatting te maken.',
    step2Title:'Afspraak & prijs',
    step2Text:'We spreken werkzaamheden, planning en prijs of tarief af. Waar nodig volgt vooraf een offerte.',
    step3Title:'Uitvoering',
    step3Text:'De opdracht wordt volgens afspraak uitgevoerd. Bij passende montage- of kluswerkzaamheden kunnen voor-, tijdens- en nafoto\'s worden vastgelegd.',
    step4Title:'Afronding',
    step4Text:'Na controle ronden we de klus af en volgt, afhankelijk van de afspraak, de factuur of afgesproken betaling.',
    aboutTitle:'Persoonlijke hulp, zonder groot bedrijf eromheen.',
    aboutP1:'Ik ben Jeremy Korstanje en ben JK Works Dordrecht gestart voor opdrachten waarbij flexibel extra hulp nodig is. De nadruk ligt op ondersteuning en inzet als extra mankracht, met daarnaast ruimte voor kleine praktische klussen en montage.',
    aboutP2:'JK Works is vooral beschikbaar buiten reguliere kantooruren. Dat maakt het geschikt voor klussen die in de avond, in het weekend of tijdens schoolvakanties uitgevoerd kunnen worden.',
    contactTitle:'Extra ondersteuning nodig?',
    contactText:'Stuur gerust een korte omschrijving van de opdracht, gewenste datum/tijden en wat voor ondersteuning je zoekt. Gaat het om een kleine klus, voeg dan eventueel een paar foto\'s toe. Dan kan ik snel aangeven of JK Works beschikbaar is.',
    footerText:'Flexibele ondersteuning, horeca en kleine praktische klussen.'
  };
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money=v=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const num=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0};
  const pad=n=>String(n).padStart(2,'0');
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
  const addDays=(iso,days)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
  const nlDate=iso=>{if(!iso)return '';const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return `${m[3]}-${m[2]}-${m[1]}`;const d=new Date(iso);return Number.isNaN(+d)?String(iso):new Intl.DateTimeFormat('nl-NL').format(d)};
  const fmtDateTime=v=>v?new Intl.DateTimeFormat('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'-';
  function normalizeClockTime(v){
    if(v==null)return '';
    const s=String(v).trim();
    // Accepteer HTML-time (08:30), seconden, ISO-datums en oudere notaties zoals 8.30.
    const m=s.match(/(?:^|T|\s)(\d{1,2})[:.](\d{2})(?::\d{2})?(?:\.\d+)?(?:$|[+Z\s])/i) || s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?(?:\.\d+)?$/);
    if(!m)return '';
    const h=Number(m[1]),min=Number(m[2]);
    if(h<0||h>23||min<0||min>59)return '';
    return `${pad(h)}:${pad(min)}`;
  }
  const jobStartTime=j=>normalizeClockTime(j?.startTime||j?.from||j?.start||j?.timeFrom||j?.beginTime||j?.begin||j?.start_time||'');
  const jobEndTime=j=>normalizeClockTime(j?.endTime||j?.to||j?.end||j?.timeTo||j?.finishTime||j?.finish||j?.end_time||'');
  const jobTimeLabel=j=>{const a=jobStartTime(j),b=jobEndTime(j);return a?(b?`${a} - ${b}`:a):'';};
  const jobPaymentType=j=>j?.paymentType==='cash'?'cash':'invoice';
  const jobPaymentLabel=j=>jobPaymentType(j)==='cash'?'Contant':'Factuur';
  const jobRate=(j,company)=>num(j?.hourlyRate!==undefined&&j?.hourlyRate!==''?j.hourlyRate:company?.defaultRate||0);
  const jobExtra=j=>num(j?.extraAmount||0);
  // Planning is stored on the job; actual work stays exclusively in timeEntries.
  function jobWorkDays(j){
    const source=Array.isArray(j?.workDays)?j.workDays:(j?.date?[{id:'legacy',date:j.date,startTime:jobStartTime(j),endTime:jobEndTime(j)}]:[]);
    return source.map(d=>({...d})).filter(d=>d.date).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function uniqueEntries(entries){return [...new Map((entries||[]).map(e=>[e.id,e])).values()];}
  function jobPlannedMinutes(j){return jobWorkDays(j).reduce((n,d)=>n+entryMinutes({date:d.date,from:d.startTime,to:d.endTime}),0);}
  function outstandingWorkDay(j,entries,now=new Date()){
    return jobWorkDays(j).find(d=>{const end=jobPlannedEnd(d);return (end?end<=now:d.date<today())&&!entries.some(e=>e.jobId===j.id&&entryDate(e)===d.date&&(!e.autoFromJobSchedule||e.actualConfirmed));});
  }
  function workDayFields(d,index){return `<fieldset class="workday-row" data-workday="${esc(d.id||JKDB.id('day'))}"><legend>Werkdag</legend><div class="form-grid"><div class="field"><label>Datum<input type="date" name="dayDate" required value="${esc(d.date||'')}"></label></div><div class="field"><label>Geplande begintijd<input type="time" name="dayStart" value="${esc(d.startTime||'')}"></label></div><div class="field"><label>Geplande eindtijd<input type="time" name="dayEnd" value="${esc(d.endTime||'')}"></label></div></div><button type="button" class="ghost" data-remove-day>Werkdag verwijderen</button></fieldset>`;}
  function readWorkDays(){
    const days=$$('[data-workday]').map(row=>({id:row.dataset.workday,date:$('[name=dayDate]',row).value,startTime:$('[name=dayStart]',row).value,endTime:$('[name=dayEnd]',row).value}));
    if(new Set(days.map(d=>d.date)).size!==days.length)throw Error('Gebruik iedere datum één keer. Bewerk de bestaande werkdag.');
    if(days.some(d=>!d.date||Boolean(d.startTime)!==Boolean(d.endTime)))throw Error('Vul per werkdag een datum en beide geplande tijden in, of laat beide tijden leeg.');
    return days.sort((a,b)=>a.date.localeCompare(b.date));
  }
  function workDaysCard(j,entries){
    const days=jobWorkDays(j),dates=[...new Set([...days.map(d=>d.date),...entries.map(entryDate)])].sort();
    return `<div class="section-title"><h2>Werkdagen &amp; uren</h2></div><div class="card"><p class="muted small">Planning en werkelijk gewerkte uren zijn gescheiden. Alleen bevestigde uren tellen mee. De klus rond je zelf af via Bewerken → Status.</p><div class="kpi-row"><div class="kpi"><strong>${hoursLabel(jobPlannedMinutes(j))}</strong><span>Gepland</span></div><div class="kpi"><strong>${hoursLabel(jobMinutes(j,entries))}</strong><span>Werkelijk gewerkt</span></div></div><div class="workday-list">${dates.map(date=>{const d=days.find(x=>x.date===date),es=uniqueEntries(entries.filter(e=>entryDate(e)===date));return `<div class="workday-summary"><strong>${nlDate(date)}</strong><div>Gepland: ${d?esc(jobTimeLabel(d)||'tijden nog invullen'):'niet vooraf gepland'}</div><div>Gewerkt: ${es.length?es.map(e=>`${esc(entryFrom(e))}–${esc(entryTo(e))} · pauze ${num(e.breakMinutes)} min${e.autoFromJobSchedule&&!e.actualConfirmed?' · nog te bevestigen':''}${e.note?' · '+esc(e.note):''}`).join('<br>'):'nog niet geregistreerd'}</div><strong>Netto: ${hoursLabel(es.reduce((n,e)=>n+entryMinutes(e),0))}</strong><div class="button-row">${es.length?es.map(e=>`<button type="button" class="secondary" data-work-entry="${esc(e.id)}">Uren bewerken</button>`).join(''):`<button type="button" class="secondary" data-work-date="${esc(date)}">Werkelijke uren invullen</button>`}${d?`<button type="button" class="ghost" data-work-calendar="${esc(date)}">📅 Agenda</button>`:''}</div></div>`}).join('')}</div><div class="button-row"><button type="button" class="secondary" id="extraWorkDay">+ Ongeplande werkdag / uren</button><button type="button" class="secondary" id="jobIcs">📅 Werkdagen downloaden (.ics)</button></div></div>`;
  }
  function jobCalendarIcs(j){
    const text=v=>String(v||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,m=>'\\'+m);
    const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
    const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//JK Works//Werkdagen//NL'];
    for(const d of jobWorkDays(j)){
      rows.push('BEGIN:VEVENT','UID:'+j.id+'-'+d.date+'@jkworks.nl','DTSTAMP:'+stamp(new Date()),'SUMMARY:'+text(j.title),'LOCATION:'+text([j.street||j.address,j.postal,j.city].filter(Boolean).join(', ')));
      if(d.startTime&&d.endTime){const start=localCalendarDateToUtc(d.date,d.startTime),end=jobPlannedEnd(d);rows.push('DTSTART:'+stamp(start),'DTEND:'+stamp(end));}
      else rows.push('DTSTART;VALUE=DATE:'+d.date.replaceAll('-',''),'DTEND;VALUE=DATE:'+addDays(d.date,1).replaceAll('-',''));
      rows.push('END:VEVENT');
    }
    rows.push('END:VCALENDAR');return rows.join('\r\n')+'\r\n';
  }
  function jobMinutes(j,entries){return uniqueEntries(entries).filter(e=>e.jobId===j.id).reduce((sum,e)=>sum+entryMinutes(e),0)}
  function jobOwnAmount(j,entries,company){return JKFinance.price(j,jobMinutes(j,entries),jobRate(j,company)).agreed??0;}
  const pricingLabel=j=>({hourly:'Op uurbasis',fixed:'Vaste prijs',manual:'Handmatig bedrag'}[JKFinance.type(j)]);
  function jobReadyForSettlement(j,entries=[],now=new Date()){
    if(j.status!=='afgerond')return false;
    const planned=jobWorkDays(j),days=planned.length?planned:uniqueEntries(entries).filter(e=>e.jobId===j.id&&(!e.autoFromJobSchedule||e.actualConfirmed)).map(e=>({date:entryDate(e),startTime:entryFrom(e),endTime:entryTo(e)})).filter(d=>d.date);
    // Untimed days end at local midnight; explicit completion remains authoritative for undated legacy jobs.
    return days.every(d=>{const end=jobPlannedEnd(d)||localCalendarDateToUtc(addDays(d.date,1),'00:00');return end&&end<=now;});
  }
  async function refreshFinance(){
    const [jobs,docs,settings,entries,company]=await Promise.all([JKDB.all('jobs'),JKDB.all('documents'),JKDB.all('settings'),JKDB.all('timeEntries'),JKDB.get('settings','company')]);
    const now=new Date();
    state.finance=JKFinance.snapshot(jobs,docs,settings,j=>JKFinance.price(j,jobMinutes(j,entries),jobRate(j,company)),j=>jobReadyForSettlement(j,entries,now));
    return state.finance;
  }
  function jobFinancial(j,entries,company){return state.finance?.job(j)||{...JKFinance.price(j,jobMinutes(j,entries),jobRate(j,company)),invoiced:0,received:0,balance:jobOwnAmount(j,entries,company),settlementReady:jobReadyForSettlement(j,entries),open:jobReadyForSettlement(j,entries)?jobOwnAmount(j,entries,company):0,paid:false};}
  function financeKpis(rows){return `<div class="kpi-row finance-kpis">${rows.map(([label,value])=>`<div class="kpi"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('')}</div>`;}
  function jobFinanceHtml(j,entries,company){
    const f=jobFinancial(j,entries,company),minutes=jobMinutes(j,entries);
    return financeKpis([['Gewerkt',hoursLabel(minutes)],['Afgesproken',f.pending?'Nog te bepalen':money(f.agreed)],['Ontvangen',money(f.received)],['Nog te ontvangen',money(f.open)]])
      +'<p class="muted small">Status: <strong>'+esc(f.paid?'Betaald':f.received>0?'Deels betaald':'Nog niet betaald')+'</strong>'
      +(f.waived>0?' · Afgerond: '+money(f.waived):'')
      +(!f.settlementReady&&f.balance>0?' · Na afronding af te rekenen: '+money(f.balance):'')+'</p>';
  }
  const isUnassignedInvoice=d=>!state.finance?.jobs.some(j=>j.id===linkedInvoiceJobId(d));
  function financeSummary(jobs,entries,company,unlinkedDocs=[]){
    const fs=jobs.map(j=>jobFinancial(j,entries,company)),orphan=unlinkedDocs.filter(d=>JKFinance.invoice(d)&&isUnassignedInvoice(d)),ids=new Set(orphan.map(d=>d.id));
    const agreed=fs.reduce((n,f)=>n+(f.agreed||0),0),invoiced=fs.reduce((n,f)=>n+f.invoiced,0)+orphan.reduce((n,d)=>n+num(d.meta?.total),0),received=fs.reduce((n,f)=>n+f.received,0)+(state.finance?.receipts||[]).filter(p=>ids.has(p.invoiceId)).reduce((n,p)=>n+(p.amount||0),0),minutes=jobs.reduce((n,j)=>n+jobMinutes(j,entries),0);
    return financeKpis([['Berekende urenwaarde',money(fs.reduce((n,f)=>n+f.hoursValue,0))],['Afgesproken omzet',money(agreed)],['Gefactureerd incl. btw',money(invoiced)],['Ontvangen',money(received)],['Effectief afgesproken / uur',minutes?money(agreed/(minutes/60)):'—'],['Effectief ontvangen / uur',minutes?money(received/(minutes/60)):'—']]);
  }
  async function freezeLegacyPayments(finance,jobId='',invoiceId=''){
    for(const p of finance.receipts.filter(p=>p.legacy&&(jobId?p.resolvedJobId===jobId:p.invoiceId===invoiceId))){
      if(!finance.stored.some(x=>x.id===p.id))await JKDB.put('settings',{...p,jobId:p.resolvedJobId});
    }
    if(jobId){const j=await JKDB.get('jobs',jobId);if(j&&!j.paymentLedger)await JKDB.put('jobs',{...j,paymentLedger:true});}
  }
  async function refreshPaymentFlags(jobId='',invoiceId=''){
    const f=await refreshFinance();
    for(const d of f.documents.filter(d=>jobId?linkedInvoiceJobId(d)===jobId:d.id===invoiceId)){
      const paid=f.document(d).paid;
      if(d.meta?.paid!==paid||!d.meta?.paymentLedger)await JKDB.put('documents',{...d,meta:{...d.meta,paid,paymentLedger:true}});
    }
    const j=f.jobs.find(j=>j.id===jobId);
    if(j)await JKDB.put('jobs',{...j,paymentPaid:f.job(j).paid,paymentLedger:true});
    await refreshFinance();
  }
  async function showPayments(jobId='',invoiceId=''){
    const f=await refreshFinance(),d=f.documents.find(d=>d.id===invoiceId);
    jobId=(d?linkedInvoiceJobId(d):jobId)||'';
    const j=f.jobs.find(j=>j.id===jobId),rows=f.receipts.filter(p=>jobId?p.resolvedJobId===jobId:p.invoiceId===invoiceId),totals=d?f.document(d):j?f.job(j):null;
    if(!totals)return;
    const settlementId=jobId?'writeoff:job:'+jobId:'writeoff:invoice:'+invoiceId;
    const writeoff=f.writeoffs.find(w=>w.id===settlementId),canRound=totals.received>0&&totals.open>0&&(!j||f.job(j).settlementReady);
    modal(`${modalHead('Betalingen')}<div class="card"><h3>${esc(d?.meta?.number||d?.filename||j?.title||'Factuur')}</h3>${financeKpis([['Ontvangen',money(totals.received)],['Nog te ontvangen',money(totals.open)]])}${totals.waived>0?'<p class="muted small">Afgerond verschil: '+money(totals.waived)+'</p>':''}<div class="button-row"><button class="primary" id="addPayment">+ Betaling registreren</button>${canRound?'<button type="button" class="secondary" id="settleRounding">Afronden als betaald</button>':''}${writeoff?'<button type="button" class="secondary" id="revokeRounding">Afronding terugdraaien</button>':''}</div>${!totals.settlementReady&&totals.balance>0?'<p class="muted small">Na afronding nog af te rekenen: '+money(totals.balance)+'</p>':''}</div><div class="list">${rows.map(p=>`<button class="list-item" data-edit-payment="${esc(p.id)}"><span class="main"><strong>${p.unknownAmount?'Bedrag onbekend':money(p.amount)}</strong><span class="sub">${p.date?nlDate(p.date):'Betaaldatum onbekend (bestaande registratie)'} · ${esc(({cash:'Contant',bank:'Bank',card:'Pin',other:'Anders',unknown:'Onbekend'})[p.method]||p.method)}${p.invoiceId?' · '+esc(f.documents.find(d=>d.id===p.invoiceId)?.meta?.number||'Factuur'):' · Klusbetaling'}</span></span><span>Bewerken</span></button>`).join('')||'<p class="muted">Nog geen betalingen.</p>'}</div>${jobId?'<button class="secondary" id="backPaymentJob">Terug naar klus</button>':''}`);
    $('#addPayment').addEventListener('click',()=>editPayment(null,jobId,invoiceId));
    $$('[data-edit-payment]').forEach(b=>b.addEventListener('click',()=>editPayment(rows.find(p=>p.id===b.dataset.editPayment),jobId,invoiceId)));
    $('#backPaymentJob')?.addEventListener('click',()=>showJob(jobId));
    const saveRounding=async voided=>{
      const amount=voided?0:totals.open;
      if(!confirm(voided?'Het afgeronde verschil weer openzetten?':'Het verschil van '+money(amount)+' niet meer innen? Dit wordt niet als ontvangen omzet geboekt.'))return;
      try{
        await JKDB.put('settings',{id:settlementId,kind:'jkWriteoff',jobId,invoiceId:jobId?'':invoiceId,amount:Math.round(amount*100)/100,date:today(),voided});
        await refreshPaymentFlags(jobId,invoiceId);closeModal();await render();await showPayments(jobId,invoiceId);
      }catch(e){alert('Afronding opslaan mislukt: '+e.message);}
    };
    $('#settleRounding')?.addEventListener('click',()=>saveRounding(false));
    $('#revokeRounding')?.addEventListener('click',()=>saveRounding(true));
  }
  async function editPayment(payment,jobId='',invoiceId=''){
    const f=await refreshFinance(),p=payment||{id:JKDB.id('payment'),kind:'jkPayment',jobId,invoiceId,date:today(),method:jobPaymentType(f.jobs.find(j=>j.id===jobId))==='cash'?'cash':'bank',amount:''},docs=f.documents.filter(d=>jobId?linkedInvoiceJobId(d)===jobId:d.id===invoiceId);
    modal(`${modalHead(payment?'Betaling bewerken':'Betaling registreren')}<form id="paymentForm"><div class="field"><label>Ontvangen bedrag<input name="amount" type="number" min="0.01" step="0.01" required value="${esc(p.amount)}"></label></div><div class="field"><label>Betaaldatum<input name="date" type="date" ${p.legacy?'':'required'} value="${esc(p.date||'')}"></label>${p.legacy?'<small>Laat leeg zolang de oorspronkelijke betaaldatum onbekend is.</small>':''}</div><div class="field"><label>Betaalwijze<select name="method">${Object.entries({bank:'Bank',cash:'Contant',card:'Pin',other:'Anders',...(p.legacy?{unknown:'Onbekend'}:{})}).map(([v,l])=>`<option value="${v}" ${p.method===v?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="field"><label>Toewijzen aan<select name="invoiceId">${jobId?'<option value="">Algemene klusbetaling</option>':''}${docs.map(d=>`<option value="${esc(d.id)}" ${p.invoiceId===d.id?'selected':''}>${esc(d.meta?.number||d.filename||d.id)}</option>`).join('')}</select></label></div><div class="button-row"><button class="primary">Opslaan</button>${payment?'<button class="danger-btn" type="button" id="voidPayment">Betaling verwijderen</button>':''}</div></form>`);
    const save=async voided=>{
      const form=$('#paymentForm');if(form.dataset.saving)return;form.dataset.saving='1';
      try{
        const values=new FormData(form),amount=num(values.get('amount')),date=values.get('date')||'';
        if(!voided&&(!(amount>0)||(!p.legacy&&!date)))throw Error('Vul een positief bedrag en betaaldatum in.');
        await freezeLegacyPayments(await refreshFinance(),jobId,invoiceId);
        await JKDB.put('settings',{...p,kind:'jkPayment',jobId,invoiceId:String(values.get('invoiceId')||''),amount:Math.round(amount*100)/100,unknownAmount:false,date,method:values.get('method'),voided});
        await refreshPaymentFlags(jobId,invoiceId);closeModal();await render();await showPayments(jobId,invoiceId);refreshActionBadges(false).catch(()=>{});
      }catch(e){alert('Betaling opslaan mislukt: '+e.message);form.dataset.saving='';}
    };
    $('#paymentForm').addEventListener('submit',e=>{e.preventDefault();save(false);});
    $('#voidPayment')?.addEventListener('click',()=>{if(confirm('Deze betaling verwijderen?'))save(true);});
  }
  const CALENDAR_TZ='Europe/Amsterdam';
  function tzOffsetMs(instant,timeZone=CALENDAR_TZ){
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    const asUTC=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
    return asUTC-instant.getTime();
  }
  function localCalendarDateToUtc(date,time,timeZone=CALENDAR_TZ){
    const dm=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/),tm=String(time||'').match(/^(\d{2}):(\d{2})$/);
    if(!dm||!tm)return null;
    const y=Number(dm[1]),m=Number(dm[2]),d=Number(dm[3]),hh=Number(tm[1]),mm=Number(tm[2]);
    let guess=new Date(Date.UTC(y,m-1,d,hh,mm,0));
    for(let i=0;i<2;i++)guess=new Date(Date.UTC(y,m-1,d,hh,mm,0)-tzOffsetMs(guess,timeZone));
    return guess;
  }
  function calendarUtcStamp(date,time){
    const d=localCalendarDateToUtc(date,time);
    return d?d.toISOString().replace(/[-:]/g,'').replace(/\.000Z$/,'Z'):'';
  }
  function calendarTimedRange(date,startTime,endTime){
    const start=localCalendarDateToUtc(date,startTime);
    if(!start)return '';
    let end=endTime?localCalendarDateToUtc(date,endTime):null;
    if(!end)end=new Date(start.getTime()+60*60*1000);
    else if(end<=start)end=localCalendarDateToUtc(addDays(date,1),endTime);
    const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.000Z$/,'Z');
    return `${stamp(start)}/${stamp(end)}`;
  }
  function legacyCalendarStamp(date,time){return `${String(date||'').replaceAll('-','')}T${String(time||'00:00').replace(':','')}00`}
  function legacyCalendarEnd(date,startTime,endTime){
    if(!startTime)return String(addDays(date,1)).replaceAll('-','');
    const a=new Date(`${date}T${startTime}:00`),b=new Date(`${date}T${endTime||startTime}:00`);
    if(!endTime)b.setHours(b.getHours()+1);else if(b<=a)b.setDate(b.getDate()+1);
    return `${b.getFullYear()}${pad(b.getMonth()+1)}${pad(b.getDate())}T${pad(b.getHours())}${pad(b.getMinutes())}00`;
  }
  function googleCalendarUrlForJob(j,extra={}){
    if(!j?.date)return '';
    const titleText=extra.title||`JK Works - ${j.title||'Klus'}`;
    const details=[extra.kind&&extra.number?`${extra.kind}: ${extra.number}`:'',j.clientName?`Klant: ${j.clientName}`:'',j.phone?`Telefoon: ${j.phone}`:'',j.email?`E-mail: ${j.email}`:'',j.notes?`Notities: ${j.notes}`:''].filter(Boolean).join('\n');
    const location=[j.street||j.address,j.postal,j.city].filter(Boolean).join(', ');
    const params=new URLSearchParams({action:'TEMPLATE',text:titleText,details,location,ctz:'Europe/Amsterdam'});
    params.set('dates',j.startTime?`${legacyCalendarStamp(j.date,j.startTime)}/${legacyCalendarEnd(j.date,j.startTime,j.endTime)}`:`${String(j.date).replaceAll('-','')}/${legacyCalendarEnd(j.date,'','')}`);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
  function openGoogleCalendarForJob(j,extra={}){if(jobWorkDays(j).length>1){modal(`${modalHead('Werkdagen in agenda')}<div class="list">${jobWorkDays(j).map(d=>`<button type="button" class="secondary" data-calendar-day="${esc(d.date)}">${nlDate(d.date)} · ${esc(jobTimeLabel(d))}</button>`).join('')}</div><button type="button" class="secondary" id="allDaysIcs">Alle werkdagen downloaden (.ics)</button>`);$$('[data-calendar-day]').forEach(b=>b.addEventListener('click',()=>openGoogleCalendarForJob({...j,...jobWorkDays(j).find(d=>d.date===b.dataset.calendarDay),workDays:undefined},extra)));$('#allDaysIcs').addEventListener('click',()=>downloadBlob(new Blob([jobCalendarIcs(j)],{type:'text/calendar;charset=utf-8'}),'JK-Works-werkdagen.ics'));return;}const url=googleCalendarUrlForJob(j,extra);if(!url){alert('Vul eerst een datum bij de klus in.');return;}window.open(url,'_blank','noopener,noreferrer');}
  function googleCalendarUrlForTimeEntry(e,j={}){
    const date=entryDate(e),from=entryFrom(e),to=entryTo(e);if(!date||!from||!to)return '';
    const clientName=j.clientName||'';
    const jobTitle=j.title||e.jobTitle||'Werkuren';
    const titleText=`JK Works - ${jobTitle}${clientName?' - '+clientName:''}`;
    const details=[
      'Urenregistratie',
      clientName?`Klant: ${clientName}`:'',
      e.note?`Notitie: ${e.note}`:'',
      `Gewerkte tijd: ${from} - ${to}`,
      `Duur: ${durationHM(entryMinutes({date,from,to}))} uur`
    ].filter(Boolean).join('\n');
    const location=[j.street||j.address,j.postal,j.city].filter(Boolean).join(', ');
    const params=new URLSearchParams({action:'TEMPLATE',text:titleText,details,location,ctz:'Europe/Amsterdam'});
    params.set('dates',`${legacyCalendarStamp(date,from)}/${legacyCalendarEnd(date,from,to)}`);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
  function openGoogleCalendarForTimeEntry(e,j={}){const url=googleCalendarUrlForTimeEntry(e,j);if(!url){alert('Vul eerst datum, van en tot in.');return;}window.open(url,'_blank','noopener,noreferrer');}
  const durationHM=min=>`${Math.floor(min/60)}:${pad(Math.round(min%60))}`;
  function jobPlannedEnd(j){
    if(Array.isArray(j?.workDays)){const ends=jobWorkDays(j).map(jobPlannedEnd).filter(Boolean);return ends.length?new Date(Math.max(...ends.map(Number))):null;}
    if(!j?.date)return null;
    const start=jobStartTime(j),end=jobEndTime(j);
    if(!end)return null;
    let endDate=j.date;
    if(start && end<=start)endDate=addDays(j.date,1);
    const d=localCalendarDateToUtc(endDate,end);
    return d && !Number.isNaN(+d) ? d : null;
  }

  const DEFAULT_NOTIFICATION_PREFS={id:'notificationPrefs',badges:true,systemNotifications:false,hours:true,photos:true,quoteCreate:true,quoteSend:true,invoiceCreate:true,invoiceSend:true,paymentReminder:true};
  async function getNotificationPrefs(){return {...DEFAULT_NOTIFICATION_PREFS,...((await JKDB.get('settings','notificationPrefs'))||{})};}
  async function getDismissedActions(){
    const row=await JKDB.get('settings','dismissedActions');
    return row&&row.items&&typeof row.items==='object'?row.items:{};
  }

  const SNOOZE_OPTIONS=[['1h','1 uur'],['12h','12 uur'],['7d','7 dagen'],['14d','14 dagen'],['1m','1 maand']];
  async function getActionSnoozes(){
    const cached=await JKDB.get('settings','actionSnoozeCache');
    let items=cached?.items||{};
    if(JKCloud.isSignedIn()&&navigator.onLine&&window.JKPush?.snoozes){
      try{
        const result=await JKPush.snoozes();
        if(result?.ok===true&&Array.isArray(result.items)){
          items=Object.fromEntries(result.items.map(x=>[x.action_key,x.due_at]));
          await JKDB.putLocal('settings',{id:'actionSnoozeCache',items,updatedAt:new Date().toISOString()});
        }
      }catch(error){console.warn('Uitgestelde acties tijdelijk niet bijgewerkt',error);}
    }
    return items;
  }
  async function snoozeActionItem(item,duration){
    if(!item?.key||!SNOOZE_OPTIONS.some(x=>x[0]===duration))return;
    const response=await JKPush.snooze(item.key,duration);
    if(response?.ok!==true||!Number.isFinite(Date.parse(response.dueAt)))throw Error('Herinnering is niet bevestigd door de server.');
    const record=await JKDB.get('settings','actionSnoozeCache')||{id:'actionSnoozeCache',items:{}};
    record.items={...(record.items||{}),[item.key]:response.dueAt};
    await JKDB.putLocal('settings',record);
    // Een nieuwe melding moet ook binnen dezelfde kalenderdag opnieuw kunnen verschijnen.
    try{
      const key='jkworks-notified-actions',saved=JSON.parse(localStorage.getItem(key)||'{}');
      if(Array.isArray(saved.keys)){saved.keys=saved.keys.filter(x=>x!==item.key);localStorage.setItem(key,JSON.stringify(saved));}
    }catch{}
    await refreshActionBadges(false);
  }
  async function cancelSnooze(key){
    const response=await JKPush.unsnooze(key);
    if(response?.ok!==true)throw Error('Uitstel opheffen is niet bevestigd.');
    const record=await JKDB.get('settings','actionSnoozeCache')||{id:'actionSnoozeCache',items:{}};
    delete record.items[key];
    await JKDB.putLocal('settings',record);
    await refreshActionBadges(false);
  }
  function openActionSnooze(item){
    if(!item)return;
    modal(`${modalHead('Actie uitstellen')}<div class="card"><strong>${esc(item.title)}</strong><p class="muted small">De actie en de rode badge verdwijnen tijdelijk. Na de gekozen tijd komt de actie terug en verstuurt de server een nieuwe pushmelding naar je aangemelde apparaten.</p><div class="snooze-options">${SNOOZE_OPTIONS.map(([v,label])=>`<button type="button" class="secondary" data-snooze="${v}">${label}</button>`).join('')}</div><p class="muted small">Voor een push met gesloten app moet push zijn ingeschakeld op dit toestel. Herinneringen komen normaal binnen 5 minuten na de gekozen tijd; netwerk- en iOS-instellingen kunnen vertraging geven.</p></div>`);
    document.querySelectorAll('[data-snooze]').forEach(button=>button.addEventListener('click',async()=>{
      if(button.disabled)return;
      document.querySelectorAll('[data-snooze]').forEach(b=>b.disabled=true);
      try{await snoozeActionItem(item,button.dataset.snooze);toast('Herinnering uitgesteld');await showActionCenter();}
      catch(error){alert('Uitstellen mislukt: '+(error.message||error));document.querySelectorAll('[data-snooze]').forEach(b=>b.disabled=false);}
    }));
  }

  async function dismissActionItem(item){
    if(!item?.key)return;
    const items=await getDismissedActions();
    items[item.key]={dismissedAt:new Date().toISOString(),type:item.type||'',category:item.category||'',title:item.title||'',detail:item.detail||''};
    await JKDB.put('settings',{id:'dismissedActions',items});
    if(item.type==='hours'&&item.jobId){
      const j=await JKDB.get('jobs',item.jobId);
      if(j&&!j.completionPromptHandledAt){j.completionPromptHandledAt=new Date().toISOString();await JKDB.put('jobs',j);}
    }
    toast('Melding weggeklikt');
    await refreshActionBadges(false);
  }
  async function restoreDismissedActions(){
    await JKDB.put('settings',{id:'dismissedActions',items:{}});
    localStorage.removeItem('jkworks-notified-actions');
    await refreshActionBadges(false);
  }
  function jobPlannedStart(j){
    if(!j?.date)return null;
    const start=jobStartTime(j)||'08:00',d=localCalendarDateToUtc(j.date,start);
    return d&&!Number.isNaN(+d)?d:null;
  }
  function jobHasEnded(j,now=new Date()){
    if(j?.status==='afgerond')return true;
    if(Array.isArray(j?.workDays))return false;
    const end=jobPlannedEnd(j);if(end)return end<=now;
    return !!j?.date && j.date<today();
  }
  async function collectActionItems({includeSnoozed=false,knownSnoozes=null}={}){
    await refreshFinance();
    const [prefs,jobs,entries,photos,docs,dismissed,snoozes]=await Promise.all([getNotificationPrefs(),JKDB.all('jobs'),JKDB.all('timeEntries'),JKDB.all('jobPhotos'),JKDB.all('documents'),getDismissedActions(),knownSnoozes||getActionSnoozes()]);
    const now=new Date(),todayIso=today(),items=[];
    const docsByJob=new Map();
    for(const d of docs){const jid=d?.meta?.jobId;if(!jid)continue;if(!docsByJob.has(jid))docsByJob.set(jid,[]);docsByJob.get(jid).push(d);}
    const photosByJob=new Map();
    for(const ph of photos){if(!photosByJob.has(ph.jobId))photosByJob.set(ph.jobId,[]);photosByJob.get(ph.jobId).push(ph);}
    for(const j of jobs){
      const ended=jobHasEnded(j,now),start=jobPlannedStart(j),started=ended||(start?start<=now:!!j.date&&j.date<=todayIso),directDocs=docsByJob.get(j.id)||[],jobName=String(j.clientName||'').trim().toLowerCase(),fuzzyDocs=docs.filter(d=>!d?.meta?.jobId&&j.date&&d?.meta?.workDate===j.date&&jobName&&String(d?.meta?.client?.name||'').trim().toLowerCase()===jobName),jobDocs=[...new Map([...directDocs,...fuzzyDocs].map(d=>[d.id,d])).values()],jobPhotos=photosByJob.get(j.id)||[];
      const add=(x)=>items.push({jobId:j.id,jobTitle:j.title||'Klus',clientName:j.clientName||'',...x});
      const dueDay=Array.isArray(j.workDays)?outstandingWorkDay(j,entries,now):null;
      if(prefs.hours&&(Array.isArray(j.workDays)?Boolean(dueDay):ended&&!j.completionPromptHandledAt)){
        const je=entries.filter(e=>e.jobId===j.id),auto=je.find(e=>e.id===j.autoTimeEntryId)||je.find(e=>e.autoFromJobSchedule===true);
        add({key:`hours:${j.id}`,type:'hours',category:'Uren',icon:'🕒',title:auto?'Uren controleren':'Uren invoeren',detail:`${j.clientName||j.title||'Klus'} · ${nlDate(dueDay?.date||j.date)}`});
      }
      if(prefs.photos&&(j.photoPolicy||'optional')==='required'){
        const has=phase=>jobPhotos.some(p=>p.phase===phase);
        if(j.date&&j.date<=todayIso&&!has('before'))add({key:`photo:before:${j.id}`,type:'photo',phase:'before',category:'Foto’s',icon:'📷',title:'Foto vóór de klus maken',detail:`${j.clientName||j.title||'Klus'} · ${nlDate(j.date)}`});
        if(started&&!has('during'))add({key:`photo:during:${j.id}`,type:'photo',phase:'during',category:'Foto’s',icon:'🔨',title:'Foto tijdens de klus maken',detail:`${j.clientName||j.title||'Klus'} · ${nlDate(j.date)}`});
        if(ended&&!has('after'))add({key:`photo:after:${j.id}`,type:'photo',phase:'after',category:'Foto’s',icon:'✅',title:'Foto na de klus maken',detail:`${j.clientName||j.title||'Klus'} · ${nlDate(j.date)}`});
      }
      const quotes=jobDocs.filter(d=>docFolder(d)==='offerte'),invoices=jobDocs.filter(d=>docFolder(d)==='factuur');
      if(prefs.quoteCreate&&j.quoteNeeded&&!quotes.length)add({key:`quoteCreate:${j.id}`,type:'quoteCreate',category:'Offerte',icon:'📄',title:'Offerte opmaken',detail:`${j.clientName||j.title||'Klus'}${j.date?' · '+nlDate(j.date):''}`});
      if(prefs.quoteSend)for(const d of quotes.filter(d=>!d.meta?.sent))add({key:`quoteSend:${d.id}`,type:'quoteSend',docId:d.id,category:'Offerte',icon:'📤',title:'Offerte versturen',detail:`${d.meta?.number||d.filename||j.clientName||j.title}`});
      if(jobPaymentType(j)==='invoice'&&ended){
        if(prefs.invoiceCreate&&!invoices.length)add({key:`invoiceCreate:${j.id}`,type:'invoiceCreate',category:'Factuur',icon:'🧾',title:'Factuur opmaken',detail:`${j.clientName||j.title||'Klus'} · ${nlDate(j.date)}`});
        if(prefs.invoiceSend)for(const d of invoices.filter(d=>!d.meta?.sent))add({key:`invoiceSend:${d.id}`,type:'invoiceSend',docId:d.id,category:'Factuur',icon:'📤',title:'Factuur versturen',detail:`${d.meta?.number||d.filename||j.clientName||j.title}`});
      }
    }
    if(prefs.paymentReminder){
      for(const d of docs.filter(d=>docFolder(d)==='factuur')){
        const m=d.meta||{},deadline=String(m.deadline||'').slice(0,10);
        if(m.sent&&state.finance.document(d).open>0&&deadline&&deadline<todayIso){
          items.push({key:`paymentReminder:${d.id}`,type:'paymentReminder',docId:d.id,category:'Betaling',icon:'💶',title:'Betaalherinnering nodig',detail:`${m.number||d.filename||'Factuur'} · vervallen ${nlDate(deadline)}`});
        }
      }
    }
    return items.filter(i=>!dismissed[i.key] && (includeSnoozed || !(Number.isFinite(Date.parse(snoozes[i.key]))&&Date.parse(snoozes[i.key])>Date.now())));
  }
  async function updateAppBadge(count,prefs){
    if(!('setAppBadge' in navigator))return;
    try{if(prefs.badges&&count>0)await navigator.setAppBadge(count);else if('clearAppBadge' in navigator)await navigator.clearAppBadge();else await navigator.setAppBadge(0);}catch(e){console.debug('App-badge niet beschikbaar',e);}
  }
  async function maybeShowSystemActionNotification(items,prefs){
    if(!prefs.systemNotifications||!items.length||!('Notification' in window)||Notification.permission!=='granted'||!('serviceWorker' in navigator))return;
    const day=today(),storeKey='jkworks-notified-actions',seenRaw=localStorage.getItem(storeKey);let seen={day,keys:[]};
    try{const parsed=JSON.parse(seenRaw||'{}');if(parsed?.day===day&&Array.isArray(parsed.keys))seen=parsed;}catch{}
    const newItems=items.filter(i=>!seen.keys.includes(i.key));if(!newItems.length)return;
    const first=newItems[0],extra=newItems.length-1,body=extra?`${first.title} - ${first.detail}. En nog ${extra} actie${extra===1?'':'s'}.`:`${first.title} - ${first.detail}`;
    try{const reg=await navigator.serviceWorker.ready;await reg.showNotification('JK Works - actie nodig',{body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:'jkworks-actions',renotify:true,data:{url:'./'}});seen.keys=[...new Set([...seen.keys,...newItems.map(i=>i.key)])];localStorage.setItem(storeKey,JSON.stringify(seen));}catch(e){console.debug('Systeemmelding niet getoond',e);}
  }
  async function refreshActionBadges(showSystem=false){
    if(!JKCloud.isSignedIn())return;
    const [items,prefs]=await Promise.all([collectActionItems(),getNotificationPrefs()]);state.actionItems=items;
    const btn=$('#notificationBtn'),countEl=$('#notificationCount');
    if(btn){btn.hidden=false;btn.classList.toggle('has-actions',items.length>0);btn.title=items.length?`${items.length} actie${items.length===1?'':'s'} nodig`:'Geen openstaande acties';}
    if(countEl){countEl.textContent=items.length>99?'99+':String(items.length);countEl.hidden=!items.length;}
    await updateAppBadge(items.length,prefs);if(showSystem)await maybeShowSystemActionNotification(items,prefs);
    return items;
  }
  function startNotificationTimer(){
    if(state.notificationTimer)return;
    state.notificationTimer=setInterval(()=>{if(document.visibilityState==='visible'&&!uiBusy())refreshActionBadges(true).catch(()=>{});},60000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&JKCloud.isSignedIn())refreshActionBadges(true).catch(()=>{});});
  }
  async function runActionItem(item){
    if(!item)return;closeModal();
    if(item.type==='hours'){
      const j=await JKDB.get('jobs',item.jobId);if(!j)return;if(Array.isArray(j.workDays)){const es=await JKDB.all('timeEntries'),d=outstandingWorkDay(j,es);if(d)editTimeEntry(es.find(e=>e.jobId===j.id&&entryDate(e)===d.date)?.id||null,j.id,d.date,j.id);return;}if(!j.completionPromptHandledAt){j.completionPromptHandledAt=new Date().toISOString();await JKDB.put('jobs',j);}const es=(await JKDB.all('timeEntries')).filter(e=>e.jobId===j.id),auto=es.find(e=>e.id===j.autoTimeEntryId)||es.find(e=>e.autoFromJobSchedule===true);editTimeEntry(auto?.id||null,j.id);return;
    }
    if(item.type==='photo'){showJob(item.jobId);return;}
    if(item.type==='quoteCreate'){const j=await JKDB.get('jobs',item.jobId);if(j)createBusinessDoc('Offerte',{jobId:j.id,clientId:j.clientId,workDate:j.date});return;}
    if(item.type==='invoiceCreate'){const j=await JKDB.get('jobs',item.jobId);if(j)createBusinessDoc('Factuur',{jobId:j.id,clientId:j.clientId,workDate:j.date});return;}
    if((item.type==='quoteSend'||item.type==='invoiceSend'||item.type==='paymentReminder')&&item.docId){showDocument(item.docId);return;}
  }
  async function showActionCenter(){
    const items=await refreshActionBadges(false)||[];
    modal(`${modalHead('Acties')}<div class="card"><div class="section-inline"><h3>Actie nodig</h3><span class="pill ${items.length?'warn':'success'}">${items.length}</span></div><p class="muted small">Deze lijst wordt lokaal berekend uit je klussen, uren, foto’s, offertes en facturen. Open een actie, kies <strong>Uitstellen</strong> voor een nieuwe herinnering of <strong>Niet nodig</strong> om hem te verwijderen.</p></div>${items.length?`<div class="action-list">${items.map((i,n)=>`<div class="action-row"><button class="action-open" type="button" data-action-index="${n}"><span class="action-emoji">${i.icon}</span><span class="action-main"><span class="action-category">${esc(i.category)}</span><strong>${esc(i.title)}</strong><small>${esc(i.detail||'')}</small></span><span class="action-chevron">›</span></button><button class="action-snooze" type="button" data-snooze-index="${n}" title="Deze actie uitstellen">⏰<span>Uitstellen</span></button><button class="action-dismiss" type="button" data-dismiss-index="${n}" title="Deze melding is niet nodig">✓<span>Niet nodig</span></button></div>`).join('')}</div>`:'<div class="empty">Geen openstaande acties.</div>'}<button class="secondary" id="actionSettings" style="width:100%;margin-top:12px">Meldingsinstellingen</button>`);
    $$('[data-action-index]').forEach(b=>b.addEventListener('click',()=>runActionItem(items[Number(b.dataset.actionIndex)])));
    document.querySelectorAll('[data-snooze-index]').forEach(b=>b.addEventListener('click',()=>openActionSnooze(items[Number(b.dataset.snoozeIndex)])));
    document.querySelectorAll('[data-dismiss-index]').forEach(b=>b.addEventListener('click',async()=>{const item=items[Number(b.dataset.dismissIndex)];await dismissActionItem(item);showActionCenter();}));
    $('#actionSettings').addEventListener('click',()=>showNotificationSettings());
  }
  async function requestNotificationAccess(){
    if(!('Notification' in window)){alert('Systeemmeldingen worden door deze browser niet ondersteund. De actie-badge in de app blijft wel werken.');return false;}
    const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true;
    if(!standalone&&/iPhone|iPad|iPod/i.test(navigator.userAgent)){alert('Op iPhone werken webmeldingen alleen wanneer JK Works aan het beginscherm is toegevoegd en als web-app is geopend.');return false;}
    try{const permission=await Notification.requestPermission();const prefs=await getNotificationPrefs();prefs.systemNotifications=permission==='granted';await JKDB.put('settings',prefs);await refreshActionBadges(permission==='granted');return permission==='granted';}catch(e){alert('Meldingstoestemming aanvragen lukte niet: '+(e.message||e));return false;}
  }
  function notificationPermissionLabel(){if(!('Notification' in window))return ['Niet ondersteund','blocked'];if(Notification.permission==='granted')return ['Toegestaan','on'];if(Notification.permission==='denied')return ['Geblokkeerd','blocked'];return ['Nog niet toegestaan',''];}
  async function showNotificationSettings(){
    const [prefs,dismissed,snoozes]=await Promise.all([getNotificationPrefs(),getDismissedActions(),getActionSnoozes()]),perm=notificationPermissionLabel(),dismissedCount=Object.keys(dismissed).length,snoozedItems=Object.entries(snoozes).filter(([key,due])=>Number.isFinite(Date.parse(due))&&Date.parse(due)>Date.now());
    // Reconstructie uit de huidige klus- en documentgegevens, niet uit de technische actiecode.
    // De badge blijft geschorst; alleen dit instellingenoverzicht mag die acties tonen.
    const [sourceActions,jobs,documents]=await Promise.all([
      collectActionItems({includeSnoozed:true,knownSnoozes:snoozes}),
      JKDB.all('jobs'),
      JKDB.all('documents')
    ]);
    const sourceByKey=new Map(sourceActions.map(a=>[a.key,a]));
    const jobsById=new Map(jobs.map(j=>[j.id,j]));
    const docsById=new Map(documents.map(d=>[d.id,d]));
    const describeJob=job=>[job.title,job.clientName,job.date?nlDate(job.date):'']
      .map(value=>String(value||'').trim()).filter((value,index,values)=>value&&values.indexOf(value)===index).join(' · ')||'Klus';
    function snoozedActionDescription(key){
      const active=sourceByKey.get(key);
      if(active){
        const job=jobsById.get(active.jobId);
        return {title:active.title,detail:job?describeJob(job):active.detail||''};
      }
      const type=key.split(':')[0],phase=key.split(':')[1],ref=key.slice(type==='photo'?('photo:'+phase+':').length:(type+':').length);
      const titles={
        hours:'Uren invoeren of controleren',
        photo:phase==='before'?'Foto vóór de klus maken':phase==='during'?'Foto tijdens de klus maken':'Foto na de klus maken',
        quoteCreate:'Offerte opmaken',
        quoteSend:'Offerte versturen',
        invoiceCreate:'Factuur opmaken',
        invoiceSend:'Factuur versturen',
        paymentReminder:'Betaalherinnering nodig'
      };
      const job=jobsById.get(ref),doc=docsById.get(ref);
      const related=job?describeJob(job)
        :doc?(doc.meta?.number||doc.filename||'Document'):'De oorspronkelijke klus of het document is niet meer beschikbaar';
      return {title:titles[type]||'Uitgestelde actie',detail:related};
    }
    const row=(name,label,desc)=>`<label class="notification-pref"><span class="pref-copy"><strong>${label}</strong><small>${desc}</small></span><input type="checkbox" name="${name}" ${prefs[name]?'checked':''}></label>`;
    modal(`${modalHead('Meldingen')}<form id="notificationForm"><div class="card"><div class="section-inline"><h3>iPhone / browser</h3><span class="notification-status ${perm[1]}">${perm[0]}</span></div><p class="muted small">De rode app-badge werkt op ondersteunde geïnstalleerde web-apps. Systeemmeldingen kunnen op iPhone worden toegestaan als JK Works op het beginscherm staat.</p><div class="button-row"><button type="button" class="secondary" id="allowNotifications">Meldingen toestaan</button>${('Notification' in window&&Notification.permission==='granted')?'<button type="button" class="secondary" id="testNotification">Test melding</button>':''}</div>${row('badges','Badge op app-icoon','Toon het aantal openstaande acties op het JK Works-icoon.')}${('Notification' in window&&Notification.permission==='granted')?row('systemNotifications','Systeemmeldingen','Toon een melding wanneer tijdens gebruik van de app een nieuwe actie nodig wordt.'):''}</div><div class="card"><h3>Echte pushmeldingen</h3><p class="muted small">Ontvang nieuwe websiteaanvragen en meldingen uit de ingeschakelde categorieën op je iPhone, ook wanneer de app gesloten is. Actieherinneringen gebruiken de laatst gesynchroniseerde cloudgegevens.</p><div class="button-row"><button type="button" class="secondary" id="enableRealPush">Push inschakelen</button><button type="button" class="secondary" id="disableRealPush">Push uitschakelen</button><button type="button" class="secondary" id="testRealPush">Test pushmelding versturen</button></div><p class="muted small">De testmelding wordt na ongeveer 30 seconden naar je eigen geregistreerde apparaten verstuurd. Na bevestiging kun je de app sluiten en je iPhone vergrendelen.</p><p id="realPushStatus" class="muted small" role="status" aria-live="polite"></p></div><div class="card"><h3>Categorieën</h3>${row('hours','Uren invoeren / controleren','Na de geplande eindtijd van een klus.')}${row('photos','Foto’s maken','Bij verplichte voor-, tijdens- en na-foto’s.')}${row('quoteCreate','Offerte opmaken','Alleen als bij de klus “Offerte nodig” is aangevinkt.')}${row('quoteSend','Offerte versturen','Als een gekoppelde offerte nog niet als Verstuurd staat.')}${row('invoiceCreate','Factuur opmaken','Na een factuurklus als nog geen factuur is gemaakt.')}${row('invoiceSend','Factuur versturen','Als een gekoppelde factuur nog niet als Verstuurd staat.')}${row('paymentReminder','Betaalherinnering','Als een verstuurde factuur na de vervaldatum nog niet betaald is.')}</div>${snoozedItems.length?`<div class="card"><h3>Uitgestelde acties (${snoozedItems.length})</h3><p class="muted small">Deze acties tellen voorlopig niet mee voor de rode badge.</p>${snoozedItems.map(([key,due],n)=>`<div class="action-row"><div class="action-open"><span class="action-main"><strong>${esc(snoozedActionDescription(key).title)}</strong><small>${esc(snoozedActionDescription(key).detail)}</small><small>Herinnering: ${new Date(due).toLocaleString('nl-NL')}</small></span></div><button type="button" class="action-snooze" data-unsnooze="${n}">↩<span>Herstellen</span></button></div>`).join('')}</div>`:''}${dismissedCount?`<div class="card"><div class="section-inline"><h3>Weggeklikte meldingen</h3><span class="pill">${dismissedCount}</span></div><p class="muted small">Meldingen die je met ‘Niet nodig’ hebt weggeklikt blijven verborgen. Herstel ze hier als je ze opnieuw wilt laten verschijnen.</p><button type="button" class="secondary" id="restoreDismissed" style="width:100%">Alle weggeklikte meldingen herstellen</button></div>`:''}<button class="primary" style="width:100%">Instellingen opslaan</button></form>`);
    document.querySelectorAll('[data-unsnooze]').forEach(b=>b.addEventListener('click',async()=>{const key=snoozedItems[Number(b.dataset.unsnooze)]?.[0];if(!key)return;try{await cancelSnooze(key);showNotificationSettings();}catch(error){alert(error.message||error);}}));
    $('#enableRealPush')?.addEventListener('click',async()=>{const el=$('#realPushStatus');el.textContent='Aanmelden...';try{await JKPush.subscribe();el.textContent='Pushmeldingen zijn ingeschakeld op dit apparaat.';}catch(e){el.textContent='Inschakelen mislukt: '+(e.message||e);}});
    $('#disableRealPush')?.addEventListener('click',async()=>{const el=$('#realPushStatus');try{await JKPush.unsubscribe();el.textContent='Pushmeldingen zijn uitgeschakeld op dit apparaat.';}catch(e){el.textContent='Uitschakelen mislukt: '+(e.message||e);}});
    $('#testRealPush')?.addEventListener('click',async event=>{
      const button=event.currentTarget,el=$('#realPushStatus');
      if(button.disabled)return;button.disabled=true;
      el.dataset.testPush='active';el.textContent='Testmelding inplannen…';
      try{await JKPush.test();el.textContent='Testmelding ingepland. Supabase verstuurt deze na ongeveer 30 seconden. Je kunt de app nu sluiten en je iPhone vergrendelen.';}
      catch(error){el.textContent=error.message;}
      finally{button.disabled=false;}
    });
    JKPush.status().then(x=>{const el=$('#realPushStatus');if(el&&!el.dataset.testPush)el.textContent=x;}).catch(()=>{});
    $('#allowNotifications').addEventListener('click',async()=>{if(await requestNotificationAccess()){closeModal();showNotificationSettings();}});
    $('#testNotification')?.addEventListener('click',async()=>{try{const reg=await navigator.serviceWorker.ready;await reg.showNotification('JK Works',{body:'Testmelding werkt.',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:'jkworks-test'});}catch(e){alert('Testmelding lukte niet: '+(e.message||e));}});
    $('#restoreDismissed')?.addEventListener('click',async()=>{if(!confirm('Alle weggeklikte meldingen opnieuw zichtbaar maken?'))return;await restoreDismissedActions();closeModal();toast('Weggeklikte meldingen hersteld');showNotificationSettings();});
    $('#notificationForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),next={...prefs};['badges','systemNotifications','hours','photos','quoteCreate','quoteSend','invoiceCreate','invoiceSend','paymentReminder'].forEach(k=>{if(k==='systemNotifications'&&(!('Notification' in window)||Notification.permission!=='granted')){next[k]=false;return;}next[k]=f.get(k)==='on';});await JKDB.put('settings',next);closeModal();toast('Meldingsinstellingen opgeslagen');await refreshActionBadges(false);if(state.route==='more')renderMore();});
  }

  async function ensureJobTimeEntry(j){return null;}
  async function markJobReminderHandled(j){
    j.completionPromptHandledAt=new Date().toISOString();
    await JKDB.put('jobs',j);
  }
  async function maybeShowCompletedJobReminder(){
    if(state.reminderChecking || !JKCloud.isSignedIn() || $('#modalRoot')?.children.length)return;
    const notificationPrefs=await getNotificationPrefs();if(!notificationPrefs.hours)return;
    state.reminderChecking=true;
    try{
      const now=new Date();
      const jobs=(await JKDB.all('jobs')).filter(j=>!Array.isArray(j.workDays)&&!j.completionPromptHandledAt && !state.snoozedReminderJobs.has(j.id));
      const due=jobs.map(j=>({j,end:jobPlannedEnd(j)})).filter(x=>x.end && x.end<=now).sort((a,b)=>a.end-b.end);
      if(!due.length)return;
      const j=due[0].j;
      const entries=(await JKDB.all('timeEntries')).filter(e=>e.jobId===j.id);
      const auto=entries.find(e=>e.id===j.autoTimeEntryId) || entries.find(e=>e.autoFromJobSchedule===true);
      const planned=auto?`${nlDate(entryDate(auto))} · ${esc(entryFrom(auto))} - ${esc(entryTo(auto))}`:`${nlDate(j.date)} · ${esc(jobTimeLabel(j))}`;
      modal(`${modalHead('Klus afgelopen')}<div class="card"><h3>Let op: controleer je uren</h3><p><strong>${esc(j.title||'Klus')}</strong>${j.clientName?`<br><span class="muted small">${esc(j.clientName)}</span>`:''}</p><p class="muted small">De geplande eindtijd is voorbij (${planned}). Controleer of de geregistreerde uren kloppen en maak daarna eventueel direct de factuur.</p></div><div class="button-row"><button class="primary" id="reminderHours">Uren controleren</button><button class="secondary" id="reminderInvoice">Factuur maken</button><button class="secondary" id="reminderDone">Gecontroleerd</button><button class="ghost" id="reminderLater">Later</button></div>`);
      $('#reminderHours').addEventListener('click',async()=>{await markJobReminderHandled(j);closeModal();editTimeEntry(auto?.id||null,j.id)});
      $('#reminderInvoice').addEventListener('click',async()=>{await markJobReminderHandled(j);closeModal();createBusinessDoc('Factuur',{jobId:j.id,clientId:j.clientId,workDate:j.date})});
      $('#reminderDone').addEventListener('click',async()=>{await markJobReminderHandled(j);closeModal();toast('Controle geregistreerd');render();});
      $('#reminderLater').addEventListener('click',()=>{state.snoozedReminderJobs.add(j.id);closeModal();});
    }finally{state.reminderChecking=false;}
  }

  let appReady=false;

  async function init(){
    await JKDB.open();
    await JKCloud.init();
    bindSiteAuth();
    bindCloudEvents();
    registerSW();
    await applyAuthState();
  }

  async function migrateLocalJobPhotosToCloud(){
    const flag=await JKDB.get('settings','photoCloudMigrationV45');
    if(flag?.done)return;
    const photos=await JKDB.all('jobPhotos');
    for(const p of photos){
      // Oudere lokale foto's zijn mogelijk nog groter. Comprimeer ze eerst opnieuw.
      if(p.blob instanceof Blob && p.blob.size>250*1024){
        const file=new File([p.blob],p.name||'klusfoto.jpg',{type:p.blob.type||'image/jpeg'});
        const {blob,originalSize}=await optimizeJobPhoto(file);
        p.originalSize=p.originalSize||originalSize;p.blob=blob;p.compressedSize=blob.size;
        await JKDB.putLocal('jobPhotos',p);
      }
      if(window.JKCloud?.queuePut) await JKCloud.queuePut('jobPhotos',p);
    }
    await JKDB.putLocal('settings',{id:'photoCloudMigrationV45',done:true,at:new Date().toISOString()});
  }

  function bindSiteAuth(){
    const form=$('#siteLoginForm');
    if(!form || form.dataset.bound==='1')return;
    form.dataset.bound='1';
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const error=$('#siteLoginError'), button=form.querySelector('button[type=submit]');
      const f=new FormData(form), email=String(f.get('email')||'').trim(), password=String(f.get('password')||'');
      error.hidden=true; error.textContent=''; button.disabled=true; button.textContent='Inloggen...';
      try{
        await JKCloud.signIn(email,password);
        form.reset();
        await applyAuthState();
      }catch(err){
        error.textContent='Inloggen mislukt. Controleer je e-mailadres en wachtwoord.';
        error.hidden=false;
        console.warn('Site-login mislukt',err);
      }finally{
        button.disabled=false; button.textContent='Inloggen';
      }
    });
  }

  async function applyAuthState(){
    const signedIn=JKCloud.isSignedIn();
    const gate=$('#authGate'), shell=$('#appShell');
    document.body.classList.toggle('auth-locked',!signedIn);
    if(gate)gate.hidden=signedIn;
    if(shell)shell.hidden=!signedIn;
    const logoutBtn=$('#topLogoutBtn'),notificationBtn=$('#notificationBtn');
    if(logoutBtn) logoutBtn.hidden=!signedIn;
    if(notificationBtn) notificationBtn.hidden=!signedIn;
    if(!signedIn){
      if($('#modalRoot'))$('#modalRoot').innerHTML='';
      if('clearAppBadge' in navigator)navigator.clearAppBadge().catch(()=>{});
      const next=location.pathname+location.search+location.hash;
      location.replace('/inloggen/?next='+encodeURIComponent(next.startsWith('/app')?next:'/app/'));
      return;
    }
    if(!appReady){
      window.__JK_SEEDING=true;
      try{await JKDB.seed();}finally{window.__JK_SEEDING=false;}
      await migrateLocalJobPhotosToCloud();
      bindNav();
      bindInputs();
      appReady=true;
      if(navigator.onLine)setTimeout(()=>ensurePdfLib().catch(()=>{}),1000);
    }
    
    await render();
    await refreshSyncButton();
    await refreshActionBadges(true);
    startNotificationTimer();
    setTimeout(()=>maybeShowCompletedJobReminder().catch(console.error),250);
  }

  function uiBusy(){ return !!window.__JK_UI_BUSY || !!$('#modalRoot')?.children.length; }
  async function flushDeferredUi(){
    if(uiBusy())return;
    if(state.pendingAuthRefresh){ state.pendingAuthRefresh=false; await applyAuthState(); return; }
    if(state.pendingCloudRefresh){
      state.pendingCloudRefresh=false;
      await render();
      setTimeout(()=>maybeShowCompletedJobReminder().catch(console.error),250);
    }
  }
  function bindCloudEvents(){
    document.addEventListener('jkcloud-auth',()=>{
      if(uiBusy()){state.pendingAuthRefresh=true;return;}
      applyAuthState().catch(console.error);
    });
    document.addEventListener('jkcloud-queue',()=>refreshSyncButton().catch(()=>{}));
    document.addEventListener('jkcloud-sync',e=>{
      refreshSyncButton().catch(()=>{});
      if(e.detail?.state==='done')refreshActionBadges(false).catch(()=>{});
      if(!JKCloud.isSignedIn()||e.detail?.state!=='done'||!e.detail?.changed)return;
      if(uiBusy()){state.pendingCloudRefresh=true;return;}
      render().then(()=>setTimeout(()=>maybeShowCompletedJobReminder().catch(console.error),250));
    });
  }
  async function refreshSyncButton(){
    const btn=$('#manualSyncBtn'); if(!btn)return;
    const cs=JKCloud.status();
    btn.hidden=!cs.signedIn;
    if(!cs.signedIn)return;
    const pending=await JKCloud.pendingCount();
    btn.classList.toggle('pending',pending>0);
    btn.disabled=cs.syncing||!navigator.onLine;
    btn.innerHTML=cs.syncing?'↻ <span>Sync...</span>':`☁ <span>${pending?`Sync (${pending})`:'Sync'}</span>`;
    btn.title=!navigator.onLine?'Geen internet - wijzigingen blijven lokaal':pending?`${pending} wijziging${pending===1?'':'en'} klaar om te synchroniseren`:'Handmatig synchroniseren';
  }
  async function manualSync(){
    if(!JKCloud.isSignedIn()){toast('Log eerst in');return;}
    if(!navigator.onLine){toast('Geen internet - wijzigingen blijven lokaal');return;}
    if(uiBusy()){toast('Sluit eerst het invoerscherm');return;}
    try{
      await refreshSyncButton();
      await JKCloud.syncNow();
      await refreshSyncButton();
      await refreshActionBadges(true);
      toast('Synchronisatie voltooid');
    }catch(e){alert('Synchroniseren mislukt: '+e.message);await refreshSyncButton();}
  }
  function registerSW(){if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./service-worker.js').catch(()=>{});}
  function ensurePdfLib(){
    if(window.PDFLib)return Promise.resolve(window.PDFLib);
    if(state.pdfLibPromise)return state.pdfLibPromise;
    state.pdfLibPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src=PDFLIB_URL;s.async=true;s.crossOrigin='anonymous';
      const t=setTimeout(()=>{state.pdfLibPromise=null;s.remove();reject(new Error('PDF-module kon niet worden geladen. Open de app één keer met internet.'));},18000);
      s.onload=()=>{clearTimeout(t);window.PDFLib?resolve(window.PDFLib):(state.pdfLibPromise=null,reject(new Error('PDF-module niet beschikbaar.')))};
      s.onerror=()=>{clearTimeout(t);state.pdfLibPromise=null;reject(new Error('PDF-module kon niet worden geladen. Controleer je internetverbinding.'));};
      document.head.appendChild(s);
    });
    return state.pdfLibPromise;
  }
  function ensurePdfJs(){
    if(window.pdfjsLib){
      window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER_URL;
      return Promise.resolve(window.pdfjsLib);
    }
    if(state.pdfJsPromise)return state.pdfJsPromise;
    state.pdfJsPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src=PDFJS_URL;s.async=true;s.crossOrigin='anonymous';
      const t=setTimeout(()=>{state.pdfJsPromise=null;s.remove();reject(new Error('PDF-leesmodule kon niet worden geladen. Controleer je internetverbinding.'));},18000);
      s.onload=()=>{
        clearTimeout(t);
        if(!window.pdfjsLib){state.pdfJsPromise=null;reject(new Error('PDF-leesmodule niet beschikbaar.'));return;}
        window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER_URL;
        resolve(window.pdfjsLib);
      };
      s.onerror=()=>{clearTimeout(t);state.pdfJsPromise=null;reject(new Error('PDF-leesmodule kon niet worden geladen. Controleer je internetverbinding.'));};
      document.head.appendChild(s);
    });
    return state.pdfJsPromise;
  }
  function parsePdfDate(value){
    const s=String(value||'').trim();let m=s.match(/\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);if(m)return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m=s.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})\b/);if(m)return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    return '';
  }
  function parsePdfEuro(value){
    let s=String(value||'').replace(/EUR|EURO|€/gi,'').replace(/\s/g,'').replace(/[^0-9,.-]/g,'');if(!s)return NaN;
    if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
    else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');
    const n=Number(s);return Number.isFinite(n)?n:NaN;
  }
  async function extractPdfLines(blob){
    await ensurePdfJs();
    const data=new Uint8Array(await blob.arrayBuffer()),pdf=await window.pdfjsLib.getDocument({data}).promise,all=[];
    for(let n=1;n<=pdf.numPages;n++){
      const pg=await pdf.getPage(n),tc=await pg.getTextContent(),rows=[];
      for(const item of tc.items||[]){
        const str=String(item.str||'').trim();if(!str)continue;
        const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0);
        let row=rows.find(r=>Math.abs(r.y-y)<=2.5);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,str});
      }
      rows.sort((a,b)=>b.y-a.y);
      for(const row of rows){row.items.sort((a,b)=>a.x-b.x);const line=row.items.map(i=>i.str).join(' ').replace(/\s+/g,' ').trim();if(line)all.push(line);}
    }
    return all;
  }
  function firstLabeledValue(lines,labels){
    for(let i=0;i<lines.length;i++)for(const re of labels){
      const m=lines[i].match(re);if(!m)continue;
      const same=String(m[1]||'').replace(/^\s*[:#-]?\s*/,'').trim();if(same)return same;
      for(let j=i+1;j<Math.min(lines.length,i+4);j++){const next=lines[j].trim();if(next)return next;}
    }return '';
  }
  function parseImportedBusinessPdf(lines,folder,company){
    const flat=lines.join(' '),lower=flat.toLowerCase(),ownName=String(company?.companyName||'JK Works Dordrecht').toLowerCase();
    const businessVerified=lower.includes('jk works dordrecht')||lower.includes(ownName)||/420\s*78161/.test(flat)||/nl\s*005477968b66/i.test(flat);
    const numberLabels=folder==='factuur'?[/(?:factuurnummer|factuur\s*nr\.?|factuurnr\.?)\s*[:#-]?\s*(.+)$/i]:[/(?:offertenummer|offerte\s*nr\.?|offertenr\.?)\s*[:#-]?\s*(.+)$/i];
    let number=firstLabeledValue(lines,numberLabels).split(/\s+(?=(?:datum|werkzaamheden|factuurdatum|offertedatum|geldig|vervaldatum)\b)|\|/i)[0].trim();
    if(!number){const m=flat.match(folder==='factuur'?/\bFAC[-\s_/]?20\d{2}[-\s_/]?\d+\b/i:/\bOFF[-\s_/]?20\d{2}[-\s_/]?\d+\b/i);if(m)number=m[0].replace(/\s+/g,'-');}
    const dateLabels=folder==='factuur'?[/factuurdatum\s*[:#-]?\s*(.*)$/i,/datum\s+factuur\s*[:#-]?\s*(.*)$/i]:[/offertedatum\s*[:#-]?\s*(.*)$/i,/datum\s+offerte\s*[:#-]?\s*(.*)$/i,/^datum\s*[:#-]?\s*(.*)$/i];
    let date=parsePdfDate(firstLabeledValue(lines,dateLabels));
    if(!date){for(const line of lines.slice(0,25)){date=parsePdfDate(line);if(date)break;}}
    let workDate=parsePdfDate(firstLabeledValue(lines,[/(?:datum\s+werkzaamheden|werkzaamheden\s+op|prestatiedatum|datum\s+prestatie)\s*[:#-]?\s*(.*)$/i]));
    let total=NaN;
    const totalLabels=[/totaal\s+te\s+betalen/i,/factuurbedrag/i,/te\s+betalen/i,/eindtotaal/i,/totaal/i];
    for(const re of totalLabels){for(let i=lines.length-1;i>=0;i--){if(!re.test(lines[i]))continue;const amounts=lines[i].match(/(?:EUR|€)?\s*-?\d[\d.]*,\d{2}|(?:EUR|€)\s*-?\d+(?:\.\d{2})?/gi)||[];if(amounts.length){const n=parsePdfEuro(amounts[amounts.length-1]);if(Number.isFinite(n)){total=n;break;}}}if(Number.isFinite(total))break;}
    const clientAnchors=[/^(?:factuur\s+aan|offerte\s+voor|klant|klantgegevens|debiteur|aan)\s*[:#-]?\s*(.*)$/i];
    let clientName=firstLabeledValue(lines,[/^(?:naam\s*\/\s*bedrijf|naam\s+bedrijf|bedrijfsnaam)\s*[:#-]?\s*(.*)$/i]),clientAddress=firstLabeledValue(lines,[/^adres\s*[:#-]?\s*(.*)$/i]),clientPostalCity=firstLabeledValue(lines,[/^(?:postcode\s*\/\s*plaats|postcode\s+plaats)\s*[:#-]?\s*(.*)$/i]);
    for(let i=0;i<lines.length&&!clientName;i++)for(const re of clientAnchors){const m=lines[i].match(re);if(!m)continue;let candidates=[];if((m[1]||'').trim())candidates.push(m[1].trim());for(let j=i+1;j<Math.min(lines.length,i+6);j++)candidates.push(lines[j].trim());candidates=candidates.filter(Boolean).filter(v=>!/^(t\.a\.v\.?|adres|postcode|plaats|telefoon|e-?mail)\b/i.test(v));clientName=candidates.find(v=>!v.toLowerCase().includes('jk works')&&!/420\s*78161/.test(v)&&!/@/.test(v))||'';const postal=candidates.find(v=>/\b\d{4}\s?[A-Z]{2}\b/i.test(v));if(postal)clientPostalCity=postal;const addr=candidates.find(v=>/\b\d+[a-z]?\b/i.test(v)&&v!==clientPostalCity&&v!==clientName);if(addr)clientAddress=addr;break;}
    if(!clientName){
      const idx=lines.findIndex(v=>/^t\.a\.v\./i.test(v));if(idx>0&&idx<lines.length-1)clientName=lines[idx+1].replace(/^t\.a\.v\.\s*/i,'').trim();
    }
    const findMoneyByLabel=(regex)=>{for(let i=lines.length-1;i>=0;i--){if(!regex.test(lines[i]))continue;const amounts=lines[i].match(/(?:EUR|€)?\s*-?\d[\d.]*,\d{2}|(?:EUR|€)\s*-?\d+(?:\.\d{2})?/gi)||[];if(amounts.length){const n=parsePdfEuro(amounts[amounts.length-1]);if(Number.isFinite(n))return n;}}return null;};
    const subtotalExVat=findMoneyByLabel(/subtotaal.*(?:excl|exclusief).*btw/i),vatAmount=findMoneyByLabel(/btw\s*bedrag/i);
    const korDetected=/kleineondernemersregeling|vrijgesteld\s+van\s+btw|btw\s*[- ]?vrijgesteld|\bKOR\b/i.test(flat);
    let parsedLines=[];
    const header=lines.findIndex(v=>/omschrijving/i.test(v)&&/(aantal|prijs|bedrag|totaal)/i.test(v));
    if(header>=0){
      for(let i=header+1;i<Math.min(lines.length,header+25);i++){
        const line=lines[i];if(/^(sub)?totaal\b|totaal\s+te\s+betalen|btw\b/i.test(line))break;
        const amts=[...(line.matchAll(/(?:EUR|€)?\s*(-?\d[\d.]*,\d{2})/gi))].map(m=>({raw:m[0],value:parsePdfEuro(m[0]),index:m.index}));
        const qm=line.match(/^\s*(\d+(?:[,.]\d+)?)\s+(.+)/);
        if(qm&&amts.length){const qty=parsePdfEuro(qm[1]);const price=amts.length>=2?amts[amts.length-2].value:amts[0].value;let desc=qm[2].slice(0,Math.max(0,(amts[0].index||0)-qm[1].length)).replace(/(?:EUR|€)\s*$/i,'').trim();if(!desc)desc=qm[2].replace(/(?:EUR|€)?\s*-?\d[\d.]*,\d{2}.*$/i,'').trim();if(desc)parsedLines.push({qty:Number.isFinite(qty)?qty:1,description:desc,price:Number.isFinite(price)?price:0,source:'pdf'});}
      }
    }
    return {businessVerified,number,date,workDate,total:Number.isFinite(total)?total:null,subtotalExVat,vatAmount,client:{name:clientName,address:clientAddress,postalCity:clientPostalCity},lines:parsedLines,korDetected,textLength:flat.length};
  }
  async function parseStoredBusinessDocument(doc,company,force=false){
    const folder=docFolder(doc);if(!['factuur','offerte'].includes(folder)||!(doc.blob instanceof Blob))return doc;
    const meta=doc.meta||{};if(!force&&meta.pdfParseVersion===PDF_PARSE_VERSION)return doc;
    try{
      const lines=await extractPdfLines(doc.blob),parsed=parseImportedBusinessPdf(lines,folder,company);
      const parsedHasVat=parsed.vatAmount!=null||parsed.subtotalExVat!=null;const parsedKorApplied=parsed.korDetected?true:(parsedHasVat?false:(typeof meta.korApplied==='boolean'?meta.korApplied:undefined));doc.meta={...meta,manualImport:meta.manualImport!==false,pdfParseVersion:PDF_PARSE_VERSION,pdfParsedAt:new Date().toISOString(),businessVerified:parsed.businessVerified,pdfTextReadable:parsed.textLength>40,pdfParseError:'',number:parsed.number||meta.number||'',docDate:parsed.date||meta.docDate||'',workDate:parsed.workDate||meta.workDate||'',total:parsed.total??meta.total,subtotalExVat:parsed.subtotalExVat??meta.subtotalExVat,vatAmount:parsed.vatAmount??meta.vatAmount,client:{...(meta.client||{}),...(parsed.client||{})},lines:parsed.lines.length?parsed.lines:(meta.lines||[]),korDetected:parsed.korDetected||meta.korDetected||false,korApplied:parsedKorApplied};
      if(!parsed.businessVerified)doc.meta.pdfParseError='JK Works-bedrijfsgegevens niet herkend in deze PDF.';
      else if(parsed.textLength<=40)doc.meta.pdfParseError='PDF bevat nauwelijks uitleesbare tekst (mogelijk een scan/afbeelding).';
    }catch(e){doc.meta={...meta,manualImport:true,pdfParseVersion:PDF_PARSE_VERSION,pdfParsedAt:new Date().toISOString(),pdfParseError:String(e.message||e)};}
    await JKDB.put('documents',doc);return doc;
  }
  async function reprocessImportedBusinessDocs(force=false){
    const [docs,company]=await Promise.all([JKDB.all('documents'),JKDB.get('settings','company')]);let checked=0,recognized=0;
    for(const d of docs){const folder=docFolder(d),m=d.meta||{},looksImported=['factuur','offerte'].includes(folder)&&d.blob instanceof Blob&&(m.manualImport||(!m.number&&!m.lines));if(!looksImported)continue;if(!force&&m.pdfParseVersion===PDF_PARSE_VERSION)continue;checked++;await parseStoredBusinessDocument(d,company,force);if(d.meta?.businessVerified)recognized++;}
    return {checked,recognized};
  }
  function bindNav(){
    $$('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.route)));
    $('#quickAddBtn').addEventListener('click',quickAdd);
    $('#manualSyncBtn')?.addEventListener('click',manualSync);
    $('#notificationBtn')?.addEventListener('click',showActionCenter);
    $('#topLogoutBtn')?.addEventListener('click',async()=>{
      if(!confirm('Wil je uitloggen bij JK Works?'))return;
      try{
        await JKCloud.signOut();
        toast('Uitgelogd');
        await applyAuthState();
      }catch(e){alert('Uitloggen mislukt: '+e.message)}
    });
  }
  function bindInputs(){
    $('#hiddenExistingPdfInput').addEventListener('change',async e=>{if(e.target.files.length)await importExistingPdfs([...e.target.files],state.importFolderTarget);e.target.value='';});
    $('#hiddenBackupInput').addEventListener('change',async e=>{if(e.target.files[0])await restoreBackup(e.target.files[0]);e.target.value='';});
  }
  async function go(route){state.route=route;if(route==='documents')state.docFolder=null;$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route===route));await render();window.scrollTo({top:0,behavior:'instant'});}
  function title(t){$('#pageTitle').textContent=t}
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove('show'),2200)}
  function modal(html){
    if(state.activeBlobUrl){URL.revokeObjectURL(state.activeBlobUrl);state.activeBlobUrl=null;}
    window.__JK_UI_BUSY=true;
    $('#modalRoot').innerHTML=`<div class="modal-backdrop"><section class="modal">${html}</section></div>`;
    // v34: formulieren/modals sluiten alleen nog bewust via de X of een actieknop.
    // Een tik naast het formulier (met name op iPhone bij toetsenbordwissels) mag
    // nooit meer onbedoeld het venster sluiten.
    $$('[data-close]').forEach(x=>x.addEventListener('click',closeModal));

    // Voorkom dat Enter/Done in een enkelregelig invoerveld een formulier
    // onbedoeld verstuurt en daardoor sluit. Textarea's en expliciete
    // submitknoppen blijven normaal werken.
    $$('#modalRoot form input:not([type=submit]):not([type=button])').forEach(inp=>{
      inp.addEventListener('keydown',e=>{
        if(e.key==='Enter'){e.preventDefault(); inp.blur();}
      });
    });
  }
  function closeModal(){
    if(state.activeBlobUrl){URL.revokeObjectURL(state.activeBlobUrl);state.activeBlobUrl=null;}
    $('#modalRoot').innerHTML='';
    window.__JK_UI_BUSY=false;
    setTimeout(()=>{
      flushDeferredUi().catch(console.error);
      refreshSyncButton().catch(()=>{});
      refreshActionBadges(false).catch(()=>{});
    },50);
  }
  function modalHead(t){return `<div class="modal-head"><h2>${esc(t)}</h2><button class="close-btn" data-close>×</button></div>`}
  async function render(){const v=$('#view');v.innerHTML='<div class="empty">Laden...</div>';try{if(state.route==='dashboard')return renderDashboard();if(state.route==='jobs')return renderJobs();if(state.route==='gear')return renderGear();if(state.route==='documents')return renderDocuments();if(state.route==='more')return renderMore();}catch(e){console.error(e);v.innerHTML=`<div class="card"><h2>Er ging iets mis</h2><p class="muted">${esc(e.message||e)}</p></div>`}}

  function entryMinutes(e){
    if(e.autoFromJobSchedule===true&&!e.actualConfirmed)return 0;
    const pause=Math.max(0,num(e.breakMinutes));
    if(e.date&&e.from&&e.to){let a=new Date(`${e.date}T${e.from}:00`),b=new Date(`${e.date}T${e.to}:00`);if(b<=a)b.setDate(b.getDate()+1);return Math.max(0,Math.round((b-a)/60000)-pause);}
    if(e.start&&e.end)return Math.max(0,Math.round((new Date(e.end)-new Date(e.start))/60000)-pause);
    return 0;
  }
  function entryDate(e){return e.date||String(e.start||'').slice(0,10)}
  function entryFrom(e){return e.from||String(e.start||'').slice(11,16)}
  function entryTo(e){return e.to||String(e.end||'').slice(11,16)}

  function currentYearMonthBuckets(entries){
    const y=new Date().getFullYear();
    const arr=Array.from({length:12},(_,i)=>({key:`${y}-${String(i+1).padStart(2,'0')}`,label:monthName(i),minutes:0}));
    for(const e of entries){const d=new Date(entryDate(e)+'T12:00:00');if(Number.isNaN(d.getTime())||d.getFullYear()!==y)continue;arr[d.getMonth()].minutes+=entryMinutes(e)}
    return arr;
  }
  function dashboardYearMiniChart(entries){
    const buckets=currentYearMonthBuckets(entries),max=Math.max(1,...buckets.map(b=>b.minutes)),total=buckets.reduce((s,b)=>s+b.minutes,0),year=new Date().getFullYear();
    return `<div class="dash-stat-head"><span>${year} per maand</span><strong>Totaal ${hoursLabel(total)}</strong></div><div class="dash-month-chart">${buckets.map(b=>`<div class="dash-month-col" title="${esc(b.label)}: ${hoursLabel(b.minutes)}"><span class="dash-month-hours">${b.minutes?hoursLabel(b.minutes):'0u'}</span><span class="dash-month-track"><i style="height:${b.minutes?Math.max(8,Math.round((b.minutes/max)*100)):2}%"></i></span><span class="dash-month-label">${esc(b.label.slice(0,3))}</span></div>`).join('')}</div>`;
  }

  async function getWebsiteRequestsSafe(){
    try{return JKCloud.isSignedIn()?await JKCloud.getWebsiteRequests():[];}catch(e){console.warn('Aanvragen ophalen mislukt',e);return [];}
  }

  // Alleen lokaal opgeslagen, handmatig gemaakte back-ups activeren een maandelijkse herinnering.
  // 'Later' stelt de melding 30 dagen uit, zonder een back-up te verplichten.
  function backupReminderInfo(backup,now=Date.now()){
    const dates=[backup?.lastBackup,backup?.lastLocalBackup]
      .map(date=>Date.parse(date||'')).filter(Number.isFinite);
    if(!dates.length)return null;
    const latest=Math.max(...dates),interval=30*86400000;
    if(latest>now||now-latest<interval)return null;
    const dismissed=Date.parse(backup?.reminderDismissedAt||'');
    if(Number.isFinite(dismissed)&&dismissed>=latest&&dismissed<=now&&now-dismissed<interval)return null;
    return {daysSinceBackup:Math.floor((now-latest)/86400000)};
  }

  async function renderDashboard(){
    await refreshFinance();
    title('Dashboard');
    const [entries,backup,jobs,company,requests,actions]=await Promise.all([JKDB.all('timeEntries'),JKDB.get('settings','backup'),JKDB.all('jobs'),JKDB.get('settings','company'),getWebsiteRequestsSafe(),collectActionItems()]);
    const now=new Date();
    const eligibleJobs=jobs.flatMap(j=>jobWorkDays(j).map(d=>({...j,...d,id:j.id,workDays:undefined}))).filter(j=>j?.id&&j.date&&j.status!=='afgerond'&&j.status!=='geannuleerd');
    const currentJobs=eligibleJobs.filter(j=>{const start=jobPlannedStart(j),end=jobPlannedEnd(j);return start&&start<=now&&(!end||end>now)&&j.date===today();}).sort((a,b)=>(+jobPlannedStart(a))-(+jobPlannedStart(b)));
    const upcomingJobs=eligibleJobs.filter(j=>{const start=jobPlannedStart(j);return start&&start>now;}).sort((a,b)=>(+jobPlannedStart(a))-(+jobPlannedStart(b)));
    const dashboardJob=currentJobs[0]||upcomingJobs[0]||null;
    const dashboardJobCurrent=!!currentJobs.length;
    const dashboardJobHtml=dashboardJob?`<div class="section-title"><h2>${dashboardJobCurrent?'Huidige klus':'Aankomende klus'}</h2></div><button type="button" id="dashboardJobOpen" class="card" style="width:100%;text-align:left;cursor:pointer;display:block"><strong>${esc(dashboardJob.title||'Klus')}</strong><div class="muted small">${esc(dashboardJob.clientName||'Geen klant')} · ${nlDate(dashboardJob.date)}${jobTimeLabel(dashboardJob)?' · '+esc(jobTimeLabel(dashboardJob)):''}</div><div class="muted small">Tik om de klus te openen en te bewerken →</div></button>`:'';
    const backupReminder=backupReminderInfo(backup);
    const newRequests=requests.filter(r=>r.status==='new').length;
    const openPayments=jobs.reduce((sum,j)=>sum+jobFinancial(j,entries,company).open,0)+state.finance.documents.filter(isUnassignedInvoice).reduce((n,d)=>n+state.finance.document(d).open,0);
    $('#view').innerHTML=`
      ${backupReminder?`<div class="warning backup-reminder" role="status"><strong>Herinnering: back-up maken?</strong><p class="small">Je laatste back-up op dit apparaat was ${backupReminder.daysSinceBackup} dagen geleden. Jij kiest of en wanneer je opnieuw een back-up maakt.</p><div class="button-row"><button class="link-btn" id="dashBackup" type="button">Back-up maken</button><button class="link-btn" id="dismissBackupReminder" type="button">Herinner mij over 30 dagen</button></div></div>`:''}
      <div class="dashboard-attention"><button id="dashRequests"><span>📥</span><strong>${newRequests}</strong><small>nieuwe aanvragen</small></button><button id="dashActions"><span>🔔</span><strong>${actions.length}</strong><small>open acties</small></button><button id="dashOpenPayments"><span>💶</span><strong>${money(openPayments)}</strong><small>openstaand</small></button></div>
      ${dashboardJobHtml}\n      <div class="section-title dashboard-first-title"><h2>Snel openen</h2></div>
      <div class="quick-grid dashboard-quick-grid">
        <button class="quick" id="newJobDash"><span class="emoji">👷</span><strong>Nieuwe klus</strong><small>Opdracht en klant koppelen</small></button>
        <button class="quick" id="addHours"><span class="emoji">🕒</span><strong>Uren invoeren</strong><small>Datum en van-tot registreren</small></button>
        <button class="quick" id="newQuote"><span class="emoji">📄</span><strong>Nieuwe offerte</strong><small>Vanuit een bestaande klus</small></button>
        <button class="quick" id="newInvoice"><span class="emoji">🧾</span><strong>Nieuwe factuur</strong><small>Uren en materiaal factureren</small></button>
        <button class="quick" id="clientsDash"><span class="emoji">👥</span><strong>Klanten</strong><small>Contact- en adresgegevens</small></button>
        <button class="quick" data-go="gear"><span class="emoji">🧰</span><strong>Materiaal</strong><small>Inpaklijsten en gereedschap</small></button>
        <button class="quick quick-stat" id="timeStatsDash"><span class="quick-stat-title"><span class="emoji">📊</span><strong>Urenstatistieken</strong></span>${dashboardYearMiniChart(entries)}</button>
      </div>`;
    $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
    $('#dashboardJobOpen')?.addEventListener('click',()=>showJob(dashboardJob.id));
    $('#newInvoice').addEventListener('click',()=>createBusinessDoc('Factuur'));
    $('#newQuote').addEventListener('click',()=>createBusinessDoc('Offerte'));
    $('#addHours').addEventListener('click',()=>chooseJobCalculation());
    $('#newJobDash').addEventListener('click',()=>editJob());
    $('#clientsDash').addEventListener('click',()=>showClients());
    $('#timeStatsDash').addEventListener('click',()=>showTimeStats());
    $('#dashRequests').addEventListener('click',()=>showWebsiteRequests());
    $('#dashActions').addEventListener('click',()=>showActionCenter());
    $('#dashOpenPayments').addEventListener('click',()=>go('jobs'));
    $('#dashBackup')?.addEventListener('click',exportBackup);
    $('#dismissBackupReminder')?.addEventListener('click',async()=>{
      // Gebruik putLocal: elke browser heeft een eigen uitsteldatum, zonder cloudsync.
      const local=await JKDB.get('settings','backup')||{id:'backup'};
      await JKDB.putLocal('settings',{...local,id:'backup',reminderDismissedAt:new Date().toISOString()});
      await renderDashboard();
    });
  }

  async function showWebsiteRequests(){
    let rows=[];
    try{rows=await JKCloud.getWebsiteRequests();}catch(e){alert('Aanvragen ophalen mislukt: '+(e.message||e));return;}
    const active=rows.filter(r=>r.status!=='rejected'&&r.status!=='converted'),done=rows.filter(r=>r.status==='converted'||r.status==='rejected');
    const rowHtml=r=>`<div class="list-item clickable request-row ${r.status==='new'?'request-new':''}" data-request="${r.id}"><div class="main"><div class="title">${esc(r.name)}${r.company?' · '+esc(r.company):''}</div><div class="sub">${esc(r.request_type||'Aanvraag')}${r.requested_date?' · '+nlDate(r.requested_date):''}${r.location?' · '+esc(r.location):''}</div><div class="sub">${esc(String(r.description||'').slice(0,120))}${String(r.description||'').length>120?'…':''}</div></div><span class="pill ${r.status==='new'?'warn':r.status==='converted'?'success':''}">${esc(r.status==='new'?'nieuw':r.status==='contact'?'contact':r.status==='converted'?'verwerkt':'afgewezen')}</span></div>`;
    modal(`${modalHead('Website-aanvragen')}<div class="card"><div class="section-inline"><h3>Open aanvragen</h3><span class="pill ${active.length?'warn':'success'}">${active.length}</span></div><p class="muted small">Aanvragen via jkworks.nl komen hier direct binnen. Maak er met één knop een klant + klus van of markeer dat je contact hebt opgenomen.</p></div>${active.length?`<div class="list">${active.map(rowHtml).join('')}</div>`:'<div class="empty">Geen open aanvragen.</div>'}${done.length?`<details class="card" style="margin-top:12px"><summary><strong>Afgehandeld (${done.length})</strong></summary><div class="list" style="margin-top:10px">${done.map(rowHtml).join('')}</div></details>`:''}`);
    $$('[data-request]').forEach(b=>b.addEventListener('click',()=>showWebsiteRequestDetail(b.dataset.request,rows)));
  }
  async function showWebsiteRequestDetail(id,rows=null){
    rows=rows||await JKCloud.getWebsiteRequests();const r=rows.find(x=>x.id===id);if(!r)return;
    const contact=[r.phone,r.email].filter(Boolean).join(' · '),time=[r.start_time?String(r.start_time).slice(0,5):'',r.end_time?String(r.end_time).slice(0,5):''].filter(Boolean).join(' - ');
    const photoUrls=[];for(const path of (Array.isArray(r.photo_paths)?r.photo_paths:[])){try{const blob=await JKCloud.downloadRequestPhoto(path);photoUrls.push(URL.createObjectURL(blob));}catch(e){console.warn('Aanvraagfoto laden mislukt',path,e);}}
    const photosHtml=photoUrls.length?`<div class="request-photo-grid">${photoUrls.map(u=>`<img src="${u}" alt="Foto bij aanvraag">`).join('')}</div>`:'';
    modal(`${modalHead('Aanvraag')}<div class="card"><h3>${esc(r.name)}${r.company?' · '+esc(r.company):''}</h3><div class="muted small">${esc(r.request_type||'Aanvraag')}${r.requested_date?' · '+nlDate(r.requested_date):''}${time?' · '+esc(time):''}</div>${r.location?`<p class="small"><strong>Locatie:</strong> ${esc(r.location)}</p>`:''}<p>${esc(r.description||'')}</p>${photosHtml}${contact?`<div class="muted small">${esc(contact)}</div>`:''}${r.preferred_contact?`<div class="muted small">Voorkeur: ${esc(r.preferred_contact)}</div>`:''}</div><div class="button-row"><button class="primary" id="requestConvert">Maak klant + klus</button><button class="secondary" id="requestQuote">Klant + klus + offerte</button><button class="secondary" id="requestContact">Contact opgenomen</button>${r.phone?'<button class="secondary" id="requestWhatsApp">WhatsApp</button>':''}${r.email?'<button class="secondary" id="requestEmail">E-mail</button>':''}</div><div class="button-row" style="margin-top:10px"><button class="ghost" id="requestReject">Afwijzen</button><button class="danger-btn" id="requestDelete">Verwijderen</button></div>`);
    $('#requestWhatsApp')?.addEventListener('click',()=>{const tel=String(r.phone||'').replace(/\D/g,'').replace(/^0/,'31');window.open(`https://wa.me/${tel}`,'_blank','noopener,noreferrer')});
    $('#requestEmail')?.addEventListener('click',()=>{location.href=`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent('Reactie op aanvraag via jkworks.nl')}`});
    $('#requestContact').addEventListener('click',async()=>{await JKCloud.updateWebsiteRequest(r.id,{status:'contact'});closeModal();toast('Aanvraag gemarkeerd als contact opgenomen');showWebsiteRequests();});
    $('#requestReject').addEventListener('click',async()=>{if(!confirm('Deze aanvraag als afgewezen markeren?'))return;await JKCloud.updateWebsiteRequest(r.id,{status:'rejected'});closeModal();showWebsiteRequests();});
    $('#requestDelete').addEventListener('click',async()=>{if(!confirm('Deze aanvraag definitief verwijderen?'))return;await JKCloud.deleteWebsiteRequest(r.id);closeModal();toast('Aanvraag verwijderd');showWebsiteRequests();});
    const convertRequest=async(makeQuote=false)=>{
      try{
        const clients=await JKDB.all('clients');let c=clients.find(c=>(r.email&&c.email&&c.email.toLowerCase()===String(r.email).toLowerCase())||(r.phone&&c.phone&&String(c.phone).replace(/\D/g,'')===String(r.phone).replace(/\D/g,'')));
        if(!c){c={id:JKDB.id('client'),name:r.company||r.name,attention:r.company?r.name:'',street:r.location||'',postal:'',city:'',phone:r.phone||'',email:r.email||'',notes:'Aangemaakt vanuit website-aanvraag'};await JKDB.put('clients',c);}
        const j={id:JKDB.id('job'),title:r.request_type||'Opdracht via website',clientId:c.id,clientName:c.name,attention:c.attention||'',street:r.location||c.street||'',postal:c.postal||'',city:c.city||'',phone:r.phone||c.phone||'',email:r.email||c.email||'',date:r.requested_date||today(),startTime:r.start_time?String(r.start_time).slice(0,5):'',endTime:r.end_time?String(r.end_time).slice(0,5):'',status:'gepland',notes:r.description||'',checklistId:'',checklistState:{},photoPolicy:/horeca|catering/i.test(r.request_type||'')?'none':'optional',paymentType:'invoice',hourlyRate:'',extraAmount:'',paymentPaid:false,quoteNeeded:makeQuote,sourceRequestId:r.id};
        await JKDB.put('jobs',j);await ensureJobTimeEntry(j);await JKCloud.updateWebsiteRequest(r.id,{status:'converted'});closeModal();toast(makeQuote?'Klant en klus aangemaakt - offerte voorbereiden':'Klant en klus aangemaakt');
        if(makeQuote)createBusinessDoc('Offerte',{jobId:j.id,clientId:c.id,workDate:j.date});else showJob(j.id);
      }catch(e){alert('Aanvraag verwerken mislukt: '+(e.message||e));}
    };
    $('#requestConvert').addEventListener('click',()=>convertRequest(false));
    $('#requestQuote').addEventListener('click',()=>convertRequest(true));
  }

  async function renderJobs(){
    await refreshFinance();title('Klussen');
    const [allJobs,entries,company]=await Promise.all([JKDB.all('jobs'),JKDB.all('timeEntries'),JKDB.get('settings','company')]);
    const jobs=allJobs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const invoiceJobs=jobs.filter(j=>jobPaymentType(j)==='invoice'),cashJobs=jobs.filter(j=>jobPaymentType(j)==='cash');
    const openJobs=jobs.filter(j=>jobFinancial(j,entries,company).open>0);
    const orphanOpen=state.finance.documents.filter(d=>isUnassignedInvoice(d)&&state.finance.document(d).open>0);
    const visible=state.jobPaymentFilter==='open'?openJobs:state.jobPaymentFilter==='invoice'?invoiceJobs:state.jobPaymentFilter==='cash'?cashJobs:jobs;
    const openTotal=jobs.reduce((sum,j)=>sum+jobFinancial(j,entries,company).open,0)+orphanOpen.reduce((sum,d)=>sum+state.finance.document(d).open,0);
    const sumReceived=list=>list.reduce((sum,j)=>sum+jobFinancial(j,entries,company).received,0);
    const invoiceReceived=sumReceived(invoiceJobs)+state.finance.documents.filter(isUnassignedInvoice).reduce((sum,d)=>sum+state.finance.document(d).received,0);
    $('#view').innerHTML=`<div class="button-row"><button class="primary" id="newJob">+ Nieuwe klus</button></div>
      <div class="card job-totals"><div class="kpi-row"><button type="button" class="kpi job-open-filter" id="jobOpenFilter" aria-pressed="${state.jobPaymentFilter==='open'}"><strong id="jobOpenTotal">${money(openTotal)}</strong><span>Openstaand bedrag · bekijken →</span></button><div class="kpi"><strong id="jobCashTotal">${money(sumReceived(cashJobs))}</strong><span>Totaal contant</span></div><div class="kpi"><strong id="jobInvoiceTotal">${money(invoiceReceived)}</strong><span>Totaal factuur</span></div></div></div>
      ${['open','all'].includes(state.jobPaymentFilter)&&orphanOpen.length?`<div class="card"><h3>Open facturen zonder klus</h3>${orphanOpen.map(d=>`<button type="button" class="secondary" data-unassigned-invoice="${esc(d.id)}">${esc(d.meta?.number||d.filename||'Factuur')} · nog ${money(state.finance.document(d).open)}</button>`).join('')}</div>`:''}
      <div class="tabs" style="margin-top:12px"><button class="tab ${state.jobPaymentFilter==='all'?'active':''}" data-jpf="all">Alles</button><button class="tab ${state.jobPaymentFilter==='invoice'?'active':''}" data-jpf="invoice">Factuur</button><button class="tab ${state.jobPaymentFilter==='cash'?'active':''}" data-jpf="cash">Contant</button><button class="tab ${state.jobPaymentFilter==='open'?'active':''}" data-jpf="open">Openstaand</button></div>
      <div class="section-title"><h2>${state.jobPaymentFilter==='open'?'Openstaande klussen':'Klussen'}</h2></div>${visible.length?`<div class="list">${visible.map(j=>{const f=jobFinancial(j,entries,company),unpaid=f.open>0;return `<div class="list-item clickable job-payment-row ${unpaid?'payment-unpaid':'payment-paid'}" data-job="${esc(j.id)}"><div class="main"><div class="job-row-heading"><div class="title">${esc(j.title)}</div><span class="pill job-status ${j.status==='afgerond'?'success':'warn'}">${esc(j.status||'open')}</span></div><div class="sub">${esc(j.clientName||'Geen klant')} · ${jobWorkDays(j).length>1?jobWorkDays(j).length+' werkdagen · '+nlDate(j.date):nlDate(j.date)||'geen datum'}${jobTimeLabel(j)?' · '+esc(jobTimeLabel(j)):''}</div>${unpaid?`<div class="job-payment-badge"><span class="pill danger">Nog te ontvangen: ${money(f.open)}</span></div>`:''}</div></div>`}).join('')}</div>`:'<div class="empty">Geen klussen in deze selectie.</div>'}
      ${state.jobPaymentFilter==='open'?'<button type="button" class="secondary" id="showAllJobs">Alles tonen</button>':''}`;
    $$('[data-unassigned-invoice]').forEach(b=>b.addEventListener('click',()=>showDocument(b.dataset.unassignedInvoice)));
    $('#newJob').addEventListener('click',()=>editJob());
    $$('[data-job]').forEach(x=>x.addEventListener('click',()=>showJob(x.dataset.job)));
    $('#jobOpenFilter').addEventListener('click',()=>{state.jobPaymentFilter=state.jobPaymentFilter==='open'?'all':'open';renderJobs()});
    $('#showAllJobs')?.addEventListener('click',()=>{state.jobPaymentFilter='all';renderJobs()});
    $$('[data-jpf]').forEach(b=>b.addEventListener('click',()=>{state.jobPaymentFilter=b.dataset.jpf;renderJobs()}));
  }
  async function editJob(id,prefill={}){
    const j=id?await JKDB.get('jobs',id):{id:JKDB.id('job'),title:'',clientId:'',clientName:'',attention:'',street:'',postal:'',city:'',phone:'',email:'',date:today(),startTime:'',endTime:'',status:'open',notes:'',checklistId:'',checklistState:{},photoPolicy:'optional',paymentType:'invoice',hourlyRate:'',extraAmount:'',paymentPaid:false,quoteNeeded:false,...prefill};
    const [clients,checks,company]=await Promise.all([JKDB.all('clients'),JKDB.all('checklists'),JKDB.get('settings','company')]);
    const linked=clients.find(c=>c.id===j.clientId);
    const initial={name:linked?.name||j.clientName||'',attention:linked?.attention||j.attention||'',street:linked?.street||j.street||j.address||'',postal:linked?.postal||j.postal||'',city:linked?.city||j.city||'',phone:linked?.phone||j.phone||'',email:linked?.email||j.email||''};
    modal(`${modalHead(id?'Klus bewerken':'Nieuwe klus')}<form id="jobForm"><div class="card form-section"><h3>Klus</h3><div class="field"><label>Omschrijving klus</label><input name="title" required value="${esc(j.title)}"></div><div class="form-grid"><div id="workDayFields" class="workday-fields">${(jobWorkDays(j).length?jobWorkDays(j):[{date:today()}]).map(workDayFields).join('')}</div><button type="button" class="secondary" id="addWorkDay">+ Werkdag toevoegen</button><div class="field"><label>Status</label><select name="status"><option ${j.status==='open'?'selected':''}>open</option><option ${j.status==='gepland'?'selected':''}>gepland</option><option ${j.status==='afgerond'?'selected':''}>afgerond</option></select></div></div><p class="muted small">Voeg zelfgekozen werkdagen toe. Deze tijden zijn uitsluitend planning. Vul na iedere werkdag de werkelijke uren in; geplande tijden worden nooit als gewerkte uren opgeslagen.</p></div><div class="card form-section"><h3>Klantgegevens</h3><div class="field"><label>Kies bestaande klant</label><select name="clientId" id="jobClientPick"><option value="">Nieuwe klant / handmatig</option>${clients.map(c=>`<option value="${c.id}" ${j.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Naam/bedrijf</label><input name="clientName" required value="${esc(initial.name)}"></div><div class="field"><label>T.a.v.</label><input name="attention" value="${esc(initial.attention)}"></div><div class="field"><label>Adres</label><input name="street" value="${esc(initial.street)}"></div><div class="form-grid"><div class="field"><label>Postcode</label><input name="postal" value="${esc(initial.postal)}"></div><div class="field"><label>Plaats</label><input name="city" value="${esc(initial.city)}"></div><div class="field"><label>Telefoon</label><input name="phone" value="${esc(initial.phone)}"></div><div class="field"><label>E-mail</label><input type="email" name="email" value="${esc(initial.email)}"></div></div><p class="muted small">Deze klantgegevens worden ook gebruikt voor offertes en facturen. Wijzig je hier een gekoppelde klant, dan wordt de klantkaart bijgewerkt zodat alles gelijk blijft.</p></div><div class="card form-section"><h3>Eigen betaaloverzicht</h3><div class="form-grid"><div class="field"><label>Afhandeling</label><select name="paymentType"><option value="invoice" ${jobPaymentType(j)==='invoice'?'selected':''}>Factuur</option><option value="cash" ${jobPaymentType(j)==='cash'?'selected':''}>Contant</option></select></div><div class="field"><label>Referentie-uurtarief voor deze klus</label><input type="number" step="0.01" min="0" name="hourlyRate" value="${esc(j.hourlyRate!==undefined&&j.hourlyRate!==''?j.hourlyRate:(company?.defaultRate||''))}"></div><div class="field"><label>Extra bedrag / materiaal</label><input type="number" step="0.01" min="0" name="extraAmount" value="${esc(j.extraAmount||'')}"></div><div class="field"><label>Type prijsafspraak</label><select name="pricingType"><option value="hourly" ${JKFinance.type(j)==='hourly'?'selected':''}>Op uurbasis</option><option value="fixed" ${JKFinance.type(j)==='fixed'?'selected':''}>Vaste prijs</option><option value="manual" ${JKFinance.type(j)==='manual'?'selected':''}>Handmatig bedrag</option></select></div><div class="field" id="agreedAmountField"><label>Afgesproken klusbedrag (zonder extra kosten)</label><input type="number" min="0" step="0.01" name="agreedAmount" value="${esc(j.agreedAmount??'')}"><small>Handmatig bedrag mag leeg blijven totdat het definitief bekend is.</small></div><div class="field"><label>Extra kosten</label><select name="extraIncluded"><option value="false" ${!j.extraIncluded?'selected':''}>Boven op het afgesproken bedrag</option><option value="true" ${j.extraIncluded?'selected':''}>Inbegrepen bij vaste / handmatige prijs</option></select></div><label class="checkline"><input type="checkbox" name="quoteNeeded" ${j.quoteNeeded?'checked':''}><span>Offerte nodig voor deze klus</span></label></div><p class="muted small">Prijsafspraak en referentie-uurtarief staan los van ontvangen betalingen. Registreer betalingen via het klusoverzicht of de gekoppelde factuur. Bestaande facturen wijzigen niet mee. Het vinkje ‘Offerte nodig’ wordt gebruikt voor je actiemeldingen. Bedragen zijn exclusief btw; bij KOR wordt geen btw toegevoegd.</p></div><div class="card form-section"><div class="field"><label>Checklist</label><select name="checklistId" id="jobChecklistPick"><option value="">Geen</option>${checks.map(c=>`<option value="${c.id}" ${j.checklistId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Foto's voor / tijdens / na</label><select name="photoPolicy" id="jobPhotoPolicy"><option value="none" ${(j.photoPolicy||'optional')==='none'?'selected':''}>Niet nodig bij deze klus</option><option value="optional" ${(j.photoPolicy||'optional')==='optional'?'selected':''}>Optioneel</option><option value="required" ${(j.photoPolicy||'optional')==='required'?'selected':''}>Verplicht voor, tijdens en na</option></select><small class="muted">Bij Catering / horeca wordt automatisch ‘Niet nodig’ voorgesteld. Bij andere kluschecklists wordt ‘Verplicht’ voorgesteld; je kunt dit altijd zelf wijzigen.</small></div><div class="field"><label>Notities</label><textarea name="notes">${esc(j.notes||'')}</textarea></div></div><div class="button-row"><button class="primary">Opslaan</button>${id?'<button type="button" class="danger-btn" id="delJob">Verwijderen</button>':''}</div></form>`);
    const pricingFields=()=>{const type=$('[name=pricingType]').value;$('#agreedAmountField').hidden=type==='hourly';$('[name=agreedAmount]').required=type==='fixed';};
    $('[name=pricingType]').addEventListener('change',pricingFields);pricingFields();
    const fillFromClient=(client)=>{if(!client)return;const form=$('#jobForm');form.elements.clientName.value=client.name||'';form.elements.attention.value=client.attention||'';form.elements.street.value=client.street||'';form.elements.postal.value=client.postal||'';form.elements.city.value=client.city||'';form.elements.phone.value=client.phone||'';form.elements.email.value=client.email||'';};
    $('#addWorkDay').addEventListener('click',()=>$('#workDayFields').insertAdjacentHTML('beforeend',workDayFields({date:''})));
    $('#workDayFields').addEventListener('click',event=>{if(event.target.closest('[data-remove-day]'))event.target.closest('[data-workday]').remove();});
    $('#jobClientPick').addEventListener('change',e=>fillFromClient(clients.find(c=>c.id===e.target.value)));
    let photoPolicyTouched=!!id;
    $('#jobPhotoPolicy').addEventListener('change',()=>{photoPolicyTouched=true});
    $('#jobChecklistPick').addEventListener('change',e=>{
      if(photoPolicyTouched)return;
      const ch=checks.find(c=>c.id===e.target.value),name=String(ch?.name||'').toLowerCase();
      $('#jobPhotoPolicy').value=!ch?'optional':name.includes('catering')||name.includes('horeca')?'none':'required';
    });
    $('#jobForm').addEventListener('submit',async e=>{e.preventDefault();let workDays;try{workDays=readWorkDays();}catch(error){alert(error.message);return;}const f=new FormData(e.target);let clientId=f.get('clientId'),client=clients.find(c=>c.id===clientId);const values={name:String(f.get('clientName')||'').trim(),attention:f.get('attention')||'',street:f.get('street')||'',postal:f.get('postal')||'',city:f.get('city')||'',phone:f.get('phone')||'',email:f.get('email')||''};if(client){Object.assign(client,values);await JKDB.put('clients',client);}else if(values.name){client={id:JKDB.id('client'),...values,notes:''};clientId=client.id;await JKDB.put('clients',client);}await freezeLegacyPayments(await refreshFinance(),j.id);const quoteWasNeeded=j.quoteNeeded===true;const oldSchedule=`${j.date||''}|${jobStartTime(j)}|${jobEndTime(j)}`;Object.assign(j,{title:f.get('title'),clientId:clientId||'',clientName:values.name,attention:values.attention,street:values.street,address:values.street,postal:values.postal,city:values.city,phone:values.phone,email:values.email,workDays,date:workDays[0]?.date||'',startTime:workDays[0]?.startTime||'',endTime:workDays[0]?.endTime||'',status:f.get('status'),paymentType:f.get('paymentType')==='cash'?'cash':'invoice',hourlyRate:f.get('hourlyRate')||'',extraAmount:f.get('extraAmount')||'',paymentLedger:true,pricingType:f.get('pricingType'),agreedAmount:f.get('agreedAmount')===''?'':num(f.get('agreedAmount')),extraIncluded:f.get('extraIncluded')==='true',quoteNeeded:f.get('quoteNeeded')==='on',checklistId:f.get('checklistId'),photoPolicy:f.get('photoPolicy')||'optional',notes:f.get('notes')});const newSchedule=`${j.date||''}|${jobStartTime(j)}|${jobEndTime(j)}`;if(oldSchedule!==newSchedule)j.completionPromptHandledAt=null;await JKDB.put('jobs',j);
      if(!quoteWasNeeded&&j.quoteNeeded){
        const dismissedRow=await JKDB.get('settings','dismissedActions');
        if(dismissedRow?.items?.['quoteCreate:'+j.id]){
          delete dismissedRow.items['quoteCreate:'+j.id];
          await JKDB.put('settings',dismissedRow);
        }
      }
      closeModal();toast('Klus en planning opgeslagen. Werkelijke uren vul je apart in.');render();if(!quoteWasNeeded&&j.quoteNeeded){const actions=await refreshActionBadges(true);if(actions?.some(a=>a.key==='quoteCreate:'+j.id))JKPush.quoteNeeded(j.id).catch(e=>console.warn('Offertepush niet verstuurd',e));}});
    $('#delJob')?.addEventListener('click',async()=>{if(confirm('Klus verwijderen?')){for(const p of (await JKDB.all('jobPhotos')).filter(x=>x.jobId===j.id))await JKDB.remove('jobPhotos',p.id);await JKDB.remove('jobs',j.id);closeModal();render();}});
  }
  async function chooseJobCalculation(){
    const jobs=(await JKDB.all('jobs')).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    modal(`${modalHead('Uren & bedrag')}<form id="chooseCalculationJob"><div class="field"><label>Voor welke klus?<select name="calculationJob" required><option value="">Kies een klus</option>${jobs.map(j=>`<option value="${esc(j.id)}">${esc(j.title)} · ${esc(j.clientName||'Geen klant')} · ${nlDate(j.date)}</option>`).join('')}</select></label></div><button class="primary" ${jobs.length?'':'disabled'}>Werkdagen en bedrag invullen</button></form><div class="button-row"><button type="button" class="secondary" id="calculationNewJob">+ Nieuwe klus</button><button type="button" class="ghost" id="calculationGeneralHours">Algemene uren zonder klus</button></div>`);
    $('#chooseCalculationJob').addEventListener('submit',e=>{e.preventDefault();editJobCalculation(new FormData(e.currentTarget).get('calculationJob'));});
    $('#calculationNewJob').addEventListener('click',()=>editJob());
    $('#calculationGeneralHours').addEventListener('click',()=>editTimeEntry());
  }
  async function editJobCalculation(id){
    const [job,allEntries,company]=await Promise.all([JKDB.get('jobs',id),JKDB.all('timeEntries'),JKDB.get('settings','company')]);
    if(!job)return;
    const originals=uniqueEntries(allEntries.filter(e=>e.jobId===id)).sort((a,b)=>entryDate(a).localeCompare(entryDate(b))||a.id.localeCompare(b.id));
    const rowHtml=e=>`<fieldset class="workday-row" data-actual-row="${esc(e.id||JKDB.id('draft'))}"><legend>Gewerkte dag</legend><div class="form-grid"><div class="field"><label>Datum<input type="date" name="actualDate" value="${esc(entryDate(e)||job.date||today())}"></label></div><div class="field"><label>Van<input type="time" name="actualFrom" value="${esc(entryFrom(e))}"></label></div><div class="field"><label>Tot<input type="time" name="actualTo" value="${esc(entryTo(e))}"></label></div><div class="field"><label>Pauze (minuten)<input type="number" min="0" step="1" name="actualBreak" value="${num(e.breakMinutes)}"></label></div></div>${e.autoFromJobSchedule&&!e.actualConfirmed?'<label class="checkline"><input type="checkbox" name="confirmActual"><span>Deze uren heb ik daadwerkelijk gewerkt</span></label>':''}<div class="small" data-actual-total></div>${e.id?'':'<button type="button" class="ghost" data-discard-actual>Dag verwijderen</button>'}</fieldset>`;
    modal(`${modalHead('Uren & totaalbedrag')}<form id="jobCalculationForm"><h3>${esc(job.title)}</h3><div class="card"><h3>1. Gewerkte dagen</h3><div id="actualDays">${(originals.length?originals:[{}]).map(rowHtml).join('')}</div><button type="button" class="secondary" id="addActualDay">+ Gewerkte dag toevoegen</button><p class="muted small">Vul de werkelijke tijden in. Geplande tijden worden niet overgenomen.</p><strong id="actualHoursTotal"></strong></div><div class="card"><h3>2. Bedrag kiezen</h3><div class="field"><label>Berekenen op basis van<select name="calculationType"><option value="hourly" ${JKFinance.type(job)==='hourly'?'selected':''}>Gewerkte uren × uurtarief</option><option value="fixed" ${JKFinance.type(job)!=='hourly'?'selected':''}>Vast bedrag invullen</option></select></label></div><div class="field" id="calculationRateField"><label>Uurtarief<input type="number" name="calculationRate" min="0" step="0.01" required value="${esc(jobRate(job,company))}"></label></div><div class="field" id="calculationFixedField"><label>Vast bedrag<input type="number" name="calculationFixed" min="0" step="0.01" value="${esc(job.agreedAmount??'')}"></label></div></div><div class="card"><h3>3. Extra kosten</h3><div class="field"><label>Extra kosten / materiaal<input type="number" name="calculationExtra" min="0" step="0.01" value="${esc(job.extraAmount||0)}"></label></div><div id="calculationIncludedField"><label class="checkline"><input type="checkbox" name="calculationIncluded" ${job.extraIncluded?'checked':''}><span>Deze kosten zitten al in het vaste bedrag</span></label></div></div><div class="card"><div id="calculationFormula" class="small"></div><div class="doc-total"><span>Totaalbedrag</span><strong id="calculationTotal"></strong></div><small class="muted">Exclusief eventuele btw; bij KOR komt er geen btw bij.</small></div><button class="primary" id="saveJobCalculation">Uren en bedrag opslaan</button></form>`);
    const readRows=()=>$$('[data-actual-row]').map(row=>{
      const old=originals.find(e=>e.id===row.dataset.actualRow),value={date:$('[name=actualDate]',row).value,from:$('[name=actualFrom]',row).value,to:$('[name=actualTo]',row).value,breakMinutes:num($('[name=actualBreak]',row).value)};
      const confirmed=!old?.autoFromJobSchedule||!!old?.actualConfirmed||!!$('[name=confirmActual]',row)?.checked;
      const unchanged=old&&value.date===entryDate(old)&&value.from===entryFrom(old)&&value.to===entryTo(old)&&value.breakMinutes===num(old.breakMinutes)&&!$('[name=confirmActual]',row)?.checked;
      const minutes=unchanged?entryMinutes(old):confirmed?entryMinutes(value):0;
      return {row,old,value,confirmed,unchanged,minutes};
    });
    const preview=()=>{
      const form=$('#jobCalculationForm'),fixed=form.elements.calculationType.value==='fixed',rows=readRows(),minutes=rows.reduce((n,r)=>n+r.minutes,0);
      rows.forEach(r=>$('[data-actual-total]',r.row).textContent=r.confirmed?'Netto: '+hoursLabel(r.minutes):'Nog te bevestigen — telt niet mee');
      $('#actualHoursTotal').textContent='Totaal gewerkt: '+hoursLabel(minutes);
      $('#calculationFixedField').hidden=!fixed;form.elements.calculationFixed.required=fixed;
      $('#calculationRateField').hidden=fixed;form.elements.calculationRate.required=!fixed;
      $('#calculationIncludedField').hidden=!fixed;
      const price=JKFinance.price({pricingType:fixed?'fixed':'hourly',agreedAmount:form.elements.calculationFixed.value,extraAmount:form.elements.calculationExtra.value,extraIncluded:fixed&&form.elements.calculationIncluded.checked},minutes,num(form.elements.calculationRate.value));
      const base=fixed?money(price.base):hoursLabel(minutes)+' × '+money(form.elements.calculationRate.value);
      $('#calculationFormula').textContent=base+(fixed&&form.elements.calculationIncluded.checked?' (extra kosten inbegrepen)':' + '+money(price.extra)+' extra kosten');
      $('#calculationTotal').textContent=money(price.agreed);return rows;
    };
    $('#jobCalculationForm').addEventListener('input',preview);$('#jobCalculationForm').addEventListener('change',preview);
    $('#addActualDay').addEventListener('click',()=>{$('#actualDays').insertAdjacentHTML('beforeend',rowHtml({}));preview();});
    $('#actualDays').addEventListener('click',e=>{const button=e.target.closest('[data-discard-actual]');if(button){button.closest('[data-actual-row]').remove();preview();}});preview();
    $('#jobCalculationForm').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget;if(form.dataset.saving)return;form.dataset.saving='1';$('#saveJobCalculation').disabled=true;
      try{
        const rows=preview(),changes=[],dates=new Map();
        for(const r of rows){
          if(!r.old&&!r.value.from&&!r.value.to)continue;
          if(!r.unchanged&&r.confirmed){
            if(!r.value.date||!r.value.from||!r.value.to)throw Error('Vul per gewerkte dag de datum, begintijd en eindtijd in.');
            const raw=entryMinutes({...r.value,breakMinutes:0});
            if(r.value.breakMinutes<0||r.value.breakMinutes>raw)throw Error('De pauze mag niet langer zijn dan de gewerkte tijd.');
          }
          const previous=dates.get(r.value.date);
          if(previous&&(!r.unchanged||!previous.unchanged))throw Error('Deze datum staat al bij de gewerkte dagen. Bewerk de bestaande dag.');
          dates.set(r.value.date,r);
          if(r.unchanged||!r.confirmed)continue;
          let entryId=r.old?.id;
          if(!entryId){const base='time_workday_'+id+'_'+r.value.date;let n=0;entryId=base;while(allEntries.some(e=>e.id===entryId)||await JKDB.isDeletedLocal('timeEntries',entryId))entryId=base+'_'+(++n);}
          changes.push({...r.old,id:entryId,...r.value,jobId:id,jobTitle:job.title,actualConfirmed:true,autoFromJobSchedule:false,start:null,end:null});
        }
        const finance=await refreshFinance();
        // Preserve historical receipts before changing hours/price; no hours are written here.
        for(const p of finance.receipts.filter(p=>p.legacy&&p.resolvedJobId===id))if(!finance.stored.some(x=>x.id===p.id))await JKDB.put('settings',{...p,jobId:p.resolvedJobId});
        const fixed=form.elements.calculationType.value==='fixed';
        const updated={...job,paymentLedger:true,pricingType:fixed?'fixed':'hourly',hourlyRate:num(form.elements.calculationRate.value),agreedAmount:fixed?num(form.elements.calculationFixed.value):job.agreedAmount??'',extraAmount:num(form.elements.calculationExtra.value),extraIncluded:fixed&&form.elements.calculationIncluded.checked};
        await JKDB.saveJobWork(updated,changes,job,originals);
        closeModal();await render();await showJob(id);toast('Werkelijke uren en totaalbedrag opgeslagen');
      }catch(error){alert(error.message||'Opslaan mislukt. Bestaande uren zijn behouden.');form.dataset.saving='';$('#saveJobCalculation').disabled=false;}
    });
  }
  async function repeatJob(id){
    const src=await JKDB.get('jobs',id);if(!src)return;
    modal(`${modalHead('Klus herhalen')}<form id="repeatJobForm"><div class="card"><h3>${esc(src.title||'Klus')}</h3><div class="muted small">${esc(src.clientName||'Geen klant')}</div></div><div class="form-grid"><div class="field"><label>Nieuwe datum</label><input type="date" name="date" required value="${today()}"></div><div class="field"><label>Starttijd</label><input type="time" name="startTime" value="${esc(jobStartTime(src))}"></div><div class="field"><label>Eindtijd</label><input type="time" name="endTime" value="${esc(jobEndTime(src))}"></div></div><p class="muted small">Klant, omschrijving, uurtarief, betaalwijze, checklist en foto-instelling worden overgenomen. Betaling en afronding beginnen opnieuw.</p><button class="primary" style="width:100%">Nieuwe klus maken</button></form>`);
    $('#repeatJobForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),copy={...src,id:JKDB.id('job'),date:f.get('date'),startTime:f.get('startTime')||'',endTime:f.get('endTime')||'',status:'gepland',paymentPaid:false,paymentLedger:true,completionPromptHandledAt:null,autoTimeEntryId:null,checklistState:{},createdAt:new Date().toISOString()};delete copy._syncUpdatedAt;copy.workDays=[{id:JKDB.id('day'),date:copy.date,startTime:copy.startTime,endTime:copy.endTime}];await JKDB.put('jobs',copy);await ensureJobTimeEntry(copy);closeModal();toast('Herhaalde klus aangemaakt');renderJobs();});
  }

  const photoPhaseMeta={before:{label:'Voor',icon:'📷'},during:{label:'Tijdens',icon:'🔨'},after:{label:'Na',icon:'✅'}};
  function photoPolicyText(v){return v==='required'?'Verplicht voor, tijdens en na':v==='none'?'Niet nodig bij deze klus':'Optioneel';}
  function humanBytes(n){
    n=Number(n||0);if(!n)return '0 KB';
    if(n<1024*1024)return `${Math.max(1,Math.round(n/1024))} KB`;
    return `${(n/1024/1024).toFixed(1).replace('.',',')} MB`;
  }
  async function optimizeJobPhoto(file){
    if(!file?.type?.startsWith('image/'))return {blob:file,originalSize:file?.size||0};
    const TARGET=250*1024; // harde richtwaarde per klusfoto voor Supabase-opslag
    try{
      const url=URL.createObjectURL(file),img=new Image();
      await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url});
      URL.revokeObjectURL(url);
      const ow=img.naturalWidth||1,oh=img.naturalHeight||1;
      let maxSide=1600,quality=.74,best=null;
      for(let attempt=0;attempt<7;attempt++){
        const scale=Math.min(1,maxSide/Math.max(ow,oh));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(ow*scale));canvas.height=Math.max(1,Math.round(oh*scale));
        const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const blob=await new Promise(res=>canvas.toBlob(res,'image/jpeg',quality));
        if(blob){best=blob;if(blob.size<=TARGET)break;}
        if(quality>.56) quality-=.07; else maxSide=Math.max(1000,Math.round(maxSide*.86));
      }
      return {blob:best||file,originalSize:file.size||0};
    }catch(e){console.warn('Foto verkleinen mislukt, origineel wordt bewaard',e);return {blob:file,originalSize:file?.size||0};}
  }
  async function saveJobPhoto(jobId,phase,file){
    if(!file)return;
    const {blob,originalSize}=await optimizeJobPhoto(file);
    const original=String(file.name||`${phase}-${Date.now()}.jpg`);
    const name=blob?.type==='image/jpeg'?original.replace(/\.[^.]+$/, '')+'.jpg':original;
    await JKDB.put('jobPhotos',{id:JKDB.id('photo'),jobId,phase,blob,name,originalSize,compressedSize:blob?.size||0,createdAt:new Date().toISOString()});
  }
  // Gebruik de bestaande uitgavenrecords; er wordt geen tweede kopie van het bonbestand gemaakt.
  function jobLinkedExpenses(jobId,expenses){
    if(!jobId)return [];
    return (expenses||[]).filter(e=>String(e.jobId||'')===String(jobId))
      .sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')));
  }
  async function showJob(id){
    await refreshFinance();
    const j=await JKDB.get('jobs',id),entries=(await JKDB.all('timeEntries')).filter(e=>e.jobId===id).sort((a,b)=>entryDate(b).localeCompare(entryDate(a))),check=j.checklistId?await JKDB.get('checklists',j.checklistId):null,client=j.clientId?await JKDB.get('clients',j.clientId):null,company=await JKDB.get('settings','company');
    const photos=(await JKDB.all('jobPhotos')).filter(p=>p.jobId===id).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    const jobExpenses=jobLinkedExpenses(id,await JKDB.all('expenses'));
    const checkHtml=check?check.items.map((item,i)=>`<label class="checkline"><input type="checkbox" data-jobcheck="${i}" ${j.checklistState?.[i]?'checked':''}><span>${esc(item)}</span></label>`).join(''):'<span class="muted small">Geen checklist gekoppeld.</span>';
    const c=client||j,contact=[c.attention?`t.a.v. ${esc(c.attention)}`:'',c.street||j.address?esc(c.street||j.address):'',([c.postal,c.city].filter(Boolean).join(' ')?esc([c.postal,c.city].filter(Boolean).join(' ')):''),c.phone?esc(c.phone):'',c.email?esc(c.email):''].filter(Boolean).join('<br>');
    const policy=j.photoPolicy||'optional';
    const photoCards=`<div class="card job-photo-folder"><div class="button-row photo-actions"><button type="button" class="primary" data-upload="general">Foto’s toevoegen</button><button type="button" class="secondary" data-camera="general">📷 Foto maken</button></div><input type="file" accept="image/*" capture="environment" data-camera-input="general" hidden><input type="file" accept="image/*" multiple data-upload-input="general" hidden><div class="job-photo-grid">${photos.map(p=>`<div class="job-photo-item"><div class="job-photo-thumb"><button type="button" class="photo-open" data-job-photo="${esc(p.id)}" aria-label="Foto bekijken"><img src="${URL.createObjectURL(p.blob)}" alt="${esc(p.name||'Klusfoto')}"></button><button type="button" class="photo-delete" data-del-photo="${esc(p.id)}" aria-label="Foto verwijderen">×</button></div>${photoCategorySelect(p)}</div>`).join('')||'<div class="job-photo-empty">Nog geen foto’s</div>'}</div></div>`;
    // Alleen een echte fotoverplichting tonen, zonder gele uitlegkaarten.
    const photoNotice=policy==='required'?'<p class="small photo-requirement">Verplicht: minimaal één foto vóór, tijdens en na de werkzaamheden.</p>':'';

    const expenseSum=jobExpenses.reduce((sum,e)=>sum+num(e.amountIncl),0);
    const jobExpensesHtml=`<div class="section-title"><h2>Bonnetjes & uitgaven</h2><span class="muted small">${jobExpenses.length} · ${money(expenseSum)}</span></div><div class="card"><div class="button-row"><button type="button" class="primary" id="addReceiptThisJob">📷 Bonnetje toevoegen</button><button type="button" class="secondary" id="allReceiptsThisJob">Alle bonnetjes</button></div></div>${jobExpenses.length?`<div class="list">${jobExpenses.map(e=>{
      const isImage=e.receiptBlob instanceof Blob&&e.receiptBlob.type.startsWith('image/');
      const thumb=isImage?`<img src="${URL.createObjectURL(e.receiptBlob)}" alt="Bonnetje" style="width:56px;height:60px;object-fit:cover;border-radius:8px">`:`<span style="font-size:26px" aria-hidden="true">${e.receiptBlob?'📄':'🧾'}</span>`;
      return `<div class="list-item clickable" data-job-expense="${esc(e.id)}"><div style="flex:0 0 56px;text-align:center">${thumb}</div><div class="main"><div class="title">${esc(e.supplier||'Uitgave')}</div><div class="sub">${nlDate(e.date)} · ${esc(e.category||'Overig')} · ${e.receiptBlob?'Bon opgeslagen':'Zonder bonbestand'}</div>${e.notes?`<div class="sub">${esc(String(e.notes).slice(0,100))}</div>`:''}</div><strong>${money(e.amountIncl)}</strong></div>`;
    }).join('')}</div>`:'<div class="empty">Nog geen bonnetjes aan deze klus gekoppeld.</div>'}`;
    const paymentCard=`<div class="section-title"><h2>Prijsafspraak & betaling</h2><span class="pill">${esc(jobPaymentLabel(j))}</span></div><div class="card">${jobFinanceHtml(j,entries,company)}<button class="primary" id="paymentsThisJob">Betalingen bekijken / registreren</button></div>`;
    modal(`${modalHead(j.title)}<div class="button-row"><button class="secondary" id="editThisJob">Bewerken</button><button class="secondary" id="repeatThisJob">↻ Herhalen</button><button class="primary" id="hoursThisJob">Uren & bedrag</button><button class="secondary" id="quoteThisJob">+ Offerte</button><button class="secondary" id="invoiceThisJob">+ Factuur</button><button class="secondary" id="calendarThisJob">📅 Google Agenda</button></div><div class="card" style="margin-top:10px"><strong>${esc(c.name||j.clientName||'Geen klant')}</strong><div class="muted small">${nlDate(j.date)}${jobTimeLabel(j)?' · '+esc(jobTimeLabel(j)):''}${contact?'<br>'+contact:''}</div>${j.notes?`<p class="small">${esc(j.notes)}</p>`:''}</div>${workDaysCard(j,entries)}${paymentCard}${jobExpensesHtml}<div class="section-title"><h2>Foto’s</h2><span class="muted small">${esc(photoPolicyText(policy))}</span></div>${photoNotice}<div class="job-photo-sections">${photoCards}</div><div class="section-title"><h2>Checklist</h2></div><div class="card">${checkHtml}</div><div class="section-title"><h2>Uren</h2><span class="muted small">${(entries.reduce((s,e)=>s+entryMinutes(e),0)/60).toFixed(2).replace('.',',')} u</span></div>${entries.length?`<div class="list">${entries.map(e=>`<div class="list-item clickable" data-time="${e.id}"><div class="main"><div class="title">${nlDate(entryDate(e))}</div><div class="sub">${esc(entryFrom(e))} - ${esc(entryTo(e))} · pauze ${num(e.breakMinutes)} min${e.autoFromJobSchedule&&!e.actualConfirmed?' · nog te bevestigen':''}${e.note?' · '+esc(e.note):''}</div></div><strong>${durationHM(entryMinutes(e))}</strong></div>`).join('')}</div>`:'<div class="empty">Nog geen uren.</div>'}`);
    $('#paymentsThisJob').addEventListener('click',()=>showPayments(id));
    $('#addReceiptThisJob').addEventListener('click',()=>editExpense(null,{jobId:id,returnJobId:id}));
    $('#allReceiptsThisJob').addEventListener('click',async()=>{
      closeModal();await go('documents');state.docFolder='expenses';await renderDocuments();
    });
    $$('[data-job-expense]').forEach(x=>x.addEventListener('click',()=>showExpense(x.dataset.jobExpense,{returnJobId:id})));
    $('#extraWorkDay').addEventListener('click',()=>editTimeEntry(null,j.id,'',j.id));
    $$('[data-work-date]').forEach(b=>b.addEventListener('click',()=>editTimeEntry(null,j.id,b.dataset.workDate,j.id)));
    $$('[data-work-entry]').forEach(b=>b.addEventListener('click',()=>editTimeEntry(b.dataset.workEntry,j.id,'',j.id)));
    $$('[data-work-calendar]').forEach(b=>b.addEventListener('click',()=>openGoogleCalendarForJob({...j,...jobWorkDays(j).find(d=>d.date===b.dataset.workCalendar),workDays:undefined})));
    $('#jobIcs').addEventListener('click',()=>downloadBlob(new Blob([jobCalendarIcs(j)],{type:'text/calendar;charset=utf-8'}),'JK-Works-werkdagen.ics'));
    $('#editThisJob').addEventListener('click',()=>{closeModal();editJob(id)});$('#repeatThisJob').addEventListener('click',()=>repeatJob(id));$('#hoursThisJob').addEventListener('click',()=>{closeModal();editJobCalculation(id)});$('#quoteThisJob').addEventListener('click',()=>{closeModal();createBusinessDoc('Offerte',{jobId:j.id,clientId:j.clientId,workDate:j.date})});$('#invoiceThisJob').addEventListener('click',()=>{closeModal();createBusinessDoc('Factuur',{jobId:j.id,clientId:j.clientId,workDate:j.date})});$('#calendarThisJob').addEventListener('click',()=>openGoogleCalendarForJob(j));$$('[data-time]').forEach(x=>x.addEventListener('click',()=>{editTimeEntry(x.dataset.time)}));$$('[data-jobcheck]').forEach(c=>c.addEventListener('change',async()=>{j.checklistState=j.checklistState||{};j.checklistState[c.dataset.jobcheck]=c.checked;await JKDB.put('jobs',j)}));
    $$('[data-camera]').forEach(b=>b.addEventListener('click',()=>document.querySelector(`[data-camera-input="${b.dataset.camera}"]`)?.click()));
    $$('[data-upload]').forEach(b=>b.addEventListener('click',()=>document.querySelector(`[data-upload-input="${b.dataset.upload}"]`)?.click()));
    const handleFiles=async(input,phase)=>{const files=[...(input.files||[])];if(!files.length)return;input.disabled=true;try{for(const file of files)await saveJobPhoto(j.id,phase,file);toast(files.length===1?'Foto opgeslagen':`${files.length} foto’s opgeslagen`);await showJob(j.id);}catch(e){console.error(e);alert('Foto opslaan lukte niet: '+(e.message||e));}finally{input.disabled=false;}};
    $$('[data-camera-input]').forEach(i=>i.addEventListener('change',()=>handleFiles(i,i.dataset.cameraInput)));
    $$('[data-upload-input]').forEach(i=>i.addEventListener('change',()=>handleFiles(i,i.dataset.uploadInput)));
    bindPhotoCategories();
    $$('[data-job-photo]').forEach(b=>b.addEventListener('click',()=>showPhotoDocument(b.dataset.jobPhoto,j.id)));
    $$('[data-del-photo]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Deze foto verwijderen?'))return;await JKDB.remove('jobPhotos',b.dataset.delPhoto);toast('Foto verwijderd');showJob(j.id)}));
  }

  const normGearName=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  function toolMatchesPackingItem(t,location,item){
    if(!t || t.location!==location)return false;
    const a=normGearName(t.name),b=normGearName(item);
    return !!a && !!b && (a===b || (a.length>=7 && b.includes(a)) || (b.length>=7 && a.includes(b)));
  }
  function inferGearCategory(name){
    const n=normGearName(name);
    if(n.includes('accu'))return 'Accu';
    if(n.includes('ladder')||n.includes('trap'))return 'Ladder / trap';
    if(n.includes('handschoen')||n.includes('bril')||n.includes('oordop')||n.includes('mondkap'))return 'PBM';
    if(n.includes('tape')||n.includes('kit')||n.includes('lijm')||n.includes('wd 40'))return 'Materiaal / verbruik';
    if(n.includes('boor')||n.includes('zaag')||n.includes('tang')||n.includes('schroevendraaier')||n.includes('hamer')||n.includes('sleutel')||n.includes('waterpas')||n.includes('rolmaat')||n.includes('mes'))return 'Handgereedschap / accessoire';
    return 'Gereedschap / materiaal';
  }
  async function unifiedGearRows(){
    const [boxes,tools]=await Promise.all([JKDB.all('mboxes'),JKDB.all('tools')]);
    const used=new Set(),rows=[];
    for(const box of boxes){
      for(const item of box.items||[]){
        const match=tools.find(t=>!used.has(t.id)&&toolMatchesPackingItem(t,box.id,item));
        if(match)used.add(match.id);
        rows.push({key:`pack|${box.id}|${encodeURIComponent(item)}`,name:item,category:match?.category||inferGearCategory(item),location:box.id,toolId:match?.id||'',source:'packing'});
      }
    }
    for(const t of tools){
      if(used.has(t.id))continue;
      rows.push({key:`tool|${t.id}`,name:t.name,category:t.category||inferGearCategory(t.name),location:t.location||'',toolId:t.id,source:'tool'});
    }
    return {boxes,rows};
  }
  async function updatePackingForTool(oldLocation,oldName,newLocation,newName){
    if(oldLocation){
      const oldBox=await JKDB.get('mboxes',oldLocation);
      if(oldBox){
        const keepSame=oldLocation===newLocation && normGearName(oldName)===normGearName(newName);
        if(!keepSame){
          oldBox.items=(oldBox.items||[]).filter(i=>normGearName(i)!==normGearName(oldName));
          if(oldBox.checked){delete oldBox.checked[oldName];}
          await JKDB.put('mboxes',oldBox);
        }
      }
    }
    if(newLocation && newName){
      const newBox=await JKDB.get('mboxes',newLocation);
      if(newBox && !(newBox.items||[]).some(i=>normGearName(i)===normGearName(newName))){
        newBox.items=[...(newBox.items||[]),newName];
        await JKDB.put('mboxes',newBox);
      }
    }
  }
  async function renderGear(){
    title('Materiaal');
    $('#view').innerHTML=`<div class="tabs"><button class="tab ${state.gearTab==='checks'?'active':''}" data-gt="checks">Kluschecklists</button><button class="tab ${state.gearTab==='mboxes'?'active':''}" data-gt="mboxes">Inpakchecklists</button><button class="tab ${state.gearTab==='tools'?'active':''}" data-gt="tools">Gereedschapregister</button></div><input class="search" id="gearSearch" placeholder="${state.gearTab==='checks'?'Zoek kluschecklist...':'Zoek koffer, machine of onderdeel...'}"><div id="gearContent"></div>`;
    $$('[data-gt]').forEach(b=>b.addEventListener('click',()=>{state.gearTab=b.dataset.gt;renderGear()}));$('#gearSearch').addEventListener('input',renderGearContent);await renderGearContent();
  }
  async function renderGearContent(){
    const c=$('#gearContent');if(!c)return;const q=($('#gearSearch')?.value||'').toLowerCase();
    if(state.gearTab==='mboxes'){
      const all=await JKDB.all('mboxes');
      const rows=all.map((m,index)=>({m,index})).filter(x=>(x.m.name+' '+x.m.type+' '+x.m.items.join(' ')).toLowerCase().includes(q)).sort((a,b)=>((a.m.order??a.index)-(b.m.order??b.index))).map(x=>x.m);
      c.innerHTML=`<div class="button-row material-actions"><button class="primary" id="addMbox">+ Nieuwe inpaklijst</button><button class="secondary" id="reorderMboxes">↕ Volgorde wijzigen</button></div><div class="list">${rows.map(m=>{const done=m.items.filter(i=>m.checked?.[i]).length;return `<div class="list-item clickable material-list-item" data-mbox="${m.id}"><div class="main"><div class="title">${esc(m.name)} · ${esc(m.type)}</div><div class="sub">${done}/${m.items.length} afgevinkt${m.notes?' · '+esc(m.notes):''}</div><div class="progress"><i style="width:${m.items.length?Math.round(done/m.items.length*100):0}%"></i></div></div><span>›</span></div>`}).join('')}</div>`;
      $('#addMbox').addEventListener('click',()=>editMbox());
      $('#reorderMboxes').addEventListener('click',()=>reorderMboxes());
      $$('[data-mbox]').forEach(x=>x.addEventListener('click',()=>showMboxChecklist(x.dataset.mbox)));
    }else if(state.gearTab==='checks'){
      const all=await JKDB.all('checklists');
      const rows=all.filter(ch=>(ch.name+' '+(ch.items||[]).join(' ')).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'nl'));
      c.innerHTML=`<div class="button-row material-actions"><button class="primary" id="addJobCheck">+ Nieuwe kluschecklist</button></div><div class="list">${rows.map(ch=>{const done=(ch.items||[]).filter(i=>ch.checked?.[i]).length;return `<div class="list-item clickable material-list-item" data-jobchecklist="${ch.id}"><div class="main"><div class="title">${esc(ch.name)}</div><div class="sub">${done}/${(ch.items||[]).length} afgevinkt</div><div class="progress"><i style="width:${(ch.items||[]).length?Math.round(done/(ch.items||[]).length*100):0}%"></i></div></div><span>›</span></div>`}).join('')}</div>`;
      $('#addJobCheck').addEventListener('click',()=>editChecklist());
      $$('[data-jobchecklist]').forEach(x=>x.addEventListener('click',()=>showMaterialChecklist(x.dataset.jobchecklist)));
    }else{
      const unified=await unifiedGearRows(),map=Object.fromEntries(unified.boxes.map(m=>[m.id,`${m.name} · ${m.type}`]));
      const rows=unified.rows.filter(t=>(t.name+' '+t.category+' '+(map[t.location]||'')).toLowerCase().includes(q));
      c.innerHTML=`<div class="button-row"><button class="primary" id="addTool">+ Nieuw (hand)gereedschap / materiaal</button></div><div class="list" style="margin-top:12px">${rows.map(t=>`<div class="list-item clickable" data-registry="${esc(t.key)}"><div class="main"><div class="title">${esc(t.name)}</div><div class="sub">${esc(t.category)} · ${esc(map[t.location]||'Los / vrij')}</div></div><span>›</span></div>`).join('')}</div>`;
      $('#addTool').addEventListener('click',()=>editTool());
      $$('[data-registry]').forEach(x=>x.addEventListener('click',()=>{const row=rows.find(r=>r.key===x.dataset.registry);if(row)editTool(row.toolId||null,{location:row.location,itemName:row.name})}));
    }
  }
  async function showMaterialChecklist(id){
    const ch=await JKDB.get('checklists',id);if(!ch)return;ch.checked=ch.checked||{};const items=ch.items||[],done=items.filter(i=>ch.checked[i]).length;
    modal(`${modalHead(ch.name)}<div class="check-card"><div class="check-summary"><strong>${done}/${items.length}</strong><span>afgevinkt</span></div>${items.map((item,i)=>`<label class="packing-row"><input type="checkbox" data-jobpack="${i}" ${ch.checked[item]?'checked':''}><span>${esc(item)}</span></label>`).join('')}</div><div class="button-row" style="margin-top:12px"><button class="secondary" id="resetJobPack">Reset checklist</button><button class="secondary" id="editJobPack">Lijst bewerken</button></div>`);
    $$('[data-jobpack]').forEach(cb=>cb.addEventListener('change',async()=>{const item=items[Number(cb.dataset.jobpack)];ch.checked[item]=cb.checked;await JKDB.put('checklists',ch);const n=items.filter(i=>ch.checked[i]).length;const el=$('.check-summary strong');if(el)el.textContent=`${n}/${items.length}`;}));
    $('#resetJobPack').addEventListener('click',async()=>{if(confirm('Alle vinkjes van deze kluschecklist wissen?')){ch.checked={};await JKDB.put('checklists',ch);closeModal();showMaterialChecklist(id)}});
    $('#editJobPack').addEventListener('click',()=>{editChecklist(id)});
  }

  async function showMboxChecklist(id){
    const m=await JKDB.get('mboxes',id);m.checked=m.checked||{};const done=m.items.filter(i=>m.checked[i]).length;
    modal(`${modalHead(m.name+' · '+m.type)}${m.notes?`<p class="muted small">${esc(m.notes)}</p>`:''}<div class="check-card"><div class="check-summary"><strong>${done}/${m.items.length}</strong><span>afgevinkt</span></div>${m.items.map((item,i)=>`<label class="packing-row"><input type="checkbox" data-pack="${i}" ${m.checked[item]?'checked':''}><span>${esc(item)}</span></label>`).join('')}</div><div class="button-row" style="margin-top:12px"><button class="secondary" id="resetPack">Reset checklist</button><button class="secondary" id="editPack">Lijst bewerken</button></div>`);
    $$('[data-pack]').forEach(cb=>cb.addEventListener('change',async()=>{const item=m.items[Number(cb.dataset.pack)];m.checked[item]=cb.checked;await JKDB.put('mboxes',m);const n=m.items.filter(i=>m.checked[i]).length;const el=$('.check-summary strong');if(el)el.textContent=`${n}/${m.items.length}`;}));$('#resetPack').addEventListener('click',async()=>{if(confirm('Alle vinkjes van deze lijst wissen?')){m.checked={};await JKDB.put('mboxes',m);closeModal();showMboxChecklist(id)}});$('#editPack').addEventListener('click',()=>{editMbox(id)});
  }
  async function editMbox(id){
    const m=id?await JKDB.get('mboxes',id):{id:JKDB.id('mbox'),name:'Nieuwe inpaklijst',type:'',items:[],notes:'',checked:{},order:(await JKDB.all('mboxes')).length};
    modal(`${modalHead(id?'Checklist bewerken':'Nieuwe checklist')}<form id="mboxForm"><div class="form-grid"><div class="field"><label>Naam</label><input name="name" value="${esc(m.name)}"></div><div class="field"><label>Type / inhoud</label><input name="type" value="${esc(m.type)}"></div><div class="field full"><label>Onderdelen - één per regel</label><textarea name="items" style="min-height:280px">${esc(m.items.join('\n'))}</textarea></div><div class="field full"><label>Notitie</label><textarea name="notes">${esc(m.notes||'')}</textarea></div></div><div class="button-row"><button class="primary">Opslaan</button>${id?'<button type="button" class="danger-btn" id="delMbox">Verwijderen</button>':''}</div></form>`);
    $('#mboxForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),oldItems=[...(m.items||[])],items=String(f.get('items')).split('\n').map(x=>x.trim()).filter(Boolean),checked={};items.forEach(i=>{if(m.checked?.[i])checked[i]=true});Object.assign(m,{name:f.get('name'),type:f.get('type'),items,notes:f.get('notes'),checked,updatedAt:new Date().toISOString()});await JKDB.put('mboxes',m);const removed=oldItems.filter(x=>!items.some(i=>normGearName(i)===normGearName(x)));if(removed.length){const tools=await JKDB.all('tools');for(const t of tools.filter(t=>t.location===m.id&&removed.some(x=>toolMatchesPackingItem(t,m.id,x)))){t.location='';await JKDB.put('tools',t)}}closeModal();toast('Checklist en register bijgewerkt');renderGearContent();});$('#delMbox')?.addEventListener('click',async()=>{if(confirm('Deze lijst verwijderen? Gekoppelde registeritems worden Los / vrij.')){const tools=await JKDB.all('tools');for(const t of tools.filter(t=>t.location===id)){t.location='';await JKDB.put('tools',t)}await JKDB.remove('mboxes',id);closeModal();renderGearContent();}});
  }
  async function reorderMboxes(){
    let rows=await JKDB.all('mboxes');
    rows=rows.map((m,index)=>({...m,_originalIndex:index})).sort((a,b)=>((a.order??a._originalIndex)-(b.order??b._originalIndex)));
    const draw=()=>{
      modal(`${modalHead('Volgorde materiaal')}<p class="muted small">Zet je meest gebruikte inpaklijsten bovenaan. De volgorde wordt gesynchroniseerd met je andere apparaten.</p><div class="reorder-list">${rows.map((m,i)=>`<div class="reorder-row"><div><strong>${esc(m.name)}</strong><small>${esc(m.type||'Inpaklijst')}</small></div><div class="reorder-buttons"><button type="button" class="icon-btn mini" data-up="${i}" ${i===0?'disabled':''}>↑</button><button type="button" class="icon-btn mini" data-down="${i}" ${i===rows.length-1?'disabled':''}>↓</button></div></div>`).join('')}</div><div class="button-row" style="margin-top:14px"><button class="primary" id="saveMboxOrder">Volgorde opslaan</button></div>`);
      $$('[data-up]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.up);[rows[i-1],rows[i]]=[rows[i],rows[i-1]];draw()}));
      $$('[data-down]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.down);[rows[i+1],rows[i]]=[rows[i],rows[i+1]];draw()}));
      $('#saveMboxOrder').addEventListener('click',async()=>{for(let i=0;i<rows.length;i++){const m={...rows[i]};delete m._originalIndex;m.order=i;m.updatedAt=new Date().toISOString();await JKDB.put('mboxes',m)}closeModal();toast('Volgorde opgeslagen');renderGearContent()});
    };
    draw();
  }

  async function editTool(id,context={}){
    const boxes=await JKDB.all('mboxes');
    const existing=id?await JKDB.get('tools',id):null;
    const isVirtual=!existing && !!context.itemName;
    const t=existing||{id:JKDB.id('tool'),name:context.itemName||'',category:context.itemName?inferGearCategory(context.itemName):'',location:context.location||'',serial:'',purchaseDate:'',notes:''};
    const oldName=context.itemName||t.name,oldLocation=context.location||t.location||'';
    modal(`${modalHead(existing||isVirtual?'Gereedschap / materiaal bewerken':'Nieuw gereedschap / materiaal')}<form id="toolForm"><div class="field"><label>Naam</label><input name="name" required value="${esc(t.name)}"></div><div class="form-grid"><div class="field"><label>Categorie</label><input name="category" value="${esc(t.category)}"></div><div class="field"><label>Locatie / inpakchecklist</label><select name="location"><option value="">Los / vrij</option>${boxes.map(m=>`<option value="${m.id}" ${m.id===t.location?'selected':''}>${esc(m.name+' · '+m.type)}</option>`).join('')}</select><small class="muted">Met een locatie wordt dit item automatisch aan die inpakchecklist gekoppeld.</small></div><div class="field"><label>Serienummer</label><input name="serial" value="${esc(t.serial||'')}"></div><div class="field"><label>Aanschafdatum</label><input type="date" name="purchaseDate" value="${esc(t.purchaseDate||'')}"></div><div class="field full"><label>Notities</label><textarea name="notes">${esc(t.notes||'')}</textarea></div></div><div class="button-row"><button class="primary">Opslaan</button>${existing||isVirtual?'<button type="button" class="danger-btn" id="delTool">Verwijderen</button>':''}</div></form>`);
    $('#toolForm').addEventListener('submit',async e=>{
      e.preventDefault();const f=new FormData(e.target);
      const newName=String(f.get('name')||'').trim(),newLocation=String(f.get('location')||'');
      Object.assign(t,{name:newName,category:f.get('category'),location:newLocation,serial:f.get('serial'),purchaseDate:f.get('purchaseDate'),notes:f.get('notes')});
      await JKDB.put('tools',t);
      await updatePackingForTool(oldLocation,oldName,newLocation,newName);
      closeModal();toast('Register en inpakchecklist bijgewerkt');renderGearContent();
    });
    $('#delTool')?.addEventListener('click',async()=>{
      if(!confirm('Dit item verwijderen uit het gereedschapsregister én uit de gekoppelde inpakchecklist?'))return;
      if(existing)await JKDB.remove('tools',existing.id);
      await updatePackingForTool(oldLocation,oldName,'','');
      closeModal();renderGearContent();
    });
  }

  async function renderDocuments(){
    await refreshFinance();
    title('Documenten');
    const [docs,photos,jobs,expenses]=await Promise.all([JKDB.all('documents'),JKDB.all('jobPhotos'),JKDB.all('jobs'),JKDB.all('expenses')]);
    const counts={offerte:0,factuur:0,diversen:0,klusfotos:photos.length,expenses:expenses.length};docs.forEach(d=>counts[docFolder(d)]++);
    if(!['offerte','factuur','diversen','klusfotos','expenses'].includes(state.docFolder)){
      $('#view').innerHTML=`<div class="button-row"><button class="primary" id="docQuote">+ Offerte</button><button class="primary" id="docInvoice">+ Factuur</button><button class="ghost" id="annualInvoices" style="margin-left:auto;font-size:12px;padding:7px 10px">Jaaroverzicht PDF</button></div><div class="section-title"><h2>Kies een map</h2></div><div class="folder-grid"><button class="folder" data-folder="offerte"><span>📁</span><strong>Offertes</strong><small>${counts.offerte} bestanden</small></button><button class="folder" data-folder="factuur"><span>📁</span><strong>Facturen</strong><small>${counts.factuur} bestanden</small></button><button class="folder" data-folder="diversen"><span>📁</span><strong>Diversen</strong><small>${counts.diversen} bestanden</small></button><button class="folder" data-folder="klusfotos"><span>📷</span><strong>Klusfoto’s</strong><small>${counts.klusfotos} foto${counts.klusfotos===1?'':'’s'}</small></button><button class="folder" data-folder="expenses"><span>🧾</span><strong>Inkoop & bonnetjes</strong><small>${counts.expenses} uitgave${counts.expenses===1?'':'n'}</small></button></div><p class="muted small" style="margin-top:14px">Klusfoto’s gebruikt dezelfde fotorecords als de klus. Bonnetjes worden compact opgeslagen en gaan bij handmatige Sync mee naar je andere apparaten.</p>`;
      $('#docQuote').addEventListener('click',()=>createBusinessDoc('Offerte'));$('#docInvoice').addEventListener('click',()=>createBusinessDoc('Factuur'));$('#annualInvoices').addEventListener('click',()=>showAnnualInvoiceReport());$$('[data-folder]').forEach(x=>x.addEventListener('click',()=>{state.docFolder=x.dataset.folder;renderDocuments()}));
      return;
    }
    if(state.docFolder==='klusfotos') return renderJobPhotoDocuments(photos,jobs);
    if(state.docFolder==='expenses') return renderExpenses(expenses);
    const folderLabel=state.docFolder==='offerte'?'Offertes':state.docFolder==='factuur'?'Facturen':'Diversen';
    $('#view').innerHTML=`<div class="button-row"><button class="secondary" id="backToFolders">← Mappen</button><button class="secondary" id="importDocs">Upload naar ${folderLabel}</button></div><div id="docList"></div>`;
    $('#backToFolders').addEventListener('click',()=>{state.docFolder=null;renderDocuments()});$('#importDocs').addEventListener('click',()=>chooseImportFolder());renderDocumentList(docs);
  }
  function invoiceReportDate(d){
    const raw=String(d?.meta?.docDate||((d?.meta?.manualImport||d?.meta?.pdfParseVersion)?'':d?.createdAt)||'');
    const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m?`${m[1]}-${m[2]}-${m[3]}`:'';
  }
  function invoiceReportYear(d){const date=invoiceReportDate(d);return date?Number(date.slice(0,4)):null;}
  function invoiceReportNumber(d){return String(d?.meta?.number||d?.filename||'').replace(/\.pdf$/i,'')||'Onbekend';}
  function reportMoney(v){return `EUR ${Number(v||0).toFixed(2).replace('.',',')}`;}
  function pdfSafeText(value){return String(value??'').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[^\x20-\x7E\xA0-\xFF]/g,'?');}
  function pdfWrapText(text,font,size,maxWidth){
    const clean=pdfSafeText(text).replace(/\s+/g,' ').trim();if(!clean)return [''];
    const words=clean.split(' '),lines=[];let line='';
    for(const word of words){const test=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(test,size)<=maxWidth){line=test;continue;}if(line)lines.push(line);let part='';for(const ch of word){const t=part+ch;if(font.widthOfTextAtSize(t,size)<=maxWidth)part=t;else{if(part)lines.push(part);part=ch}}line=part;}
    if(line)lines.push(line);return lines;
  }
  async function showAnnualInvoiceReport(){
    toast("Handmatig geüploade PDF's controleren...");
    const scan=await reprocessImportedBusinessDocs(false);
    if(scan.checked)toast(`${scan.recognized} van ${scan.checked} geüploade PDF${scan.checked===1?'':'s'} herkend`);
    const docs=(await JKDB.all('documents')).filter(d=>docFolder(d)==='factuur');
    const years=[...new Set(docs.map(invoiceReportYear).filter(Boolean))].sort((a,b)=>b-a);
    if(!years.length)years.push(new Date().getFullYear());
    const options=years.map(y=>`<option value="${y}">${y}</option>`).join('');
    modal(`${modalHead('Jaaroverzicht facturen')}<div class="card"><p>Maak een PDF-overzicht van je verkoopfacturen per kalenderjaar.</p><div class="field"><label>Kalenderjaar</label><select id="annualInvoiceYear">${options}</select></div><div class="muted small">Handmatig geüploade facturen worden automatisch uitgelezen, ook als ze een ander sjabloon hebben. Herkende factuurnummers, datums, klantgegevens, bedragen, regels en KOR-vermelding worden meegenomen. De originele facturen blijven de fiscale brondocumenten.</div><button class="secondary" id="downloadAnnualInvoices" style="width:100%;margin-top:14px">Download jaaroverzicht PDF</button></div>`);
    $('#downloadAnnualInvoices').addEventListener('click',async()=>{
      const year=Number($('#annualInvoiceYear').value);const btn=$('#downloadAnnualInvoices');btn.disabled=true;btn.textContent='PDF maken...';
      try{await generateAnnualInvoiceReport(year);closeModal();toast(`Jaaroverzicht ${year} gedownload`);}catch(err){console.error(err);alert('Jaaroverzicht maken mislukt: '+(err.message||err));btn.disabled=false;btn.textContent='Download jaaroverzicht PDF';}
    });
  }
  async function generateAnnualInvoiceReport(year){
    await refreshFinance();
    await ensurePdfLib();
    const [allDocs,company]=await Promise.all([JKDB.all('documents'),JKDB.get('settings','company')]);
    const invoices=allDocs.filter(d=>docFolder(d)==='factuur'&&invoiceReportYear(d)===Number(year)).sort((a,b)=>invoiceReportDate(a).localeCompare(invoiceReportDate(b))||invoiceReportNumber(a).localeCompare(invoiceReportNumber(b)));
    if(!invoices.length)throw new Error(`Geen facturen gevonden voor ${year}.`);
    const {PDFDocument,StandardFonts,rgb}=PDFLib,pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const W=595.28,H=841.89,M=42,contentW=W-M*2,bronze=rgb(0.48,0.32,0.19),dark=rgb(0.15,0.14,0.13),muted=rgb(0.38,0.36,0.34),light=rgb(0.94,0.92,0.88),line=rgb(0.82,0.79,0.74);
    let page,y,pageNo=0;
    const addPage=()=>{page=pdf.addPage([W,H]);pageNo++;y=H-M;page.drawText('JK Works Dordrecht',{x:M,y:y-2,size:9,font:bold,color:bronze});page.drawText(`Jaaroverzicht verkoopfacturen ${year}`,{x:W-M-regular.widthOfTextAtSize(`Jaaroverzicht verkoopfacturen ${year}`,9),y:y-2,size:9,font:regular,color:muted});y-=24;return page;};
    const ensure=(need)=>{if(y-need<M+28)addPage();};
    const text=(value,x,size=9,font=regular,color=dark,maxWidth=contentW,lineH=size*1.28)=>{const lines=pdfWrapText(value,font,size,maxWidth);for(const ln of lines){ensure(lineH);page.drawText(ln,{x,y:y-size,size,font,color});y-=lineH;}return lines.length;};
    const labelValue=(label,value)=>{const labelLines=pdfWrapText(pdfSafeText(label),bold,8,100),valLines=pdfWrapText(value||'-',regular,8.5,contentW-122),h=Math.max(17,Math.max(labelLines.length,valLines.length)*11+6);ensure(h);for(let i=0;i<labelLines.length;i++)page.drawText(labelLines[i],{x:M,y:y-9-(i*11),size:8,font:bold,color:muted});for(let i=0;i<valLines.length;i++)page.drawText(valLines[i],{x:M+112,y:y-9-(i*11),size:8.5,font:regular,color:dark});y-=h;};
    addPage();
    page.drawText(`Jaaroverzicht verkoopfacturen ${year}`,{x:M,y:y-26,size:20,font:bold,color:dark});y-=38;
    text('Administratief overzicht van de uitgaande facturen in de JK Works-app. Dit document is een samenvatting en vervangt de originele facturen en overige bedrijfsadministratie niet.',M,9,regular,muted,contentW,12);y-=8;
    page.drawRectangle({x:M,y:y-100,width:contentW,height:94,color:light});
    let iy=y-20;const companyName=company?.companyName||'JK Works Dordrecht',owner=company?.owner||'Jeremy Korstanje';
    page.drawText(pdfSafeText(companyName),{x:M+14,y:iy,size:12,font:bold,color:dark});iy-=16;page.drawText(pdfSafeText(owner),{x:M+14,y:iy,size:9,font:regular,color:dark});iy-=14;page.drawText('Van Blanckenburgstraat 72, 3314 WP Dordrecht',{x:M+14,y:iy,size:8.5,font:regular,color:dark});iy-=14;page.drawText('KVK 42078161  |  BTW-ID NL005477968B66',{x:M+14,y:iy,size:8.5,font:regular,color:dark});
    y-=114;
    const structured=invoices.filter(d=>d?.meta?.total!=null&&d.meta.total!==''&&Number.isFinite(Number(d.meta.total))),total=structured.reduce((s,d)=>s+Number(d.meta.total||0),0),paid=structured.reduce((s,d)=>s+Math.min(num(d.meta.total),state.finance.document(d).received),0),open=structured.reduce((s,d)=>s+state.finance.document(d).open,0),vatTotal=invoices.reduce((s,d)=>s+(d.meta?.vatAmount!=null&&Number.isFinite(Number(d.meta.vatAmount))?Number(d.meta.vatAmount):0),0);
    page.drawText('Samenvatting',{x:M,y:y-12,size:13,font:bold,color:dark});y-=28;
    const stats=[['Aantal facturen',String(invoices.length)],['Totaal factuurbedragen',reportMoney(total)],['Waarvan uitgelezen btw',reportMoney(vatTotal)],['Ontvangen op deze facturen (alle datums)',reportMoney(paid)],['Nog open op deze facturen',reportMoney(open)],['Werkelijk ontvangen in kalenderjaar',reportMoney(state.finance.receipts.filter(p=>p.date?.startsWith(String(year))).reduce((n,p)=>n+p.amount,0))],['Ontvangen zonder bekende betaaldatum',reportMoney(state.finance.receipts.filter(p=>!p.date).reduce((n,p)=>n+p.amount,0))]];
    for(const [a,b] of stats)labelValue(a,b);
    if(company?.kor){labelValue('KOR',company.korSince?`Actief sinds ${nlDate(company.korSince)}`:'Actief');}
    if(structured.length!==invoices.length){text(`${invoices.length-structured.length} factuur/facturen hebben geen gestructureerd totaalbedrag in de app en zijn daarom niet meegenomen in de totaalsommen. Controleer daarvoor de originele PDF.`,M,8.5,bold,bronze,contentW,11);y-=4;}
    text('Belastingdienst: een volledige administratie omvat meer dan alleen verkoopfacturen. Bewaar de originele facturen en onderliggende administratie. Voor de aangifte inkomstenbelasting zijn onder andere ook zakelijke kosten en gegevens voor winst-en-verliesrekening en balans nodig.',M,8,regular,muted,contentW,10.5);y-=14;
    page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:0.7,color:line});y-=18;
    page.drawText('Facturen',{x:M,y:y-10,size:14,font:bold,color:dark});y-=28;
    for(const d of invoices){
      const m=d.meta||{},number=invoiceReportNumber(d),date=invoiceReportDate(d),client=m.client||{},amount=(m.total!=null&&m.total!==''&&Number.isFinite(Number(m.total)))?reportMoney(m.total):'Zie originele factuur',status=state.finance.document(d).paid?'Betaald':state.finance.document(d).received>0?'Gedeeltelijk betaald; open '+reportMoney(state.finance.document(d).open):(m.sent?'Verstuurd / onbetaald':'Niet als verstuurd gemarkeerd');
      ensure(94);
      page.drawRectangle({x:M,y:y-24,width:contentW,height:24,color:light});
      page.drawText(pdfSafeText(number),{x:M+10,y:y-16,size:9.5,font:bold,color:dark});
      const right=`${nlDate(date)}  |  ${amount}`;page.drawText(pdfSafeText(right),{x:W-M-10-regular.widthOfTextAtSize(pdfSafeText(right),8.5),y:y-15,size:8.5,font:regular,color:dark});y-=34;
      labelValue('Klant',client.name||m.clientName||'Niet opgeslagen');
      const address=[client.address,client.postalCity].filter(Boolean).join(', ');if(address)labelValue('Adres afnemer',address);
      if(m.workDate)labelValue('Datum prestatie',nlDate(m.workDate));
      labelValue('Status',status);
      const inKor=typeof m.korApplied==='boolean'?m.korApplied:!!(m.korDetected||(company?.kor&&company?.korSince&&date&&date>=company.korSince));labelValue('BTW/KOR',inKor?'KOR - vrijgesteld van btw':(m.vatAmount!=null?`BTW van toepassing${m.vatRate?` (${m.vatRate}%)`:''}`:'Zie originele factuur voor btw-specificatie'));if(m.subtotalExVat!=null&&Number.isFinite(Number(m.subtotalExVat)))labelValue('Subtotaal excl. btw',reportMoney(m.subtotalExVat));if(m.vatAmount!=null&&Number.isFinite(Number(m.vatAmount)))labelValue('BTW-bedrag',reportMoney(m.vatAmount));
      const lines=(m.lines||[]).filter(l=>String(l?.description||'').trim()||num(l?.qty)||num(l?.price));
      if(lines.length){
        ensure(28);page.drawText('Werkzaamheden / regels',{x:M,y:y-9,size:8,font:bold,color:muted});y-=17;
        for(const l of lines){const q=num(l.qty),p=num(l.price),lt=q*p,desc=String(l.description||'Omschrijving');const prefix=`${String(l.qty||'1')} x `,suffix=` @ ${reportMoney(p)} = ${reportMoney(lt)}`;const whole=prefix+desc+suffix;text(whole,M+10,8.2,regular,dark,contentW-20,10.5);}
      }else{text(m.manualImport?'Geen betrouwbare factuurregels automatisch herkend - overige gegevens zijn wel uit de PDF overgenomen. Raadpleeg voor de regels de originele PDF.':'Geen gestructureerde factuurregels opgeslagen - raadpleeg de originele PDF.',M+10,8.2,regular,muted,contentW-20,10.5);}
      y-=6;page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:0.5,color:line});y-=15;
    }
    const pages=pdf.getPages(),generated=new Intl.DateTimeFormat('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
    pages.forEach((pg,i)=>{const footer=`Pagina ${i+1} van ${pages.length}  |  Gegenereerd ${generated}`;pg.drawText(footer,{x:M,y:20,size:7.5,font:regular,color:muted});});
    const bytes=await pdf.save(),blob=new Blob([bytes],{type:'application/pdf'});downloadBlob(blob,`JK-Works-Jaaroverzicht-Facturen-${year}.pdf`);
  }
  function docFolder(d){const k=String(d.folder||d.kind||'').toLowerCase();return k.includes('offert')?'offerte':k.includes('fact')?'factuur':'diversen'}
  // Alleen expliciete klus-ID's gebruiken: nooit koppelen op naam of datum.
  function linkedInvoiceJobId(doc){
    return String(doc?.meta?.jobId!==undefined?doc.meta.jobId:(doc?.jobId||''));
  }
  function linkedInvoicesForJob(jobId,documents){
    return (documents||[]).filter(d=>docFolder(d)==='factuur'&&linkedInvoiceJobId(d)===jobId);
  }
  // Compatibility entry point for document creation: update derived flags only.
  async function syncJobPaymentForInvoice(jobId){
    if(!jobId)return false;
    const f=await refreshFinance();await freezeLegacyPayments(f,jobId);
    await refreshPaymentFlags(jobId);return true;
  }
  async function setInvoiceJobLink(doc,jobId){
    if(docFolder(doc)!=='factuur')throw new Error('Alleen facturen kunnen hier gekoppeld worden.');
    const next=String(jobId||''),previous=linkedInvoiceJobId(doc);
    if(next===previous)return false;
    if(next&&!await JKDB.get('jobs',next))throw new Error('De gekozen klus bestaat niet meer.');
    const finance=await refreshFinance();await freezeLegacyPayments(finance,previous,doc.id);
    if(previous){const old=await JKDB.get('jobs',previous);if(old)await JKDB.put('jobs',{...old,paymentLedger:true});}
    for(const p of (await JKDB.all('settings')).filter(p=>p.kind==='jkPayment'&&p.invoiceId===doc.id))await JKDB.put('settings',{...p,jobId:next});
    doc.meta={...doc.meta,jobId:next};
    await JKDB.put('documents',doc);
    if(previous)await syncJobPaymentForInvoice(previous);
    if(next)await syncJobPaymentForInvoice(next);else await refreshPaymentFlags('',doc.id);
    return true;
  }
  function docStatusHtml(d){const f=docFolder(d),m=d.meta||{};if(f==='factuur')return `<span class="status-chip ${m.sent?'on':''}">${m.sent?'✓ ':''}Verstuurd</span><span class="status-chip ${state.finance?.document(d).paid?'on':''}">${state.finance?.document(d).paid?'✓ ':''}${state.finance?.document(d).paid?'Betaald':state.finance?.document(d).received>0?'Gedeeltelijk betaald':'Onbetaald'}</span>`;if(f==='offerte')return `<span class="status-chip ${m.sent?'on':''}">${m.sent?'✓ ':''}Verstuurd</span><span class="status-chip ${m.confirmed?'on':''}">${m.confirmed?'✓ ':''}Bevestigd</span>`;return ''}
  function renderDocumentList(docs){const c=$('#docList');if(!c)return;const filtered=docs.filter(d=>docFolder(d)===state.docFolder).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));c.innerHTML=`<div class="section-title"><h2>${state.docFolder==='offerte'?'Offertes':state.docFolder==='factuur'?'Facturen':'Diversen'}</h2></div>${filtered.length?`<div class="list">${filtered.map(d=>{const m=d.meta||{},parsed=m.manualImport&&m.pdfParseVersion===PDF_PARSE_VERSION?(m.businessVerified?' · PDF uitgelezen':' · PDF controle nodig'):'';return `<div class="list-item clickable" data-doc="${d.id}"><div class="document-card"><div class="doc-icon">PDF</div><div class="main"><div class="title">${esc(d.filename)}</div><div class="sub">${m.docDate?nlDate(m.docDate):fmtDateTime(d.createdAt)} · ${esc(d.kind||'PDF')}${parsed}</div>${m.total!=null?`<div class="sub"><strong>${money(m.total)}</strong>${m.number?' · '+esc(m.number):''}</div>`:''}<div class="status-row">${docStatusHtml(d)}</div></div></div><span>›</span></div>`}).join('')}</div>`:'<div class="empty">Deze map is nog leeg.</div>'}`;$$('[data-doc]').forEach(x=>x.addEventListener('click',()=>showDocument(x.dataset.doc)))}
  async function renderJobPhotoDocuments(photos,jobs){
    const jobMap=new Map(jobs.map(j=>[j.id,j]));
    const groups=new Map();
    for(const p of photos.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))){
      const key=p.jobId||'zonder-klus';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
    }
    const html=[...groups.entries()].map(([jobId,list])=>{
      const job=jobMap.get(jobId),title=job?.title||'Klus niet meer aanwezig',sub=[job?.clientName,nlDate(job?.date)].filter(Boolean).join(' · ');
      return `<div class="card photo-doc-job"><h3>${esc(title)}</h3>${sub?`<div class="muted small">${esc(sub)}</div>`:''}<div class="job-photo-grid">${list.map(p=>`<button class="job-photo-thumb photo-doc-thumb" type="button" data-photo-doc="${esc(p.id)}"><img src="${URL.createObjectURL(p.blob)}" alt="${esc(p.name||'Klusfoto')}"></button>`).join('')}</div></div>`;
    }).join('');
    $('#view').innerHTML=`<div class="button-row"><button class="secondary" id="backToFolders">← Mappen</button></div><div class="section-title"><h2>Klusfoto’s</h2><span class="muted small">${photos.length} totaal</span></div>${html||'<div class="empty">Nog geen klusfoto’s. Voeg ze toe vanuit een klus.</div>'}`;
    $('#backToFolders').addEventListener('click',()=>{state.docFolder=null;renderDocuments()});
    $$('[data-photo-doc]').forEach(b=>b.addEventListener('click',()=>showPhotoDocument(b.dataset.photoDoc)));
  }
  async function renderExpenses(expenses=null){
    expenses=expenses||await JKDB.all('expenses');const expenseJobs=await JKDB.all('jobs');expenses.sort((a,b)=>(b.date||b.createdAt||'').localeCompare(a.date||a.createdAt||''));
    const year=new Date().getFullYear(),yearRows=expenses.filter(e=>String(e.date||'').startsWith(String(year))),total=yearRows.reduce((a,e)=>a+num(e.amountIncl),0),vat=yearRows.reduce((a,e)=>a+num(e.vatAmount),0);
    $('#view').innerHTML=`<div class="button-row"><button class="secondary" id="backToFolders">← Mappen</button><button class="primary" id="addExpense">+ Uitgave / bon</button></div><div class="card" style="margin-top:12px"><div class="kpi-row"><div class="kpi"><strong>${money(total)}</strong><span>Uitgaven ${year}</span></div><div class="kpi"><strong>${money(vat)}</strong><span>BTW geregistreerd</span></div><div class="kpi"><strong>${expenses.length}</strong><span>Bonnetjes totaal</span></div></div><p class="muted small">Dit is je eigen inkoopoverzicht. Het staat los van het Jaaroverzicht Facturen.</p></div><div class="section-title"><h2>Inkoop & bonnetjes</h2></div>${expenses.length?`<div class="list">${expenses.map(e=>`<div class="list-item clickable" data-expense="${e.id}"><div class="main"><div class="title">${esc(e.supplier||'Uitgave')}</div><div class="sub">${nlDate(e.date)} · ${esc(e.category||'Overig')}${e.receiptBlob?' · bon toegevoegd':''}${e.jobId?' · '+esc(expenseJobs.find(j=>j.id===e.jobId)?.title||'Klus ontbreekt'):''}</div></div><strong>${money(e.amountIncl)}</strong></div>`).join('')}</div>`:'<div class="empty">Nog geen bonnetjes of zakelijke uitgaven.</div>'}`;
    $('#backToFolders').addEventListener('click',()=>{state.docFolder=null;renderDocuments()});$('#addExpense').addEventListener('click',()=>editExpense());$$('[data-expense]').forEach(b=>b.addEventListener('click',()=>showExpense(b.dataset.expense)));
  }
  async function editExpense(id,options={}){
    const returnJobId=options.returnJobId||'';
    const e=id?await JKDB.get('expenses',id):{id:JKDB.id('expense'),date:today(),supplier:'',category:'Materiaal',amountIncl:'',vatAmount:'',notes:'',receiptBlob:null,receiptName:'',jobId:options.jobId||''};
    const jobs=await JKDB.all('jobs');
    modal(`${modalHead(id?'Uitgave bewerken':'Nieuwe uitgave')}<form id="expenseForm"><div class="form-grid"><div class="field"><label>Datum</label><input type="date" name="date" required value="${esc(e.date||today())}"></div><div class="field"><label>Leverancier / winkel</label><input name="supplier" required value="${esc(e.supplier||'')}"></div><div class="field"><label>Categorie</label><select name="category">${['Materiaal','Gereedschap','Parkeren / vervoer','Kleding / PBM','Horeca / verbruik','Software / abonnement','Overig'].map(x=>`<option ${e.category===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Koppelen aan klus</label><select name="jobId"><option value="">Geen klus gekoppeld</option>${jobs.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(j=>`<option value="${esc(j.id)}" ${e.jobId===j.id?'selected':''}>${esc(j.title||'Klus')} · ${esc(j.clientName||'Geen klant')} · ${esc(nlDate(j.date)||'geen datum')}</option>`).join('')}</select><small class="muted">Alleen bonnetjes met een gekoppelde klus kun je later direct als factuurregel kiezen.</small></div><div class="field"><label>Bedrag incl. btw</label><input name="amountIncl" type="number" step="0.01" min="0" required value="${esc(e.amountIncl||'')}"></div><div class="field"><label>BTW-bedrag</label><input name="vatAmount" type="number" step="0.01" min="0" value="${esc(e.vatAmount||'')}"></div></div><div class="field"><label>Notitie</label><textarea name="notes">${esc(e.notes||'')}</textarea></div><div class="card small"><strong>Bon / bewijs</strong><p class="muted small">Foto’s worden voor opslag verkleind. Je kunt ook een PDF kiezen.</p><div class="button-row"><button type="button" class="secondary" id="expenseCamera">📷 Foto maken</button><button type="button" class="secondary" id="expenseUpload">⬆ Bestand kiezen</button></div><input id="expenseCameraInput" type="file" accept="image/*" capture="environment" hidden><input id="expenseFileInput" type="file" accept="image/*,application/pdf" hidden><div id="expenseFileLabel" class="muted small" style="margin-top:8px">${e.receiptBlob?esc(e.receiptName||'Bon toegevoegd'):'Nog geen bestand'}</div></div><div class="button-row"><button class="primary">Opslaan</button>${returnJobId?'<button type="button" class="secondary" id="backExpenseEditJob">Terug naar klus</button>':''}${id?'<button type="button" class="danger-btn" id="deleteExpense">Verwijderen</button>':''}</div></form>`);
    $('#backExpenseEditJob')?.addEventListener('click',()=>showJob(returnJobId));
    let pendingBlob=e.receiptBlob||null,pendingName=e.receiptName||'';
    const take=async file=>{if(!file)return;if(file.type.startsWith('image/')){const r=await optimizeJobPhoto(file);pendingBlob=r.blob;pendingName=String(file.name||'bon.jpg').replace(/\.[^.]+$/, '')+'.jpg';}else{if(file.size>2*1024*1024){alert('Deze PDF is groter dan 2 MB. Verklein het bestand eerst om Supabase-opslag beperkt te houden.');return;}pendingBlob=new Blob([await file.arrayBuffer()],{type:file.type||'application/pdf'});pendingName=file.name||'bon.pdf';}$('#expenseFileLabel').textContent=`${pendingName} · ${humanBytes(pendingBlob.size)}`;};
    $('#expenseCamera').addEventListener('click',()=>$('#expenseCameraInput').click());$('#expenseUpload').addEventListener('click',()=>$('#expenseFileInput').click());$('#expenseCameraInput').addEventListener('change',e=>take(e.target.files?.[0]));$('#expenseFileInput').addEventListener('change',e=>take(e.target.files?.[0]));
    $('#expenseForm').addEventListener('submit',async ev=>{ev.preventDefault();const f=new FormData(ev.target);Object.assign(e,{date:f.get('date'),supplier:f.get('supplier'),category:f.get('category'),jobId:f.get('jobId')||'',amountIncl:f.get('amountIncl'),vatAmount:f.get('vatAmount'),notes:f.get('notes'),receiptBlob:pendingBlob,receiptName:pendingName,createdAt:e.createdAt||new Date().toISOString()});await JKDB.put('expenses',e);closeModal();toast('Uitgave opgeslagen');if(returnJobId)await showJob(returnJobId);else await renderExpenses();});
    $('#deleteExpense')?.addEventListener('click',async()=>{if(!confirm('Deze uitgave en het gekoppelde bonbestand verwijderen?'))return;await JKDB.remove('expenses',id);closeModal();if(returnJobId)await showJob(returnJobId);else await renderExpenses();});
  }
  async function showExpense(id,options={}){
    const returnJobId=options.returnJobId||'';
    const e=await JKDB.get('expenses',id);if(!e)return;
    const job=e.jobId?await JKDB.get('jobs',e.jobId):null;
    let preview='',previewUrl=null;
    if(e.receiptBlob instanceof Blob){
      if(e.receiptBlob.type.startsWith('image/')){
        previewUrl=URL.createObjectURL(e.receiptBlob);
        preview=`<img src="${previewUrl}" alt="Bon" style="width:100%;max-height:55vh;object-fit:contain;border-radius:12px;background:#f3f1ed">`;
      }else if(e.receiptBlob.type==='application/pdf'){
        previewUrl=URL.createObjectURL(e.receiptBlob);
        preview=`<iframe src="${previewUrl}#toolbar=0" title="Bon PDF" style="width:100%;height:380px;border:0;border-radius:12px"></iframe>`;
      }
    }
    modal(`${modalHead(e.supplier||'Uitgave')}<div class="card">${preview}<div class="kpi-row" style="margin-top:12px"><div class="kpi"><strong>${money(e.amountIncl)}</strong><span>Incl. btw</span></div><div class="kpi"><strong>${money(e.vatAmount)}</strong><span>BTW</span></div></div><div class="muted small">${nlDate(e.date)} · ${esc(e.category||'Overig')}${e.jobId?' · Klus: '+esc(job?.title||'Klus ontbreekt'):''}</div>${e.notes?`<p>${esc(e.notes)}</p>`:''}<div class="button-row"><button class="secondary" id="editExpense">Bewerken</button>${e.receiptBlob?'<button class="secondary" id="shareExpense">Delen / bewaar</button>':''}${returnJobId?'<button class="secondary" id="backExpenseJob">Terug naar klus</button>':''}</div></div>`);
    if(previewUrl)state.activeBlobUrl=previewUrl;
    $('#editExpense').addEventListener('click',()=>editExpense(id,{returnJobId}));$('#shareExpense')?.addEventListener('click',()=>shareBlob(e.receiptBlob,e.receiptName||'bon'));$('#backExpenseJob')?.addEventListener('click',()=>showJob(returnJobId));
  }

  function photoCategorySelect(p){
    return `<label class="photo-category">Categorie<select data-photo-category="${esc(p.id)}" aria-label="Categorie voor ${esc(p.name||'foto')}"><option value="general" ${!photoPhaseMeta[p.phase]?'selected':''}>Niet ingedeeld</option>${Object.entries(photoPhaseMeta).map(([key,meta])=>`<option value="${key}" ${p.phase===key?'selected':''}>${meta.label}</option>`).join('')}</select></label>`;
  }
  function bindPhotoCategories(){
    $$('[data-photo-category]').forEach(select=>select.addEventListener('change',async()=>{
      select.disabled=true;
      try{
        const p=await JKDB.get('jobPhotos',select.dataset.photoCategory);if(!p)throw new Error('Deze foto is inmiddels verwijderd.');
        if(p.phase!==select.value){p.phase=select.value;await JKDB.put('jobPhotos',p);}
        toast('Categorie opgeslagen');
      }catch(error){alert('Categorie opslaan lukte niet: '+error.message);}finally{select.disabled=false;}
    }));
  }
  async function showPhotoDocument(id,returnJobId=''){
    const p=await JKDB.get('jobPhotos',id);if(!p)return;
    const j=p.jobId?await JKDB.get('jobs',p.jobId):null,meta=photoPhaseMeta[p.phase]||{label:'Foto',icon:'📷'},url=URL.createObjectURL(p.blob);
    modal(`${modalHead(`${meta.icon} ${meta.label}`)}<div class="card"><img src="${url}" alt="Klusfoto" style="width:100%;max-height:62vh;object-fit:contain;border-radius:14px;background:#f2eee7"><h3 style="margin-top:12px">${esc(j?.title||'Klusfoto')}</h3><div class="muted small">${esc(p.name||'foto.jpg')} · ${fmtDateTime(p.createdAt)}${j?.clientName?' · '+esc(j.clientName):''}${p.compressedSize||p.blob?.size?' · '+humanBytes(p.compressedSize||p.blob?.size):''}</div>${photoCategorySelect(p)}<div class="button-row" style="margin-top:14px">${returnJobId?'<button class="secondary" id="backPhotoJob">Terug naar klus</button>':''}<button class="primary" id="sharePhotoDoc">Delen / bewaar</button><button class="secondary" id="downloadPhotoDoc">Download</button><button class="danger-btn" id="deletePhotoDoc">Verwijderen</button></div></div>`);
    bindPhotoCategories();
    $('#backPhotoJob')?.addEventListener('click',()=>showJob(returnJobId));
    $('#sharePhotoDoc').addEventListener('click',()=>shareBlob(p.blob,p.name||'klusfoto.jpg'));
    $('#downloadPhotoDoc').addEventListener('click',()=>downloadBlob(p.blob,p.name||'klusfoto.jpg'));
    $('#deletePhotoDoc').addEventListener('click',async()=>{if(!confirm('Deze foto verwijderen? De foto verdwijnt ook bij de gekoppelde klus.'))return;await JKDB.remove('jobPhotos',p.id);closeModal();toast('Foto verwijderd');if(returnJobId)await showJob(returnJobId);else if(state.route==='documents')renderDocuments();});
  }
  function chooseImportFolder(){
    if(['offerte','factuur','diversen'].includes(state.docFolder)){state.importFolderTarget=state.docFolder;$('#hiddenExistingPdfInput').click();return;}
    modal(`${modalHead('PDF uploaden')}<p class="muted small">Kies in welke map je het bestand wilt plaatsen.</p><div class="grid two"><button class="quick" data-import-folder="offerte"><span class="emoji">📄</span><strong>Offertes</strong></button><button class="quick" data-import-folder="factuur"><span class="emoji">🧾</span><strong>Facturen</strong></button><button class="quick" data-import-folder="diversen"><span class="emoji">📁</span><strong>Diversen</strong></button></div>`);
    $$('[data-import-folder]').forEach(b=>b.addEventListener('click',()=>{state.importFolderTarget=b.dataset.importFolder;closeModal();$('#hiddenExistingPdfInput').click();}));
  }
  async function importExistingPdfs(files,folder='diversen'){
    let count=0,recognized=0,failed=0;folder=['offerte','factuur','diversen'].includes(folder)?folder:'diversen';const company=await JKDB.get('settings','company');
    for(const file of files){
      if(!file.name.toLowerCase().endsWith('.pdf'))continue;
      const doc={id:JKDB.id('doc'),filename:file.name,kind:folder==='offerte'?'Offerte':folder==='factuur'?'Factuur':'Diversen',folder,blob:new Blob([await file.arrayBuffer()],{type:'application/pdf'}),createdAt:new Date().toISOString(),meta:{sent:false,paid:false,confirmed:false,manualImport:true}};
      await JKDB.put('documents',doc);count++;
      if(['offerte','factuur'].includes(folder)){toast(`PDF uitlezen: ${file.name}`);await parseStoredBusinessDocument(doc,company,true);if(doc.meta?.businessVerified)recognized++;else failed++;}
    }
    if(['offerte','factuur'].includes(folder)&&count)toast(`${count} PDF${count===1?'':'s'} geüpload · ${recognized} automatisch herkend${failed?` · ${failed} controle nodig`:''}`);else toast(`${count} PDF${count===1?'':'s'} geüpload naar Diversen`);
    state.docFolder=folder;if(state.route==='documents')renderDocuments();
  }

  async function nextDocNumber(kind){
    const prefix=kind==='Factuur'?'FAC':'OFF',year=new Date().getFullYear(),docs=await JKDB.all('documents');let max=0;for(const d of docs){const n=d.meta?.number||d.number||d.filename||'',m=String(n).match(new RegExp(`${prefix}-${year}-(\\d+)`,'i'));if(m)max=Math.max(max,Number(m[1]));}return `${prefix}-${year}-${String(max+1).padStart(3,'0')}`;
  }
  function businessJobContext(job,checklists=[]){
    const checklist=checklists.find(c=>c.id===job?.checklistId);
    return `${job?.title||''} ${checklist?.name||''}`.toLowerCase();
  }
  function jobTimeRange(job){
    const start=String(job?.startTime||'').trim(),end=String(job?.endTime||'').trim();
    if(start&&end)return `${start} - ${end}`;
    if(start)return `vanaf ${start}`;
    return '';
  }
  function linkedQuoteNumber(job,documents=[]){
    if(!job?.id)return '';
    const quotes=documents.filter(d=>docFolder(d)==='offerte'&&d.meta?.jobId===job.id).sort((a,b)=>{
      const ac=a.meta?.confirmed?1:0,bc=b.meta?.confirmed?1:0;if(ac!==bc)return bc-ac;
      return String(b.meta?.docDate||b.createdAt||'').localeCompare(String(a.meta?.docDate||a.createdAt||''));
    });
    return String(quotes[0]?.meta?.number||'').trim();
  }
  const DEFAULT_WORK_CATEGORIES=[
    {id:'kit',label:'Kitwerkzaamheden',keywords:'kitten, afkitten, kitwerk, siliconenkit, acrylaatkit, plinten'},
    {id:'catering',label:'Cateringwerkzaamheden',keywords:'catering, buffet, bruiloft catering'},
    {id:'horeca',label:'Horecawerkzaamheden',keywords:'horeca, achter de bar, barwerk, bediening, bartender, tappen, barmedewerker'},
    {id:'montage',label:'Montagewerkzaamheden',keywords:'montage, monteren, keuken, ikea, kasten, meubelmontage'},
    {id:'vloer',label:'Vloerwerkzaamheden',keywords:'laminaat, pvc vloer, vloer leggen, parket, plavuizen'},
    {id:'elektra',label:'Elektrawerkzaamheden',keywords:'elektra, elektrisch, bekabeling, kabel trekken, stopcontact, verlichting'},
    {id:'schilder',label:'Schilderwerkzaamheden',keywords:'schilderen, verven, schilderwerk, lakken'},
    {id:'bestrating',label:'Bestratingswerkzaamheden',keywords:'bestraten, bestrating, tegels leggen, klinkers, terras aanleggen'},
    {id:'tuin',label:'Tuinwerkzaamheden',keywords:'tuin, schutting, snoeien, tuinonderhoud'},
    {id:'verhuis',label:'Verhuiswerkzaamheden',keywords:'verhuizen, verhuizing, sjouwen, inboedel'},
    {id:'evenement',label:'Opbouw- en afbouwwerkzaamheden',keywords:'festival opbouwen, evenement opbouwen, afbouw, podiumbouw'}
  ];
  async function workCategories(){
    const saved=await JKDB.get('settings','workCategories');
    return Array.isArray(saved?.items)?saved.items:DEFAULT_WORK_CATEGORIES.map(x=>({...x}));
  }
  function workDescriptionForJob(job,categories,checklists=[]){
    if(!job)return 'Werkzaamheden';
    const title=String(job.title||'').toLocaleLowerCase('nl-NL');
    const context=businessJobContext(job,checklists);
    for(const category of categories){
      const terms=String(category.keywords||'').split(',').map(x=>x.trim().toLocaleLowerCase('nl-NL')).filter(Boolean);
      if(terms.some(term=>title.includes(term)))return category.label;
    }
    for(const category of categories){
      const terms=String(category.keywords||'').split(',').map(x=>x.trim().toLocaleLowerCase('nl-NL')).filter(Boolean);
      if(terms.some(term=>context.includes(term)))return category.label;
    }
    return String(job.title||'').trim()||'Werkzaamheden';
  }
  function businessDescriptionForJob(job,kind,documents=[],checklists=[],categories=DEFAULT_WORK_CATEGORIES){
    return workDescriptionForJob(job,categories,checklists);
  }
  async function showWorkCategories(){
    const categories=await workCategories();
    const paint=()=>{
      modal(`${modalHead('Werkzaamhedencategorieën')}<div class="card"><p class="muted small">De volgorde bepaalt welke categorie voorrang krijgt. Trefwoorden scheid je met komma's. De omschrijving wordt automatisch gebruikt bij nieuwe offertes en facturen en blijft daar handmatig aanpasbaar.</p><div class="list">${categories.map((cat,i)=>`<div class="card"><div class="field"><label>Omschrijving</label><input data-category-label="${i}" value="${esc(cat.label)}"></div><div class="field"><label>Trefwoorden (komma-gescheiden)</label><textarea data-category-keywords="${i}" rows="2">${esc(cat.keywords)}</textarea></div><div class="button-row"><button type="button" class="secondary" data-category-up="${i}" ${i===0?'disabled':''}>↑</button><button type="button" class="secondary" data-category-down="${i}" ${i===categories.length-1?'disabled':''}>↓</button><button type="button" class="danger-btn" data-category-delete="${i}">Verwijderen</button></div></div>`).join('')}</div><div class="button-row"><button type="button" class="secondary" id="categoryAdd">+ Categorie</button><button type="button" class="primary" id="categorySave">Opslaan</button></div></div>`);
      const collect=()=>{categories.forEach((cat,i)=>{cat.label=document.querySelector(`[data-category-label="${i}"]`)?.value.trim()||'';cat.keywords=document.querySelector(`[data-category-keywords="${i}"]`)?.value.trim()||'';});};
      $('#categoryAdd').addEventListener('click',()=>{collect();categories.push({id:JKDB.id('category'),label:'',keywords:''});paint();});
      $$('[data-category-up]').forEach(b=>b.addEventListener('click',()=>{collect();const i=Number(b.dataset.categoryUp);[categories[i-1],categories[i]]=[categories[i],categories[i-1]];paint();}));
      $$('[data-category-down]').forEach(b=>b.addEventListener('click',()=>{collect();const i=Number(b.dataset.categoryDown);[categories[i+1],categories[i]]=[categories[i],categories[i+1]];paint();}));
      $$('[data-category-delete]').forEach(b=>b.addEventListener('click',()=>{collect();categories.splice(Number(b.dataset.categoryDelete),1);paint();}));
      $('#categorySave').addEventListener('click',async()=>{collect();if(categories.some(x=>!x.label||!x.keywords)){alert('Vul bij iedere categorie een omschrijving en minimaal één trefwoord in.');return;}await JKDB.put('settings',{id:'workCategories',items:categories});closeModal();toast('Werkzaamhedencategorieën opgeslagen');});
    };
    paint();
  }
  // Factuurregels nemen alleen de bonomschrijving en het bedrag over, niet de bonfoto.
  function receiptInvoicePrice(e,kor){
    const gross=num(e?.amountIncl);
    if(!Number.isFinite(gross)||gross<=0)throw new Error('Bonbedrag moet hoger zijn dan nul.');
    return Math.round((kor?gross:gross/1.21)*100)/100;
  }
  function receiptInvoiceLine(e,kor){
    if(!e?.id)throw new Error('Bonnetje ontbreekt.');
    const detail=String(e.notes||e.category||'Materiaal').replace(/\s+/g,' ').trim().slice(0,68);
    const supplier=String(e.supplier||'Winkel').replace(/\s+/g,' ').trim().slice(0,30);
    return {qty:'1',description:[detail,supplier,e.date?'bon '+nlDate(e.date):''].filter(Boolean).join(' - '),price:moneyNumber(receiptInvoicePrice(e,kor)),expenseId:e.id};
  }
  function receiptInvoiceIsUsed(id,documents){
    return (documents||[]).some(d=>docFolder(d)==='factuur'&&(d.meta?.lines||[]).some(l=>l.expenseId===id));
  }
  function addReceiptInvoiceLines(existing,selected,kor,max=4){
    const result=existing.map(l=>({...l})),ids=selected.map(e=>e.id);
    if(new Set(ids).size!==ids.length)throw new Error('Een bon is meermaals geselecteerd.');
    if(result.some(l=>l.expenseId&&ids.includes(l.expenseId)))throw new Error('Dit bonnetje is al toegevoegd.');
    const free=[];
    for(let i=0;i<max;i++){
      const l=result[i]||{qty:'',description:'',price:''};
      if(!String(l.qty||'').trim()&&!String(l.description||'').trim()&&!String(l.price||'').trim())free.push(i);
    }
    if(selected.length>free.length)throw new Error('Er zijn slechts '+free.length+' lege factuurregels beschikbaar (maximaal 4 totaal).');
    selected.forEach((e,i)=>{result[free[i]]=receiptInvoiceLine(e,kor);});
    return result;
  }
  async function createBusinessDoc(kind,prefill={}){
    const [clients,entries,company,jobs,checklists,documents,expenses,categories]=await Promise.all([JKDB.all('clients'),JKDB.all('timeEntries'),JKDB.get('settings','company'),JKDB.all('jobs'),JKDB.all('checklists'),JKDB.all('documents'),JKDB.all('expenses'),workCategories()]);
    const number=await nextDocNumber(kind),isInvoice=kind==='Factuur',docDate=today();
    const defaultKor=typeof prefill.korApplied==='boolean'?prefill.korApplied:!!(company?.kor&&(!company?.korSince||docDate>=company.korSince));
    const initialWorkDate=prefill.workDate||'';
    const maxQuoteDeadline=()=>{
      const issue=$('[name=docDate]')?.value||docDate;
      let max=addDays(issue,28);
      const work=$('[name=workDate]')?.value||initialWorkDate;
      if(!isInvoice && /^\d{4}-\d{2}-\d{2}$/.test(work)){
        const dayBefore=addDays(work,-1);
        if(dayBefore<max) max=dayBefore;
      }
      return max;
    };
    let deadline=isInvoice?addDays(docDate,14):addDays(docDate,28);
    if(!isInvoice && /^\d{4}-\d{2}-\d{2}$/.test(initialWorkDate)){
      const dayBefore=addDays(initialWorkDate,-1); if(dayBefore<deadline)deadline=dayBefore;
    }
    const lines=(prefill.lines||[]).slice(0,4);while(lines.length<4)lines.push({qty:'',description:'',price:''});
    const pClient=prefill.client||{};
    const prefillJob=jobs.find(j=>j.id===prefill.jobId)||null;
    if(prefillJob){
      const suggested=businessDescriptionForJob(prefillJob,kind,documents,checklists),current=String(lines[0]?.description||'').trim();
      const kitchenInvoice=isInvoice&&/keuken/.test(businessJobContext(prefillJob,checklists))&&/^Keuken plaatsen en afwerken$/i.test(current);
      if(!current||/^Werkuren$/i.test(current)||kitchenInvoice)lines[0].description=suggested;
    }
    modal(`${modalHead('Nieuwe '+kind.toLowerCase())}<form id="businessDocForm"><div class="card form-section"><h3>Document</h3><p id="jobHoursBasis" class="muted small" role="status"></p><div class="field"><label>Kies klus</label><select id="jobPick" required><option value="">Selecteer een klus</option>${jobs.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(j=>`<option value="${j.id}" ${prefill.jobId===j.id?'selected':''}>${esc(j.title)}${j.clientName?' · '+esc(j.clientName):''}${j.date?' · '+nlDate(j.date):''}</option>`).join('')}</select><small class="muted">De gekozen klus wordt gebruikt voor klantgegevens, datum werkzaamheden en de koppeling met uren. De app maakt op basis van de gekozen klus automatisch een passende omschrijving op regel 1. Je kunt deze omschrijving altijd zelf aanpassen.</small><button type="button" class="secondary" id="calendarBusinessJob" style="margin-top:8px">📅 Zet gekozen klus in agenda</button></div><div class="form-grid"><div class="field"><label>${kind}nummer</label><input name="number" required value="${esc(number)}"></div><div class="field"><label>${isInvoice?'Factuurdatum':'Datum'}</label><input type="date" name="docDate" required value="${esc(docDate)}"></div><div class="field"><label>${isInvoice?'Datum werkzaamheden':'Werkzaamheden op'}</label>${isInvoice?`<input name="workDate" placeholder="bijv. 04-10-2026" value="${esc(initialWorkDate)}">`:`<input type="date" name="workDate" value="${esc(initialWorkDate)}">`}</div><div class="field"><label>${isInvoice?'Vervaldatum':'Geldig t/m'}</label><input type="date" name="deadline" required value="${esc(deadline)}" ${isInvoice?'':`max="${esc(deadline)}"`}>${isInvoice?'<small class="muted">Standaard 14 dagen na de factuurdatum. Je kunt de vervaldatum handmatig aanpassen.</small>':'<small class="muted">Automatisch maximaal 4 weken na offertedatum, of uiterlijk de dag vóór de werkzaamheden.</small>'}</div></div><label class="checkline" style="margin-top:12px"><input type="checkbox" id="docKor" ${defaultKor?'checked':''}><span><strong>KOR toepassen op dit document</strong><br><small class="muted">Aan = KOR-sjabloon zonder btw. Uit = normaal sjabloon met 21% btw.</small></span></label></div>
      <div class="card form-section"><h3>Klant</h3><div class="field"><label>Kies bestaande klant</label><select id="clientPick"><option value="">Handmatig invullen</option>${clients.map(c=>`<option value="${c.id}" ${prefill.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Naam/bedrijf</label><input name="clientName" value="${esc(pClient.name||'')}"></div><div class="field"><label>T.a.v.</label><input name="attention" value="${esc(pClient.attention||'')}"></div><div class="field"><label>Adres</label><input name="address" value="${esc(pClient.address||pClient.street||'')}"></div><div class="field"><label>Postcode/Plaats</label><input name="postalCity" value="${esc(pClient.postalCity||[pClient.postal,pClient.city].filter(Boolean).join(' '))}"></div><div class="form-grid"><div class="field"><label>Telefoon</label><input name="phone" value="${esc(pClient.phone||'')}"></div><div class="field"><label>E-mail</label><input type="email" name="email" value="${esc(pClient.email||'')}"></div></div><p class="muted small">Kies je een bestaande klant, dan worden alle klantgegevens automatisch overgenomen.</p></div>
      <div class="card form-section"><div class="section-inline"><h3>Werkzaamheden / materiaal</h3><span class="muted small">maximaal 4 regels inclusief bonnen</span></div><div class="line-head"><span>Aantal</span><span>Omschrijving</span><span>Prijs p/st</span><span>Totaal</span></div>${lines.map((l,i)=>`<div class="invoice-line" data-line="${i}" data-expense-id="${esc(l.expenseId||'')}" data-auto-receipt-price="${l.expenseId?'1':'0'}"><input inputmode="decimal" name="qty${i}" placeholder="1" value="${esc(l.qty||'')}"><textarea rows="2" name="desc${i}" placeholder="${i===0?'Passende werkzaamheden':'Omschrijving'}">${esc(l.description||'')}</textarea><input inputmode="decimal" name="price${i}" placeholder="0,00" value="${esc(l.price||'')}"><output id="lineTotal${i}">€ 0,00</output></div>`).join('')}<div id="vatTotals"><div class="doc-total" id="subtotalRow"><span>Subtotaal excl. btw</span><strong id="subtotalTotal">€ 0,00</strong></div><div class="doc-total tax-row" id="vatRow"><span>Btw 21%</span><strong id="vatTotal">€ 0,00</strong></div><div class="doc-total"><span id="grandTotalLabel">Totaal incl. btw</span><strong id="grandTotal">€ 0,00</strong></div></div></div>
      ${isInvoice?`<div class="card form-section"><h3>Bonnetjes van deze klus</h3><p class="muted small">Selecteer bonnetjes uit Documenten → Inkoop & bonnetjes die aan de gekozen klus gekoppeld zijn. Elke bon komt op een eigen factuurregel; het originele bonbestand blijft intern bewaard.</p><div class="hours-select" id="invoiceReceiptChoices">Selecteer eerst een klus.</div><button type="button" class="secondary" id="addInvoiceReceipts" style="margin-top:10px">Voeg geselecteerde bonnetjes toe</button><p class="muted small">Er passen maximaal 4 regels op dit sjabloon. Onder KOR wordt het bonbedrag inclusief btw ingevuld; bij een gewone factuur wordt dit teruggerekend naar een prijs exclusief 21% btw. Controleer zelf de juiste doorberekening en btw.</p></div>`:''}
       ${entries.length?`<div class="card form-section"><div class="section-inline"><h3>Uren uit urenregistratie</h3><span class="muted small">optioneel</span></div><p class="muted small">Selecteer registraties van de gekozen klus. De app telt ze op en zet ze op regel 1 met een passende omschrijving voor de gekozen klus; uren en uurtarief blijven apart zichtbaar.</p><div class="hours-select">${entries.sort((a,b)=>entryDate(b).localeCompare(entryDate(a))).map(e=>`<label class="packing-row"><input type="checkbox" data-hour-entry="${e.id}"><span><strong>${nlDate(entryDate(e))}</strong> · ${esc(e.jobTitle||'Algemeen')} · ${durationHM(entryMinutes(e))} u</span></label>`).join('')}</div><div class="form-grid" style="margin-top:10px"><div class="field"><label>Uurtarief voor geselecteerde uren</label><input id="hourRate" inputmode="decimal" value="${esc(company?.defaultRate||'')}"></div><div class="field action-field"><button type="button" class="secondary" id="hoursToLine">Voeg geselecteerde uren toe</button></div></div></div>`:''}
      <div class="button-row"><button class="primary">Maak PDF</button><button type="button" class="secondary" data-close>Annuleren</button></div></form>`);

    function recalc(){let subtotal=0;for(let i=0;i<4;i++){const q=num($(`[name=qty${i}]`).value),p=num($(`[name=price${i}]`).value),t=q*p;subtotal+=t;$(`#lineTotal${i}`).textContent=money(t)}const kor=!!$('#docKor')?.checked,vat=kor?0:Math.round(subtotal*21)/100,total=Math.round((subtotal+vat)*100)/100;$('#subtotalTotal').textContent=money(subtotal);$('#vatTotal').textContent=money(vat);$('#grandTotal').textContent=money(total);$('#subtotalRow').hidden=kor;$('#vatRow').hidden=kor;$('#grandTotalLabel').textContent=kor?'Totaal te betalen':'Totaal incl. btw';return {subtotal,vat,total,kor}}
    $$('[name^=qty], [name^=price]').forEach(x=>x.addEventListener('input',recalc));const docKor=$('#docKor');if(docKor){docKor.dataset.manual=typeof prefill.korApplied==='boolean'?'1':'0';docKor.addEventListener('change',e=>{e.target.dataset.manual='1';recalc()});}recalc();
    const showInvoiceReceiptChoices=()=>{
      if(!isInvoice)return;
      const target=$('#invoiceReceiptChoices'),jid=$('#jobPick').value;
      if(!jid){target.innerHTML='<p class="muted small">Selecteer eerst een klus.</p>';return;}
      const available=expenses.filter(e=>String(e.jobId||'')===jid);
      target.innerHTML=available.length?available.map(e=>{
        const used=receiptInvoiceIsUsed(e.id,documents),invalid=num(e.amountIncl)<=0;
        return `<label class="packing-row"><input type="checkbox" data-invoice-receipt="${esc(e.id)}" ${used||invalid?'disabled':''}><span><strong>${esc(String(e.notes||e.category||'Materiaal').slice(0,80))}</strong> · ${esc(e.supplier||'Winkel')} · ${nlDate(e.date)} · ${money(e.amountIncl)}${e.receiptBlob?' · bon aanwezig':''}${used?' · <strong>Al gefactureerd</strong>':''}${invalid?' · bedrag ontbreekt':''}</span></label>`;
      }).join(''):'<p class="muted small">Geen bonnetjes bij deze klus. Koppel ze eerst via Documenten → Inkoop & bonnetjes.</p>';
    };
    if(isInvoice){
      $$('[data-line] [name^=price]').forEach(el=>el.addEventListener('input',()=>{el.closest('[data-line]').dataset.autoReceiptPrice='0';}));
      $('#docKor').addEventListener('change',()=>{
        $$('[data-line]').forEach(row=>{
          if(!row.dataset.expenseId||row.dataset.autoReceiptPrice!=='1')return;
          const receipt=expenses.find(e=>e.id===row.dataset.expenseId);
          if(receipt)row.querySelector('[name^=price]').value=moneyNumber(receiptInvoicePrice(receipt,!!$('#docKor').checked));
        });
        recalc();
      });
      $('#addInvoiceReceipts').addEventListener('click',()=>{
        const jid=$('#jobPick').value;
        if(!jid){alert('Selecteer eerst een klus.');return;}
        const selectedIds=$$('[data-invoice-receipt]:checked').map(el=>el.dataset.invoiceReceipt);
        if(!selectedIds.length){alert('Selecteer eerst een bonnetje.');return;}
        const current=$$('[data-line]').map(row=>({
          qty:row.querySelector('[name^=qty]').value,
          description:row.querySelector('[name^=desc]').value,
          price:row.querySelector('[name^=price]').value,
          expenseId:row.dataset.expenseId||''
        }));
        try{
          const selected=selectedIds.map(id=>expenses.find(e=>e.id===id));
          if(selected.some(e=>!e||String(e.jobId||'')!==jid||receiptInvoiceIsUsed(e.id,documents)))throw new Error('Selecteer alleen nog niet gefactureerde bonnetjes van deze klus.');
          const updated=addReceiptInvoiceLines(current,selected,!!$('#docKor').checked);
          const rows=$$('[data-line]');
          updated.forEach((line,i)=>{
            const row=rows[i];
            row.querySelector('[name^=qty]').value=line.qty||'';
            row.querySelector('[name^=desc]').value=line.description||'';
            row.querySelector('[name^=price]').value=line.price||'';
            row.dataset.expenseId=line.expenseId||'';
            if(selectedIds.includes(line.expenseId))row.dataset.autoReceiptPrice='1';
          });
          $$('[data-invoice-receipt]:checked').forEach(el=>el.checked=false);
          recalc();toast(selected.length+' bonnetje(s) toegevoegd als factuurregel');
        }catch(err){alert(err.message||String(err));}
      });
      showInvoiceReceiptChoices();
    }
    const fillDocClient=(c)=>{if(!c)return;$('#clientPick').value=c.id||'';$('[name=clientName]').value=c.name||'';$('[name=attention]').value=c.attention||'';$('[name=address]').value=c.street||c.address||'';$('[name=postalCity]').value=c.postalCity||[c.postal,c.city].filter(Boolean).join(' ');$('[name=phone]').value=c.phone||'';$('[name=email]').value=c.email||'';};
    $('#clientPick').addEventListener('change',e=>fillDocClient(clients.find(x=>x.id===e.target.value)));
    const desc0=$('[name=desc0]');
    if(desc0){desc0.dataset.autoDescription=String(desc0.value||'').trim()?'0':'1';desc0.addEventListener('input',e=>e.target.dataset.autoDescription='0');}
    let previousInvoiceJobId=$('#jobPick').value;
    const fillJobHours=j=>{
      if(!j)return;
      if(!isInvoice&&prefill.lines?.length&&previousInvoiceJobId===j.id)return;
      const price=JKFinance.price(j,jobMinutes(j,entries),jobRate(j,company));
      if(price.type!=='hourly'){
        $('[name=qty0]').value=price.pending?'':'1';$('[name=price0]').value=price.pending?'':String(price.base).replace('.',',');
        $('#jobHoursBasis').textContent=price.pending?'Definitief klusbedrag nog bepalen; vul het bedrag eerst in de klus of handmatig op de factuur in.':pricingLabel(j)+'; onafhankelijk van de gewerkte uren. Extra kosten '+(j.extraIncluded?'inbegrepen.':'erbovenop.');
      }else{
      const minutes=isInvoice?jobMinutes(j,entries):jobPlannedMinutes(j);
      $('[name=qty0]').value=minutes?String(Math.round(minutes/60*100)/100).replace('.',','):'';
      $('[name=price0]').value=String(jobRate(j,company)).replace('.',',');
      if($('#hourRate'))$('#hourRate').value=String(jobRate(j,company));
      $('#jobHoursBasis').textContent=isInvoice?(minutes?'Werkelijk geregistreerde uren, na aftrek van pauzes.':'Nog geen bevestigde werkelijke uren. Planning wordt niet als gewerkt ingevuld.'):'Ureninschatting op basis van de planning; geen daadwerkelijk gewerkte uren.';
      }
      const extraRow=$('[data-line="1"]');
      if(!extraRow.dataset.expenseId&&((!$('[name=qty1]').value&&!$('[name=desc1]').value&&!$('[name=price1]').value)||extraRow.dataset.autoExtra==='1')){
        const add=jobExtra(j)>0&&!(j.extraIncluded&&price.type!=='hourly');
        $('[name=qty1]').value=add?'1':'';$('[name=price1]').value=add?String(jobExtra(j)).replace('.',','):'';$('[name=desc1]').value=add?'Extra kosten / materiaal':'';extraRow.dataset.autoExtra='1';
      }
      recalc();
    };
    ['qty1','desc1','price1'].forEach(name=>$(`[name=${name}]`).addEventListener('input',()=>{$('[data-line="1"]').dataset.autoExtra='0';}));
    $('#jobPick').addEventListener('change',async e=>{
      const j=jobs.find(x=>x.id===e.target.value);
      if(isInvoice&&previousInvoiceJobId!==e.target.value){
        $$('[data-line]').forEach(row=>{
          if(!row.dataset.expenseId)return;
          row.querySelector('[name^=qty]').value='';
          row.querySelector('[name^=desc]').value='';
          row.querySelector('[name^=price]').value='';
          row.dataset.expenseId='';
          row.dataset.autoReceiptPrice='0';
        });
        recalc();
      }
      fillJobHours(j);
      previousInvoiceJobId=e.target.value;
      showInvoiceReceiptChoices();
      if(!j)return;let c=j.clientId?clients.find(x=>x.id===j.clientId):null;if(!c)c={id:j.clientId||'',name:j.clientName||'',attention:j.attention||'',street:j.street||j.address||'',postal:j.postal||'',city:j.city||'',phone:j.phone||'',email:j.email||''};fillDocClient(c);if(j.date)$('[name=workDate]').value=isInvoice?nlDate(j.date):j.date;const description=businessDescriptionForJob(j,kind,documents,checklists,categories);if(desc0&&(!desc0.value.trim()||desc0.dataset.autoDescription==='1'||/^Werkuren$/i.test(desc0.value.trim()))){desc0.value=description;desc0.dataset.autoDescription='1';}if(!isInvoice){const ev=new Event('change');$('[name=workDate]').dispatchEvent(ev);}});
    if(prefill.clientId)$('#clientPick').dispatchEvent(new Event('change'));
    if(prefillJob){if(desc0&&!String(prefill.lines?.[0]?.description||'').trim())desc0.dataset.autoDescription='1';$('#jobPick').dispatchEvent(new Event('change'));}
    if(isInvoice){
      const syncInvoiceDeadline=()=>{const issue=$('[name=docDate]').value||docDate,el=$('[name=deadline]');if(!el.value||el.dataset.auto!=='0')el.value=addDays(issue,14);el.dataset.auto=el.dataset.auto||'1';};
      $('[name=docDate]').addEventListener('change',()=>{syncInvoiceDeadline();if(docKor&&docKor.dataset.manual!=='1'){const d=$('[name=docDate]').value;docKor.checked=!!(company?.kor&&(!company?.korSince||d>=company.korSince));recalc();}});
      $('[name=deadline]').addEventListener('input',e=>e.target.dataset.auto='0');
      $('[name=deadline]').dataset.auto='1';
      syncInvoiceDeadline();
    }else{
      const syncQuoteDeadline=()=>{const max=maxQuoteDeadline(),el=$('[name=deadline]');el.max=max;if(!el.value||el.value>max)el.value=max;else if(el.dataset.auto==='1')el.value=max;el.dataset.auto='1';};
      $('[name=docDate]').addEventListener('change',()=>{syncQuoteDeadline();if(docKor&&docKor.dataset.manual!=='1'){const d=$('[name=docDate]').value;docKor.checked=!!(company?.kor&&(!company?.korSince||d>=company.korSince));recalc();}});$('[name=workDate]').addEventListener('change',syncQuoteDeadline);$('[name=deadline]').addEventListener('input',e=>e.target.dataset.auto='0');syncQuoteDeadline();
    }
    $('#calendarBusinessJob')?.addEventListener('click',()=>{const j=jobs.find(x=>x.id===$('#jobPick').value);if(!j){alert('Selecteer eerst een klus.');return;}openGoogleCalendarForJob(j,{kind,number:document.querySelector('[name=number]')?.value||''});});
    $('#hoursToLine')?.addEventListener('click',()=>{const ids=$$('[data-hour-entry]:checked').map(x=>x.dataset.hourEntry);if(!ids.length){alert('Selecteer eerst één of meer urenregistraties.');return}const jobId=$('#jobPick').value;let selected=entries.filter(e=>ids.includes(e.id));if(jobId){const matching=selected.filter(e=>!e.jobId||e.jobId===jobId);if(matching.length!==selected.length){alert('Selecteer alleen urenregistraties die bij de gekozen klus horen.');return;}selected=matching;}const minutes=selected.reduce((s,e)=>s+entryMinutes(e),0),hours=Math.round(minutes/60*100)/100,rate=num($('#hourRate').value);const idx=0,dates=[...new Set(selected.map(entryDate))].sort(),job=jobs.find(j=>j.id===jobId),description=businessDescriptionForJob(job,kind,documents,checklists,categories);$(`[name=qty${idx}]`).value=String(hours).replace('.',',');const desc=$(`[name=desc${idx}]`);if(desc&&(!desc.value.trim()||desc.dataset.autoDescription==='1'||/^Werkuren$/i.test(desc.value.trim()))){desc.value=description;desc.dataset.autoDescription='1';}$(`[name=price${idx}]`).value=rate?String(rate).replace('.',','):'';if(!$('[name=workDate]').value&&dates.length)$('[name=workDate]').value=dates.length===1?nlDate(dates[0]):`${nlDate(dates[0])} t/m ${nlDate(dates.at(-1))}`;recalc();toast('Geregistreerde uren met passende omschrijving op regel 1 gezet');});
    $('#businessDocForm').addEventListener('submit',async e=>{e.preventDefault();const selectedJob=jobs.find(x=>x.id===$('#jobPick').value);if(!selectedJob){alert('Selecteer eerst een klus.');return;}const f=new FormData(e.target),items=[];for(let i=0;i<4;i++){
        const receiptId=$(`[data-line="${i}"]`)?.dataset.expenseId||'';
        if(receiptId){
          const receipt=expenses.find(x=>x.id===receiptId);
          if(!isInvoice||!receipt||String(receipt.jobId||'')!==selectedJob.id||receiptInvoiceIsUsed(receiptId,documents)){alert('Een bonnetje behoort niet bij deze klus of is al gefactureerd.');return;}
        }
        items.push({qty:f.get(`qty${i}`),description:f.get(`desc${i}`),price:f.get(`price${i}`),...(receiptId?{expenseId:receiptId}:{})});
      }let chosenDeadline=f.get('deadline');if(isInvoice){if(!chosenDeadline)chosenDeadline=addDays(f.get('docDate'),14);}else{const max=maxQuoteDeadline();if(!chosenDeadline||chosenDeadline>max)chosenDeadline=max;}const totals=recalc(),korApplied=totals.kor;const finalItems=items.map(l=>({...l,vatRate:korApplied?0:21}));const data={kind,number:f.get('number'),docDate:f.get('docDate'),workDate:f.get('workDate'),deadline:chosenDeadline,jobId:$('#jobPick').value,clientId:$('#clientPick').value,client:{name:f.get('clientName'),attention:f.get('attention'),address:f.get('address'),postalCity:f.get('postalCity'),phone:f.get('phone'),email:f.get('email')},lines:finalItems,korApplied,vatRate:korApplied?0:21,subtotalExVat:totals.subtotal,vatAmount:totals.vat,total:totals.total};try{const d=await generateBusinessPdf(data);closeModal();toast(kind+' opgeslagen');state.docFolder=isInvoice?'factuur':'offerte';await showDocument(d.id);if(state.route==='documents')renderDocuments();}catch(err){console.error(err);alert('PDF maken mislukt: '+err.message)}});
  }
  function setPdfText(form,name,value){try{const f=form.getTextField(name);f.setText(String(value??''));f.setFontSize(12);return true}catch(e){console.warn('PDF field',name,e.message);return false}}
  function setPdfTextAny(form,names,value){for(const name of names){try{const f=form.getTextField(name);f.setText(String(value??''));f.setFontSize(12);return true}catch(e){}}console.warn('PDF fields ontbreken',names);return false}
  function drawRightText(page,font,text,xRight,y,size=12){const safe=String(text??'');page.drawText(safe,{x:xRight-font.widthOfTextAtSize(safe,size),y,size,font});}
  function descriptionTokens(text){
    const protectedParts=[];
    const safe=String(text??'').replace(/\b\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\b/g,m=>{const key=`__TIME_${protectedParts.length}__`;protectedParts.push(m.replace(/\s*[-–]\s*/,' - '));return key;});
    return safe.trim().split(/\s+/).filter(Boolean).map(t=>{const m=t.match(/^__TIME_(\d+)__$/);return m?protectedParts[Number(m[1])]:t;});
  }
  function descriptionLayout(font,text,maxWidth){
    const clean=String(text??'').replace(/\s+/g,' ').trim();
    if(!clean)return {lines:[],size:12,lineHeight:0};
    // Een korte omschrijving blijft op 12 pt. Bij een langere omschrijving zoeken we
    // de beste verdeling over twee regels en houden we 12 pt aan zodra beide regels passen.
    if(font.widthOfTextAtSize(clean,12)<=maxWidth)return {lines:[clean],size:12,lineHeight:0};
    const tokens=descriptionTokens(clean);
    if(tokens.length<2){
      const unit=font.widthOfTextAtSize(clean,1)||1;
      const size=Math.max(8,Math.min(12,maxWidth/unit));
      return {lines:[clean],size,lineHeight:0};
    }
    let best=null;
    for(let i=1;i<tokens.length;i++){
      const a=tokens.slice(0,i).join(' '),b=tokens.slice(i).join(' ');
      const unit=Math.max(font.widthOfTextAtSize(a,1),font.widthOfTextAtSize(b,1),1);
      const size=Math.min(12,maxWidth/unit);
      const balance=Math.abs(font.widthOfTextAtSize(a,size)-font.widthOfTextAtSize(b,size));
      // Eerst zoveel mogelijk lettergrootte, daarna de meest evenwichtige regelverdeling.
      if(!best||size>best.size+0.01||(Math.abs(size-best.size)<0.01&&balance<best.balance))best={lines:[a,b],size,balance};
    }
    best.size=Math.max(8,best.size);
    // Bij 12 pt gebruiken twee regels vrijwel de volledige rijhoogte zonder de lijnen te raken.
    best.lineHeight=Math.min(13.2,Math.max(10,best.size*1.1));
    return best;
  }
  function drawDescriptionCell(page,font,text,x,yCenter,maxWidth){
    const layout=descriptionLayout(font,text,maxWidth);if(!layout.lines.length)return;
    // PDF-tekst lijkt optisch snel te hoog te staan in deze tabelcellen.
    // Daarom verschuiven we de baselines iets verder omlaag voor een rustiger,
    // visueel beter gecentreerd resultaat binnen de rij.
    const verticalOffset=layout.size*0.48;
    if(layout.lines.length===1){
      page.drawText(layout.lines[0],{x,y:yCenter-verticalOffset,size:layout.size,font});
      return;
    }
    const h=layout.lineHeight||layout.size;
    page.drawText(layout.lines[0],{x,y:yCenter+(h/2)-verticalOffset,size:layout.size,font});
    page.drawText(layout.lines[1],{x,y:yCenter-(h/2)-verticalOffset,size:layout.size,font});
  }
  function drawBusinessDescriptions(page,font,lines,{x,maxWidth,rows=[397,365,332,299]}){
    for(let i=0;i<4;i++){const desc=String(lines[i]?.description||'').trim();if(desc)drawDescriptionCell(page,font,desc,x,rows[i],maxWidth);}
  }
  function drawNormalInvoiceLines(page,font,lines){
    const rows=[397,365,332,299];
    for(let i=0;i<4;i++){
      const l=lines[i]||{},q=String(l.qty||''),desc=String(l.description||''),p=num(l.price),used=!!(q||desc||l.price),t=num(l.qty)*p;if(!used)continue;
      page.drawText(q,{x:48,y:rows[i],size:12,font});
      drawRightText(page,font,moneyNumber(p),396,rows[i],12);
      drawRightText(page,font,moneyNumber(t),487,rows[i],12);
      drawRightText(page,font,'21%',544,rows[i],12);
    }
    drawBusinessDescriptions(page,font,lines,{x:100,maxWidth:218,rows});
  }
  async function generateBusinessPdf(data){
    await ensurePdfLib();
    const isInvoice=data.kind==='Factuur',korApplied=!!data.korApplied;
    const path=isInvoice?(korApplied?'templates/factuur-kor.pdf':'templates/factuur-normaal.pdf'):(korApplied?'templates/offerte-kor.pdf':'templates/offerte-normaal.pdf');
    const res=await fetch(path);if(!res.ok)throw new Error('PDF-sjabloon niet gevonden.');
    const pdf=await PDFLib.PDFDocument.load(await res.arrayBuffer()),form=pdf.getForm(),helvetica=await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    setPdfTextAny(form,[isInvoice?'Factuurnummer':'Offertenummer'],data.number);
    setPdfTextAny(form,isInvoice?['Factuurdatum']:korApplied?['Datum']:['Datum vandaag','Datum'],nlDate(data.docDate));
    setPdfTextAny(form,isInvoice?(korApplied?['Datum werkzaamheden']:['Datum werkzaamheden 1','Datum werkzaamheden']):['Werkzaamheden op'],isInvoice?(data.workDate||''):nlDate(data.workDate));
    setPdfTextAny(form,[isInvoice?'Vervaldatum':'Geldig t/m'],nlDate(data.deadline));
    setPdfTextAny(form,['Naam/bedrijf'],data.client.name);
    setPdfTextAny(form,korApplied?['T.a.v','T.A.V']:isInvoice?['T.A.V','T.a.v']:['T.a.v','T.A.V'],data.client.attention);
    setPdfTextAny(form,['Adres'],data.client.address);setPdfTextAny(form,['Postcode/Plaats'],data.client.postalCity);
    let subtotal=0;
    for(let i=0;i<4;i++){
      const l=data.lines[i]||{},q=num(l.qty),p=num(l.price),t=q*p;subtotal+=t;
      if(korApplied||!isInvoice){
        setPdfText(form,`Aantal ${i+1}`,l.qty||'');setPdfText(form,`Omschrijving ${i+1}`,'');setPdfText(form,`Prijs ${i+1}`,l.price?moneyNumber(p):'');setPdfText(form,`Totaal ${i+1}`,(l.qty||l.description||l.price)?moneyNumber(t):'');
        if(!korApplied)setPdfText(form,`BTW ${i+1}`,(l.qty||l.description||l.price)?'21%':'');
      }
    }
    const vat=korApplied?0:Math.round(subtotal*21)/100,total=Math.round((subtotal+vat)*100)/100;
    if(korApplied){setPdfText(form,'Totaal te betalen EUR',moneyNumber(total));}
    else{setPdfText(form,'Subtotaal excl btw EUR',moneyNumber(subtotal));setPdfText(form,'Btw bedrag EUR',moneyNumber(vat));setPdfTextAny(form,isInvoice?['Totaal te betalen EUR']:['Totaal incl btw EUR','Totaal te betalen EUR'],moneyNumber(total));}
    try{form.updateFieldAppearances(helvetica);form.flatten();}catch(e){console.warn('Flatten',e)}
    const page=pdf.getPages()[0];
    if(!korApplied&&isInvoice)drawNormalInvoiceLines(page,helvetica,data.lines);
    else if(korApplied)drawBusinessDescriptions(page,helvetica,data.lines,{x:107,maxWidth:244});
    else drawBusinessDescriptions(page,helvetica,data.lines,{x:102,maxWidth:216});
    if(isInvoice)await freezeLegacyPayments(await refreshFinance(),data.jobId);
    const bytes=await pdf.save(),blob=new Blob([bytes],{type:'application/pdf'}),filename=`${data.number}.pdf`,folder=isInvoice?'factuur':'offerte',doc={id:JKDB.id('doc'),filename,kind:data.kind,folder,blob,createdAt:new Date().toISOString(),meta:{...data,subtotalExVat:subtotal,vatAmount:vat,total,korApplied,korDetected:korApplied,lines:data.lines,sent:false,paid:false,confirmed:false}};await JKDB.put('documents',doc);if(isInvoice)await syncJobPaymentForInvoice(data.jobId);return doc;
  }
  function moneyNumber(v){return Number(v||0).toFixed(2).replace('.',',')}
  async function showDocument(id){
    await refreshFinance();
    const [d,jobs]=await Promise.all([JKDB.get('documents',id),JKDB.all('jobs')]);if(!d){toast('Document niet gevonden');return;}const folder=docFolder(d),m=d.meta||{},linkedId=linkedInvoiceJobId(d),linkedJob=jobs.find(j=>j.id===linkedId)||null;
    const statusBox=folder==='factuur'?`<div class="card" style="margin-top:12px"><h3>Status factuur</h3><label class="checkline"><input type="checkbox" id="docSent" ${m.sent?'checked':''}><span>Verstuurd</span></label><p>Ontvangen ${money(state.finance.document(d).received)} · Openstaand ${money(state.finance.document(d).open)}</p><button class="primary" type="button" id="documentPayments">Betalingen bekijken / registreren</button></div>`:folder==='offerte'?`<div class="card" style="margin-top:12px"><h3>Status offerte</h3><label class="checkline"><input type="checkbox" id="docSent" ${m.sent?'checked':''}><span>Verstuurd</span></label><label class="checkline"><input type="checkbox" id="docConfirmed" ${m.confirmed?'checked':''}><span>Bevestigd</span></label></div>`:'';
    const jobLinkBox=folder==='factuur'? `<div class="card" style="margin-top:12px"><h3>Gekoppelde klus</h3><div class="field"><label for="docJobPick">Kies bij welke klus deze factuur hoort</label><select id="docJobPick"><option value="">Geen klus gekoppeld</option>${[...jobs].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(j=>`<option value="${esc(j.id)}" ${j.id===linkedId?'selected':''}>${esc(j.title||'Klus')} · ${esc(j.clientName||'Geen klant')} · ${esc(nlDate(j.date)||'geen datum')}</option>`).join('')}</select></div><button class="secondary" id="saveDocJobLink" type="button">Koppeling opslaan</button><p class="muted small">${!linkedId?'Deze factuur is nog niet aan een klus gekoppeld. Betalingen worden pas gesynchroniseerd nadat je de juiste klus hebt gekozen.':linkedJob?'Betaalstatus van deze factuur en deze klus worden in beide richtingen bijgewerkt.':'De eerder gekoppelde klus bestaat niet meer; selecteer een geldige klus.'}</p></div>`:'';
    const overdue=folder==='factuur'&&m.sent&&state.finance.document(d).open>0&&String(m.deadline||'').slice(0,10)&&String(m.deadline).slice(0,10)<today();
    const reminderBox=overdue?`<div class="warning important-warning" style="margin-top:12px"><strong>Factuur is over de vervaldatum</strong><br><span class="small">Vervaldatum ${nlDate(String(m.deadline).slice(0,10))}. Maak desgewenst direct een betaalherinnering.</span><div style="margin-top:10px"><button class="secondary" id="makePaymentReminder">Maak betaalherinnering</button></div></div>`:'';
    const importedDataCard=(['factuur','offerte'].includes(folder)&&m.manualImport)?`<div class="card" style="margin-top:12px"><h3>Uitgelezen documentgegevens</h3>${m.pdfParseError?`<div class="warning important-warning small">${esc(m.pdfParseError)}</div>`:''}<div class="form-grid"><div class="field"><label>${folder==='factuur'?'Factuurnummer':'Offertenummer'}</label><input id="parsedDocNumber" value="${esc(m.number||'')}"></div><div class="field"><label>${folder==='factuur'?'Factuurdatum':'Offertedatum'}</label><input id="parsedDocDate" type="date" value="${esc(m.docDate||'')}"></div><div class="field"><label>Klant</label><input id="parsedClientName" value="${esc(m.client?.name||'')}"></div><div class="field"><label>Totaalbedrag</label><input id="parsedTotal" inputmode="decimal" value="${m.total!=null?esc(String(m.total).replace('.',',')):''}"></div></div><label class="checkline"><input type="checkbox" id="parsedKor" ${(m.korApplied===true||m.korDetected)?'checked':''}><span>KOR / vrijgesteld van btw staat op dit document</span></label><div class="button-row"><button class="secondary" id="saveParsedDoc">Gegevens opslaan</button><button class="ghost" id="reparseDoc">PDF opnieuw uitlezen</button></div><p class="muted small">Deze gegevens worden gebruikt voor het jaaroverzicht. Je kunt ze corrigeren als een afwijkend PDF-sjabloon niet perfect wordt herkend.</p></div>`:'';
    modal(`${modalHead(d.filename)}<div class="card"><div class="document-card"><div class="doc-icon">PDF</div><div><h3>${esc(d.filename)}</h3><div class="muted small">${esc(d.kind||'PDF')} · ${fmtDateTime(d.createdAt)}</div>${d.meta?.total!=null?`<div class="big-number" style="margin-top:8px">${money(d.meta.total)}</div>`:''}</div></div><div class="button-row" style="margin-top:14px"><button class="primary" id="previewDoc">Bekijk PDF</button><button class="secondary" id="shareDoc">Delen / bewaar in iCloud</button><button class="secondary" id="downloadDoc">Download</button>${folder==='offerte'||folder==='factuur'?'<button class="secondary" id="calendarDoc">📅 Google Agenda</button>':''}</div><div id="pdfPreviewHost" class="pdf-preview-host" hidden></div>${folder==='offerte'&&d.meta?.lines?`<button class="secondary" id="quoteToInvoice" style="width:100%;margin-top:10px">Zet offerte om naar factuur</button>`:''}</div>${importedDataCard}${statusBox}${jobLinkBox}${reminderBox}<div class="card" style="margin-top:12px"><h3>Documentnaam</h3><div class="field"><label>Bestandsnaam</label><input id="docFilename" value="${esc(d.filename)}"></div><button class="secondary" id="renameDoc" style="width:100%">Naam opslaan</button></div><div class="card" style="margin-top:12px"><h3>Map</h3><div class="field"><label>Verplaats document naar</label><select id="moveDocFolder"><option value="offerte" ${folder==='offerte'?'selected':''}>Offertes</option><option value="factuur" ${folder==='factuur'?'selected':''}>Facturen</option><option value="diversen" ${folder==='diversen'?'selected':''}>Diversen</option></select></div></div><button class="danger-btn" id="delDoc" style="width:100%">Uit app verwijderen</button>`);
    $('#documentPayments')?.addEventListener('click',()=>showPayments(linkedId,d.id));
    $('#previewDoc').addEventListener('click',()=>{const host=$('#pdfPreviewHost');if(!host)return;if(!host.hidden){host.hidden=true;host.innerHTML='';if(state.activeBlobUrl){URL.revokeObjectURL(state.activeBlobUrl);state.activeBlobUrl=null;}$('#previewDoc').textContent='Bekijk PDF';return;}if(!(d.blob instanceof Blob)){alert('Dit PDF-bestand is nog niet lokaal beschikbaar. Synchroniseer opnieuw en probeer het nog eens.');return;}state.activeBlobUrl=URL.createObjectURL(d.blob);host.innerHTML=`<iframe class="pdf-preview-frame" src="${state.activeBlobUrl}#toolbar=0&navpanes=0" title="Voorbeeld ${esc(d.filename)}"></iframe>`;host.hidden=false;$('#previewDoc').textContent='Sluit voorbeeld';});
    $('#shareDoc').addEventListener('click',()=>shareBlob(d.blob,d.filename));$('#downloadDoc').addEventListener('click',()=>downloadBlob(d.blob,d.filename));$('#calendarDoc')?.addEventListener('click',async()=>{let job=linkedJob;if(!job){const jobs=await JKDB.all('jobs');const work=String(m.workDate||'');const clientName=normGearName(m.client?.name||'');job=jobs.find(j=>(!work||j.date===work||nlDate(j.date)===work)&&(!clientName||normGearName(j.clientName)===clientName));}if(!job){alert('Dit document is niet aan een klus gekoppeld. Open de offerte/factuur vanuit een klus om een agenda-afspraak te maken.');return;}openGoogleCalendarForJob(job,{kind:d.kind||folder,number:m.number||d.filename.replace(/\.pdf$/i,'')});});$('#quoteToInvoice')?.addEventListener('click',()=>{const meta=d.meta;closeModal();createBusinessDoc('Factuur',{jobId:meta.jobId,clientId:meta.clientId,client:meta.client,lines:meta.lines,workDate:meta.workDate,korApplied:meta.korApplied})});$('#makePaymentReminder')?.addEventListener('click',()=>showPaymentReminder(d));
    $('#saveParsedDoc')?.addEventListener('click',async()=>{
      d.meta=d.meta||{};d.meta.number=$('#parsedDocNumber').value.trim();d.meta.docDate=$('#parsedDocDate').value;d.meta.client={...(d.meta.client||{}),name:$('#parsedClientName').value.trim()};const raw=$('#parsedTotal').value.trim();d.meta.total=raw?num(raw):null;d.meta.korDetected=$('#parsedKor').checked;d.meta.korApplied=$('#parsedKor').checked;d.meta.businessVerified=true;d.meta.pdfParseError='';await JKDB.put('documents',d);toast('Documentgegevens opgeslagen');
    });
    $('#reparseDoc')?.addEventListener('click',async()=>{const btn=$('#reparseDoc');btn.disabled=true;btn.textContent='PDF uitlezen...';const company=await JKDB.get('settings','company');await parseStoredBusinessDocument(d,company,true);closeModal();toast(d.meta?.businessVerified?'PDF opnieuw uitgelezen':'PDF uitgelezen - controleer de gegevens');showDocument(d.id);});
    $('#saveDocJobLink')?.addEventListener('click',async()=>{
      const btn=$('#saveDocJobLink');btn.disabled=true;
      try{
        const changed=await setInvoiceJobLink(d,$('#docJobPick').value);
        closeModal();
        if(state.route==='documents')await renderDocuments();
        await showDocument(d.id);
        toast(changed?'Factuur aan klus gekoppeld; betaalstatus bijgewerkt':'Koppeling ongewijzigd');
      }catch(err){console.error('Factuur koppelen mislukt',err);alert('Koppeling niet volledig bijgewerkt: '+(err.message||err));btn.disabled=false;}
    });
    const saveStatus=async()=>{
      d.meta=d.meta||{};
      if($('#docSent'))d.meta.sent=$('#docSent').checked;
      if($('#docConfirmed'))d.meta.confirmed=$('#docConfirmed').checked;
      try{
        await JKDB.put('documents',d);
        toast('Status opgeslagen');
        if(state.route==='documents')renderDocuments();
        refreshActionBadges(false).catch(()=>{});
      }catch(err){
        console.error('Status document / gekoppelde klus niet volledig bijgewerkt',err);
        alert('Betaalstatus niet volledig bijgewerkt. Controleer de factuur en de gekoppelde klus. '+(err.message||err));
      }
    };
    $('#docSent')?.addEventListener('change',saveStatus);$('#docConfirmed')?.addEventListener('change',saveStatus);
    $('#renameDoc').addEventListener('click',async()=>{
      let name=String($('#docFilename').value||'').trim();
      if(!name){alert('Vul een documentnaam in.');return;}
      // Documenten in deze app zijn PDF's. Voeg de extensie automatisch toe.
      if(!name.toLowerCase().endsWith('.pdf')) name += '.pdf';
      d.filename=name;
      await JKDB.put('documents',d);
      toast('Documentnaam aangepast');
      closeModal();
      if(state.route==='documents') renderDocuments();
      await showDocument(id);
    });
    $('#moveDocFolder').addEventListener('change',async e=>{const target=e.target.value;if(folder==='factuur')await freezeLegacyPayments(await refreshFinance(),linkedInvoiceJobId(d),d.id);d.folder=target;d.kind=target==='offerte'?'Offerte':target==='factuur'?'Factuur':'Diversen';d.meta=d.meta||{};if(target!=='factuur')d.meta.paid=false;if(target!=='offerte')d.meta.confirmed=false;await JKDB.put('documents',d);if(folder==='factuur'||target==='factuur')await syncJobPaymentForInvoice(linkedInvoiceJobId(d));toast('Document verplaatst');closeModal();state.docFolder=target;if(state.route==='documents')renderDocuments();});
    $('#delDoc').addEventListener('click',async()=>{if(confirm('Deze PDF uit de app verwijderen?')){await freezeLegacyPayments(await refreshFinance(),linkedInvoiceJobId(d),d.id);await JKDB.remove('documents',id);if(folder==='factuur')await syncJobPaymentForInvoice(linkedInvoiceJobId(d));closeModal();if(state.route==='documents')renderDocuments();}});
  }
  function showPaymentReminder(d){
    const m=d.meta||{},client=m.client||{},number=m.number||d.filename.replace(/\.pdf$/i,''),deadline=nlDate(String(m.deadline||'').slice(0,10)),amount=state.finance?money(state.finance.document(d).open):(m.total!=null?money(m.total):''),name=client.name||'klant';
    const message=`Beste ${name},\n\nVolgens mijn administratie staat factuur ${number}${amount?` met een openstaand bedrag van ${amount}`:''} nog open. De vervaldatum was ${deadline||'inmiddels verstreken'}. Zou je willen controleren of de betaling nog kan worden voldaan?\n\nAlvast bedankt.\n\nMet vriendelijke groet,\nJeremy Korstanje\nJK Works Dordrecht`;
    modal(`${modalHead('Betaalherinnering')}<div class="card"><p class="muted small">Controleer de tekst en verstuur hem via WhatsApp of e-mail. De app verstuurt niets automatisch.</p><textarea id="reminderText" style="min-height:260px">${esc(message)}</textarea><div class="button-row" style="margin-top:12px"><button class="primary" id="copyReminder">Kopieer tekst</button>${client.phone?'<button class="secondary" id="waReminder">WhatsApp</button>':''}${client.email?'<button class="secondary" id="mailReminder">E-mail</button>':''}</div></div>`);
    $('#copyReminder').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#reminderText').value);toast('Herinnering gekopieerd')}catch{alert('Kopiëren lukte niet. Selecteer de tekst handmatig.')}});
    $('#waReminder')?.addEventListener('click',()=>{const tel=String(client.phone||'').replace(/\D/g,'').replace(/^0/,'31');window.open(`https://wa.me/${tel}?text=${encodeURIComponent($('#reminderText').value)}`,'_blank','noopener,noreferrer')});
    $('#mailReminder')?.addEventListener('click',()=>{location.href=`mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent('Betaalherinnering '+number)}&body=${encodeURIComponent($('#reminderText').value)}`});
  }

  async function shareBlob(blob,filename){const file=new File([blob],filename,{type:blob.type||'application/pdf'});try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({files:[file]});return}}catch(e){if(e.name==='AbortError')return}downloadBlob(blob,filename)}
  function downloadBlob(blob,filename){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();const u=a.href;a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}

  async function renderMore(){
    title('Meer');const [clients,entries,company,backup,cloudStatus,requests]=await Promise.all([JKDB.all('clients'),JKDB.all('timeEntries'),JKDB.get('settings','company'),JKDB.get('settings','backup'),JKDB.get('settings','cloudStatus'),getWebsiteRequestsSafe()]);const cs=JKCloud.status(),openRequests=requests.filter(r=>r.status==='new'||r.status==='contact').length;
    $('#view').innerHTML=`<div class="list"><div class="list-item clickable" id="cloudMenu"><div class="main"><div class="title">☁️ Synchronisatie</div><div class="sub">${cs.signedIn?(cs.email+' · '+(cloudStatus?.lastSync?'laatst '+fmtDateTime(cloudStatus.lastSync):'nog niet gesynchroniseerd')):'Niet ingelogd'}</div></div><span>›</span></div><div class="list-item clickable" id="notificationMenu"><div class="main"><div class="title">🔔 Meldingen</div><div class="sub">Acties, badges en meldingen per categorie</div></div><span>›</span></div><div class="list-item clickable" id="timeMenu"><div class="main"><div class="title">🕒 Urenregistratie</div><div class="sub">${entries.length} registraties · handmatig van-tot</div></div><span>›</span></div><div class="list-item clickable" id="timeStatsMenu"><div class="main"><div class="title">📊 Statistieken</div><div class="sub">Ontvangen, afspraken en uren per periode of klant</div></div><span>›</span></div><div class="list-item clickable" id="clientMenu"><div class="main"><div class="title">👥 Klanten</div><div class="sub">${clients.length} klanten</div></div><span>›</span></div><div class="list-item clickable" id="workCategoriesMenu"><div class="main"><div class="title">🧰 Werkzaamhedencategorieën</div><div class="sub">Automatische omschrijvingen en trefwoorden beheren</div></div><span>›</span></div><div class="list-item clickable" id="companyMenu"><div class="main"><div class="title">🏢 Bedrijfsgegevens</div><div class="sub">${esc(company?.companyName||'JK Works Dordrecht')}</div></div><span>›</span></div><div class="list-item clickable" id="websiteRequestsMenu"><div class="main"><div class="title">📥 Website-aanvragen</div><div class="sub">${openRequests} open aanvraag${openRequests===1?'':'en'}</div></div><span>›</span></div><div class="list-item clickable" id="websiteMenu"><div class="main"><div class="title">🌐 Website beheren</div><div class="sub">Teksten van jkworks.nl aanpassen en direct publiceren</div></div><span>›</span></div><div class="list-item clickable" id="backupMenu"><div class="main"><div class="title">💾 Back-up en herstellen</div><div class="sub">${backup?.lastBackup?'Laatst '+fmtDateTime(backup.lastBackup):'Nog geen back-up'}</div></div><span>›</span></div></div>`;
    $('#cloudMenu').addEventListener('click',showCloud);$('#notificationMenu').addEventListener('click',showNotificationSettings);$('#timeMenu').addEventListener('click',showTimeEntries);$('#timeStatsMenu').addEventListener('click',showTimeStats);$('#clientMenu').addEventListener('click',showClients);$('#companyMenu').addEventListener('click',showCompany);$('#workCategoriesMenu').addEventListener('click',showWorkCategories);$('#websiteRequestsMenu').addEventListener('click',showWebsiteRequests);$('#websiteMenu').addEventListener('click',()=>window.JKWebsiteEditor.open());$('#backupMenu').addEventListener('click',showBackup);
  }

  function showCloud(){
    const cs=JKCloud.status();
    if(cs.signedIn){
      modal(`${modalHead('Synchronisatie')}<div class="card"><h3>Ingelogd</h3><p class="small"><strong>${esc(cs.email)}</strong></p><p class="muted small">Wijzigingen worden eerst alleen op dit apparaat opgeslagen. Er is geen automatische achtergrond-sync meer. Druk bovenin op Sync wanneer je klaar bent; dan worden je wijzigingen naar Supabase gestuurd en wijzigingen van je andere apparaten opgehaald. <strong>Klusfoto’s gaan gecomprimeerd mee</strong> naar Supabase, zodat ze op meerdere apparaten beschikbaar zijn.</p><div class="button-row"><button class="primary" id="syncNow">Nu synchroniseren</button><button class="secondary" id="cloudLogout">Uitloggen</button></div></div><div class="card"><h3>Cloud opschonen</h3><p class="muted small">Gebruik dit alleen op een apparaat waarop Klussen, Uren en Documenten nu correct zijn. Klusfoto’s synchroniseren ook via Supabase. Cloudopschoning hieronder beperkt zich nog steeds tot Klussen, Uren en Documenten. Oude cloudrecords die op dit apparaat niet meer bestaan worden dan definitief verwijderd, zodat een nieuw apparaat ze niet meer terughaalt.</p><button class="danger-btn" id="pruneCloud" style="width:100%">Maak dit apparaat leidend voor Klussen, Uren en Documenten</button></div>`);
      $('#syncNow').addEventListener('click',async()=>{closeModal();await manualSync();});
      $('#pruneCloud').addEventListener('click',async()=>{
        const ok=confirm('LET OP: gebruik dit alleen op een apparaat waarop Klussen, Urenregistraties, Foto’s en Documenten compleet en correct zijn. Oude cloudgegevens die hier niet meer staan worden definitief verwijderd. Doorgaan?');
        if(!ok)return;
        try{
          const r=await JKCloud.pruneCloudToLocal(['documents','timeEntries','jobs']);
          alert(`${r.removed} oude cloudrecord${r.removed===1?'':'s'} verwijderd. Nieuwe apparaten zullen deze niet meer terughalen.`);
          closeModal(); render();
        }catch(e){alert('Cloud opschonen mislukt: '+e.message)}
      });
      $('#cloudLogout').addEventListener('click',async()=>{await JKCloud.signOut();closeModal();toast('Uitgelogd');});
    } else {
      modal(`${modalHead('Synchronisatie')}<div class="card"><h3>Inloggen</h3><p class="muted small">Gebruik op je iPhone en MacBook hetzelfde e-mailadres en wachtwoord.</p><form id="cloudForm"><div class="field"><label>E-mail</label><input type="email" name="email" required autocomplete="email"></div><div class="field"><label>Wachtwoord</label><input type="password" name="password" required minlength="6" autocomplete="current-password"></div><div class="button-row"><button class="primary" name="action" value="signin">Inloggen</button><button class="secondary" name="action" value="signup">Account maken</button></div></form></div>`);
      $('#cloudForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),action=e.submitter?.value||'signin';try{if(action==='signup'){const r=await JKCloud.signUp(f.get('email'),f.get('password'));if(!r.session){alert('Account gemaakt. Controleer je e-mail voor de bevestigingslink en log daarna in.');return;}}else await JKCloud.signIn(f.get('email'),f.get('password'));closeModal();toast('Cloud gekoppeld');render();}catch(err){alert((action==='signup'?'Account maken':'Inloggen')+' mislukt: '+err.message)}});
    }
  }


  function hoursNumber(minutes){return Math.round((minutes/60)*100)/100}
  function hoursLabel(minutes){const h=hoursNumber(minutes);return h.toLocaleString('nl-NL',{minimumFractionDigits:h%1?1:0,maximumFractionDigits:2})+' u'}
  function monthName(i){return ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][i]}
  function isoWeekInfo(dateValue){
    const d=new Date(String(dateValue||'')+'T12:00:00');
    if(Number.isNaN(d.getTime()))return null;
    const utc=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    const day=utc.getUTCDay()||7;
    utc.setUTCDate(utc.getUTCDate()+4-day);
    const isoYear=utc.getUTCFullYear();
    const yearStart=new Date(Date.UTC(isoYear,0,1));
    const week=Math.ceil((((utc-yearStart)/86400000)+1)/7);
    return {year:isoYear,week,key:`${isoYear}-W${String(week).padStart(2,'0')}`,label:`Week ${week} '${String(isoYear).slice(-2)}`};
  }
  function statPeriodInfo(dateValue,mode){
    const d=new Date(String(dateValue||'')+'T12:00:00');
    if(Number.isNaN(d.getTime()))return null;
    if(mode==='week'){
      const w=isoWeekInfo(dateValue);return w?{key:w.key,label:w.label,sort:w.key}:null;
    }
    if(mode==='month'){
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      return {key,label:`${monthName(d.getMonth())} '${String(d.getFullYear()).slice(-2)}`,sort:key};
    }
    if(mode==='quarter'){
      const q=Math.floor(d.getMonth()/3)+1,key=`${d.getFullYear()}-Q${q}`;
      return {key,label:`Q${q} '${String(d.getFullYear()).slice(-2)}`,sort:`${d.getFullYear()}-${q}`};
    }
    const key=String(d.getFullYear());return {key,label:key,sort:key};
  }
  // Statistieken tonen alleen eigen verdiensten, zonder expliciet doorberekende bonnen/extra kosten.
  function normalizeStatsDate(value){
    const raw=String(value||'').trim(),iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
    const dutch=raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    const date=iso?`${iso[1]}-${iso[2]}-${iso[3]}`:dutch?`${dutch[3]}-${dutch[2]}-${dutch[1]}`:'';
    if(!date)return '';
    const d=new Date(date+'T12:00:00');
    return !Number.isNaN(d.getTime())&&d.getFullYear()===Number(date.slice(0,4))&&d.getMonth()+1===Number(date.slice(5,7))&&d.getDate()===Number(date.slice(8,10))?date:'';
  }
    function jobStatsDate(j,entries){
    const planned=jobWorkDays(j).map(x=>normalizeStatsDate(x.date));
    const actual=uniqueEntries(entries).filter(e=>String(e.jobId)===String(j.id)&&(!e.autoFromJobSchedule||e.actualConfirmed)).map(e=>normalizeStatsDate(entryDate(e)));
    return [...planned,...actual,normalizeStatsDate(j.date)].filter(Boolean).sort().at(-1)||'';
  }
    function invoiceStatsDate(d){
    // Losse facturen: alleen werkdatum gebruiken. Nooit factuur- of betaaldatum gokken.
    return normalizeStatsDate(d?.meta?.workDate||d?.meta?.work_date||'');
  }
    function invoicePassThroughParts(d){
    let receipts=0,extras=0;
    for(const line of d?.meta?.lines||[]){
      const description=String(line.description||'').trim();
      const isReceipt=!!line.expenseId, isExtra=/^extra kosten\s*(?:\/|&|en)\s*materiaal\b/i.test(description);
      if(!isReceipt&&!isExtra)continue;
      const quantity=Math.max(0,num(line.qty)),unitPrice=Math.max(0,num(line.price));
      const vat=Math.max(0,num(line.vatRate??(d.meta?.korApplied?0:d.meta?.vatRate??0)));
      const cents=Math.round(quantity*unitPrice*(1+vat/100)*100);
      if(isReceipt)receipts+=cents;else extras+=cents;
    }
    return {receipts,extras};
  }
    function expenseLinesRecharged(d){
    const parts=invoicePassThroughParts(d);
    return parts.receipts+parts.extras;
  }
    function ownEarningsProfile(j,entries,company,finance){
    const p=JKFinance.price(j,jobMinutes(j,entries),jobRate(j,company));
    const docs=(finance?.documents||[]).filter(d=>String(linkedInvoiceJobId(d))===String(j.id));
    const invoiced=docs.reduce((sum,d)=>sum+Math.round(num(d.meta?.total)*100),0);
    const receiptsOnInvoices=docs.reduce((sum,d)=>sum+invoicePassThroughParts(d).receipts,0);
    const extrasOnInvoices=docs.reduce((sum,d)=>sum+invoicePassThroughParts(d).extras,0);
    const extra=Math.max(0,Math.round(num(j.extraAmount)*100));
    const agreed=Math.max(0,Math.round(num(p.agreed)*100));
    // Een als klus-extra EN factuur-extra ingevoerd bedrag slechts eenmaal aftrekken.
    // Bonnetjes met een eigen expenseId komen hier bovenop (afzonderlijke voorschotten).
    const reimbursement=Math.max(extra,receiptsOnInvoices+extrasOnInvoices);
    const grossDue=Math.max(agreed,invoiced);
    return {agreed:Math.min(Math.max(0,agreed-extra),Math.max(0,grossDue-reimbursement)),grossDue,reimbursement};
  }
    function ownEarningsPayments(finance,jobs,entries,company){
    const result=new Map(),jMap=new Map(jobs.map(j=>[String(j.id),j]));
    const docs=new Map((finance?.documents||[]).map(d=>[String(d.id),d]));
    const groups=new Map();
    for(const p of finance?.receipts||[]){
      const jobId=String(p.resolvedJobId||p.jobId||''),invoiceId=String(p.invoiceId||'');
      const key=jobId&&jMap.has(jobId)?'job:'+jobId:invoiceId&&docs.has(invoiceId)?'invoice:'+invoiceId:'payment:'+String(p.id);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(p);
    }
    for(const [key,payments] of groups){
      let due=0,reimbursement=0;
      if(key.startsWith('job:')){
        const profile=ownEarningsProfile(jMap.get(key.slice(4)),entries,company,finance);
        due=profile.grossDue;reimbursement=profile.reimbursement;
      }else if(key.startsWith('invoice:')){
        const doc=docs.get(key.slice(8));
        due=Math.max(0,Math.round(num(doc.meta?.total)*100));
        reimbursement=expenseLinesRecharged(doc);
      }
      const totalPaid=payments.reduce((sum,p)=>sum+Math.max(0,Math.round(num(p.amount)*100)),0);
      due=Math.max(due,totalPaid);
      const earnedMax=Math.max(0,due-reimbursement);
      // Totale verdiensten worden gemaximeerd tot werkloon; voorgeschoten kosten
      // komen nooit als eigen inkomen in de statistieken terecht.
      let grossSoFar=0;
      for(const p of [...payments].sort((a,b)=>String(a.date||'9999-99-99').localeCompare(String(b.date||'9999-99-99'))||String(a.id).localeCompare(String(b.id)))){
        const prior=Math.min(grossSoFar,earnedMax);
        grossSoFar+=Math.max(0,Math.round(num(p.amount)*100));
        result.set(p.id,(Math.min(grossSoFar,earnedMax)-prior)/100);
      }
    }
    return result;
  }
    function financialEvents(entries,jobs,company,finance=state.finance){
    const events=[],jobMap=new Map(jobs.map(j=>[String(j.id),j])),ownPaid=ownEarningsPayments(finance,jobs,entries,company);
    const incomeByJob=new Map();
    for(const p of finance?.receipts||[]){
      const id=String(p.resolvedJobId||'');
      if(jobMap.has(id))incomeByJob.set(id,(incomeByJob.get(id)||0)+Math.round((ownPaid.get(p.id)||0)*100));
    }
    for(const e of uniqueEntries(entries)){
      const j=jobMap.get(String(e.jobId)),minutes=entryMinutes(e);
      events.push({date:entryDate(e),job:j,minutes,hoursValue:j?Math.round(minutes/60*jobRate(j,company)*100)/100:0});
    }
    for(const j of jobs){
      const date=jobStatsDate(j,entries),profile=ownEarningsProfile(j,entries,company,finance);
      const earned=incomeByJob.get(String(j.id))||0;
      const grossOpen=Math.round(num(finance?.job?.(j)?.open)*100);
      const ownOpen=Math.max(0,Math.min(grossOpen,profile.agreed-earned));
      // Alleen expliciet in Klussen afgeronde bedragen; geen kosten of open werk raden.
      const ownWaived=Math.max(0,Math.min(Math.round(num(finance?.job?.(j)?.waived)*100),profile.agreed-earned-ownOpen));
      const amount=profile.agreed/100;
      events.push({date,job:j,amount,open:ownOpen/100,waived:ownWaived/100,invoiceAmount:jobPaymentType(j)==='invoice'?amount:0,cashAmount:jobPaymentType(j)==='cash'?amount:0});
    }
    // Factuurbedrag blijft voor bestaande metrics beschikbaar, maar hoort niet
    // bij eigen verdiensten en beïnvloedt de nieuwe grafiek niet.
    for(const d of finance?.documents||[]){
      const job=jobMap.get(String(linkedInvoiceJobId(d)));
      events.push({date:job?jobStatsDate(job,entries):invoiceStatsDate(d),job,client:d.meta?.client,clientId:d.meta?.clientId,invoiced:num(d.meta?.total)});
    }
    for(const p of finance?.receipts||[]){
      const d=(finance?.documents||[]).find(d=>String(d.id)===String(p.invoiceId)),j=jobMap.get(String(p.resolvedJobId||'')),amount=ownPaid.get(p.id)||0;
      const date=j?jobStatsDate(j,entries):d?invoiceStatsDate(d):'';
      events.push({date,job:j,client:d?.meta?.client,clientId:d?.meta?.clientId,received:date?amount:0,undatedReceived:date?0:amount});
    }
    // Losse facturen zonder klus kunnen eveneens nog openstaande eigen
    // werkzaamheden bevatten. Aan een klus gekoppelde facturen zijn hierboven al verwerkt.
    for(const d of finance?.documents||[]){
      if(jobMap.has(String(linkedInvoiceJobId(d))))continue;
      const date=invoiceStatsDate(d),totalCents=Math.max(0,Math.round(num(d.meta?.total)*100));
      const costs=expenseLinesRecharged(d);
      const ownInvoice=Math.max(0,totalCents-costs);
      const payments=(finance?.receipts||[]).filter(p=>String(p.invoiceId)===String(d.id));
      const earned=payments.reduce((sum,p)=>sum+Math.round((ownPaid.get(p.id)||0)*100),0);
      const financeOpen=Math.max(0,Math.round(num(finance?.document?.(d)?.open)*100));
      const open=Math.max(0,Math.min(financeOpen,ownInvoice-earned));
      const waived=Math.max(0,Math.min(Math.round(num(finance?.document?.(d)?.waived)*100),ownInvoice-earned-open));
      events.push({date,job:null,client:d.meta?.client,clientId:d.meta?.clientId,amount:ownInvoice/100,open:open/100,waived:waived/100});
    }
    return events;
  }
    const emptyMetrics=()=>({minutes:0,amount:0,invoiceAmount:0,cashAmount:0,hoursValue:0,invoiced:0,received:0,open:0,waived:0,undatedReceived:0});
  function addMetrics(target,event){for(const key of Object.keys(emptyMetrics()))target[key]=(target[key]||0)+(event[key]||0);}
  function periodBuckets(entries,jobs,company,mode){
    const now=new Date(), map=new Map();
    const ensure=info=>{let b=map.get(info.key);if(!b){b={...info,...emptyMetrics()};map.set(info.key,b)}return b};
    for(const event of financialEvents(entries,jobs,company)){
      const info=statPeriodInfo(event.date,mode);if(!info)continue;
      addMetrics(ensure(info),event);
    }
    if(mode==='week'){
      const arr=[];
      const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      const dow=monday.getDay()||7;monday.setDate(monday.getDate()-(dow-1));
      for(let i=11;i>=0;i--){
        const d=new Date(monday);d.setDate(d.getDate()-(i*7));
        const ymd=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const w=isoWeekInfo(ymd);if(!w)continue;
        arr.push(map.get(w.key)||{key:w.key,label:w.label,sort:w.key,...emptyMetrics()});
      }
      return arr;
    }
    if(mode==='month'){
      const arr=[];for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;arr.push(map.get(key)||{key,label:`${monthName(d.getMonth())} '${String(d.getFullYear()).slice(-2)}`,sort:key,...emptyMetrics()})}return arr;
    }
    if(mode==='quarter'){
      const arr=[];const cq=Math.floor(now.getMonth()/3)+1;for(let i=7;i>=0;i--){let q=cq-i,y=now.getFullYear();while(q<=0){q+=4;y--}while(q>4){q-=4;y++}const key=`${y}-Q${q}`;arr.push(map.get(key)||{key,label:`Q${q} '${String(y).slice(-2)}`,sort:`${y}-${q}`,...emptyMetrics()})}return arr;
    }
    const years=[...map.values()].sort((a,b)=>a.sort.localeCompare(b.sort));if(!years.length)years.push({key:String(now.getFullYear()),label:String(now.getFullYear()),sort:String(now.getFullYear()),...emptyMetrics()});return years;
  }
  // Eén getal tegelijk: de berekeningen veranderen niet, alleen de presentatie.
  function statMetricValue(bucket,metric){
    return metric==='hours'?num(bucket.minutes):metric==='agreed'?num(bucket.amount):num(bucket.received);
  }
  function statMetricLabel(metric){return metric==='hours'?'Gewerkte uren':metric==='agreed'?'Afgesproken':'Ontvangen';}
  function statMetricText(bucket,metric){const v=statMetricValue(bucket,metric);return metric==='hours'?hoursLabel(v):money(v);}
  function simpleStatsHtml(buckets,metric,context=''){
    const include=b=>Math.abs(statMetricValue(b,metric))>0.00001||(metric==='received'&&num(b.open)>0.00001);
    const shown=buckets.filter(include);
    shown.sort((a,b)=>context.startsWith('in ')?statMetricValue(b,metric)-statMetricValue(a,metric)||num(b.open)-num(a.open)||a.label.localeCompare(b.label,'nl'):String(b.sort||b.key).localeCompare(String(a.sort||a.key)));
    const total=shown.reduce((sum,b)=>sum+statMetricValue(b,metric),0);
    const open=metric==='received'?shown.reduce((sum,b)=>sum+num(b.open),0):0;
    const label=statMetricLabel(metric),empty=metric==='hours'?'Geen gewerkte uren':metric==='agreed'?'Geen afspraken':'Geen ontvangen of openstaande verdiensten';
    return `<div class="card stats-simple-total"><span class="muted small">Totaal ${esc(label.toLowerCase())}${context?' · '+esc(context):''}</span><strong>${statMetricText({minutes:total,amount:total,received:total},metric)}</strong>${open>0?`<span class="stats-total-open">Nog te ontvangen: ${money(open)}</span>`:''}</div>${shown.length?`<div class="list stats-simple-list">${shown.map(b=>`<div class="list-item stats-simple-row"><div class="main"><div class="title">${esc(b.label)}</div></div><div class="stats-simple-figures"><strong class="stats-simple-value">${esc(statMetricText(b,metric))}</strong>${metric==='received'&&num(b.open)>0?`<span class="stats-row-open">+ ${money(b.open)} open</span>`:''}</div></div>`).join('')}</div>`:`<div class="empty">${empty}${context?' '+esc(context):''}.</div>`}`;
  }

  function simpleStatsChartHtml(buckets,metric,customerMode=false){
    const hasOpen=b=>metric==='received'&&num(b.open)>0.00001;
    const relevant=b=>Math.abs(statMetricValue(b,metric))>0.00001||hasOpen(b);
    const valid=buckets.filter(relevant);
    if(!valid.length)return '';
    const current=b=>Math.max(0,statMetricValue(b,metric));
    const pending=b=>hasOpen(b)?Math.max(0,num(b.open)):0;
    const full=b=>current(b)+pending(b);
    const maximum=Math.max(...valid.map(full),0.01);
    const width=b=>Math.max(3,Math.round(full(b)/maximum*1000)/10);
    const pct=(part,sum)=>sum>0?Math.round(part/sum*1000)/10:0;
    const title='Grafiek · '+statMetricLabel(metric).toLowerCase();
    const legend=metric==='received'&&valid.some(hasOpen)?'<div class="stats-chart-legend"><span><i class="stats-chart-dot"></i> Ontvangen</span><span><i class="stats-chart-dot stats-chart-dot-open"></i> Openstaand</span></div>':'';
    if(customerMode){
      const clients=[...valid].sort((a,b)=>statMetricValue(b,metric)-statMetricValue(a,metric)||num(b.open)-num(a.open)||a.label.localeCompare(b.label,'nl'));
      return `<div class="card stats-chart-card" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${legend}<div class="stats-client-chart">${clients.map(b=>{
        const total=full(b),maxWidth=width(b),receivedWidth=pct(current(b),total)*maxWidth/100,openWidth=pct(pending(b),total)*maxWidth/100;
        const description=b.label+': '+statMetricText(b,metric)+(hasOpen(b)?', '+money(pending(b))+' openstaand':'');
        return `<div class="stats-client-chart-row"><div class="stats-client-chart-caption"><span>${esc(b.label)}</span><strong>${esc(statMetricText(b,metric))}${hasOpen(b)?`<small class="stats-chart-open-value">+ ${money(pending(b))} open</small>`:''}</strong></div><div class="stats-client-chart-track" role="img" aria-label="${esc(description)}"><span class="stats-client-chart-fill" style="width:${receivedWidth}%"></span>${hasOpen(b)?`<span class="stats-client-chart-open" style="width:${openWidth}%"></span>`:''}</div></div>`;
      }).join('')}</div></div>`;
    }
    return `<div class="card stats-chart-card" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${legend}<div class="stats-period-chart-scroll"><div class="stats-period-chart">${buckets.map(b=>{
      const value=current(b),open=pending(b),combined=full(b),height=combined?width(b):0;
      const description=b.label+': '+statMetricText(b,metric)+(hasOpen(b)?', '+money(open)+' openstaand':'');
      const bar=metric==='received'
        ?`<span class="stats-period-chart-stack" style="height:${height}%">${hasOpen(b)?`<span class="stats-period-chart-open" style="height:${pct(open,combined)}%"></span>`:''}<span class="stats-period-chart-fill" style="height:${pct(value,combined)}%"></span></span>`
        :`<span class="stats-period-chart-fill" style="height:${height}%"></span>`;
      return `<div class="stats-period-chart-col" role="img" aria-label="${esc(description)}"><span class="stats-period-chart-value">${esc(statMetricText(b,metric))}${hasOpen(b)?`<small class="stats-chart-open-value">+ ${money(open)} open</small>`:''}</span><div class="stats-period-chart-track">${bar}</div><span class="stats-period-chart-label">${esc(b.label)}</span></div>`;
    }).join('')}</div></div></div>`;
  }
  function customerStatBuckets(entries,jobs,clients,company,year){
    const map=new Map(),clientMap=new Map(clients.map(c=>[c.id,c]));
    for(const event of financialEvents(entries,jobs,company)){
      if(!String(event.date||'').startsWith(String(year)))continue;
      const j=event.job,id=j?.clientId||event.clientId||'',c=clientMap.get(id),name=(c?.name||j?.clientName||event.client?.name||'Geen klant / algemeen').trim(),key=id||'name:'+name.toLowerCase();
      if(!map.has(key))map.set(key,{key,label:name,...emptyMetrics()});addMetrics(map.get(key),event);
    }
    return [...map.values()].sort((a,b)=>b.amount-a.amount||b.minutes-a.minutes||a.label.localeCompare(b.label,'nl'));
  }
  function statsComparisonHtml(buckets,customerMode,context){
    const hasData=b=>Math.abs(num(b.amount))+Math.abs(num(b.received))+Math.abs(num(b.minutes))>0.00001;
    const shown=buckets.filter(hasData);
    const agreed=shown.reduce((n,b)=>n+num(b.amount),0);
    const received=shown.reduce((n,b)=>n+num(b.received),0);
    const minutes=shown.reduce((n,b)=>n+num(b.minutes),0);
    const label=context?' · '+esc(context):'';
    return `<div class="card stats-comparison-summary" aria-label="Totaaloverzicht${label}">
      <div><span>Afgesproken${label}</span><strong>${money(agreed)}</strong></div>
      <div><span>Ontvangen</span><strong>${money(received)}</strong></div>
      ${customerMode?`<div><span>Gewerkte uren</span><strong>${hoursLabel(minutes)}</strong></div>`:''}
    </div>`;
  }

  function statsComparisonChartHtml(buckets,customerMode=false){
    const agreed=b=>Math.max(0,num(b.amount));
    const received=b=>Math.max(0,num(b.received));
    const hours=b=>Math.max(0,num(b.minutes));
    // De echte openstaande waarde uit Klussen/Facturen, na expliciete afboeking.
    const remaining=b=>Math.max(0,num(b.open));
    const waived=b=>Math.max(0,num(b.waived));
    const total=b=>Math.max(agreed(b),received(b)+remaining(b)+waived(b));
    const relevant=b=>total(b)>0.00001||hours(b)>0.00001;
    const list=buckets.filter(relevant);
    if(!list.length)return '<div class="empty">Nog geen werkzaamheden of verdiensten voor deze selectie.</div>';
    const percentage=(part,whole)=>whole>0?Math.min(100,Math.round(part/whole*1000)/10):0;
    const legend=`<div class="stats-chart-legend"><span><i class="stats-chart-dot"></i> Ontvangen</span><span><i class="stats-chart-dot stats-chart-dot-open"></i> Nog te ontvangen</span>${list.some(b=>waived(b)>0.005)?'<span><i class="stats-chart-dot stats-chart-dot-waived"></i> Afgerond (niet openstaand)</span>':''}</div>`;
    if(customerMode){
      const maxHours=Math.max(1,...list.map(hours));
      const maxMoney=Math.max(0.01,...list.map(total));
      const sorted=[...list].sort((a,b)=>total(b)-total(a)||hours(b)-hours(a)||a.label.localeCompare(b.label,'nl'));
      return `<section class="card stats-chart-card stats-comparison-chart" aria-label="Uren en verdiensten per klant"><h3>Uren en verdiensten per klant</h3>${legend}
      <div class="stats-client-chart">${sorted.map(b=>{
        const ownTotal=total(b),paid=percentage(received(b),ownTotal),unpaid=percentage(remaining(b),ownTotal),settled=percentage(waived(b),ownTotal);
        const financeScale=percentage(ownTotal,maxMoney),hourScale=percentage(hours(b),maxHours);
        const desc=`${b.label}: ${hoursLabel(hours(b))} gewerkt, ${money(agreed(b))} afgesproken, ${money(received(b))} ontvangen, ${money(remaining(b))} nog te ontvangen${waived(b)>0?`, ${money(waived(b))} afgerond (niet openstaand)`:''}`;
        return `<div class="stats-client-combined" role="group" aria-label="${esc(desc)}">
          <div class="stats-client-name">${esc(b.label)}</div>
          <div class="stats-comparison-label"><span>Uren</span><strong>${hoursLabel(hours(b))}</strong></div>
          <div class="stats-client-chart-track stats-client-hours-track" role="img" aria-label="${esc(hoursLabel(hours(b)))} gewerkt"><span class="stats-client-hours-fill" style="width:${hourScale}%"></span></div>
          <div class="stats-comparison-label"><span>Verdiensten</span><strong>${money(agreed(b))} afgesproken</strong></div>
          <div class="stats-client-chart-track stats-client-money-track" role="img" aria-label="${esc(desc)}"><div class="stats-client-money-width" style="width:${financeScale}%"><span class="stats-client-chart-fill" style="width:${paid}%"></span>${unpaid>0?`<span class="stats-client-chart-open" style="width:${unpaid}%"></span>`:'' }${settled>0?`<span class="stats-client-chart-waived" style="width:${settled}%"></span>`:''}</div></div>
          <div class="stats-comparison-detail"><span>${money(received(b))} ontvangen</span>${remaining(b)>0.005?`<span class="stats-comparison-outstanding">${money(remaining(b))} nog te ontvangen</span>`:'' }${waived(b)>0.005?`<span class="stats-comparison-writtenoff">${money(waived(b))} afgerond</span>`:''}</div>
        </div>`;
      }).join('')}</div></section>`;
    }
    const maxMoney=Math.max(0.01,...list.map(total));
    return `<section class="card stats-chart-card stats-comparison-chart" aria-label="Afgesproken en ontvangen per periode"><h3>Afgesproken en ontvangen</h3>${legend}
    <div class="stats-period-chart-scroll"><div class="stats-period-chart">${buckets.map(b=>{
      const ownTotal=total(b),barHeight=percentage(ownTotal,maxMoney),paid=percentage(received(b),ownTotal),unpaid=percentage(remaining(b),ownTotal),settled=percentage(waived(b),ownTotal);
      const desc=`${b.label}: ${money(agreed(b))} afgesproken, ${money(received(b))} ontvangen, ${money(remaining(b))} nog te ontvangen${waived(b)>0?`, ${money(waived(b))} afgerond (niet openstaand)`:''}`;
      return `<div class="stats-period-chart-col" role="img" aria-label="${esc(desc)}">
        <span class="stats-period-chart-value">${ownTotal>0?`<strong>${money(received(b))}</strong><small>van ${money(agreed(b))}</small>`:'–'}</span>
        <div class="stats-period-chart-track">${ownTotal>0?`<span class="stats-period-chart-stack" style="height:${barHeight}%">${settled>0?`<span class="stats-period-chart-waived" style="height:${settled}%"></span>`:'' }${unpaid>0?`<span class="stats-period-chart-open" style="height:${unpaid}%"></span>`:''}<span class="stats-period-chart-fill" style="height:${paid}%"></span></span>`:''}</div>
        <span class="stats-period-chart-label">${esc(b.label)}</span>
      </div>`;
    }).join('')}</div></div></section>`;
  }

  async function showTimeStats(){
    await refreshFinance();
    const [entries,jobs,clients,company]=await Promise.all([JKDB.all('timeEntries'),JKDB.all('jobs'),JKDB.all('clients'),JKDB.get('settings','company')]);
    let mode='client';
    const years=[...new Set([...entries.map(e=>entryDate(e)),...jobs.map(j=>jobStatsDate(j,entries)),...state.finance.documents.map(invoiceStatsDate)].filter(Boolean).map(v=>new Date(v+'T12:00:00')).filter(d=>!Number.isNaN(d.getTime())).map(d=>d.getFullYear()))].sort((a,b)=>b-a);
    if(!years.includes(new Date().getFullYear()))years.unshift(new Date().getFullYear());
    let customerYear=new Date().getFullYear();
    const draw=()=>{
      const customerMode=mode==='client';
      const periods={month:'laatste 12 maanden',quarter:'laatste 8 kwartalen',year:'alle kalenderjaren'};
      const buckets=customerMode?customerStatBuckets(entries,jobs,clients,company,customerYear):periodBuckets(entries,jobs,company,mode);
      const content=statsComparisonHtml(buckets,customerMode,customerMode?'in '+customerYear:periods[mode])+statsComparisonChartHtml(buckets,customerMode);
      const undated=financialEvents(entries,jobs,company).reduce((n,event)=>n+(event.undatedReceived||0),0);
      modal(`${modalHead('Statistieken')}<div class="tabs stats-tabs" aria-label="Statistieken per periode">
        <button type="button" class="tab ${customerMode?'active':''}" data-stat-mode="client">Per klant</button>
        <button type="button" class="tab ${mode==='month'?'active':''}" data-stat-mode="month">Per maand</button>
        <button type="button" class="tab ${mode==='quarter'?'active':''}" data-stat-mode="quarter">Per kwartaal</button>
        <button type="button" class="tab ${mode==='year'?'active':''}" data-stat-mode="year">Per jaar</button>
      </div>
      ${customerMode?`<div class="field stat-year-field"><label for="customerStatsYear">Kalenderjaar</label><select id="customerStatsYear">${years.map(y=>`<option value="${y}" ${y===customerYear?'selected':''}>${y}</option>`).join('')}</select></div>`:''}
      ${content}<p class="muted small stats-comparison-note">Rood toont alleen wat bij Klussen of Facturen nog openstaat. Afgeronde bedragen zijn geen schuld en worden apart in grijs getoond.</p>
      ${undated>0?`<p class="muted small stats-undated">Zonder uitvoerdatum (niet ingedeeld): ${money(undated)}</p>`:''}`);
      $$('[data-stat-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.statMode;draw()}));
      $('#customerStatsYear')?.addEventListener('change',e=>{customerYear=Number(e.target.value);draw()});
    };
    draw();
  }
  async function showTimeEntries(){
    const es=(await JKDB.all('timeEntries')).sort((a,b)=>(entryDate(b)+entryFrom(b)).localeCompare(entryDate(a)+entryFrom(a)));
    modal(`${modalHead('Urenregistratie')}<button class="primary" id="addTime" style="width:100%;margin-bottom:12px">+ Uren toevoegen</button>${es.length?`<div class="list">${es.map(e=>`<div class="list-item clickable" data-time="${e.id}"><div class="main"><div class="title">${nlDate(entryDate(e))} · ${esc(e.jobTitle||'Algemeen')}</div><div class="sub">${esc(entryFrom(e))} - ${esc(entryTo(e))} · pauze ${num(e.breakMinutes)} min${e.autoFromJobSchedule&&!e.actualConfirmed?' · nog te bevestigen':''}${e.note?' · '+esc(e.note):''}</div></div><strong>${durationHM(entryMinutes(e))}</strong></div>`).join('')}</div>`:'<div class="empty">Nog geen uren geregistreerd.</div>'}`);$('#addTime').addEventListener('click',()=>{editTimeEntry()});$$('[data-time]').forEach(x=>x.addEventListener('click',()=>{editTimeEntry(x.dataset.time)}));
  }
  async function editTimeEntry(id,jobId='',workDate='',returnJobId=''){
    if(!id&&jobId&&workDate){const existing=(await JKDB.all('timeEntries')).find(e=>e.jobId===jobId&&entryDate(e)===workDate);if(existing)id=existing.id;}
    const jobs=(await JKDB.all('jobs')).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),old=id?await JKDB.get('timeEntries',id):null,e=old||{id:JKDB.id('time'),jobId,jobTitle:'',date:workDate||today(),from:'',to:'',breakMinutes:0,note:''};
    if(old&&!e.date&&e.start){e.date=entryDate(e);e.from=entryFrom(e);e.to=entryTo(e)}
    modal(`${modalHead(id?'Uren bewerken':'Uren toevoegen')}<form id="timeForm"><div class="field"><label>Klus</label><select name="jobId"><option value="">Algemene werkzaamheden</option>${jobs.map(j=>`<option value="${j.id}" ${j.id===e.jobId?'selected':''}>${esc(j.title)}${j.clientName?' · '+esc(j.clientName):''}</option>`).join('')}</select></div><div class="field"><label>Datum</label><input type="date" name="date" required value="${esc(e.date||today())}"></div><div class="form-grid"><div class="field"><label>Van</label><input type="time" name="from" required value="${esc(e.from||'')}"></div><div class="field"><label>Tot</label><input type="time" name="to" required value="${esc(e.to||'')}"></div></div><div class="field"><label>Pauze in minuten</label><input name="breakMinutes" type="number" min="0" step="1" value="${num(e.breakMinutes)}"></div><div class="field"><label>Notitie</label><input name="note" value="${esc(e.note||'')}" placeholder="Optioneel"></div><div class="card small" id="timePreview"></div><div class="button-row"><button class="primary">Opslaan</button><button type="button" class="secondary" id="calendarTime">📅 Google Agenda</button>${id?'<button type="button" class="danger-btn" id="delTime">Verwijderen</button>':''}</div></form>`);
    const preview=()=>{const f=new FormData($('#timeForm')),tmp={date:f.get('date'),from:f.get('from'),to:f.get('to'),breakMinutes:f.get('breakMinutes')};$('#timePreview').innerHTML=`Tijdsduur: <strong>${durationHM(entryMinutes(tmp))} uur</strong>`};$$('#timeForm input').forEach(x=>x.addEventListener('input',preview));preview();$('#calendarTime').addEventListener('click',()=>{const f=new FormData($('#timeForm')),j=jobs.find(x=>x.id===f.get('jobId'))||{};openGoogleCalendarForTimeEntry({jobTitle:j.title||e.jobTitle||'Algemene werkzaamheden',date:f.get('date'),from:f.get('from'),to:f.get('to'),note:f.get('note')},j)});$('#timeForm').addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget;if(form.dataset.saving==='1')return;form.dataset.saving='1';try{const f=new FormData(ev.target),j=jobs.find(x=>x.id===f.get('jobId'));const duplicate=(await JKDB.all('timeEntries')).find(x=>x.id!==e.id&&x.jobId===(j?.id||'')&&entryDate(x)===f.get('date'));if(j&&duplicate&&(!old||old.jobId!==j.id||entryDate(old)!==f.get('date'))){alert('Deze werkdag heeft al uren. Bewerk de bestaande registratie; er wordt niets overschreven.');return;}const rawMinutes=entryMinutes({date:f.get('date'),from:f.get('from'),to:f.get('to')});if(num(f.get('breakMinutes'))>rawMinutes){alert('De pauze kan niet langer zijn dan de gewerkte tijd.');return;}if(!old&&j){const base='time_workday_'+j.id+'_'+f.get('date'),all=await JKDB.all('timeEntries');let candidate=base,n=0;while(all.some(x=>x.id===candidate)||await JKDB.isDeletedLocal('timeEntries',candidate))candidate=base+'_'+(++n);e.id=candidate;}await freezeLegacyPayments(await refreshFinance(),old?.jobId||j?.id||'');if(old?.jobId&&j?.id&&old.jobId!==j.id)await freezeLegacyPayments(await refreshFinance(),j.id);Object.assign(e,{actualConfirmed:true,autoFromJobSchedule:false,breakMinutes:num(f.get('breakMinutes')),jobId:j?.id||'',jobTitle:j?.title||'Algemene werkzaamheden',date:f.get('date'),from:f.get('from'),to:f.get('to'),note:f.get('note'),start:null,end:null});await JKDB.put('timeEntries',e);closeModal();toast('Uren opgeslagen');if(returnJobId)await showJob(returnJobId);else if(state.route==='dashboard')render();else showTimeEntries();}finally{form.dataset.saving='0';}});$('#delTime')?.addEventListener('click',async()=>{if(confirm('Deze urenregistratie verwijderen?')){await freezeLegacyPayments(await refreshFinance(),old?.jobId||'');await JKDB.remove('timeEntries',id);closeModal();showTimeEntries();}});
  }

  async function showClients(){const cs=(await JKDB.all('clients')).sort((a,b)=>a.name.localeCompare(b.name));modal(`${modalHead('Klanten')}<button class="primary" id="addClient" style="width:100%;margin-bottom:12px">+ Nieuwe klant</button>${cs.length?`<div class="list">${cs.map(c=>`<div class="list-item clickable" data-client="${c.id}"><div class="main"><div class="title">${esc(c.name)}</div><div class="sub">${esc([c.city,c.phone].filter(Boolean).join(' · ')||'Geen extra gegevens')}</div></div><span>›</span></div>`).join('')}</div>`:'<div class="empty">Nog geen klanten.</div>'}`);$('#addClient').addEventListener('click',()=>{editClient()});$$('[data-client]').forEach(x=>x.addEventListener('click',()=>showClientHistory(x.dataset.client)));}
  async function showClientHistory(id){
    await refreshFinance();
    const c=await JKDB.get('clients',id);if(!c)return;
    const [jobs,entries,docs,photos,company]=await Promise.all([JKDB.all('jobs'),JKDB.all('timeEntries'),JKDB.all('documents'),JKDB.all('jobPhotos'),JKDB.get('settings','company')]);
    const cj=jobs.filter(j=>j.clientId===id||(!j.clientId&&String(j.clientName||'').toLowerCase()===String(c.name||'').toLowerCase())).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const ids=new Set(cj.map(j=>j.id));
    const ce=entries.filter(e=>ids.has(e.jobId));
    const clientNameNorm=String(c.name||'').trim().toLowerCase(),cd=docs.filter(d=>ids.has(d.meta?.jobId)||String(d.meta?.clientId||'')===id||(clientNameNorm&&String(d.meta?.client?.name||'').trim().toLowerCase()===clientNameNorm)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    const cp=photos.filter(p=>ids.has(p.jobId));
    const mins=ce.reduce((a,e)=>a+entryMinutes(e),0),amount=cj.reduce((a,j)=>a+jobOwnAmount(j,entries,company),0),open=cj.reduce((a,j)=>a+jobFinancial(j,entries,company).open,0)+cd.filter(d=>JKFinance.invoice(d)&&isUnassignedInvoice(d)).reduce((n,d)=>n+state.finance.document(d).open,0);
    const jobsHtml=cj.length?`<div class="list">${cj.map(j=>`<div class="list-item clickable" data-history-job="${j.id}"><div class="main"><div class="title">${esc(j.title)}</div><div class="sub">${nlDate(j.date)} · ${hoursLabel(jobMinutes(j,entries))} · ${money(jobOwnAmount(j,entries,company))}</div></div><span>›</span></div>`).join('')}</div>`:'<div class="empty">Nog geen klussen voor deze klant.</div>';
    const docsHtml=cd.length?`<div class="list">${cd.map(d=>`<div class="list-item clickable" data-history-doc="${d.id}"><div class="main"><div class="title">${esc(d.meta?.number||d.filename)}</div><div class="sub">${esc(d.kind||docFolder(d))}${d.meta?.total!=null?' · '+money(d.meta.total):''}</div></div><span>›</span></div>`).join('')}</div>`:'<div class="empty">Geen gekoppelde offertes of facturen.</div>';
    let photosHtml=`<div class="empty">Geen klusfoto's voor deze klant.</div>`;
    if(cp.length){
      const thumbs=cp.slice(0,12).map(p=>{const url=URL.createObjectURL(p.blob);return `<button class="job-photo-thumb photo-doc-thumb" type="button" data-history-photo="${p.id}"><img src="${url}" alt="Klusfoto"></button>`}).join('');
      photosHtml=`<div class="job-photo-grid">${thumbs}</div>${cp.length>12?`<p class="muted small">Eerste 12 van ${cp.length} foto's getoond.</p>`:''}`;
    }
    modal(`${modalHead(c.name)}<div class="button-row"><button class="secondary" id="editClientFromHistory">Bewerken</button><button class="primary" id="newJobForClient">+ Nieuwe klus</button></div><div class="card"><div class="kpi-row"><div class="kpi"><strong>${cj.length}</strong><span>Klussen</span></div><div class="kpi"><strong>${hoursLabel(mins)}</strong><span>Uren</span></div><div class="kpi"><strong>${money(amount)}</strong><span>Afgesproken totaal</span></div><div class="kpi"><strong>${money(open)}</strong><span>Openstaand</span></div></div><div class="muted small">${esc([c.street,[c.postal,c.city].filter(Boolean).join(' '),c.phone,c.email].filter(Boolean).join(' · '))}</div></div><div class="section-title"><h2>Klussen</h2></div>${jobsHtml}${financeSummary(cj,entries,company,cd)}<div class="section-title"><h2>Documenten</h2><span class="muted small">${cd.length}</span></div>${docsHtml}<div class="section-title"><h2>Foto's</h2><span class="muted small">${cp.length}</span></div>${photosHtml}`);
    $('#editClientFromHistory').addEventListener('click',()=>editClient(id));
    $('#newJobForClient').addEventListener('click',()=>{closeModal();editJobForClient(c)});
    $$('[data-history-job]').forEach(b=>b.addEventListener('click',()=>showJob(b.dataset.historyJob)));
    $$('[data-history-doc]').forEach(b=>b.addEventListener('click',()=>showDocument(b.dataset.historyDoc)));
    $$('[data-history-photo]').forEach(b=>b.addEventListener('click',()=>showPhotoDocument(b.dataset.historyPhoto)));
  }
  async function editJobForClient(c){
    closeModal();
    await editJob(null,{clientId:c.id,clientName:c.name,attention:c.attention||'',street:c.street||'',postal:c.postal||'',city:c.city||'',phone:c.phone||'',email:c.email||''});
  }
  async function editClient(id){const c=id?await JKDB.get('clients',id):{id:JKDB.id('client'),name:'',attention:'',street:'',postal:'',city:'',phone:'',email:'',notes:''};modal(`${modalHead(id?'Klant bewerken':'Nieuwe klant')}<form id="clientForm"><div class="field"><label>Naam/bedrijf</label><input name="name" required value="${esc(c.name)}"></div><div class="field"><label>T.a.v.</label><input name="attention" value="${esc(c.attention||'')}"></div><div class="field"><label>Adres</label><input name="street" value="${esc(c.street||'')}"></div><div class="form-grid"><div class="field"><label>Postcode</label><input name="postal" value="${esc(c.postal||'')}"></div><div class="field"><label>Plaats</label><input name="city" value="${esc(c.city||'')}"></div><div class="field"><label>Telefoon</label><input name="phone" value="${esc(c.phone||'')}"></div><div class="field"><label>E-mail</label><input type="email" name="email" value="${esc(c.email||'')}"></div><div class="field full"><label>Notities</label><textarea name="notes">${esc(c.notes||'')}</textarea></div></div><div class="button-row"><button class="primary">Opslaan</button>${id?'<button type="button" class="danger-btn" id="delClient">Verwijderen</button>':''}</div></form>`);$('#clientForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);['name','attention','street','postal','city','phone','email','notes'].forEach(k=>c[k]=f.get(k));await JKDB.put('clients',c);closeModal();toast('Klant opgeslagen');if(state.route==='more')render();});$('#delClient')?.addEventListener('click',async()=>{if(confirm('Klant verwijderen?')){await JKDB.remove('clients',id);closeModal();}});}
  async function showChecklists(){const cs=await JKDB.all('checklists');modal(`${modalHead('Algemene checklists')}<button class="primary" id="addCheck" style="width:100%;margin-bottom:12px">+ Nieuwe checklist</button><div class="list">${cs.map(c=>`<div class="list-item clickable" data-checklist="${c.id}"><div class="main"><div class="title">${esc(c.name)}</div><div class="sub">${c.items.length} punten</div></div><span>›</span></div>`).join('')}</div>`);$('#addCheck').addEventListener('click',()=>{editChecklist()});$$('[data-checklist]').forEach(x=>x.addEventListener('click',()=>{editChecklist(x.dataset.checklist)}));}
  async function editChecklist(id){const c=id?await JKDB.get('checklists',id):{id:JKDB.id('check'),name:'',items:[],checked:{}};c.checked=c.checked||{};modal(`${modalHead(id?'Checklist bewerken':'Nieuwe checklist')}<form id="checkForm"><div class="field"><label>Naam</label><input name="name" required value="${esc(c.name)}"></div><div class="field"><label>Punten - één per regel</label><textarea name="items" style="min-height:260px">${esc((c.items||[]).join('\n'))}</textarea></div><div class="button-row"><button class="primary">Opslaan</button>${id?'<button type="button" class="danger-btn" id="delCheck">Verwijderen</button>':''}</div></form>`);$('#checkForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),items=String(f.get('items')).split('\n').map(x=>x.trim()).filter(Boolean),checked={};items.forEach(i=>{if(c.checked?.[i])checked[i]=true});c.name=f.get('name');c.items=items;c.checked=checked;c.updatedAt=new Date().toISOString();await JKDB.put('checklists',c);closeModal();toast('Checklist opgeslagen');if(state.route==='gear'&&state.gearTab==='checks')renderGearContent()});$('#delCheck')?.addEventListener('click',async()=>{if(confirm('Checklist verwijderen?')){await JKDB.remove('checklists',id);closeModal();if(state.route==='gear'&&state.gearTab==='checks')renderGearContent();}})}
  async function showCompany(){
    const c=await JKDB.get('settings','company');
    modal(`${modalHead('Bedrijfsgegevens')}<form id="companyForm"><div class="field"><label>Bedrijfsnaam</label><input name="companyName" value="${esc(c.companyName||'')}"></div><div class="field"><label>Naam</label><input name="owner" value="${esc(c.owner||'')}"></div><label class="checkline"><input type="checkbox" name="kor" ${c.kor?'checked':''}><span>Kleineondernemersregeling (KOR) actief</span></label><div class="field"><label>KOR sinds</label><input type="date" name="korSince" value="${esc(c.korSince||'')}"></div><div class="field"><label>Standaard uurtarief voor facturen</label><input type="number" step="0.01" name="defaultRate" value="${esc(c.defaultRate||'')}"></div><div class="field"><label>Notities</label><textarea name="notes">${esc(c.notes||'')}</textarea></div><button class="primary" style="width:100%">Opslaan</button></form>`);
    $('#companyForm').addEventListener('submit',async e=>{
      e.preventDefault();const f=new FormData(e.target);
      if(num(c.defaultRate)!==num(f.get('defaultRate'))){const finance=await refreshFinance();for(const j of finance.jobs.filter(j=>j.paymentPaid))await freezeLegacyPayments(finance,j.id);}
      Object.assign(c,{companyName:f.get('companyName'),owner:f.get('owner'),kor:f.get('kor')==='on',korSince:f.get('korSince'),defaultRate:f.get('defaultRate'),notes:f.get('notes')});
      await JKDB.put('settings',c);closeModal();toast('Bedrijfsgegevens opgeslagen');
    });
  }

  async function showWebsiteEditor(){
    let remote={};
    try{remote=(await JKCloud.getWebsiteContent())||{};}catch(e){console.warn('Website-inhoud ophalen mislukt',e);}
    const c={...DEFAULT_WEBSITE_CONTENT,...remote};
    const field=(name,label,rows=2)=>`<div class="field"><label>${esc(label)}</label><textarea name="${name}" rows="${rows}">${esc(c[name]||'')}</textarea></div>`;
    const short=(name,label)=>`<div class="field"><label>${esc(label)}</label><input name="${name}" value="${esc(c[name]||'')}"></div>`;
    modal(`${modalHead('Website beheren')}
      <div class="card"><h3>Openbare website</h3><p class="muted small">Pas hier de teksten van <strong>jkworks.nl</strong> aan. Met <strong>Website publiceren</strong> worden de wijzigingen direct openbaar; dit staat los van de handmatige app-sync.</p><button type="button" class="secondary" id="openPublicSite" style="width:100%">🌐 Bekijk huidige website</button></div>
      <form id="websiteForm">
        <div class="card"><h3>Intro</h3>${short('heroTitle1','Hoofdtitel - eerste deel')}${short('heroTitle2','Hoofdtitel - benadrukt deel')}${field('heroCopy','Introductietekst',4)}</div>
        <div class="card"><h3>Diensten</h3>${short('servicesTitle','Titel diensten')}${field('servicesIntro','Inleiding diensten',3)}${short('service1Title','Dienst 1 - titel')}${field('service1Text','Dienst 1 - tekst',3)}${short('service2Title','Dienst 2 - titel')}${field('service2Text','Dienst 2 - tekst',3)}${short('service3Title','Dienst 3 - titel')}${field('service3Text','Dienst 3 - tekst',3)}${short('service4Title','Dienst 4 - titel')}${field('service4Text','Dienst 4 - tekst',3)}${short('service5Title','Dienst 5 - titel')}${field('service5Text','Dienst 5 - tekst',3)}${short('service6Title','Dienst 6 - titel')}${field('service6Text','Dienst 6 - tekst',3)}</div>
        <div class="card"><h3>Werkwijze</h3>${short('workflowTitle','Titel')}${field('workflowIntro','Inleiding',2)}${short('step1Title','Stap 1 - titel')}${field('step1Text','Stap 1 - tekst',2)}${short('step2Title','Stap 2 - titel')}${field('step2Text','Stap 2 - tekst',2)}${short('step3Title','Stap 3 - titel')}${field('step3Text','Stap 3 - tekst',2)}${short('step4Title','Stap 4 - titel')}${field('step4Text','Stap 4 - tekst',2)}</div>
        <div class="card"><h3>Over JK Works</h3>${short('aboutTitle','Titel')}${field('aboutP1','Tekst 1',4)}${field('aboutP2','Tekst 2',3)}</div>
        <div class="card"><h3>Contact</h3>${short('contactTitle','Titel')}${field('contactText','Contacttekst',4)}${short('footerText','Korte footeromschrijving')}</div>
        <div class="button-row"><button class="primary" type="submit">Website publiceren</button><button class="secondary" type="button" id="resetWebsiteText">Standaardteksten terugzetten</button></div>
      </form>`);
    $('#openPublicSite').addEventListener('click',()=>window.open('/','_blank','noopener,noreferrer'));
    $('#resetWebsiteText').addEventListener('click',()=>{if(!confirm('Alle tekstvelden terugzetten naar de standaardteksten van v62?'))return;const form=$('#websiteForm');for(const [k,v] of Object.entries(DEFAULT_WEBSITE_CONTENT)){const el=form.elements.namedItem(k);if(el)el.value=v;}toast('Standaardteksten ingevuld - druk op Website publiceren om ze openbaar te maken');});
    $('#websiteForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=e.submitter; if(btn){btn.disabled=true;btn.textContent='Publiceren...';}
      try{
        const f=new FormData(e.target),next={};
        for(const k of Object.keys(DEFAULT_WEBSITE_CONTENT))next[k]=String(f.get(k)||'').trim();
        await JKCloud.saveWebsiteContent(next);
        toast('Website gepubliceerd');
        if(btn){btn.textContent='Gepubliceerd ✓';setTimeout(()=>{btn.disabled=false;btn.textContent='Website publiceren';},1200);}
      }catch(err){if(btn){btn.disabled=false;btn.textContent='Website publiceren';}alert('Publiceren mislukt: '+(err.message||err));}
    });
  }

  let preparedBackupDownload=null;
  const backupSummary=c=>`${c.clients} klanten · ${c.jobs} klussen · ${c.timeEntries} urenregistraties · ${c.documents} documenten · ${c.photos} klusfoto’s`;
  async function showBackup(){
    const b=await JKDB.get('settings','backup'),guard=await JKDB.get('settings','backupRestoreGuard');
    const full=b?.lastBackupVerified?b.lastBackup:null;
    modal(`${modalHead('💾 Back-up en herstellen')}<div class="card"><p class="muted small">Eén bestand voor jouw appgegevens, PDF’s en foto’s. Bewaar de download zelf in iCloud Drive. Cloudgegevens worden alleen gelezen; dit is geen volledige Supabase- of accountback-up.</p>${full?`<p>Laatste volledige appback-up op dit apparaat: <strong>${fmtDateTime(full)}</strong></p>`:'<p>Nog geen gecontroleerde volledige appback-up op dit apparaat bekend.</p>'}${b?.lastBackup&&!full?`<p class="small">Eerdere back-up zonder cloudcontrole: ${fmtDateTime(b.lastBackup)}</p>`:''}${b?.lastLocalBackup?`<p class="small">Laatste lokale kopie: ${fmtDateTime(b.lastLocalBackup)} — cloud niet volledig gecontroleerd.</p>`:''}${b?.counts?`<p class="small">Laatste download: ${backupSummary(b.counts)} · ${humanBytes(b.bytes)}</p>`:''}<p class="muted small">Back-ups zijn vrijwillig. Na je eerste handmatige back-up op dit apparaat verschijnt na 30 dagen een wegklikbare herinnering; je kunt die steeds 30 dagen uitstellen.</p>${guard?.active?'<div class="warning important-warning"><strong>Herstelkopie beschermd</strong><br>Synchronisatie is op dit apparaat geblokkeerd, ook na opnieuw inloggen. De cloud en andere apparaten zijn niet teruggezet. Hervatten vereist een afzonderlijk herstelplan; bewaar eerst deze kopie.</div>':''}</div><div class="card"><label class="small"><input id="backupEncrypt" type="checkbox"> Versleutelen met een wachtwoord</label><p class="muted small">Zonder versleuteling kan iedereen met het bestand de gegevens lezen.</p><div id="backupPasswords" hidden><div class="field"><label>Wachtwoord (minimaal 12 tekens)</label><input id="backupPassword" type="password" autocomplete="new-password"></div><div class="field"><label>Herhaal wachtwoord</label><input id="backupPasswordAgain" type="password" autocomplete="new-password"></div><p class="muted small">Bewaar het wachtwoord apart. Zonder dit wachtwoord kan niemand de back-up openen.</p></div><button class="primary" id="exportBackup" style="width:100%">Back-up maken</button></div><div class="card"><p class="muted small">Herstel vervangt alleen lokale appgegevens, na controle, jouw bevestiging en een veiligheidskopie. Foto’s en PDF’s worden hersteld; website-inhoud en website-aanvragen blijven als bijlage in het back-upbestand. Er wordt niets naar Supabase teruggeschreven.</p><div class="field"><label>Wachtwoord van versleutelde back-up (indien nodig)</label><input id="restorePassword" type="password" autocomplete="off"></div><button class="secondary" id="importBackup" style="width:100%">Back-up herstellen</button></div><p id="backupProgress" class="small" role="status" aria-live="polite"></p>${preparedBackupDownload?'<button class="secondary" id="shareBackup">Bewaar laatste download via deelkaart</button>':''}`);
    $('#backupEncrypt').onchange=e=>{$('#backupPasswords').hidden=!e.target.checked;};
    $('#exportBackup').onclick=exportBackup;$('#importBackup').onclick=()=>$('#hiddenBackupInput').click();
    $('#shareBackup')?.addEventListener('click',async()=>{
      const {blob,name}=preparedBackupDownload,file=new File([blob],name,{type:blob.type});
      try{if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file]});else await JKBackup.download(blob,name);}catch{toast('Delen geannuleerd of niet beschikbaar. De download blijft beschikbaar.');}
    });
  }
  function backupProgress(message){const el=$('#backupProgress');if(el)el.textContent=message;else toast(message);}
  function backupButtons(disabled){for(const id of ['exportBackup','importBackup','backupEncrypt','backupPassword','backupPasswordAgain','restorePassword'])if($('#'+id))$('#'+id).disabled=disabled;}
  async function exportBackup(){
    if(!$('#backupProgress'))await showBackup();
    let password='',downloaded=false;
    if($('#backupEncrypt')?.checked){password=$('#backupPassword').value;if(password!==$('#backupPasswordAgain').value||password.length<12){alert('Gebruik twee gelijke wachtwoorden van minstens 12 tekens.');return;}}
    backupButtons(true);
    try{
      await JKCloud.withBackupRead(async()=>{
        let payload;
        try{payload=await JKBackup.make({progress:backupProgress});}
        catch{
          if(!confirm('Een volledige cloudcontrole lukte niet. Wil je uitsluitend een gecontroleerde lokale kopie downloaden? Gegevens of bestanden die alleen in de cloud staan, kunnen ontbreken.'))throw new Error('Back-up afgebroken.');
          payload=await JKBackup.make({localOnly:true,progress:backupProgress});
        }
        const blob=await JKBackup.pack(payload,password),name=JKBackup.filename(payload.scope.cloudChecked?'JK-Works-backup':'JK-Works-lokale-kopie');
        // Round-trip the exact download, including authenticated decryption when chosen.
        await JKBackup.read(blob,password);
        await JKBackup.download(blob,name);downloaded=true;preparedBackupDownload={blob,name};
        const previous=await JKDB.get('settings','backup')||{id:'backup'};
        await JKDB.putLocal('settings',{...previous,id:'backup',...(payload.scope.cloudChecked?{lastBackup:payload.createdAt,lastBackupVerified:true}:{lastLocalBackup:payload.createdAt}),reminderDismissedAt:null,counts:payload.counts,bytes:blob.size});
        await showBackup();backupProgress(`${payload.scope.cloudChecked?'Volledige appback-up':'Lokale kopie; cloud niet volledig gecontroleerd'} gecontroleerd. Download gestart (${humanBytes(blob.size)}). Bewaar het bestand zelf in iCloud Drive. ${backupSummary(payload.counts)}`);
      });
    }catch(error){backupProgress(downloaded?'De gecontroleerde download is gestart; het overzicht kon niet worden bijgewerkt. Controleer Bestanden/Downloads.':error.safeBackupMessage?'Back-up niet afgerond: '+error.message:'Back-up niet afgerond. Er is geen nieuwe succesvolle back-up geregistreerd. Controleer verbinding en vrije opslagruimte en probeer opnieuw.');}
    finally{password='';for(const id of ['backupPassword','backupPasswordAgain'])if($('#'+id))$('#'+id).value='';backupButtons(false);}
  }
  async function restoreBackup(file){
    let password=$('#restorePassword')?.value||'',restored=false;backupButtons(true);
    try{
      await JKCloud.withBackupRead(async()=>{
        backupProgress('Back-up en bestanden controleren…');
        const prepared=await JKBackup.read(file,password);
        const result=await JKBackup.restore(prepared,{
          progress:backupProgress,
          confirm:async checked=>confirm(`Back-up van ${fmtDateTime(checked.payload.createdAt)}\n${backupSummary(checked.counts)}\n${checked.legacy?'Ouder formaat: zonder checksums; oorspronkelijke volledigheid is niet aantoonbaar.\n':''}${checked.payload.scope?.cloudChecked?'Cloudgegevens zijn bij export gecontroleerd.':'Alleen lokale gegevens; cloudvolledigheid niet aangetoond.'}\n\nDit vervangt de lokale gegevens op dit apparaat. Cloudgegevens worden NIET hersteld. Synchronisatie blijft daarna geblokkeerd om overschrijven te voorkomen. Eerst wordt een veiligheidskopie gedownload. Doorgaan?`),
          safetyCopy:async safety=>{
            const blob=await JKBackup.pack(safety,password),name=JKBackup.filename('JK-Works-veiligheidskopie');
            await JKBackup.read(blob,password);await JKBackup.download(blob,name);
            return confirm('De veiligheidskopie is gecontroleerd en de download gestart. Controleer in Bestanden/Downloads dat het bestand daadwerkelijk is bewaard. Pas daarna worden huidige lokale gegevens vervangen. Is de veiligheidskopie veilig bewaard en wil je herstellen?');
          }
        });
        if(result){restored=true;closeModal();await go('dashboard');await showBackup();backupProgress('Foto’s, PDF’s en appgegevens lokaal hersteld. Synchronisatie geblokkeerd; Supabase is ongewijzigd.');}
        else backupProgress('Herstel geannuleerd. Bestaande gegevens zijn behouden.');
      });
    }catch(error){backupProgress(restored?'Gegevens zijn lokaal hersteld en beschermd tegen sync; het scherm kon niet worden bijgewerkt. Heropen de app.':error.safeBackupMessage?'Herstel niet uitgevoerd: '+error.message+' Bestaande gegevens zijn behouden.':'Herstel niet uitgevoerd: bestand ongeldig of lokale gegevens gewijzigd. Bestaande gegevens zijn behouden.');}
    finally{password='';if($('#restorePassword'))$('#restorePassword').value='';backupButtons(false);}
  }
  async function quickAdd(){modal(`${modalHead('Snel toevoegen')}<div class="grid two"><button class="quick" id="qaInvoice"><span class="emoji">🧾</span><strong>Factuur</strong></button><button class="quick" id="qaQuote"><span class="emoji">📄</span><strong>Offerte</strong></button><button class="quick" id="qaTime"><span class="emoji">🕒</span><strong>Uren</strong></button><button class="quick" id="qaJob"><span class="emoji">👷</span><strong>Klus</strong></button></div>`);$('#qaInvoice').addEventListener('click',()=>{closeModal();createBusinessDoc('Factuur')});$('#qaQuote').addEventListener('click',()=>{closeModal();createBusinessDoc('Offerte')});$('#qaTime').addEventListener('click',()=>{closeModal();chooseJobCalculation()});$('#qaJob').addEventListener('click',()=>{closeModal();editJob()});}

  return {init,go};
})();
document.addEventListener('DOMContentLoaded',()=>App.init());
