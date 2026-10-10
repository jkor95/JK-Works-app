/* JK Works Dordrecht - persoonlijke PWA v66 */
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
  function jobMinutes(j,entries){return (entries||[]).filter(e=>e.jobId===j.id).reduce((sum,e)=>sum+entryMinutes(e),0)}
  function jobOwnAmount(j,entries,company){return Math.round(((jobMinutes(j,entries)/60)*jobRate(j,company)+jobExtra(j))*100)/100}
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
  function openGoogleCalendarForJob(j,extra={}){const url=googleCalendarUrlForJob(j,extra);if(!url){alert('Vul eerst een datum bij de klus in.');return;}window.open(url,'_blank','noopener,noreferrer');}
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
    if(!j?.date)return null;
    const start=jobStartTime(j),end=jobEndTime(j);
    if(!end)return null;
    let endDate=j.date;
    if(start && end<=start)endDate=addDays(j.date,1);
    const d=localCalendarDateToUtc(endDate,end);
    return d && !Number.isNaN(+d) ? d : null;
  }

  const DEFAULT_NOTIFICATION_PREFS={id:'notificationPrefs',badges:true,systemNotifications:false,hours:true,photos:true,quoteCreate:true,quoteSend:true,invoiceCreate:true,invoiceSend:true};
  async function getNotificationPrefs(){return {...DEFAULT_NOTIFICATION_PREFS,...((await JKDB.get('settings','notificationPrefs'))||{})};}
  async function getDismissedActions(){
    const row=await JKDB.get('settings','dismissedActions');
    return row&&row.items&&typeof row.items==='object'?row.items:{};
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
    const end=jobPlannedEnd(j);if(end)return end<=now;
    return !!j?.date && j.date<today();
  }
  async function collectActionItems(){
    const [prefs,jobs,entries,photos,docs,dismissed]=await Promise.all([getNotificationPrefs(),JKDB.all('jobs'),JKDB.all('timeEntries'),JKDB.all('jobPhotos'),JKDB.all('documents'),getDismissedActions()]);
    const now=new Date(),todayIso=today(),items=[];
    const docsByJob=new Map();
    for(const d of docs){const jid=d?.meta?.jobId;if(!jid)continue;if(!docsByJob.has(jid))docsByJob.set(jid,[]);docsByJob.get(jid).push(d);}
    const photosByJob=new Map();
    for(const ph of photos){if(!photosByJob.has(ph.jobId))photosByJob.set(ph.jobId,[]);photosByJob.get(ph.jobId).push(ph);}
    for(const j of jobs){
      const ended=jobHasEnded(j,now),start=jobPlannedStart(j),started=ended||(start?start<=now:!!j.date&&j.date<=todayIso),directDocs=docsByJob.get(j.id)||[],jobName=String(j.clientName||'').trim().toLowerCase(),fuzzyDocs=docs.filter(d=>!d?.meta?.jobId&&j.date&&d?.meta?.workDate===j.date&&jobName&&String(d?.meta?.client?.name||'').trim().toLowerCase()===jobName),jobDocs=[...new Map([...directDocs,...fuzzyDocs].map(d=>[d.id,d])).values()],jobPhotos=photosByJob.get(j.id)||[];
      const add=(x)=>items.push({jobId:j.id,jobTitle:j.title||'Klus',clientName:j.clientName||'',...x});
      if(prefs.hours&&ended&&!j.completionPromptHandledAt){
        const je=entries.filter(e=>e.jobId===j.id),auto=je.find(e=>e.id===j.autoTimeEntryId)||je.find(e=>e.autoFromJobSchedule===true);
        add({key:`hours:${j.id}`,type:'hours',category:'Uren',icon:'🕒',title:auto?'Uren controleren':'Uren invoeren',detail:`${j.clientName||j.title||'Klus'} · ${nlDate(j.date)}`});
      }
      if(prefs.photos&&(j.photoPolicy||'optional')==='required'){
        const has=phase=>jobPhotos.some(p=>p.phase===phase);
        if(j.date&&j.date<=todayIso&&!has('before'))add({key:`photo:before:${j.id}`,type:'photo',phase:'before',category:'Foto’s',icon:'📷',title:'Foto vóór de klus maken',detail:`${j.clientName||j.title||'Klus'} · ${nlDate(j.date)}`});
        if(started&&!has('during'))add({key:`photo:during:${j.id}`,type:'photo',phase:'during',category:'Foto’s',icon:'🔨',title:'Foto tijdens de klus maken',detail:`${j.clientName||j.title||'Klus'} · ${nlDate(j.date)}`});
        if(ended&&!has('after'))add({key:`photo:after:${j.id}`,type:'photo',phase:'after',category:'Foto’s',icon:'✅',title:'Foto na de klus maken',detail:`${j.clientName||j.title||'Klus'} · ${nlDate(j.date)}`});
      }
      const quotes=jobDocs.filter(d=>docFolder(d)==='offerte'),invoices=jobDocs.filter(d=>docFolder(d)==='factuur');
      if(prefs.quoteCreate&&j.quoteNeeded&&!quotes.length&&!ended)add({key:`quoteCreate:${j.id}`,type:'quoteCreate',category:'Offerte',icon:'📄',title:'Offerte opmaken',detail:`${j.clientName||j.title||'Klus'}${j.date?' · '+nlDate(j.date):''}`});
      if(prefs.quoteSend)for(const d of quotes.filter(d=>!d.meta?.sent))add({key:`quoteSend:${d.id}`,type:'quoteSend',docId:d.id,category:'Offerte',icon:'📤',title:'Offerte versturen',detail:`${d.meta?.number||d.filename||j.clientName||j.title}`});
      if(jobPaymentType(j)==='invoice'&&ended){
        if(prefs.invoiceCreate&&!invoices.length)add({key:`invoiceCreate:${j.id}`,type:'invoiceCreate',category:'Factuur',icon:'🧾',title:'Factuur opmaken',detail:`${j.clientName||j.title||'Klus'} · ${nlDate(j.date)}`});
        if(prefs.invoiceSend)for(const d of invoices.filter(d=>!d.meta?.sent))add({key:`invoiceSend:${d.id}`,type:'invoiceSend',docId:d.id,category:'Factuur',icon:'📤',title:'Factuur versturen',detail:`${d.meta?.number||d.filename||j.clientName||j.title}`});
      }
    }
    return items.filter(i=>!dismissed[i.key]);
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
      const j=await JKDB.get('jobs',item.jobId);if(!j)return;if(!j.completionPromptHandledAt){j.completionPromptHandledAt=new Date().toISOString();await JKDB.put('jobs',j);}const es=(await JKDB.all('timeEntries')).filter(e=>e.jobId===j.id),auto=es.find(e=>e.id===j.autoTimeEntryId)||es.find(e=>e.autoFromJobSchedule===true);editTimeEntry(auto?.id||null,j.id);return;
    }
    if(item.type==='photo'){showJob(item.jobId);return;}
    if(item.type==='quoteCreate'){const j=await JKDB.get('jobs',item.jobId);if(j)createBusinessDoc('Offerte',{jobId:j.id,clientId:j.clientId,workDate:j.date});return;}
    if(item.type==='invoiceCreate'){const j=await JKDB.get('jobs',item.jobId);if(j)createBusinessDoc('Factuur',{jobId:j.id,clientId:j.clientId,workDate:j.date});return;}
    if((item.type==='quoteSend'||item.type==='invoiceSend')&&item.docId){showDocument(item.docId);return;}
  }
  async function showActionCenter(){
    const items=await refreshActionBadges(false)||[];
    modal(`${modalHead('Acties')}<div class="card"><div class="section-inline"><h3>Actie nodig</h3><span class="pill ${items.length?'warn':'success'}">${items.length}</span></div><p class="muted small">Deze lijst wordt lokaal berekend uit je klussen, uren, foto’s, offertes en facturen. Open een actie of kies <strong>Niet nodig</strong> om hem weg te strepen uit de melding en badge.</p></div>${items.length?`<div class="action-list">${items.map((i,n)=>`<div class="action-row"><button class="action-open" type="button" data-action-index="${n}"><span class="action-emoji">${i.icon}</span><span class="action-main"><span class="action-category">${esc(i.category)}</span><strong>${esc(i.title)}</strong><small>${esc(i.detail||'')}</small></span><span class="action-chevron">›</span></button><button class="action-dismiss" type="button" data-dismiss-index="${n}" title="Deze melding is niet nodig">✓<span>Niet nodig</span></button></div>`).join('')}</div>`:'<div class="successbox"><strong>Alles bijgewerkt</strong><br><span class="small">Er zijn nu geen openstaande acties.</span></div>'}<button class="secondary" id="actionSettings" style="width:100%;margin-top:12px">Meldingsinstellingen</button>`);
    $$('[data-action-index]').forEach(b=>b.addEventListener('click',()=>runActionItem(items[Number(b.dataset.actionIndex)])));
    $$('[data-dismiss-index]').forEach(b=>b.addEventListener('click',async()=>{const item=items[Number(b.dataset.dismissIndex)];await dismissActionItem(item);showActionCenter();}));
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
    const [prefs,dismissed]=await Promise.all([getNotificationPrefs(),getDismissedActions()]),perm=notificationPermissionLabel(),dismissedCount=Object.keys(dismissed).length;
    const row=(name,label,desc)=>`<label class="notification-pref"><span class="pref-copy"><strong>${label}</strong><small>${desc}</small></span><input type="checkbox" name="${name}" ${prefs[name]?'checked':''}></label>`;
    modal(`${modalHead('Meldingen')}<form id="notificationForm"><div class="card"><div class="section-inline"><h3>iPhone / browser</h3><span class="notification-status ${perm[1]}">${perm[0]}</span></div><p class="muted small">De rode app-badge werkt op ondersteunde geïnstalleerde web-apps. Systeemmeldingen kunnen op iPhone worden toegestaan als JK Works op het beginscherm staat.</p><div class="button-row"><button type="button" class="secondary" id="allowNotifications">Meldingen toestaan</button>${('Notification' in window&&Notification.permission==='granted')?'<button type="button" class="secondary" id="testNotification">Test melding</button>':''}</div>${row('badges','Badge op app-icoon','Toon het aantal openstaande acties op het JK Works-icoon.')}${('Notification' in window&&Notification.permission==='granted')?row('systemNotifications','Systeemmeldingen','Toon een melding wanneer tijdens gebruik van de app een nieuwe actie nodig wordt.'):''}</div><div class="card"><h3>Categorieën</h3>${row('hours','Uren invoeren / controleren','Na de geplande eindtijd van een klus.')}${row('photos','Foto’s maken','Bij verplichte voor-, tijdens- en na-foto’s.')}${row('quoteCreate','Offerte opmaken','Alleen als bij de klus “Offerte nodig” is aangevinkt.')}${row('quoteSend','Offerte versturen','Als een gekoppelde offerte nog niet als Verstuurd staat.')}${row('invoiceCreate','Factuur opmaken','Na een factuurklus als nog geen factuur is gemaakt.')}${row('invoiceSend','Factuur versturen','Als een gekoppelde factuur nog niet als Verstuurd staat.')}</div>${dismissedCount?`<div class="card"><div class="section-inline"><h3>Weggeklikte meldingen</h3><span class="pill">${dismissedCount}</span></div><p class="muted small">Meldingen die je met ‘Niet nodig’ hebt weggeklikt blijven verborgen. Herstel ze hier als je ze opnieuw wilt laten verschijnen.</p><button type="button" class="secondary" id="restoreDismissed" style="width:100%">Alle weggeklikte meldingen herstellen</button></div>`:''}<button class="primary" style="width:100%">Instellingen opslaan</button></form>`);
    $('#allowNotifications').addEventListener('click',async()=>{if(await requestNotificationAccess()){closeModal();showNotificationSettings();}});
    $('#testNotification')?.addEventListener('click',async()=>{try{const reg=await navigator.serviceWorker.ready;await reg.showNotification('JK Works',{body:'Testmelding werkt.',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:'jkworks-test'});}catch(e){alert('Testmelding lukte niet: '+(e.message||e));}});
    $('#restoreDismissed')?.addEventListener('click',async()=>{if(!confirm('Alle weggeklikte meldingen opnieuw zichtbaar maken?'))return;await restoreDismissedActions();closeModal();toast('Weggeklikte meldingen hersteld');showNotificationSettings();});
    $('#notificationForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),next={...prefs};['badges','systemNotifications','hours','photos','quoteCreate','quoteSend','invoiceCreate','invoiceSend'].forEach(k=>{if(k==='systemNotifications'&&(!('Notification' in window)||Notification.permission!=='granted')){next[k]=false;return;}next[k]=f.get(k)==='on';});await JKDB.put('settings',next);closeModal();toast('Meldingsinstellingen opgeslagen');await refreshActionBadges(false);if(state.route==='more')renderMore();});
  }

  async function ensureJobTimeEntry(j){
    if(!j?.id || !j.date)return null;
    const from=jobStartTime(j),to=jobEndTime(j);
    if(!from || !to)return null;
    const all=await JKDB.all('timeEntries');
    let e=(j.autoTimeEntryId ? all.find(x=>x.id===j.autoTimeEntryId) : null) || all.find(x=>x.jobId===j.id && x.autoFromJobSchedule===true);
    if(!e)e={id:JKDB.id('time'),autoFromJobSchedule:true,createdFromJobAt:new Date().toISOString()};
    Object.assign(e,{jobId:j.id,jobTitle:j.title||'Klus',date:j.date,from,to,note:e.note||'Automatisch vanuit klusplanning',start:null,end:null,autoFromJobSchedule:true});
    await JKDB.put('timeEntries',e);
    if(j.autoTimeEntryId!==e.id){j.autoTimeEntryId=e.id;await JKDB.put('jobs',j);}
    return e;
  }
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
      const jobs=(await JKDB.all('jobs')).filter(j=>!j.completionPromptHandledAt && !state.snoozedReminderJobs.has(j.id));
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
    if(e.date&&e.from&&e.to){let a=new Date(`${e.date}T${e.from}:00`),b=new Date(`${e.date}T${e.to}:00`);if(b<=a)b.setDate(b.getDate()+1);return Math.max(0,Math.round((b-a)/60000));}
    if(e.start&&e.end)return Math.max(0,Math.round((new Date(e.end)-new Date(e.start))/60000));
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

  async function renderDashboard(){
    title('Dashboard');
    const [entries,backup]=await Promise.all([JKDB.all('timeEntries'),JKDB.get('settings','backup')]);
    const daysSinceBackup=backup?.lastBackup?Math.floor((Date.now()-new Date(backup.lastBackup))/86400000):999;
    $('#view').innerHTML=`
      ${daysSinceBackup>7?`<div class="warning"><strong>Back-up aanbevolen</strong><br><span class="small">${backup?.lastBackup?'Laatste back-up '+daysSinceBackup+' dagen geleden.':'Nog geen back-up gemaakt.'}</span> <button class="link-btn" id="dashBackup">Nu maken</button></div>`:''}
      <div class="section-title dashboard-first-title"><h2>Snel openen</h2></div>
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
    $('#newInvoice').addEventListener('click',()=>createBusinessDoc('Factuur'));
    $('#newQuote').addEventListener('click',()=>createBusinessDoc('Offerte'));
    $('#addHours').addEventListener('click',()=>editTimeEntry());
    $('#newJobDash').addEventListener('click',()=>editJob());
    $('#clientsDash').addEventListener('click',()=>showClients());
    $('#timeStatsDash').addEventListener('click',()=>showTimeStats());
    $('#dashBackup')?.addEventListener('click',exportBackup);
  }

  async function renderJobs(){
    title('Klussen');
    const [allJobs,entries,company]=await Promise.all([JKDB.all('jobs'),JKDB.all('timeEntries'),JKDB.get('settings','company')]);
    const jobs=allJobs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const invoiceJobs=jobs.filter(j=>jobPaymentType(j)==='invoice'),cashJobs=jobs.filter(j=>jobPaymentType(j)==='cash');
    const sumAmount=list=>list.reduce((sum,j)=>sum+jobOwnAmount(j,entries,company),0);
    const openAmount=list=>list.reduce((sum,j)=>{const amount=jobOwnAmount(j,entries,company);return sum+(jobHasEnded(j)&&!j.paymentPaid&&amount>0?amount:0)},0);
    const totalMinutes=jobs.reduce((sum,j)=>sum+jobMinutes(j,entries),0);
    const openInvoice=openAmount(invoiceJobs),openCash=openAmount(cashJobs),openTotal=openInvoice+openCash;
    const visible=state.jobPaymentFilter==='invoice'?invoiceJobs:state.jobPaymentFilter==='cash'?cashJobs:jobs;
    $('#view').innerHTML=`<div class="button-row"><button class="primary" id="newJob">+ Nieuwe klus</button></div>
      <div class="card jobs-summary-card" style="margin-top:12px"><div class="section-inline"><h3>Snel overzicht</h3><span class="muted small">intern, geen factuur</span></div><div class="kpi-row"><div class="kpi"><strong>${hoursLabel(totalMinutes)}</strong><span>Geregistreerd</span></div><div class="kpi"><strong>${money(sumAmount(invoiceJobs))}</strong><span>Factuur totaal</span></div><div class="kpi"><strong>${money(sumAmount(cashJobs))}</strong><span>Contant totaal</span></div></div><div class="open-payment-summary ${openTotal>0?'has-open':''}"><div class="open-payment-title"><strong>Openstaand</strong><span>${money(openTotal)}</span></div><div class="open-payment-grid"><div><span>Factuur</span><strong>${money(openInvoice)}</strong></div><div><span>Contant</span><strong>${money(openCash)}</strong></div></div></div><p class="muted small" style="margin-bottom:0">Berekening: geregistreerde uren × uurtarief + eventueel extra bedrag. Openstaand = de klus is afgelopen en de betaling is nog niet als ontvangen gemarkeerd. Toekomstige of nog lopende klussen tellen niet mee. Dit overzicht maakt geen factuur en wordt niet opgenomen in het Jaaroverzicht Facturen.</p></div>
      <div class="tabs" style="margin-top:12px"><button class="tab ${state.jobPaymentFilter==='all'?'active':''}" data-jpf="all">Alles</button><button class="tab ${state.jobPaymentFilter==='invoice'?'active':''}" data-jpf="invoice">Factuur</button><button class="tab ${state.jobPaymentFilter==='cash'?'active':''}" data-jpf="cash">Contant</button></div>
      <div class="section-title"><h2>Klussen</h2></div>${visible.length?`<div class="list">${visible.map(j=>{const mins=jobMinutes(j,entries),amount=jobOwnAmount(j,entries,company),ptype=jobPaymentType(j),unpaid=jobHasEnded(j)&&!j.paymentPaid&&amount>0;return `<div class="list-item clickable job-payment-row ${unpaid?'payment-unpaid':'payment-paid'}" data-job="${j.id}"><div class="main"><div class="title">${esc(j.title)}</div><div class="sub">${esc(j.clientName||'Geen klant')} · ${nlDate(j.date)||'geen datum'}${jobTimeLabel(j)?' · '+esc(jobTimeLabel(j)):''}</div><div class="sub">${hoursLabel(mins)} · ${money(amount)} · <strong>${ptype==='cash'?'Contant':'Factuur'}</strong>${unpaid?' · <strong class="payment-open-text">OPENSTAAND</strong>':j.paymentPaid?' · ✓ ontvangen':''}</div></div><div class="job-row-pills">${unpaid?'<span class="pill danger">Nog te ontvangen</span>':''}<span class="pill ${j.status==='afgerond'?'success':'warn'}">${esc(j.status||'open')}</span></div></div>`}).join('')}</div>`:'<div class="empty">Geen klussen in deze selectie.</div>'}`;
    $('#newJob').addEventListener('click',()=>editJob());
    $$('[data-job]').forEach(x=>x.addEventListener('click',()=>showJob(x.dataset.job)));
    $$('[data-jpf]').forEach(b=>b.addEventListener('click',()=>{state.jobPaymentFilter=b.dataset.jpf;renderJobs()}));
  }
  async function editJob(id){
    const j=id?await JKDB.get('jobs',id):{id:JKDB.id('job'),title:'',clientId:'',clientName:'',attention:'',street:'',postal:'',city:'',phone:'',email:'',date:today(),startTime:'',endTime:'',status:'open',notes:'',checklistId:'',checklistState:{},photoPolicy:'optional',paymentType:'invoice',hourlyRate:'',extraAmount:'',paymentPaid:false,quoteNeeded:false};
    const [clients,checks,company]=await Promise.all([JKDB.all('clients'),JKDB.all('checklists'),JKDB.get('settings','company')]);
    const linked=clients.find(c=>c.id===j.clientId);
    const initial={name:linked?.name||j.clientName||'',attention:linked?.attention||j.attention||'',street:linked?.street||j.street||j.address||'',postal:linked?.postal||j.postal||'',city:linked?.city||j.city||'',phone:linked?.phone||j.phone||'',email:linked?.email||j.email||''};
    modal(`${modalHead(id?'Klus bewerken':'Nieuwe klus')}<form id="jobForm"><div class="card form-section"><h3>Klus</h3><div class="field"><label>Omschrijving klus</label><input name="title" required value="${esc(j.title)}"></div><div class="form-grid"><div class="field"><label>Datum werkzaamheden</label><input type="date" name="date" value="${esc(j.date||'')}"></div><div class="field"><label>Starttijd</label><input type="time" name="startTime" value="${esc(j.startTime||'')}"></div><div class="field"><label>Eindtijd</label><input type="time" name="endTime" value="${esc(j.endTime||'')}"></div><div class="field"><label>Status</label><select name="status"><option ${j.status==='open'?'selected':''}>open</option><option ${j.status==='gepland'?'selected':''}>gepland</option><option ${j.status==='afgerond'?'selected':''}>afgerond</option></select></div></div><p class="muted small">De datum en tijden worden gebruikt voor de agenda-afspraak én automatisch als urenregistratie aangemaakt. Na de geplande eindtijd krijg je bij de eerstvolgende opening een herinnering om de uren te controleren en de factuur te maken.</p></div><div class="card form-section"><h3>Klantgegevens</h3><div class="field"><label>Kies bestaande klant</label><select name="clientId" id="jobClientPick"><option value="">Nieuwe klant / handmatig</option>${clients.map(c=>`<option value="${c.id}" ${j.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Naam/bedrijf</label><input name="clientName" required value="${esc(initial.name)}"></div><div class="field"><label>T.a.v.</label><input name="attention" value="${esc(initial.attention)}"></div><div class="field"><label>Adres</label><input name="street" value="${esc(initial.street)}"></div><div class="form-grid"><div class="field"><label>Postcode</label><input name="postal" value="${esc(initial.postal)}"></div><div class="field"><label>Plaats</label><input name="city" value="${esc(initial.city)}"></div><div class="field"><label>Telefoon</label><input name="phone" value="${esc(initial.phone)}"></div><div class="field"><label>E-mail</label><input type="email" name="email" value="${esc(initial.email)}"></div></div><p class="muted small">Deze klantgegevens worden ook gebruikt voor offertes en facturen. Wijzig je hier een gekoppelde klant, dan wordt de klantkaart bijgewerkt zodat alles gelijk blijft.</p></div><div class="card form-section"><h3>Eigen betaaloverzicht</h3><div class="form-grid"><div class="field"><label>Afhandeling</label><select name="paymentType"><option value="invoice" ${jobPaymentType(j)==='invoice'?'selected':''}>Factuur</option><option value="cash" ${jobPaymentType(j)==='cash'?'selected':''}>Contant</option></select></div><div class="field"><label>Uurtarief voor interne berekening</label><input type="number" step="0.01" min="0" name="hourlyRate" value="${esc(j.hourlyRate!==undefined&&j.hourlyRate!==''?j.hourlyRate:(company?.defaultRate||''))}"></div><div class="field"><label>Extra bedrag / materiaal</label><input type="number" step="0.01" min="0" name="extraAmount" value="${esc(j.extraAmount||'')}"></div><div class="field"><label>Betaalstatus</label><label class="checkline"><input type="checkbox" name="paymentPaid" ${j.paymentPaid?'checked':''}><span>Betaling ontvangen</span></label></div><label class="checkline"><input type="checkbox" name="quoteNeeded" ${j.quoteNeeded?'checked':''}><span>Offerte nodig voor deze klus</span></label></div><p class="muted small">Alleen voor je eigen snelle overzicht. De app rekent geregistreerde uren × uurtarief + extra bedrag. Dit maakt geen factuur en deze bedragen komen niet in het Jaaroverzicht Facturen. Het vinkje ‘Offerte nodig’ wordt gebruikt voor je actiemeldingen.</p></div><div class="card form-section"><div class="field"><label>Checklist</label><select name="checklistId" id="jobChecklistPick"><option value="">Geen</option>${checks.map(c=>`<option value="${c.id}" ${j.checklistId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Foto's voor / tijdens / na</label><select name="photoPolicy" id="jobPhotoPolicy"><option value="none" ${(j.photoPolicy||'optional')==='none'?'selected':''}>Niet nodig bij deze klus</option><option value="optional" ${(j.photoPolicy||'optional')==='optional'?'selected':''}>Optioneel</option><option value="required" ${(j.photoPolicy||'optional')==='required'?'selected':''}>Verplicht voor, tijdens en na</option></select><small class="muted">Bij Catering / horeca wordt automatisch ‘Niet nodig’ voorgesteld. Bij andere kluschecklists wordt ‘Verplicht’ voorgesteld; je kunt dit altijd zelf wijzigen.</small></div><div class="field"><label>Notities</label><textarea name="notes">${esc(j.notes||'')}</textarea></div></div><div class="button-row"><button class="primary">Opslaan</button>${id?'<button type="button" class="danger-btn" id="delJob">Verwijderen</button>':''}</div></form>`);
    const fillFromClient=(client)=>{if(!client)return;const form=$('#jobForm');form.elements.clientName.value=client.name||'';form.elements.attention.value=client.attention||'';form.elements.street.value=client.street||'';form.elements.postal.value=client.postal||'';form.elements.city.value=client.city||'';form.elements.phone.value=client.phone||'';form.elements.email.value=client.email||'';};
    $('#jobClientPick').addEventListener('change',e=>fillFromClient(clients.find(c=>c.id===e.target.value)));
    let photoPolicyTouched=!!id;
    $('#jobPhotoPolicy').addEventListener('change',()=>{photoPolicyTouched=true});
    $('#jobChecklistPick').addEventListener('change',e=>{
      if(photoPolicyTouched)return;
      const ch=checks.find(c=>c.id===e.target.value),name=String(ch?.name||'').toLowerCase();
      $('#jobPhotoPolicy').value=!ch?'optional':name.includes('catering')||name.includes('horeca')?'none':'required';
    });
    $('#jobForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);let clientId=f.get('clientId'),client=clients.find(c=>c.id===clientId);const values={name:String(f.get('clientName')||'').trim(),attention:f.get('attention')||'',street:f.get('street')||'',postal:f.get('postal')||'',city:f.get('city')||'',phone:f.get('phone')||'',email:f.get('email')||''};if(client){Object.assign(client,values);await JKDB.put('clients',client);}else if(values.name){client={id:JKDB.id('client'),...values,notes:''};clientId=client.id;await JKDB.put('clients',client);}const oldSchedule=`${j.date||''}|${jobStartTime(j)}|${jobEndTime(j)}`;Object.assign(j,{title:f.get('title'),clientId:clientId||'',clientName:values.name,attention:values.attention,street:values.street,address:values.street,postal:values.postal,city:values.city,phone:values.phone,email:values.email,date:f.get('date'),startTime:f.get('startTime')||'',endTime:f.get('endTime')||'',status:f.get('status'),paymentType:f.get('paymentType')==='cash'?'cash':'invoice',hourlyRate:f.get('hourlyRate')||'',extraAmount:f.get('extraAmount')||'',paymentPaid:f.get('paymentPaid')==='on',quoteNeeded:f.get('quoteNeeded')==='on',checklistId:f.get('checklistId'),photoPolicy:f.get('photoPolicy')||'optional',notes:f.get('notes')});const newSchedule=`${j.date||''}|${jobStartTime(j)}|${jobEndTime(j)}`;if(oldSchedule!==newSchedule)j.completionPromptHandledAt=null;await JKDB.put('jobs',j);const autoEntry=await ensureJobTimeEntry(j);closeModal();toast(autoEntry?'Klus en urenregistratie opgeslagen':'Klus opgeslagen - vul start- en eindtijd in voor automatische uren');render();});
    $('#delJob')?.addEventListener('click',async()=>{if(confirm('Klus verwijderen?')){if(j.autoTimeEntryId)await JKDB.remove('timeEntries',j.autoTimeEntryId).catch(()=>{});for(const p of (await JKDB.all('jobPhotos')).filter(x=>x.jobId===j.id))await JKDB.remove('jobPhotos',p.id);await JKDB.remove('jobs',j.id);closeModal();render();}});
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
  async function showJob(id){
    const j=await JKDB.get('jobs',id),entries=(await JKDB.all('timeEntries')).filter(e=>e.jobId===id).sort((a,b)=>entryDate(b).localeCompare(entryDate(a))),check=j.checklistId?await JKDB.get('checklists',j.checklistId):null,client=j.clientId?await JKDB.get('clients',j.clientId):null,company=await JKDB.get('settings','company');
    const photos=(await JKDB.all('jobPhotos')).filter(p=>p.jobId===id).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    const checkHtml=check?check.items.map((item,i)=>`<label class="checkline"><input type="checkbox" data-jobcheck="${i}" ${j.checklistState?.[i]?'checked':''}><span>${esc(item)}</span></label>`).join(''):'<span class="muted small">Geen checklist gekoppeld.</span>';
    const c=client||j,contact=[c.attention?`t.a.v. ${esc(c.attention)}`:'',c.street||j.address?esc(c.street||j.address):'',([c.postal,c.city].filter(Boolean).join(' ')?esc([c.postal,c.city].filter(Boolean).join(' ')):''),c.phone?esc(c.phone):'',c.email?esc(c.email):''].filter(Boolean).join('<br>');
    const policy=j.photoPolicy||'optional';
    const photoCards=Object.entries(photoPhaseMeta).map(([phase,meta])=>{
      const list=photos.filter(p=>p.phase===phase),missing=policy==='required'&&!list.length;
      const thumbs=list.map(p=>{const url=URL.createObjectURL(p.blob);return `<div class="job-photo-thumb"><img src="${url}" alt="${esc(meta.label)} foto"><button type="button" class="photo-delete" data-del-photo="${p.id}" aria-label="Foto verwijderen">×</button></div>`}).join('');
      return `<div class="job-photo-phase ${missing?'photo-missing':''}"><div class="job-photo-head"><strong>${meta.icon} ${meta.label}</strong><span>${list.length} foto${list.length===1?'':'\'s'}${missing?' · nog nodig':''}</span></div><div class="job-photo-grid">${thumbs||'<div class="job-photo-empty">Nog geen foto</div>'}</div><div class="button-row photo-actions"><button type="button" class="secondary" data-camera="${phase}">📷 Foto maken</button><button type="button" class="secondary" data-upload="${phase}">⬆ Uploaden</button></div><input type="file" accept="image/*" capture="environment" data-camera-input="${phase}" hidden><input type="file" accept="image/*" multiple data-upload-input="${phase}" hidden></div>`;
    }).join('');
    const localPhotoInfo='<div class="successbox"><strong>Foto’s op al je apparaten</strong><br><span class="small">Dezelfde foto wordt bij de klus én onder Documenten → Klusfoto’s getoond. Er is maar één cloudbestand. Foto’s worden vóór upload verkleind tot ongeveer maximaal 250 KB per foto en gaan mee bij handmatige Sync.</span></div>';
    const photoNotice=(policy==='required'?'<div class="warning"><strong>Foto’s verplicht bij deze klus</strong><br><span class="small">Maak minimaal één foto vóór, tijdens en na de werkzaamheden.</span></div>':policy==='none'?'<div class="successbox"><strong>Foto’s niet nodig</strong><br><span class="small">Je kunt hieronder alsnog foto’s toevoegen als je dat wilt.</span></div>':'<div class="successbox"><strong>Foto’s optioneel</strong><br><span class="small">Je kunt voor, tijdens en na foto’s toevoegen zonder dat dit verplicht is.</span></div>')+localPhotoInfo;

    const ownMinutes=entries.reduce((sum,e)=>sum+entryMinutes(e),0),ownRate=jobRate(j,company),ownExtra=jobExtra(j),ownTotal=jobOwnAmount(j,entries,company);
    const paymentCard=`<div class="section-title"><h2>Eigen betaaloverzicht</h2><span class="pill ${jobPaymentType(j)==='cash'?'warn':'success'}">${esc(jobPaymentLabel(j))}</span></div><div class="card"><div class="kpi-row"><div class="kpi"><strong>${hoursLabel(ownMinutes)}</strong><span>Uren</span></div><div class="kpi"><strong>${money(ownRate)}</strong><span>Uurtarief</span></div><div class="kpi"><strong>${money(ownTotal)}</strong><span>Totaal</span></div></div><div class="muted small">${hoursLabel(ownMinutes)} × ${money(ownRate)}${ownExtra?` + ${money(ownExtra)} extra`:''} = <strong>${money(ownTotal)}</strong> · ${j.paymentPaid?'✓ betaling ontvangen':'nog niet als ontvangen gemarkeerd'}</div><div class="muted small" style="margin-top:6px">Dit is alleen je interne rekensom en wordt niet opgenomen in het Jaaroverzicht Facturen.</div></div>`;    modal(`${modalHead(j.title)}<div class="button-row"><button class="secondary" id="editThisJob">Bewerken</button><button class="primary" id="hoursThisJob">+ Uren</button><button class="secondary" id="quoteThisJob">+ Offerte</button><button class="secondary" id="invoiceThisJob">+ Factuur</button><button class="secondary" id="calendarThisJob">📅 Google Agenda</button></div><div class="card" style="margin-top:10px"><strong>${esc(c.name||j.clientName||'Geen klant')}</strong><div class="muted small">${nlDate(j.date)}${jobTimeLabel(j)?' · '+esc(jobTimeLabel(j)):''}${contact?'<br>'+contact:''}</div>${j.notes?`<p class="small">${esc(j.notes)}</p>`:''}</div>${paymentCard}<div class="section-title"><h2>Foto’s</h2><span class="muted small">${esc(photoPolicyText(policy))}</span></div>${photoNotice}<div class="job-photo-sections">${photoCards}</div><div class="section-title"><h2>Checklist</h2></div><div class="card">${checkHtml}</div><div class="section-title"><h2>Uren</h2><span class="muted small">${(entries.reduce((s,e)=>s+entryMinutes(e),0)/60).toFixed(2).replace('.',',')} u</span></div>${entries.length?`<div class="list">${entries.map(e=>`<div class="list-item clickable" data-time="${e.id}"><div class="main"><div class="title">${nlDate(entryDate(e))}</div><div class="sub">${esc(entryFrom(e))} - ${esc(entryTo(e))}${e.note?' · '+esc(e.note):''}</div></div><strong>${durationHM(entryMinutes(e))}</strong></div>`).join('')}</div>`:'<div class="empty">Nog geen uren.</div>'}`);
    $('#editThisJob').addEventListener('click',()=>{closeModal();editJob(id)});$('#hoursThisJob').addEventListener('click',()=>{closeModal();editTimeEntry(null,id)});$('#quoteThisJob').addEventListener('click',()=>{closeModal();createBusinessDoc('Offerte',{jobId:j.id,clientId:j.clientId,workDate:j.date})});$('#invoiceThisJob').addEventListener('click',()=>{closeModal();createBusinessDoc('Factuur',{jobId:j.id,clientId:j.clientId,workDate:j.date})});$('#calendarThisJob').addEventListener('click',()=>openGoogleCalendarForJob(j));$$('[data-time]').forEach(x=>x.addEventListener('click',()=>{editTimeEntry(x.dataset.time)}));$$('[data-jobcheck]').forEach(c=>c.addEventListener('change',async()=>{j.checklistState=j.checklistState||{};j.checklistState[c.dataset.jobcheck]=c.checked;await JKDB.put('jobs',j)}));
    $$('[data-camera]').forEach(b=>b.addEventListener('click',()=>document.querySelector(`[data-camera-input="${b.dataset.camera}"]`)?.click()));
    $$('[data-upload]').forEach(b=>b.addEventListener('click',()=>document.querySelector(`[data-upload-input="${b.dataset.upload}"]`)?.click()));
    const handleFiles=async(input,phase)=>{const files=[...(input.files||[])];if(!files.length)return;input.disabled=true;try{for(const file of files)await saveJobPhoto(j.id,phase,file);toast(files.length===1?'Foto opgeslagen':`${files.length} foto’s opgeslagen`);await showJob(j.id);}catch(e){console.error(e);alert('Foto opslaan lukte niet: '+(e.message||e));}finally{input.disabled=false;}};
    $$('[data-camera-input]').forEach(i=>i.addEventListener('change',()=>handleFiles(i,i.dataset.cameraInput)));
    $$('[data-upload-input]').forEach(i=>i.addEventListener('change',()=>handleFiles(i,i.dataset.uploadInput)));
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
      c.innerHTML=`<div class="button-row material-actions"><button class="primary" id="addMbox">+ Nieuwe inpaklijst</button><button class="secondary" id="reorderMboxes">↕ Volgorde wijzigen</button></div><div class="successbox"><strong>Inpakken = afvinken</strong><br><span class="small">Open een Mbox, organizer of losse groep en vink af wat je hebt ingepakt. Met Reset maak je hem weer leeg voor de volgende klus.</span></div><div class="list">${rows.map(m=>{const done=m.items.filter(i=>m.checked?.[i]).length;return `<div class="list-item clickable material-list-item" data-mbox="${m.id}"><div class="main"><div class="title">${esc(m.name)} · ${esc(m.type)}</div><div class="sub">${done}/${m.items.length} afgevinkt${m.notes?' · '+esc(m.notes):''}</div><div class="progress"><i style="width:${m.items.length?Math.round(done/m.items.length*100):0}%"></i></div></div><span>›</span></div>`}).join('')}</div>`;
      $('#addMbox').addEventListener('click',()=>editMbox());
      $('#reorderMboxes').addEventListener('click',()=>reorderMboxes());
      $$('[data-mbox]').forEach(x=>x.addEventListener('click',()=>showMboxChecklist(x.dataset.mbox)));
    }else if(state.gearTab==='checks'){
      const all=await JKDB.all('checklists');
      const rows=all.filter(ch=>(ch.name+' '+(ch.items||[]).join(' ')).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'nl'));
      c.innerHTML=`<div class="button-row material-actions"><button class="primary" id="addJobCheck">+ Nieuwe kluschecklist</button></div><div class="successbox"><strong>Klus voorbereiden = afvinken</strong><br><span class="small">Open een kluschecklist en vink af wat je voor die klus hebt klaargelegd. De vinkjes blijven lokaal bewaard tot je op Reset drukt. Je kunt dezelfde checklist daarnaast nog steeds aan een klus koppelen.</span></div><div class="list">${rows.map(ch=>{const done=(ch.items||[]).filter(i=>ch.checked?.[i]).length;return `<div class="list-item clickable material-list-item" data-jobchecklist="${ch.id}"><div class="main"><div class="title">${esc(ch.name)}</div><div class="sub">${done}/${(ch.items||[]).length} afgevinkt</div><div class="progress"><i style="width:${(ch.items||[]).length?Math.round(done/(ch.items||[]).length*100):0}%"></i></div></div><span>›</span></div>`}).join('')}</div>`;
      $('#addJobCheck').addEventListener('click',()=>editChecklist());
      $$('[data-jobchecklist]').forEach(x=>x.addEventListener('click',()=>showMaterialChecklist(x.dataset.jobchecklist)));
    }else{
      const unified=await unifiedGearRows(),map=Object.fromEntries(unified.boxes.map(m=>[m.id,`${m.name} · ${m.type}`]));
      const rows=unified.rows.filter(t=>(t.name+' '+t.category+' '+(map[t.location]||'')).toLowerCase().includes(q));
      c.innerHTML=`<div class="button-row"><button class="primary" id="addTool">+ Nieuw (hand)gereedschap / materiaal</button></div><div class="successbox"><strong>Gekoppeld register</strong><br><span class="small">Alles uit de inpakchecklists staat automatisch ook in dit register. Voeg je hier iets toe met een locatie, dan wordt het tegelijk aan die inpakchecklist toegevoegd.</span></div><div class="list" style="margin-top:12px">${rows.map(t=>`<div class="list-item clickable" data-registry="${esc(t.key)}"><div class="main"><div class="title">${esc(t.name)}</div><div class="sub">${esc(t.category)} · ${esc(map[t.location]||'Los / vrij')}</div></div><span>›</span></div>`).join('')}</div>`;
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
    modal(`${modalHead(m.name+' · '+m.type)}${m.notes?`<div class="warning small">${esc(m.notes)}</div>`:''}<div class="check-card"><div class="check-summary"><strong>${done}/${m.items.length}</strong><span>afgevinkt</span></div>${m.items.map((item,i)=>`<label class="packing-row"><input type="checkbox" data-pack="${i}" ${m.checked[item]?'checked':''}><span>${esc(item)}</span></label>`).join('')}</div><div class="button-row" style="margin-top:12px"><button class="secondary" id="resetPack">Reset checklist</button><button class="secondary" id="editPack">Lijst bewerken</button></div>`);
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
    title('Documenten');
    const [docs,photos,jobs]=await Promise.all([JKDB.all('documents'),JKDB.all('jobPhotos'),JKDB.all('jobs')]);
    const counts={offerte:0,factuur:0,diversen:0,klusfotos:photos.length};docs.forEach(d=>counts[docFolder(d)]++);
    if(!['offerte','factuur','diversen','klusfotos'].includes(state.docFolder)){
      $('#view').innerHTML=`<div class="button-row"><button class="primary" id="docQuote">+ Offerte</button><button class="primary" id="docInvoice">+ Factuur</button><button class="ghost" id="annualInvoices" style="margin-left:auto;font-size:12px;padding:7px 10px">Jaaroverzicht PDF</button></div><div class="section-title"><h2>Kies een map</h2></div><div class="folder-grid"><button class="folder" data-folder="offerte"><span>📁</span><strong>Offertes</strong><small>${counts.offerte} bestanden</small></button><button class="folder" data-folder="factuur"><span>📁</span><strong>Facturen</strong><small>${counts.factuur} bestanden</small></button><button class="folder" data-folder="diversen"><span>📁</span><strong>Diversen</strong><small>${counts.diversen} bestanden</small></button><button class="folder" data-folder="klusfotos"><span>📷</span><strong>Klusfoto’s</strong><small>${counts.klusfotos} foto${counts.klusfotos===1?'':'’s'}</small></button></div><p class="muted small" style="margin-top:14px">Klusfoto’s gebruikt dezelfde fotorecords als de klus. Er wordt dus geen tweede cloudbestand opgeslagen. Na handmatige Sync zijn ze op je andere apparaten beschikbaar.</p>`;
      $('#docQuote').addEventListener('click',()=>createBusinessDoc('Offerte'));$('#docInvoice').addEventListener('click',()=>createBusinessDoc('Factuur'));$('#annualInvoices').addEventListener('click',()=>showAnnualInvoiceReport());$$('[data-folder]').forEach(x=>x.addEventListener('click',()=>{state.docFolder=x.dataset.folder;renderDocuments()}));
      return;
    }
    if(state.docFolder==='klusfotos') return renderJobPhotoDocuments(photos,jobs);
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
    const labelValue=(label,value)=>{const valLines=pdfWrapText(value||'-',regular,8.5,contentW-122),h=Math.max(17,valLines.length*11+6);ensure(h);page.drawText(pdfSafeText(label),{x:M,y:y-9,size:8,font:bold,color:muted});for(let i=0;i<valLines.length;i++)page.drawText(valLines[i],{x:M+112,y:y-9-(i*11),size:8.5,font:regular,color:dark});y-=h;};
    addPage();
    page.drawText(`Jaaroverzicht verkoopfacturen ${year}`,{x:M,y:y-26,size:20,font:bold,color:dark});y-=38;
    text('Administratief overzicht van de uitgaande facturen in de JK Works-app. Dit document is een samenvatting en vervangt de originele facturen en overige bedrijfsadministratie niet.',M,9,regular,muted,contentW,12);y-=8;
    page.drawRectangle({x:M,y:y-100,width:contentW,height:94,color:light});
    let iy=y-20;const companyName=company?.companyName||'JK Works Dordrecht',owner=company?.owner||'Jeremy Korstanje';
    page.drawText(pdfSafeText(companyName),{x:M+14,y:iy,size:12,font:bold,color:dark});iy-=16;page.drawText(pdfSafeText(owner),{x:M+14,y:iy,size:9,font:regular,color:dark});iy-=14;page.drawText('Van Blanckenburgstraat 72, 3314 WP Dordrecht',{x:M+14,y:iy,size:8.5,font:regular,color:dark});iy-=14;page.drawText('KVK 42078161  |  BTW-ID NL005477968B66',{x:M+14,y:iy,size:8.5,font:regular,color:dark});
    y-=114;
    const structured=invoices.filter(d=>d?.meta?.total!=null&&d.meta.total!==''&&Number.isFinite(Number(d.meta.total))),total=structured.reduce((s,d)=>s+Number(d.meta.total||0),0),paid=structured.filter(d=>d.meta?.paid).reduce((s,d)=>s+Number(d.meta.total||0),0),open=total-paid,vatTotal=invoices.reduce((s,d)=>s+(d.meta?.vatAmount!=null&&Number.isFinite(Number(d.meta.vatAmount))?Number(d.meta.vatAmount):0),0);
    page.drawText('Samenvatting',{x:M,y:y-12,size:13,font:bold,color:dark});y-=28;
    const stats=[['Aantal facturen',String(invoices.length)],['Totaal factuurbedragen',reportMoney(total)],['Waarvan uitgelezen btw',reportMoney(vatTotal)],['Betaald gemarkeerd',reportMoney(paid)],['Openstaand gemarkeerd',reportMoney(open)]];
    for(const [a,b] of stats)labelValue(a,b);
    if(company?.kor){labelValue('KOR',company.korSince?`Actief sinds ${nlDate(company.korSince)}`:'Actief');}
    if(structured.length!==invoices.length){text(`${invoices.length-structured.length} factuur/facturen hebben geen gestructureerd totaalbedrag in de app en zijn daarom niet meegenomen in de totaalsommen. Controleer daarvoor de originele PDF.`,M,8.5,bold,bronze,contentW,11);y-=4;}
    text('Belastingdienst: een volledige administratie omvat meer dan alleen verkoopfacturen. Bewaar de originele facturen en onderliggende administratie. Voor de aangifte inkomstenbelasting zijn onder andere ook zakelijke kosten en gegevens voor winst-en-verliesrekening en balans nodig.',M,8,regular,muted,contentW,10.5);y-=14;
    page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:0.7,color:line});y-=18;
    page.drawText('Facturen',{x:M,y:y-10,size:14,font:bold,color:dark});y-=28;
    for(const d of invoices){
      const m=d.meta||{},number=invoiceReportNumber(d),date=invoiceReportDate(d),client=m.client||{},amount=(m.total!=null&&m.total!==''&&Number.isFinite(Number(m.total)))?reportMoney(m.total):'Zie originele factuur',status=m.paid?'Betaald':(m.sent?'Verstuurd / niet als betaald gemarkeerd':'Niet als verstuurd gemarkeerd');
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
  function docStatusHtml(d){const f=docFolder(d),m=d.meta||{};if(f==='factuur')return `<span class="status-chip ${m.sent?'on':''}">${m.sent?'✓ ':''}Verstuurd</span><span class="status-chip ${m.paid?'on':''}">${m.paid?'✓ ':''}Betaald</span>`;if(f==='offerte')return `<span class="status-chip ${m.sent?'on':''}">${m.sent?'✓ ':''}Verstuurd</span><span class="status-chip ${m.confirmed?'on':''}">${m.confirmed?'✓ ':''}Bevestigd</span>`;return ''}
  function renderDocumentList(docs){const c=$('#docList');if(!c)return;const filtered=docs.filter(d=>docFolder(d)===state.docFolder).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));c.innerHTML=`<div class="section-title"><h2>${state.docFolder==='offerte'?'Offertes':state.docFolder==='factuur'?'Facturen':'Diversen'}</h2></div>${filtered.length?`<div class="list">${filtered.map(d=>{const m=d.meta||{},parsed=m.manualImport&&m.pdfParseVersion===PDF_PARSE_VERSION?(m.businessVerified?' · PDF uitgelezen':' · PDF controle nodig'):'';return `<div class="list-item clickable" data-doc="${d.id}"><div class="document-card"><div class="doc-icon">PDF</div><div class="main"><div class="title">${esc(d.filename)}</div><div class="sub">${m.docDate?nlDate(m.docDate):fmtDateTime(d.createdAt)} · ${esc(d.kind||'PDF')}${parsed}</div>${m.total!=null?`<div class="sub"><strong>${money(m.total)}</strong>${m.number?' · '+esc(m.number):''}</div>`:''}<div class="status-row">${docStatusHtml(d)}</div></div></div><span>›</span></div>`}).join('')}</div>`:'<div class="empty">Deze map is nog leeg.</div>'}`;$$('[data-doc]').forEach(x=>x.addEventListener('click',()=>showDocument(x.dataset.doc)))}
  async function renderJobPhotoDocuments(photos,jobs){
    const jobMap=new Map(jobs.map(j=>[j.id,j]));
    const groups=new Map();
    for(const p of photos.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))){
      const key=p.jobId||'zonder-klus';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
    }
    const phaseOrder=['before','during','after'];
    const html=[...groups.entries()].map(([jobId,list])=>{
      const job=jobMap.get(jobId),title=job?.title||'Klus niet meer aanwezig',sub=[job?.clientName,nlDate(job?.date)].filter(Boolean).join(' · ');
      const phases=phaseOrder.map(phase=>{
        const items=list.filter(p=>p.phase===phase);if(!items.length)return '';
        const meta=photoPhaseMeta[phase]||{label:phase,icon:'📷'};
        return `<div class="photo-doc-phase"><div class="job-photo-head"><strong>${meta.icon} ${esc(meta.label)}</strong><span>${items.length} foto${items.length===1?'':'’s'}</span></div><div class="job-photo-grid">${items.map(p=>{const url=URL.createObjectURL(p.blob);return `<button class="job-photo-thumb photo-doc-thumb" type="button" data-photo-doc="${p.id}"><img src="${url}" alt="${esc(meta.label)} foto"></button>`}).join('')}</div></div>`;
      }).join('');
      return `<div class="card photo-doc-job"><h3>${esc(title)}</h3>${sub?`<div class="muted small">${esc(sub)}</div>`:''}<div class="photo-doc-phases">${phases}</div></div>`;
    }).join('');
    $('#view').innerHTML=`<div class="button-row"><button class="secondary" id="backToFolders">← Mappen</button></div><div class="section-title"><h2>Klusfoto’s</h2><span class="muted small">${photos.length} totaal</span></div><div class="successbox"><strong>Cloudfoto’s zonder dubbele opslag</strong><br><span class="small">Deze map toont exact dezelfde foto’s als bij de klus. Foto’s worden gecomprimeerd naar ongeveer maximaal 250 KB en bij handmatige Sync via Supabase beschikbaar op je andere apparaten.</span></div>${html||'<div class="empty">Nog geen klusfoto’s. Voeg ze toe vanuit een klus.</div>'}`;
    $('#backToFolders').addEventListener('click',()=>{state.docFolder=null;renderDocuments()});
    $$('[data-photo-doc]').forEach(b=>b.addEventListener('click',()=>showPhotoDocument(b.dataset.photoDoc)));
  }
  async function showPhotoDocument(id){
    const p=await JKDB.get('jobPhotos',id);if(!p)return;
    const j=p.jobId?await JKDB.get('jobs',p.jobId):null,meta=photoPhaseMeta[p.phase]||{label:'Foto',icon:'📷'},url=URL.createObjectURL(p.blob);
    modal(`${modalHead(`${meta.icon} ${meta.label}`)}<div class="card"><img src="${url}" alt="Klusfoto" style="width:100%;max-height:62vh;object-fit:contain;border-radius:14px;background:#f2eee7"><h3 style="margin-top:12px">${esc(j?.title||'Klusfoto')}</h3><div class="muted small">${esc(p.name||'foto.jpg')} · ${fmtDateTime(p.createdAt)}${j?.clientName?' · '+esc(j.clientName):''}${p.compressedSize||p.blob?.size?' · '+humanBytes(p.compressedSize||p.blob?.size):''}</div><div class="button-row" style="margin-top:14px"><button class="primary" id="sharePhotoDoc">Delen / bewaar</button><button class="secondary" id="downloadPhotoDoc">Download</button><button class="danger-btn" id="deletePhotoDoc">Verwijderen</button></div></div>`);
    $('#sharePhotoDoc').addEventListener('click',()=>shareBlob(p.blob,p.name||'klusfoto.jpg'));
    $('#downloadPhotoDoc').addEventListener('click',()=>downloadBlob(p.blob,p.name||'klusfoto.jpg'));
    $('#deletePhotoDoc').addEventListener('click',async()=>{if(!confirm('Deze foto verwijderen? De foto verdwijnt ook bij de gekoppelde klus.'))return;await JKDB.remove('jobPhotos',p.id);closeModal();toast('Foto verwijderd');if(state.route==='documents')renderDocuments();});
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
  function businessDescriptionForJob(job,kind,documents=[],checklists=[]){
    if(!job)return 'Werkzaamheden';
    const ctx=businessJobContext(job,checklists),date=job.date?nlDate(job.date):'',time=jobTimeRange(job);
    if(/catering|horeca/.test(ctx))return ['Cateringwerkzaamheden',date,time].filter(Boolean).join(' - ');
    if(/keuken/.test(ctx)){
      if(kind==='Factuur'){
        const quote=linkedQuoteNumber(job,documents);
        return `Keuken plaatsen en afwerken conform geaccepteerde offerte/opdracht${quote?' '+quote:''}`;
      }
      return 'Keuken plaatsen en afwerken';
    }
    const title=String(job.title||'').trim();
    if(title&&!/^werkuren$/i.test(title))return [title,date].filter(Boolean).join(' - ');
    return ['Werkzaamheden',date].filter(Boolean).join(' - ');
  }
  async function createBusinessDoc(kind,prefill={}){
    const [clients,entries,company,jobs,checklists,documents]=await Promise.all([JKDB.all('clients'),JKDB.all('timeEntries'),JKDB.get('settings','company'),JKDB.all('jobs'),JKDB.all('checklists'),JKDB.all('documents')]);
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
    modal(`${modalHead('Nieuwe '+kind.toLowerCase())}<form id="businessDocForm"><div class="card form-section"><h3>Document</h3><div class="field"><label>Kies klus</label><select id="jobPick" required><option value="">Selecteer een klus</option>${jobs.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(j=>`<option value="${j.id}" ${prefill.jobId===j.id?'selected':''}>${esc(j.title)}${j.clientName?' · '+esc(j.clientName):''}${j.date?' · '+nlDate(j.date):''}</option>`).join('')}</select><small class="muted">De gekozen klus wordt gebruikt voor klantgegevens, datum werkzaamheden en de koppeling met uren. De app maakt op basis van de gekozen klus automatisch een passende omschrijving op regel 1. Je kunt deze omschrijving altijd zelf aanpassen.</small><button type="button" class="secondary" id="calendarBusinessJob" style="margin-top:8px">📅 Zet gekozen klus in agenda</button></div><div class="form-grid"><div class="field"><label>${kind}nummer</label><input name="number" required value="${esc(number)}"></div><div class="field"><label>${isInvoice?'Factuurdatum':'Datum'}</label><input type="date" name="docDate" required value="${esc(docDate)}"></div><div class="field"><label>${isInvoice?'Datum werkzaamheden':'Werkzaamheden op'}</label>${isInvoice?`<input name="workDate" placeholder="bijv. 04-10-2026" value="${esc(initialWorkDate)}">`:`<input type="date" name="workDate" value="${esc(initialWorkDate)}">`}</div><div class="field"><label>${isInvoice?'Vervaldatum':'Geldig t/m'}</label><input type="date" name="deadline" required value="${esc(deadline)}" ${isInvoice?'':`max="${esc(deadline)}"`}>${isInvoice?'<small class="muted">Standaard 14 dagen na de factuurdatum. Je kunt de vervaldatum handmatig aanpassen.</small>':'<small class="muted">Automatisch maximaal 4 weken na offertedatum, of uiterlijk de dag vóór de werkzaamheden.</small>'}</div></div><label class="checkline" style="margin-top:12px"><input type="checkbox" id="docKor" ${defaultKor?'checked':''}><span><strong>KOR toepassen op dit document</strong><br><small class="muted">Aan = KOR-sjabloon zonder btw. Uit = normaal sjabloon met 21% btw.</small></span></label></div>
      <div class="card form-section"><h3>Klant</h3><div class="field"><label>Kies bestaande klant</label><select id="clientPick"><option value="">Handmatig invullen</option>${clients.map(c=>`<option value="${c.id}" ${prefill.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Naam/bedrijf</label><input name="clientName" value="${esc(pClient.name||'')}"></div><div class="field"><label>T.a.v.</label><input name="attention" value="${esc(pClient.attention||'')}"></div><div class="field"><label>Adres</label><input name="address" value="${esc(pClient.address||pClient.street||'')}"></div><div class="field"><label>Postcode/Plaats</label><input name="postalCity" value="${esc(pClient.postalCity||[pClient.postal,pClient.city].filter(Boolean).join(' '))}"></div><div class="form-grid"><div class="field"><label>Telefoon</label><input name="phone" value="${esc(pClient.phone||'')}"></div><div class="field"><label>E-mail</label><input type="email" name="email" value="${esc(pClient.email||'')}"></div></div><p class="muted small">Kies je een bestaande klant, dan worden alle klantgegevens automatisch overgenomen.</p></div>
      <div class="card form-section"><div class="section-inline"><h3>Werkzaamheden / materiaal</h3><span class="muted small">max. 4 regels in huidig sjabloon</span></div><div class="line-head"><span>Aantal</span><span>Omschrijving</span><span>Prijs p/st</span><span>Totaal</span></div>${lines.map((l,i)=>`<div class="invoice-line" data-line="${i}"><input inputmode="decimal" name="qty${i}" placeholder="1" value="${esc(l.qty||'')}"><textarea rows="2" name="desc${i}" placeholder="${i===0?'Passende werkzaamheden':'Omschrijving'}">${esc(l.description||'')}</textarea><input inputmode="decimal" name="price${i}" placeholder="0,00" value="${esc(l.price||'')}"><output id="lineTotal${i}">€ 0,00</output></div>`).join('')}<div id="vatTotals"><div class="doc-total" id="subtotalRow"><span>Subtotaal excl. btw</span><strong id="subtotalTotal">€ 0,00</strong></div><div class="doc-total tax-row" id="vatRow"><span>Btw 21%</span><strong id="vatTotal">€ 0,00</strong></div><div class="doc-total"><span id="grandTotalLabel">Totaal incl. btw</span><strong id="grandTotal">€ 0,00</strong></div></div></div>
      ${entries.length?`<div class="card form-section"><div class="section-inline"><h3>Uren uit urenregistratie</h3><span class="muted small">optioneel</span></div><p class="muted small">Selecteer registraties van de gekozen klus. De app telt ze op en zet ze op regel 1 met een passende omschrijving voor de gekozen klus; uren en uurtarief blijven apart zichtbaar.</p><div class="hours-select">${entries.sort((a,b)=>entryDate(b).localeCompare(entryDate(a))).slice(0,30).map(e=>`<label class="packing-row"><input type="checkbox" data-hour-entry="${e.id}"><span><strong>${nlDate(entryDate(e))}</strong> · ${esc(e.jobTitle||'Algemeen')} · ${durationHM(entryMinutes(e))} u</span></label>`).join('')}</div><div class="form-grid" style="margin-top:10px"><div class="field"><label>Uurtarief voor geselecteerde uren</label><input id="hourRate" inputmode="decimal" value="${esc(company?.defaultRate||'')}"></div><div class="field action-field"><button type="button" class="secondary" id="hoursToLine">Voeg geselecteerde uren toe</button></div></div></div>`:''}
      <div class="button-row"><button class="primary">Maak PDF</button><button type="button" class="secondary" data-close>Annuleren</button></div></form>`);

    function recalc(){let subtotal=0;for(let i=0;i<4;i++){const q=num($(`[name=qty${i}]`).value),p=num($(`[name=price${i}]`).value),t=q*p;subtotal+=t;$(`#lineTotal${i}`).textContent=money(t)}const kor=!!$('#docKor')?.checked,vat=kor?0:Math.round(subtotal*21)/100,total=Math.round((subtotal+vat)*100)/100;$('#subtotalTotal').textContent=money(subtotal);$('#vatTotal').textContent=money(vat);$('#grandTotal').textContent=money(total);$('#subtotalRow').hidden=kor;$('#vatRow').hidden=kor;$('#grandTotalLabel').textContent=kor?'Totaal te betalen':'Totaal incl. btw';return {subtotal,vat,total,kor}}
    $$('[name^=qty], [name^=price]').forEach(x=>x.addEventListener('input',recalc));const docKor=$('#docKor');if(docKor){docKor.dataset.manual=typeof prefill.korApplied==='boolean'?'1':'0';docKor.addEventListener('change',e=>{e.target.dataset.manual='1';recalc()});}recalc();
    const fillDocClient=(c)=>{if(!c)return;$('#clientPick').value=c.id||'';$('[name=clientName]').value=c.name||'';$('[name=attention]').value=c.attention||'';$('[name=address]').value=c.street||c.address||'';$('[name=postalCity]').value=c.postalCity||[c.postal,c.city].filter(Boolean).join(' ');$('[name=phone]').value=c.phone||'';$('[name=email]').value=c.email||'';};
    $('#clientPick').addEventListener('change',e=>fillDocClient(clients.find(x=>x.id===e.target.value)));
    const desc0=$('[name=desc0]');
    if(desc0){desc0.dataset.autoDescription=String(desc0.value||'').trim()?'0':'1';desc0.addEventListener('input',e=>e.target.dataset.autoDescription='0');}
    $('#jobPick').addEventListener('change',async e=>{const j=jobs.find(x=>x.id===e.target.value);if(!j)return;let c=j.clientId?clients.find(x=>x.id===j.clientId):null;if(!c)c={id:j.clientId||'',name:j.clientName||'',attention:j.attention||'',street:j.street||j.address||'',postal:j.postal||'',city:j.city||'',phone:j.phone||'',email:j.email||''};fillDocClient(c);if(j.date)$('[name=workDate]').value=isInvoice?nlDate(j.date):j.date;const description=businessDescriptionForJob(j,kind,documents,checklists);if(desc0&&(!desc0.value.trim()||desc0.dataset.autoDescription==='1'||/^Werkuren$/i.test(desc0.value.trim()))){desc0.value=description;desc0.dataset.autoDescription='1';}if(!isInvoice){const ev=new Event('change');$('[name=workDate]').dispatchEvent(ev);}});
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
    $('#hoursToLine')?.addEventListener('click',()=>{const ids=$$('[data-hour-entry]:checked').map(x=>x.dataset.hourEntry);if(!ids.length){alert('Selecteer eerst één of meer urenregistraties.');return}const jobId=$('#jobPick').value;let selected=entries.filter(e=>ids.includes(e.id));if(jobId){const matching=selected.filter(e=>!e.jobId||e.jobId===jobId);if(matching.length!==selected.length){alert('Selecteer alleen urenregistraties die bij de gekozen klus horen.');return;}selected=matching;}const minutes=selected.reduce((s,e)=>s+entryMinutes(e),0),hours=Math.round(minutes/60*100)/100,rate=num($('#hourRate').value);const idx=0,dates=[...new Set(selected.map(entryDate))].sort(),job=jobs.find(j=>j.id===jobId),description=businessDescriptionForJob(job,kind,documents,checklists);$(`[name=qty${idx}]`).value=String(hours).replace('.',',');const desc=$(`[name=desc${idx}]`);if(desc&&(!desc.value.trim()||desc.dataset.autoDescription==='1'||/^Werkuren$/i.test(desc.value.trim()))){desc.value=description;desc.dataset.autoDescription='1';}$(`[name=price${idx}]`).value=rate?String(rate).replace('.',','):'';if(!$('[name=workDate]').value&&dates.length)$('[name=workDate]').value=dates.length===1?nlDate(dates[0]):`${nlDate(dates[0])} t/m ${nlDate(dates.at(-1))}`;recalc();toast('Geregistreerde uren met passende omschrijving op regel 1 gezet');});
    $('#businessDocForm').addEventListener('submit',async e=>{e.preventDefault();const selectedJob=jobs.find(x=>x.id===$('#jobPick').value);if(!selectedJob){alert('Selecteer eerst een klus.');return;}const f=new FormData(e.target),items=[];for(let i=0;i<4;i++)items.push({qty:f.get(`qty${i}`),description:f.get(`desc${i}`),price:f.get(`price${i}`)});let chosenDeadline=f.get('deadline');if(isInvoice){if(!chosenDeadline)chosenDeadline=addDays(f.get('docDate'),14);}else{const max=maxQuoteDeadline();if(!chosenDeadline||chosenDeadline>max)chosenDeadline=max;}const totals=recalc(),korApplied=totals.kor;const finalItems=items.map(l=>({...l,vatRate:korApplied?0:21}));const data={kind,number:f.get('number'),docDate:f.get('docDate'),workDate:f.get('workDate'),deadline:chosenDeadline,jobId:$('#jobPick').value,clientId:$('#clientPick').value,client:{name:f.get('clientName'),attention:f.get('attention'),address:f.get('address'),postalCity:f.get('postalCity'),phone:f.get('phone'),email:f.get('email')},lines:finalItems,korApplied,vatRate:korApplied?0:21,subtotalExVat:totals.subtotal,vatAmount:totals.vat,total:totals.total};try{const d=await generateBusinessPdf(data);closeModal();toast(kind+' opgeslagen');state.docFolder=isInvoice?'factuur':'offerte';await showDocument(d.id);if(state.route==='documents')renderDocuments();}catch(err){console.error(err);alert('PDF maken mislukt: '+err.message)}});
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
    if(layout.lines.length===1){
      // De baseline iets laten zakken zodat één regel optisch midden in de tabelrij staat.
      page.drawText(layout.lines[0],{x,y:yCenter-(layout.size*0.16),size:layout.size,font});
      return;
    }
    const h=layout.lineHeight||layout.size;
    // Twee regels als één tekstblok verticaal centreren in dezelfde tabelrij.
    const baselineAdjust=layout.size*0.16;
    page.drawText(layout.lines[0],{x,y:yCenter+(h/2)-baselineAdjust,size:layout.size,font});
    page.drawText(layout.lines[1],{x,y:yCenter-(h/2)-baselineAdjust,size:layout.size,font});
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
    const bytes=await pdf.save(),blob=new Blob([bytes],{type:'application/pdf'}),filename=`${data.number}.pdf`,folder=isInvoice?'factuur':'offerte',doc={id:JKDB.id('doc'),filename,kind:data.kind,folder,blob,createdAt:new Date().toISOString(),meta:{...data,subtotalExVat:subtotal,vatAmount:vat,total,korApplied,korDetected:korApplied,lines:data.lines,sent:false,paid:false,confirmed:false}};await JKDB.put('documents',doc);return doc;
  }
  function moneyNumber(v){return Number(v||0).toFixed(2).replace('.',',')}
  async function showDocument(id){
    const d=await JKDB.get('documents',id),folder=docFolder(d),m=d.meta||{},linkedJob=m.jobId?await JKDB.get('jobs',m.jobId):null;
    const statusBox=folder==='factuur'?`<div class="card" style="margin-top:12px"><h3>Status factuur</h3><label class="checkline"><input type="checkbox" id="docSent" ${m.sent?'checked':''}><span>Verstuurd</span></label><label class="checkline"><input type="checkbox" id="docPaid" ${m.paid?'checked':''}><span>Betaald</span></label></div>`:folder==='offerte'?`<div class="card" style="margin-top:12px"><h3>Status offerte</h3><label class="checkline"><input type="checkbox" id="docSent" ${m.sent?'checked':''}><span>Verstuurd</span></label><label class="checkline"><input type="checkbox" id="docConfirmed" ${m.confirmed?'checked':''}><span>Bevestigd</span></label></div>`:'';
    const importedDataCard=(['factuur','offerte'].includes(folder)&&m.manualImport)?`<div class="card" style="margin-top:12px"><h3>Uitgelezen documentgegevens</h3>${m.pdfParseError?`<div class="warning small">${esc(m.pdfParseError)}</div>`:`<div class="successbox small">PDF automatisch uitgelezen${m.businessVerified?' en JK Works herkend':''}.</div>`}<div class="form-grid"><div class="field"><label>${folder==='factuur'?'Factuurnummer':'Offertenummer'}</label><input id="parsedDocNumber" value="${esc(m.number||'')}"></div><div class="field"><label>${folder==='factuur'?'Factuurdatum':'Offertedatum'}</label><input id="parsedDocDate" type="date" value="${esc(m.docDate||'')}"></div><div class="field"><label>Klant</label><input id="parsedClientName" value="${esc(m.client?.name||'')}"></div><div class="field"><label>Totaalbedrag</label><input id="parsedTotal" inputmode="decimal" value="${m.total!=null?esc(String(m.total).replace('.',',')):''}"></div></div><label class="checkline"><input type="checkbox" id="parsedKor" ${(m.korApplied===true||m.korDetected)?'checked':''}><span>KOR / vrijgesteld van btw staat op dit document</span></label><div class="button-row"><button class="secondary" id="saveParsedDoc">Gegevens opslaan</button><button class="ghost" id="reparseDoc">PDF opnieuw uitlezen</button></div><p class="muted small">Deze gegevens worden gebruikt voor het jaaroverzicht. Je kunt ze corrigeren als een afwijkend PDF-sjabloon niet perfect wordt herkend.</p></div>`:'';
    modal(`${modalHead(d.filename)}<div class="card"><div class="document-card"><div class="doc-icon">PDF</div><div><h3>${esc(d.filename)}</h3><div class="muted small">${esc(d.kind||'PDF')} · ${fmtDateTime(d.createdAt)}</div>${d.meta?.total!=null?`<div class="big-number" style="margin-top:8px">${money(d.meta.total)}</div>`:''}</div></div><div class="button-row" style="margin-top:14px"><button class="primary" id="previewDoc">Bekijk PDF</button><button class="secondary" id="shareDoc">Delen / bewaar in iCloud</button><button class="secondary" id="downloadDoc">Download</button>${folder==='offerte'||folder==='factuur'?'<button class="secondary" id="calendarDoc">📅 Google Agenda</button>':''}</div><div id="pdfPreviewHost" class="pdf-preview-host" hidden></div>${folder==='offerte'&&d.meta?.lines?`<button class="secondary" id="quoteToInvoice" style="width:100%;margin-top:10px">Zet offerte om naar factuur</button>`:''}</div>${importedDataCard}${statusBox}<div class="card" style="margin-top:12px"><h3>Documentnaam</h3><div class="field"><label>Bestandsnaam</label><input id="docFilename" value="${esc(d.filename)}"></div><button class="secondary" id="renameDoc" style="width:100%">Naam opslaan</button></div><div class="card" style="margin-top:12px"><h3>Map</h3><div class="field"><label>Verplaats document naar</label><select id="moveDocFolder"><option value="offerte" ${folder==='offerte'?'selected':''}>Offertes</option><option value="factuur" ${folder==='factuur'?'selected':''}>Facturen</option><option value="diversen" ${folder==='diversen'?'selected':''}>Diversen</option></select></div></div><button class="danger-btn" id="delDoc" style="width:100%">Uit app verwijderen</button>`);
    $('#previewDoc').addEventListener('click',()=>{const host=$('#pdfPreviewHost');if(!host)return;if(!host.hidden){host.hidden=true;host.innerHTML='';if(state.activeBlobUrl){URL.revokeObjectURL(state.activeBlobUrl);state.activeBlobUrl=null;}$('#previewDoc').textContent='Bekijk PDF';return;}if(!(d.blob instanceof Blob)){alert('Dit PDF-bestand is nog niet lokaal beschikbaar. Synchroniseer opnieuw en probeer het nog eens.');return;}state.activeBlobUrl=URL.createObjectURL(d.blob);host.innerHTML=`<iframe class="pdf-preview-frame" src="${state.activeBlobUrl}#toolbar=0&navpanes=0" title="Voorbeeld ${esc(d.filename)}"></iframe>`;host.hidden=false;$('#previewDoc').textContent='Sluit voorbeeld';});
    $('#shareDoc').addEventListener('click',()=>shareBlob(d.blob,d.filename));$('#downloadDoc').addEventListener('click',()=>downloadBlob(d.blob,d.filename));$('#calendarDoc')?.addEventListener('click',async()=>{let job=linkedJob;if(!job){const jobs=await JKDB.all('jobs');const work=String(m.workDate||'');const clientName=normGearName(m.client?.name||'');job=jobs.find(j=>(!work||j.date===work||nlDate(j.date)===work)&&(!clientName||normGearName(j.clientName)===clientName));}if(!job){alert('Dit document is niet aan een klus gekoppeld. Open de offerte/factuur vanuit een klus om een agenda-afspraak te maken.');return;}openGoogleCalendarForJob(job,{kind:d.kind||folder,number:m.number||d.filename.replace(/\.pdf$/i,'')});});$('#quoteToInvoice')?.addEventListener('click',()=>{const meta=d.meta;closeModal();createBusinessDoc('Factuur',{jobId:meta.jobId,clientId:meta.clientId,client:meta.client,lines:meta.lines,workDate:meta.workDate,korApplied:meta.korApplied})});
    $('#saveParsedDoc')?.addEventListener('click',async()=>{
      d.meta=d.meta||{};d.meta.number=$('#parsedDocNumber').value.trim();d.meta.docDate=$('#parsedDocDate').value;d.meta.client={...(d.meta.client||{}),name:$('#parsedClientName').value.trim()};const raw=$('#parsedTotal').value.trim();d.meta.total=raw?num(raw):null;d.meta.korDetected=$('#parsedKor').checked;d.meta.korApplied=$('#parsedKor').checked;d.meta.businessVerified=true;d.meta.pdfParseError='';await JKDB.put('documents',d);toast('Documentgegevens opgeslagen');
    });
    $('#reparseDoc')?.addEventListener('click',async()=>{const btn=$('#reparseDoc');btn.disabled=true;btn.textContent='PDF uitlezen...';const company=await JKDB.get('settings','company');await parseStoredBusinessDocument(d,company,true);closeModal();toast(d.meta?.businessVerified?'PDF opnieuw uitgelezen':'PDF uitgelezen - controleer de gegevens');showDocument(d.id);});
    const saveStatus=async()=>{d.meta=d.meta||{};if($('#docSent'))d.meta.sent=$('#docSent').checked;if($('#docPaid'))d.meta.paid=$('#docPaid').checked;if($('#docConfirmed'))d.meta.confirmed=$('#docConfirmed').checked;await JKDB.put('documents',d);toast('Status opgeslagen');refreshActionBadges(false).catch(()=>{});};
    $('#docSent')?.addEventListener('change',saveStatus);$('#docPaid')?.addEventListener('change',saveStatus);$('#docConfirmed')?.addEventListener('change',saveStatus);
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
    $('#moveDocFolder').addEventListener('change',async e=>{const target=e.target.value;d.folder=target;d.kind=target==='offerte'?'Offerte':target==='factuur'?'Factuur':'Diversen';d.meta=d.meta||{};if(target!=='factuur')d.meta.paid=false;if(target!=='offerte')d.meta.confirmed=false;await JKDB.put('documents',d);toast('Document verplaatst');closeModal();state.docFolder=target;if(state.route==='documents')renderDocuments();});
    $('#delDoc').addEventListener('click',async()=>{if(confirm('Deze PDF uit de app verwijderen?')){await JKDB.remove('documents',id);closeModal();if(state.route==='documents')renderDocuments();}});
  }
  async function shareBlob(blob,filename){const file=new File([blob],filename,{type:blob.type||'application/pdf'});try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({files:[file]});return}}catch(e){if(e.name==='AbortError')return}downloadBlob(blob,filename)}
  function downloadBlob(blob,filename){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();const u=a.href;a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}

  async function renderMore(){
    title('Meer');const [clients,entries,company,backup,cloudStatus]=await Promise.all([JKDB.all('clients'),JKDB.all('timeEntries'),JKDB.get('settings','company'),JKDB.get('settings','backup'),JKDB.get('settings','cloudStatus')]);const cs=JKCloud.status();
    $('#view').innerHTML=`<div class="list"><div class="list-item clickable" id="cloudMenu"><div class="main"><div class="title">☁️ Synchronisatie</div><div class="sub">${cs.signedIn?(cs.email+' · '+(cloudStatus?.lastSync?'laatst '+fmtDateTime(cloudStatus.lastSync):'nog niet gesynchroniseerd')):'Niet ingelogd'}</div></div><span>›</span></div><div class="list-item clickable" id="notificationMenu"><div class="main"><div class="title">🔔 Meldingen</div><div class="sub">Acties, badges en meldingen per categorie</div></div><span>›</span></div><div class="list-item clickable" id="timeMenu"><div class="main"><div class="title">🕒 Urenregistratie</div><div class="sub">${entries.length} registraties · handmatig van-tot</div></div><span>›</span></div><div class="list-item clickable" id="timeStatsMenu"><div class="main"><div class="title">📊 Urenstatistieken</div><div class="sub">Grafieken per maand, kwartaal en kalenderjaar</div></div><span>›</span></div><div class="list-item clickable" id="clientMenu"><div class="main"><div class="title">👥 Klanten</div><div class="sub">${clients.length} klanten</div></div><span>›</span></div><div class="list-item clickable" id="companyMenu"><div class="main"><div class="title">🏢 Bedrijfsgegevens</div><div class="sub">${esc(company?.companyName||'JK Works Dordrecht')}</div></div><span>›</span></div><div class="list-item clickable" id="websiteMenu"><div class="main"><div class="title">🌐 Website beheren</div><div class="sub">Teksten van jkworks.nl aanpassen en direct publiceren</div></div><span>›</span></div><div class="list-item clickable" id="backupMenu"><div class="main"><div class="title">☁️ Back-up & herstel</div><div class="sub">${backup?.lastBackup?'Laatst '+fmtDateTime(backup.lastBackup):'Nog geen back-up'}</div></div><span>›</span></div></div>`;
    $('#cloudMenu').addEventListener('click',showCloud);$('#notificationMenu').addEventListener('click',showNotificationSettings);$('#timeMenu').addEventListener('click',showTimeEntries);$('#timeStatsMenu').addEventListener('click',showTimeStats);$('#clientMenu').addEventListener('click',showClients);$('#companyMenu').addEventListener('click',showCompany);$('#websiteMenu').addEventListener('click',showWebsiteEditor);$('#backupMenu').addEventListener('click',showBackup);
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
  function periodBuckets(entries,jobs,company,mode){
    const now=new Date(), map=new Map();
    const ensure=info=>{let b=map.get(info.key);if(!b){b={...info,minutes:0,amount:0,invoiceAmount:0,cashAmount:0};map.set(info.key,b)}return b};
    for(const e of entries){const info=statPeriodInfo(entryDate(e),mode);if(!info)continue;ensure(info).minutes+=entryMinutes(e)}
    for(const j of jobs){
      let date=j.date||'';
      if(!date){const linked=entries.filter(e=>e.jobId===j.id).map(entryDate).filter(Boolean).sort();date=linked[0]||''}
      const info=statPeriodInfo(date,mode);if(!info)continue;
      const b=ensure(info),amount=jobOwnAmount(j,entries,company);b.amount+=amount;if(jobPaymentType(j)==='cash')b.cashAmount+=amount;else b.invoiceAmount+=amount;
    }
    if(mode==='week'){
      const arr=[];
      const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      const dow=monday.getDay()||7;monday.setDate(monday.getDate()-(dow-1));
      for(let i=11;i>=0;i--){
        const d=new Date(monday);d.setDate(d.getDate()-(i*7));
        const ymd=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const w=isoWeekInfo(ymd);if(!w)continue;
        arr.push(map.get(w.key)||{key:w.key,label:w.label,sort:w.key,minutes:0,amount:0,invoiceAmount:0,cashAmount:0});
      }
      return arr;
    }
    if(mode==='month'){
      const arr=[];for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;arr.push(map.get(key)||{key,label:`${monthName(d.getMonth())} '${String(d.getFullYear()).slice(-2)}`,sort:key,minutes:0,amount:0,invoiceAmount:0,cashAmount:0})}return arr;
    }
    if(mode==='quarter'){
      const arr=[];const cq=Math.floor(now.getMonth()/3)+1;for(let i=7;i>=0;i--){let q=cq-i,y=now.getFullYear();while(q<=0){q+=4;y--}while(q>4){q-=4;y++}const key=`${y}-Q${q}`;arr.push(map.get(key)||{key,label:`Q${q} '${String(y).slice(-2)}`,sort:`${y}-${q}`,minutes:0,amount:0,invoiceAmount:0,cashAmount:0})}return arr;
    }
    const years=[...map.values()].sort((a,b)=>a.sort.localeCompare(b.sort));if(!years.length)years.push({key:String(now.getFullYear()),label:String(now.getFullYear()),sort:String(now.getFullYear()),minutes:0,amount:0,invoiceAmount:0,cashAmount:0});return years;
  }
  function statsChartHtml(buckets){
    const maxMinutes=Math.max(1,...buckets.map(b=>b.minutes||0)),maxAmount=Math.max(1,...buckets.map(b=>b.amount||0)),total=buckets.reduce((s,b)=>s+b.minutes,0),totalAmount=buckets.reduce((s,b)=>s+(b.amount||0),0),invoiceAmount=buckets.reduce((s,b)=>s+(b.invoiceAmount||0),0),cashAmount=buckets.reduce((s,b)=>s+(b.cashAmount||0),0);
    return `<div class="kpi-row stats-kpis stats-kpis-money"><div class="kpi"><strong>${hoursLabel(total)}</strong><span>Totaal uren</span></div><div class="kpi"><strong>${money(totalAmount)}</strong><span>Intern totaal</span></div><div class="kpi"><strong>${money(invoiceAmount)}</strong><span>Factuur</span></div><div class="kpi"><strong>${money(cashAmount)}</strong><span>Contant</span></div></div><div class="stats-dual-legend"><span><i class="legend-hours"></i>Uren</span><span><i class="legend-amount"></i>Bedrag</span></div><div class="hours-chart-wrap"><div class="hours-chart dual-stats-chart">${buckets.map(b=>{const hoursPct=b.minutes?Math.max(4,(b.minutes/maxMinutes)*100):0,amountPct=b.amount?Math.max(4,(b.amount/maxAmount)*100):0;return `<div class="dual-stat-col"><div class="dual-stat-values"><span>${b.minutes?hoursLabel(b.minutes):'0 u'}</span><span>${money(b.amount||0)}</span></div><div class="dual-stat-bars"><div class="dual-stat-bar"><div class="hours-bar-track"><div class="hours-bar" style="height:${hoursPct}%"></div></div><small>Uren</small></div><div class="dual-stat-bar"><div class="hours-bar-track amount-bar-track"><div class="amount-bar" style="height:${amountPct}%"></div></div><small>Bedrag</small></div></div><div class="hours-label">${esc(b.label)}</div></div>`}).join('')}</div></div><p class="muted tiny stats-scale-note">Uren en bedragen hebben ieder hun eigen schaal, zodat beide staven goed leesbaar blijven.</p>`;
  }
  function customerStatBuckets(entries,jobs,clients,company,year){
    const jobMap=new Map(jobs.map(j=>[j.id,j])), clientMap=new Map(clients.map(c=>[c.id,c])), map=new Map();
    const bucketForJob=j=>{const c=j?.clientId?clientMap.get(j.clientId):null,name=(c?.name||j?.clientName||'Geen klant / algemeen').trim()||'Geen klant / algemeen',key=j?.clientId||('name:'+name.toLowerCase());let b=map.get(key);if(!b){b={key,label:name,minutes:0,amount:0,invoiceAmount:0,cashAmount:0};map.set(key,b)}return b};
    for(const e of entries){
      const d=new Date(entryDate(e)+'T12:00:00');if(Number.isNaN(d.getTime())||d.getFullYear()!==year)continue;
      const j=jobMap.get(e.jobId);if(j)bucketForJob(j).minutes+=entryMinutes(e);else {let b=map.get('general');if(!b){b={key:'general',label:'Geen klant / algemeen',minutes:0,amount:0,invoiceAmount:0,cashAmount:0};map.set('general',b)}b.minutes+=entryMinutes(e)}
    }
    for(const j of jobs){
      let date=j.date||'';if(!date){const linked=entries.filter(e=>e.jobId===j.id).map(entryDate).filter(Boolean).sort();date=linked[0]||''}
      const d=new Date(date+'T12:00:00');if(Number.isNaN(d.getTime())||d.getFullYear()!==year)continue;
      const b=bucketForJob(j),amount=jobOwnAmount(j,entries,company);b.amount+=amount;if(jobPaymentType(j)==='cash')b.cashAmount+=amount;else b.invoiceAmount+=amount;
    }
    return [...map.values()].sort((a,b)=>b.amount-a.amount||b.minutes-a.minutes||a.label.localeCompare(b.label,'nl'));
  }
  function customerStatsHtml(buckets,year){
    const totalMinutes=buckets.reduce((s,b)=>s+b.minutes,0),totalAmount=buckets.reduce((s,b)=>s+b.amount,0),invoiceAmount=buckets.reduce((s,b)=>s+b.invoiceAmount,0),cashAmount=buckets.reduce((s,b)=>s+b.cashAmount,0),maxMinutes=Math.max(1,...buckets.map(b=>b.minutes||0)),maxAmount=Math.max(1,...buckets.map(b=>b.amount||0));
    if(!buckets.length)return `<div class="empty">Geen uren of klusbedragen voor klanten geregistreerd in ${year}.</div>`;
    return `<div class="kpi-row stats-kpis stats-kpis-money"><div class="kpi"><strong>${hoursLabel(totalMinutes)}</strong><span>Uren ${year}</span></div><div class="kpi"><strong>${money(totalAmount)}</strong><span>Intern totaal</span></div><div class="kpi"><strong>${money(invoiceAmount)}</strong><span>Factuur</span></div><div class="kpi"><strong>${money(cashAmount)}</strong><span>Contant</span></div></div><div class="stats-dual-legend customer-legend"><span><i class="legend-hours"></i>Uren</span><span><i class="legend-amount"></i>Bedrag</span></div><div class="customer-hours-list">${buckets.map(b=>`<div class="customer-hours-row"><div class="customer-hours-top"><strong>${esc(b.label)}</strong></div><div class="customer-dual-metric"><div class="customer-metric-line"><div class="customer-metric-head"><span>Uren</span><strong>${hoursLabel(b.minutes)}</strong></div><div class="customer-hours-track"><i style="width:${b.minutes?Math.max(3,(b.minutes/maxMinutes)*100):0}%"></i></div></div><div class="customer-metric-line"><div class="customer-metric-head"><span>Bedrag</span><strong>${money(b.amount||0)}</strong></div><div class="customer-hours-track customer-amount-track"><i style="width:${b.amount?Math.max(3,(b.amount/maxAmount)*100):0}%"></i></div></div></div><div class="customer-money-split"><span>Factuur ${money(b.invoiceAmount)}</span><span>Contant ${money(b.cashAmount)}</span></div></div>`).join('')}</div><p class="muted tiny stats-scale-note">Uren en bedragen hebben ieder hun eigen schaal.</p>`;
  }
  async function showTimeStats(){
    const [entries,jobs,clients,company]=await Promise.all([JKDB.all('timeEntries'),JKDB.all('jobs'),JKDB.all('clients'),JKDB.get('settings','company')]);let mode='month';
    const years=[...new Set([...entries.map(e=>entryDate(e)),...jobs.map(j=>j.date)].filter(Boolean).map(v=>new Date(v+'T12:00:00')).filter(d=>!Number.isNaN(d.getTime())).map(d=>d.getFullYear()))].sort((a,b)=>b-a);
    if(!years.includes(new Date().getFullYear()))years.unshift(new Date().getFullYear());
    let customerYear=new Date().getFullYear();
    const draw=()=>{
      const customerMode=mode==='client';
      const content=customerMode?customerStatsHtml(customerStatBuckets(entries,jobs,clients,company,customerYear),customerYear):statsChartHtml(periodBuckets(entries,jobs,company,mode));
      modal(`${modalHead('Uren & bedragen')}<div class="tabs stats-tabs"><button type="button" class="tab ${mode==='week'?'active':''}" data-stat-mode="week">Per week</button><button type="button" class="tab ${mode==='month'?'active':''}" data-stat-mode="month">Per maand</button><button type="button" class="tab ${mode==='quarter'?'active':''}" data-stat-mode="quarter">Per kwartaal</button><button type="button" class="tab ${mode==='year'?'active':''}" data-stat-mode="year">Per kalenderjaar</button><button type="button" class="tab ${mode==='client'?'active':''}" data-stat-mode="client">Per klant</button></div>${customerMode?`<div class="field stat-year-field"><label>Kalenderjaar</label><select id="customerStatsYear">${years.map(y=>`<option value="${y}" ${y===customerYear?'selected':''}>${y}</option>`).join('')}</select></div>`:''}${content}<p class="muted small stats-note">Uren komen uit je urenregistraties. Bedragen zijn alleen je interne klusberekening: uren × uurtarief + extra bedrag. Factuur en contant blijven apart zichtbaar. Deze bedragen worden niet gebruikt voor het Jaaroverzicht Facturen.</p>`);
      $$('[data-stat-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.statMode;draw()}));
      $('#customerStatsYear')?.addEventListener('change',e=>{customerYear=Number(e.target.value);draw()});
    };draw();
  }

  async function showTimeEntries(){
    const es=(await JKDB.all('timeEntries')).sort((a,b)=>(entryDate(b)+entryFrom(b)).localeCompare(entryDate(a)+entryFrom(a)));
    modal(`${modalHead('Urenregistratie')}<button class="primary" id="addTime" style="width:100%;margin-bottom:12px">+ Uren toevoegen</button>${es.length?`<div class="list">${es.map(e=>`<div class="list-item clickable" data-time="${e.id}"><div class="main"><div class="title">${nlDate(entryDate(e))} · ${esc(e.jobTitle||'Algemeen')}</div><div class="sub">${esc(entryFrom(e))} - ${esc(entryTo(e))}${e.note?' · '+esc(e.note):''}</div></div><strong>${durationHM(entryMinutes(e))}</strong></div>`).join('')}</div>`:'<div class="empty">Nog geen uren geregistreerd.</div>'}`);$('#addTime').addEventListener('click',()=>{editTimeEntry()});$$('[data-time]').forEach(x=>x.addEventListener('click',()=>{editTimeEntry(x.dataset.time)}));
  }
  async function editTimeEntry(id,jobId=''){
    const jobs=(await JKDB.all('jobs')).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),old=id?await JKDB.get('timeEntries',id):null,e=old||{id:JKDB.id('time'),jobId,jobTitle:'',date:today(),from:'08:00',to:'16:30',note:''};
    if(old&&!e.date&&e.start){e.date=entryDate(e);e.from=entryFrom(e);e.to=entryTo(e)}
    modal(`${modalHead(id?'Uren bewerken':'Uren toevoegen')}<form id="timeForm"><div class="field"><label>Klus</label><select name="jobId"><option value="">Algemene werkzaamheden</option>${jobs.map(j=>`<option value="${j.id}" ${j.id===e.jobId?'selected':''}>${esc(j.title)}${j.clientName?' · '+esc(j.clientName):''}</option>`).join('')}</select></div><div class="field"><label>Datum</label><input type="date" name="date" required value="${esc(e.date||today())}"></div><div class="form-grid"><div class="field"><label>Van</label><input type="time" name="from" required value="${esc(e.from||'')}"></div><div class="field"><label>Tot</label><input type="time" name="to" required value="${esc(e.to||'')}"></div></div><div class="field"><label>Notitie</label><input name="note" value="${esc(e.note||'')}" placeholder="Optioneel"></div><div class="card small" id="timePreview"></div><div class="button-row"><button class="primary">Opslaan</button><button type="button" class="secondary" id="calendarTime">📅 Google Agenda</button>${id?'<button type="button" class="danger-btn" id="delTime">Verwijderen</button>':''}</div></form>`);
    const preview=()=>{const f=new FormData($('#timeForm')),tmp={date:f.get('date'),from:f.get('from'),to:f.get('to')};$('#timePreview').innerHTML=`Tijdsduur: <strong>${durationHM(entryMinutes(tmp))} uur</strong>`};$$('#timeForm input').forEach(x=>x.addEventListener('input',preview));preview();$('#calendarTime').addEventListener('click',()=>{const f=new FormData($('#timeForm')),j=jobs.find(x=>x.id===f.get('jobId'))||{};openGoogleCalendarForTimeEntry({jobTitle:j.title||e.jobTitle||'Algemene werkzaamheden',date:f.get('date'),from:f.get('from'),to:f.get('to'),note:f.get('note')},j)});$('#timeForm').addEventListener('submit',async ev=>{ev.preventDefault();const f=new FormData(ev.target),j=jobs.find(x=>x.id===f.get('jobId'));Object.assign(e,{jobId:j?.id||'',jobTitle:j?.title||'Algemene werkzaamheden',date:f.get('date'),from:f.get('from'),to:f.get('to'),note:f.get('note'),start:null,end:null});await JKDB.put('timeEntries',e);closeModal();toast('Uren opgeslagen');if(state.route==='dashboard')render();else showTimeEntries();});$('#delTime')?.addEventListener('click',async()=>{if(confirm('Deze urenregistratie verwijderen?')){await JKDB.remove('timeEntries',id);closeModal();showTimeEntries();}});
  }

  async function showClients(){const cs=(await JKDB.all('clients')).sort((a,b)=>a.name.localeCompare(b.name));modal(`${modalHead('Klanten')}<button class="primary" id="addClient" style="width:100%;margin-bottom:12px">+ Nieuwe klant</button>${cs.length?`<div class="list">${cs.map(c=>`<div class="list-item clickable" data-client="${c.id}"><div class="main"><div class="title">${esc(c.name)}</div><div class="sub">${esc([c.city,c.phone].filter(Boolean).join(' · ')||'Geen extra gegevens')}</div></div><span>›</span></div>`).join('')}</div>`:'<div class="empty">Nog geen klanten.</div>'}`);$('#addClient').addEventListener('click',()=>{editClient()});$$('[data-client]').forEach(x=>x.addEventListener('click',()=>{editClient(x.dataset.client)}));}
  async function editClient(id){const c=id?await JKDB.get('clients',id):{id:JKDB.id('client'),name:'',attention:'',street:'',postal:'',city:'',phone:'',email:'',notes:''};modal(`${modalHead(id?'Klant bewerken':'Nieuwe klant')}<form id="clientForm"><div class="field"><label>Naam/bedrijf</label><input name="name" required value="${esc(c.name)}"></div><div class="field"><label>T.a.v.</label><input name="attention" value="${esc(c.attention||'')}"></div><div class="field"><label>Adres</label><input name="street" value="${esc(c.street||'')}"></div><div class="form-grid"><div class="field"><label>Postcode</label><input name="postal" value="${esc(c.postal||'')}"></div><div class="field"><label>Plaats</label><input name="city" value="${esc(c.city||'')}"></div><div class="field"><label>Telefoon</label><input name="phone" value="${esc(c.phone||'')}"></div><div class="field"><label>E-mail</label><input type="email" name="email" value="${esc(c.email||'')}"></div><div class="field full"><label>Notities</label><textarea name="notes">${esc(c.notes||'')}</textarea></div></div><div class="button-row"><button class="primary">Opslaan</button>${id?'<button type="button" class="danger-btn" id="delClient">Verwijderen</button>':''}</div></form>`);$('#clientForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);['name','attention','street','postal','city','phone','email','notes'].forEach(k=>c[k]=f.get(k));await JKDB.put('clients',c);closeModal();toast('Klant opgeslagen');if(state.route==='more')render();});$('#delClient')?.addEventListener('click',async()=>{if(confirm('Klant verwijderen?')){await JKDB.remove('clients',id);closeModal();}});}
  async function showChecklists(){const cs=await JKDB.all('checklists');modal(`${modalHead('Algemene checklists')}<button class="primary" id="addCheck" style="width:100%;margin-bottom:12px">+ Nieuwe checklist</button><div class="list">${cs.map(c=>`<div class="list-item clickable" data-checklist="${c.id}"><div class="main"><div class="title">${esc(c.name)}</div><div class="sub">${c.items.length} punten</div></div><span>›</span></div>`).join('')}</div>`);$('#addCheck').addEventListener('click',()=>{editChecklist()});$$('[data-checklist]').forEach(x=>x.addEventListener('click',()=>{editChecklist(x.dataset.checklist)}));}
  async function editChecklist(id){const c=id?await JKDB.get('checklists',id):{id:JKDB.id('check'),name:'',items:[],checked:{}};c.checked=c.checked||{};modal(`${modalHead(id?'Checklist bewerken':'Nieuwe checklist')}<form id="checkForm"><div class="field"><label>Naam</label><input name="name" required value="${esc(c.name)}"></div><div class="field"><label>Punten - één per regel</label><textarea name="items" style="min-height:260px">${esc((c.items||[]).join('\n'))}</textarea></div><div class="button-row"><button class="primary">Opslaan</button>${id?'<button type="button" class="danger-btn" id="delCheck">Verwijderen</button>':''}</div></form>`);$('#checkForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target),items=String(f.get('items')).split('\n').map(x=>x.trim()).filter(Boolean),checked={};items.forEach(i=>{if(c.checked?.[i])checked[i]=true});c.name=f.get('name');c.items=items;c.checked=checked;c.updatedAt=new Date().toISOString();await JKDB.put('checklists',c);closeModal();toast('Checklist opgeslagen');if(state.route==='gear'&&state.gearTab==='checks')renderGearContent()});$('#delCheck')?.addEventListener('click',async()=>{if(confirm('Checklist verwijderen?')){await JKDB.remove('checklists',id);closeModal();if(state.route==='gear'&&state.gearTab==='checks')renderGearContent();}})}
  async function showCompany(){
    const c=await JKDB.get('settings','company');
    modal(`${modalHead('Bedrijfsgegevens')}<form id="companyForm"><div class="field"><label>Bedrijfsnaam</label><input name="companyName" value="${esc(c.companyName||'')}"></div><div class="field"><label>Naam</label><input name="owner" value="${esc(c.owner||'')}"></div><label class="checkline"><input type="checkbox" name="kor" ${c.kor?'checked':''}><span>Kleineondernemersregeling (KOR) actief</span></label><div class="field"><label>KOR sinds</label><input type="date" name="korSince" value="${esc(c.korSince||'')}"></div><div class="field"><label>Standaard uurtarief voor facturen</label><input type="number" step="0.01" name="defaultRate" value="${esc(c.defaultRate||'')}"></div><div class="field"><label>Notities</label><textarea name="notes">${esc(c.notes||'')}</textarea></div><button class="primary" style="width:100%">Opslaan</button></form>`);
    $('#companyForm').addEventListener('submit',async e=>{
      e.preventDefault();const f=new FormData(e.target);
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

  function showBackup(){modal(`${modalHead('Back-up & herstel')}<div class="card"><h3>iCloud-back-up maken</h3><p class="muted small">Maakt één bestand met klanten, uren, checklists en alle PDF's. Bewaar dat via de deelkaart in iCloud Drive.</p><button class="primary" id="exportBackup" style="width:100%">Maak volledige back-up</button></div><div class="card"><h3>Back-up terugzetten</h3><p class="muted small">Dit vervangt de huidige lokale appgegevens.</p><button class="secondary" id="importBackup" style="width:100%">Kies back-upbestand</button></div>`);$('#exportBackup').addEventListener('click',exportBackup);$('#importBackup').addEventListener('click',()=>$('#hiddenBackupInput').click())}
  async function blobToDataURL(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob)})}
  async function serializeRecord(r){const o={...r};for(const k of Object.keys(o))if(o[k] instanceof Blob)o[k]={__blob:true,type:o[k].type,data:await blobToDataURL(o[k])};return o}
  function dataURLToBlob(url){const [meta,b64]=url.split(','),mime=/data:(.*?);base64/.exec(meta)?.[1]||'application/octet-stream',bin=atob(b64),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:mime})}
  async function exportBackup(){try{const payload={format:'JKWORKS_BACKUP_V2',createdAt:new Date().toISOString(),stores:{}};for(const s of JKDB.stores){payload.stores[s]=[];for(const r of await JKDB.all(s))payload.stores[s].push(await serializeRecord(r))}const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),name=`JK-Works-backup-${today()}.jkbackup.json`;await JKDB.put('settings',{id:'backup',lastBackup:new Date().toISOString()});closeModal();await shareBlob(blob,name);toast('Back-up gemaakt');if(state.route==='dashboard')render();}catch(e){alert('Back-up maken lukte niet: '+e.message)}}
  async function restoreBackup(file){try{const p=JSON.parse(await file.text());if(!['JKWORKS_BACKUP_V1','JKWORKS_BACKUP_V2'].includes(p.format))throw new Error('Onbekend back-upformaat');if(!confirm('Huidige appgegevens vervangen door deze back-up?'))return;for(const s of JKDB.stores){await JKDB.clear(s);for(const rec of (p.stores[s]||[])){for(const k of Object.keys(rec))if(rec[k]?.__blob)rec[k]=dataURLToBlob(rec[k].data);await JKDB.put(s,rec)}}await JKDB.put('settings',{id:'backup',lastBackup:new Date().toISOString()});await JKDB.put('settings',{id:'seedVersion',value:3,at:new Date().toISOString()});toast('Back-up teruggezet');go('dashboard')}catch(e){alert('Terugzetten mislukt: '+e.message)}}
  async function quickAdd(){modal(`${modalHead('Snel toevoegen')}<div class="grid two"><button class="quick" id="qaInvoice"><span class="emoji">🧾</span><strong>Factuur</strong></button><button class="quick" id="qaQuote"><span class="emoji">📄</span><strong>Offerte</strong></button><button class="quick" id="qaTime"><span class="emoji">🕒</span><strong>Uren</strong></button><button class="quick" id="qaJob"><span class="emoji">👷</span><strong>Klus</strong></button></div>`);$('#qaInvoice').addEventListener('click',()=>{closeModal();createBusinessDoc('Factuur')});$('#qaQuote').addEventListener('click',()=>{closeModal();createBusinessDoc('Offerte')});$('#qaTime').addEventListener('click',()=>{closeModal();editTimeEntry()});$('#qaJob').addEventListener('click',()=>{closeModal();editJob()});}

  return {init,go};
})();
document.addEventListener('DOMContentLoaded',()=>App.init());
