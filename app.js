/* JK Works Dordrecht - persoonlijke PWA v31 */
const App = (() => {
  const state = {route:'dashboard',gearTab:'mboxes',docFolder:null,importFolderTarget:'diversen',pdfLibPromise:null,activeBlobUrl:null,reminderChecking:false,snoozedReminderJobs:new Set(),pendingCloudRefresh:false,pendingAuthRefresh:false};
  window.__JK_UI_BUSY=false;
  const PDFLIB_URL='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
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
    let endDate=date,end=endTime?localCalendarDateToUtc(date,endTime):null;
    if(!end)end=new Date(start.getTime()+60*60*1000);
    else if(end<=start){endDate=addDays(date,1);end=localCalendarDateToUtc(endDate,endTime);}
    const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.000Z$/,'Z');
    return `${stamp(start)}/${stamp(end)}`;
  }
  async function resolveJobCalendarTimes(j){
    // Lees bij klikken altijd de nieuwste klus uit IndexedDB. Zo gebruiken we niet
    // per ongeluk een oudere modal-kopie zonder recent opgeslagen tijden.
    const fresh=(j?.id ? await JKDB.get('jobs',j.id) : null) || j || {};
    let start=jobStartTime(fresh),end=jobEndTime(fresh);
    if(start)return {job:fresh,start,end};
    // Fallback: gekoppelde urenregistraties op dezelfde klus/datum.
    if(fresh?.id && fresh?.date){
      const entries=(await JKDB.all('timeEntries')).filter(e=>e.jobId===fresh.id && entryDate(e)===fresh.date);
      const starts=entries.map(e=>normalizeClockTime(entryFrom(e))).filter(Boolean).sort();
      const ends=entries.map(e=>normalizeClockTime(entryTo(e))).filter(Boolean).sort();
      if(starts.length){ start=starts[0]; end=ends.length?ends.at(-1):''; }
    }
    return {job:fresh,start,end};
  }
  function googleCalendarUrlForJob(j,extra={},times={}){
    if(!j?.date)return '';
    const titleText=extra.title||`JK Works - ${j.title||'Klus'}`;
    const details=[extra.kind&&extra.number?`${extra.kind}: ${extra.number}`:'',j.clientName?`Klant: ${j.clientName}`:'',j.phone?`Telefoon: ${j.phone}`:'',j.email?`E-mail: ${j.email}`:'',j.notes?`Notities: ${j.notes}`:''].filter(Boolean).join('\n');
    const location=[j.street||j.address,j.postal,j.city].filter(Boolean).join(', ');
    const params=new URLSearchParams({action:'TEMPLATE',text:titleText,details,location,ctz:CALENDAR_TZ});
    const start=normalizeClockTime(times.start||jobStartTime(j)),end=normalizeClockTime(times.end||jobEndTime(j));
    // Gebruik exact dezelfde timed-range-opbouw als bij Urenregistratie, want die
    // route wordt door Google Agenda op mobiel correct als afspraak met tijd gelezen.
    if(start){
      const range=calendarTimedRange(j.date,start,end);
      if(range) params.set('dates',range);
    }
    if(!params.has('dates')) params.set('dates',`${String(j.date).replaceAll('-','')}/${String(addDays(j.date,1)).replaceAll('-','')}`);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
  async function openGoogleCalendarForJob(j,extra={}){
    const resolved=await resolveJobCalendarTimes(j);
    const fresh=resolved.job||j;
    if(!fresh?.date){alert('Vul eerst een datum bij de klus in.');return;}
    if(!resolved.start){
      const proceed=confirm('Bij deze klus kon geen starttijd worden gevonden. Google Agenda zou er daarom een hele-dagafspraak van maken. Toch doorgaan?');
      if(!proceed)return;
    }
    const url=googleCalendarUrlForJob(fresh,extra,resolved);
    if(url)window.open(url,'_blank','noopener,noreferrer');
  }
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
    params.set('dates',calendarTimedRange(date,from,to));
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
    if(!signedIn){
      if($('#modalRoot'))$('#modalRoot').innerHTML='';
      return;
    }
    if(!appReady){
      window.__JK_SEEDING=true;
      try{await JKDB.seed();}finally{window.__JK_SEEDING=false;}
      bindNav();
      bindInputs();
      appReady=true;
      if(navigator.onLine)setTimeout(()=>ensurePdfLib().catch(()=>{}),1000);
    }
    await render();
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
    document.addEventListener('jkcloud-sync',e=>{
      if(!JKCloud.isSignedIn()||e.detail?.state!=='done'||!e.detail?.changed)return;
      if(uiBusy()){state.pendingCloudRefresh=true;return;}
      render().then(()=>setTimeout(()=>maybeShowCompletedJobReminder().catch(console.error),250));
    });
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
  function bindNav(){
    $$('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.route)));
    $('#quickAddBtn').addEventListener('click',quickAdd);
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
    $('.modal-backdrop').addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))closeModal()});
    $$('[data-close]').forEach(x=>x.addEventListener('click',closeModal));
  }
  function closeModal(){
    if(state.activeBlobUrl){URL.revokeObjectURL(state.activeBlobUrl);state.activeBlobUrl=null;}
    $('#modalRoot').innerHTML='';
    window.__JK_UI_BUSY=false;
    setTimeout(()=>{
      flushDeferredUi().catch(console.error);
      if(JKCloud.isSignedIn()&&navigator.onLine)JKCloud.syncNow().catch(()=>{});
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
    title('Klussen');const jobs=(await JKDB.all('jobs')).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    $('#view').innerHTML=`<div class="button-row"><button class="primary" id="newJob">+ Nieuwe klus</button></div><div class="section-title"><h2>Klussen</h2></div>${jobs.length?`<div class="list">${jobs.map(j=>`<div class="list-item clickable" data-job="${j.id}"><div class="main"><div class="title">${esc(j.title)}</div><div class="sub">${esc(j.clientName||'Geen klant')} · ${nlDate(j.date)||'geen datum'}${jobTimeLabel(j)?' · '+esc(jobTimeLabel(j)):''}</div></div><span class="pill ${j.status==='afgerond'?'success':'warn'}">${esc(j.status||'open')}</span></div>`).join('')}</div>`:'<div class="empty">Nog geen klussen.</div>'}`;
    $('#newJob').addEventListener('click',()=>editJob());$$('[data-job]').forEach(x=>x.addEventListener('click',()=>showJob(x.dataset.job)));
  }
  async function editJob(id){
    const j=id?await JKDB.get('jobs',id):{id:JKDB.id('job'),title:'',clientId:'',clientName:'',attention:'',street:'',postal:'',city:'',phone:'',email:'',date:today(),startTime:'',endTime:'',status:'open',notes:'',checklistId:'',checklistState:{}};
    const [clients,checks]=await Promise.all([JKDB.all('clients'),JKDB.all('checklists')]);
    const linked=clients.find(c=>c.id===j.clientId);
    const initial={name:linked?.name||j.clientName||'',attention:linked?.attention||j.attention||'',street:linked?.street||j.street||j.address||'',postal:linked?.postal||j.postal||'',city:linked?.city||j.city||'',phone:linked?.phone||j.phone||'',email:linked?.email||j.email||''};
    modal(`${modalHead(id?'Klus bewerken':'Nieuwe klus')}<form id="jobForm"><div class="card form-section"><h3>Klus</h3><div class="field"><label>Omschrijving klus</label><input name="title" required value="${esc(j.title)}"></div><div class="form-grid"><div class="field"><label>Datum werkzaamheden</label><input type="date" name="date" value="${esc(j.date||'')}"></div><div class="field"><label>Starttijd</label><input type="time" name="startTime" value="${esc(j.startTime||'')}"></div><div class="field"><label>Eindtijd</label><input type="time" name="endTime" value="${esc(j.endTime||'')}"></div><div class="field"><label>Status</label><select name="status"><option ${j.status==='open'?'selected':''}>open</option><option ${j.status==='gepland'?'selected':''}>gepland</option><option ${j.status==='afgerond'?'selected':''}>afgerond</option></select></div></div><p class="muted small">De datum en tijden worden gebruikt voor Google Agenda én automatisch als urenregistratie aangemaakt. Na de geplande eindtijd krijg je bij de eerstvolgende opening een herinnering om de uren te controleren en de factuur te maken.</p></div><div class="card form-section"><h3>Klantgegevens</h3><div class="field"><label>Kies bestaande klant</label><select name="clientId" id="jobClientPick"><option value="">Nieuwe klant / handmatig</option>${clients.map(c=>`<option value="${c.id}" ${j.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Naam/bedrijf</label><input name="clientName" required value="${esc(initial.name)}"></div><div class="field"><label>T.a.v.</label><input name="attention" value="${esc(initial.attention)}"></div><div class="field"><label>Adres</label><input name="street" value="${esc(initial.street)}"></div><div class="form-grid"><div class="field"><label>Postcode</label><input name="postal" value="${esc(initial.postal)}"></div><div class="field"><label>Plaats</label><input name="city" value="${esc(initial.city)}"></div><div class="field"><label>Telefoon</label><input name="phone" value="${esc(initial.phone)}"></div><div class="field"><label>E-mail</label><input type="email" name="email" value="${esc(initial.email)}"></div></div><p class="muted small">Deze klantgegevens worden ook gebruikt voor offertes en facturen. Wijzig je hier een gekoppelde klant, dan wordt de klantkaart bijgewerkt zodat alles gelijk blijft.</p></div><div class="card form-section"><div class="field"><label>Checklist</label><select name="checklistId"><option value="">Geen</option>${checks.map(c=>`<option value="${c.id}" ${j.checklistId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Notities</label><textarea name="notes">${esc(j.notes||'')}</textarea></div></div><div class="button-row"><button class="primary">Opslaan</button>${id?'<button type="button" class="danger-btn" id="delJob">Verwijderen</button>':''}</div></form>`);
    const fillFromClient=(client)=>{if(!client)return;const form=$('#jobForm');form.elements.clientName.value=client.name||'';form.elements.attention.value=client.attention||'';form.elements.street.value=client.street||'';form.elements.postal.value=client.postal||'';form.elements.city.value=client.city||'';form.elements.phone.value=client.phone||'';form.elements.email.value=client.email||'';};
    $('#jobClientPick').addEventListener('change',e=>fillFromClient(clients.find(c=>c.id===e.target.value)));
    $('#jobForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);let clientId=f.get('clientId'),client=clients.find(c=>c.id===clientId);const values={name:String(f.get('clientName')||'').trim(),attention:f.get('attention')||'',street:f.get('street')||'',postal:f.get('postal')||'',city:f.get('city')||'',phone:f.get('phone')||'',email:f.get('email')||''};if(client){Object.assign(client,values);await JKDB.put('clients',client);}else if(values.name){client={id:JKDB.id('client'),...values,notes:''};clientId=client.id;await JKDB.put('clients',client);}const oldSchedule=`${j.date||''}|${jobStartTime(j)}|${jobEndTime(j)}`;Object.assign(j,{title:f.get('title'),clientId:clientId||'',clientName:values.name,attention:values.attention,street:values.street,address:values.street,postal:values.postal,city:values.city,phone:values.phone,email:values.email,date:f.get('date'),startTime:f.get('startTime')||'',endTime:f.get('endTime')||'',status:f.get('status'),checklistId:f.get('checklistId'),notes:f.get('notes')});const newSchedule=`${j.date||''}|${jobStartTime(j)}|${jobEndTime(j)}`;if(oldSchedule!==newSchedule)j.completionPromptHandledAt=null;await JKDB.put('jobs',j);const autoEntry=await ensureJobTimeEntry(j);closeModal();toast(autoEntry?'Klus en urenregistratie opgeslagen':'Klus opgeslagen - vul start- en eindtijd in voor automatische uren');render();});
    $('#delJob')?.addEventListener('click',async()=>{if(confirm('Klus verwijderen?')){if(j.autoTimeEntryId)await JKDB.remove('timeEntries',j.autoTimeEntryId).catch(()=>{});await JKDB.remove('jobs',j.id);closeModal();render();}});
  }
  async function showJob(id){
    const j=await JKDB.get('jobs',id),entries=(await JKDB.all('timeEntries')).filter(e=>e.jobId===id).sort((a,b)=>entryDate(b).localeCompare(entryDate(a))),check=j.checklistId?await JKDB.get('checklists',j.checklistId):null,client=j.clientId?await JKDB.get('clients',j.clientId):null;
    const checkHtml=check?check.items.map((item,i)=>`<label class="checkline"><input type="checkbox" data-jobcheck="${i}" ${j.checklistState?.[i]?'checked':''}><span>${esc(item)}</span></label>`).join(''):'<span class="muted small">Geen checklist gekoppeld.</span>';
    const c=client||j,contact=[c.attention?`t.a.v. ${esc(c.attention)}`:'',c.street||j.address?esc(c.street||j.address):'',([c.postal,c.city].filter(Boolean).join(' ')?esc([c.postal,c.city].filter(Boolean).join(' ')):''),c.phone?esc(c.phone):'',c.email?esc(c.email):''].filter(Boolean).join('<br>');
    modal(`${modalHead(j.title)}<div class="button-row"><button class="secondary" id="editThisJob">Bewerken</button><button class="primary" id="hoursThisJob">+ Uren</button><button class="secondary" id="quoteThisJob">+ Offerte</button><button class="secondary" id="invoiceThisJob">+ Factuur</button><button class="secondary" id="calendarThisJob">📅 Google Agenda</button></div><div class="card" style="margin-top:10px"><strong>${esc(c.name||j.clientName||'Geen klant')}</strong><div class="muted small">${nlDate(j.date)}${jobTimeLabel(j)?' · '+esc(jobTimeLabel(j)):''}${contact?'<br>'+contact:''}</div>${j.notes?`<p class="small">${esc(j.notes)}</p>`:''}</div><div class="section-title"><h2>Checklist</h2></div><div class="card">${checkHtml}</div><div class="section-title"><h2>Uren</h2><span class="muted small">${(entries.reduce((s,e)=>s+entryMinutes(e),0)/60).toFixed(2).replace('.',',')} u</span></div>${entries.length?`<div class="list">${entries.map(e=>`<div class="list-item clickable" data-time="${e.id}"><div class="main"><div class="title">${nlDate(entryDate(e))}</div><div class="sub">${esc(entryFrom(e))} - ${esc(entryTo(e))}${e.note?' · '+esc(e.note):''}</div></div><strong>${durationHM(entryMinutes(e))}</strong></div>`).join('')}</div>`:'<div class="empty">Nog geen uren.</div>'}`);
    $('#editThisJob').addEventListener('click',()=>{closeModal();editJob(id)});$('#hoursThisJob').addEventListener('click',()=>{closeModal();editTimeEntry(null,id)});$('#quoteThisJob').addEventListener('click',()=>{closeModal();createBusinessDoc('Offerte',{jobId:j.id,clientId:j.clientId,workDate:j.date})});$('#invoiceThisJob').addEventListener('click',()=>{closeModal();createBusinessDoc('Factuur',{jobId:j.id,clientId:j.clientId,workDate:j.date})});$('#calendarThisJob').addEventListener('click',()=>openGoogleCalendarForJob(j));$$('[data-time]').forEach(x=>x.addEventListener('click',()=>{closeModal();editTimeEntry(x.dataset.time)}));$$('[data-jobcheck]').forEach(c=>c.addEventListener('change',async()=>{j.checklistState=j.checklistState||{};j.checklistState[c.dataset.jobcheck]=c.checked;await JKDB.put('jobs',j)}));
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
    $('#view').innerHTML=`<div class="tabs"><button class="tab ${state.gearTab==='mboxes'?'active':''}" data-gt="mboxes">Inpakchecklists</button><button class="tab ${state.gearTab==='tools'?'active':''}" data-gt="tools">Gereedschapregister</button></div><input class="search" id="gearSearch" placeholder="Zoek koffer, machine of onderdeel..."><div id="gearContent"></div>`;
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
    }else{
      const unified=await unifiedGearRows(),map=Object.fromEntries(unified.boxes.map(m=>[m.id,`${m.name} · ${m.type}`]));
      const rows=unified.rows.filter(t=>(t.name+' '+t.category+' '+(map[t.location]||'')).toLowerCase().includes(q));
      c.innerHTML=`<div class="button-row"><button class="primary" id="addTool">+ Nieuw (hand)gereedschap / materiaal</button></div><div class="successbox"><strong>Gekoppeld register</strong><br><span class="small">Alles uit de inpakchecklists staat automatisch ook in dit register. Voeg je hier iets toe met een locatie, dan wordt het tegelijk aan die inpakchecklist toegevoegd.</span></div><div class="list" style="margin-top:12px">${rows.map(t=>`<div class="list-item clickable" data-registry="${esc(t.key)}"><div class="main"><div class="title">${esc(t.name)}</div><div class="sub">${esc(t.category)} · ${esc(map[t.location]||'Los / vrij')}</div></div><span>›</span></div>`).join('')}</div>`;
      $('#addTool').addEventListener('click',()=>editTool());
      $$('[data-registry]').forEach(x=>x.addEventListener('click',()=>{const row=rows.find(r=>r.key===x.dataset.registry);if(row)editTool(row.toolId||null,{location:row.location,itemName:row.name})}));
    }
  }
  async function showMboxChecklist(id){
    const m=await JKDB.get('mboxes',id);m.checked=m.checked||{};const done=m.items.filter(i=>m.checked[i]).length;
    modal(`${modalHead(m.name+' · '+m.type)}${m.notes?`<div class="warning small">${esc(m.notes)}</div>`:''}<div class="check-card"><div class="check-summary"><strong>${done}/${m.items.length}</strong><span>afgevinkt</span></div>${m.items.map((item,i)=>`<label class="packing-row"><input type="checkbox" data-pack="${i}" ${m.checked[item]?'checked':''}><span>${esc(item)}</span></label>`).join('')}</div><div class="button-row" style="margin-top:12px"><button class="secondary" id="resetPack">Reset checklist</button><button class="secondary" id="editPack">Lijst bewerken</button></div>`);
    $$('[data-pack]').forEach(cb=>cb.addEventListener('change',async()=>{const item=m.items[Number(cb.dataset.pack)];m.checked[item]=cb.checked;await JKDB.put('mboxes',m);const n=m.items.filter(i=>m.checked[i]).length;const el=$('.check-summary strong');if(el)el.textContent=`${n}/${m.items.length}`;}));$('#resetPack').addEventListener('click',async()=>{if(confirm('Alle vinkjes van deze lijst wissen?')){m.checked={};await JKDB.put('mboxes',m);closeModal();showMboxChecklist(id)}});$('#editPack').addEventListener('click',()=>{closeModal();editMbox(id)});
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
    title('Documenten');const docs=await JKDB.all('documents');const counts={offerte:0,factuur:0,diversen:0};docs.forEach(d=>counts[docFolder(d)]++);
    if(!['offerte','factuur','diversen'].includes(state.docFolder)){
      $('#view').innerHTML=`<div class="button-row"><button class="primary" id="docQuote">+ Offerte</button><button class="primary" id="docInvoice">+ Factuur</button></div><div class="section-title"><h2>Kies een map</h2></div><div class="folder-grid"><button class="folder" data-folder="offerte"><span>📁</span><strong>Offertes</strong><small>${counts.offerte} bestanden</small></button><button class="folder" data-folder="factuur"><span>📁</span><strong>Facturen</strong><small>${counts.factuur} bestanden</small></button><button class="folder" data-folder="diversen"><span>📁</span><strong>Diversen</strong><small>${counts.diversen} bestanden</small></button></div><p class="muted small" style="margin-top:14px">Open een map om de documenten daarin te bekijken. Documenten uit verschillende mappen worden hier niet door elkaar getoond.</p>`;
      $('#docQuote').addEventListener('click',()=>createBusinessDoc('Offerte'));$('#docInvoice').addEventListener('click',()=>createBusinessDoc('Factuur'));$$('[data-folder]').forEach(x=>x.addEventListener('click',()=>{state.docFolder=x.dataset.folder;renderDocuments()}));
      return;
    }
    const folderLabel=state.docFolder==='offerte'?'Offertes':state.docFolder==='factuur'?'Facturen':'Diversen';
    $('#view').innerHTML=`<div class="button-row"><button class="secondary" id="backToFolders">← Mappen</button><button class="secondary" id="importDocs">Upload naar ${folderLabel}</button></div><div id="docList"></div>`;
    $('#backToFolders').addEventListener('click',()=>{state.docFolder=null;renderDocuments()});$('#importDocs').addEventListener('click',()=>chooseImportFolder());renderDocumentList(docs);
  }
  function docFolder(d){const k=String(d.folder||d.kind||'').toLowerCase();return k.includes('offert')?'offerte':k.includes('fact')?'factuur':'diversen'}
  function docStatusHtml(d){const f=docFolder(d),m=d.meta||{};if(f==='factuur')return `<span class="status-chip ${m.sent?'on':''}">${m.sent?'✓ ':''}Verstuurd</span><span class="status-chip ${m.paid?'on':''}">${m.paid?'✓ ':''}Betaald</span>`;if(f==='offerte')return `<span class="status-chip ${m.sent?'on':''}">${m.sent?'✓ ':''}Verstuurd</span><span class="status-chip ${m.confirmed?'on':''}">${m.confirmed?'✓ ':''}Bevestigd</span>`;return ''}
  function renderDocumentList(docs){const c=$('#docList');if(!c)return;const filtered=docs.filter(d=>docFolder(d)===state.docFolder).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));c.innerHTML=`<div class="section-title"><h2>${state.docFolder==='offerte'?'Offertes':state.docFolder==='factuur'?'Facturen':'Diversen'}</h2></div>${filtered.length?`<div class="list">${filtered.map(d=>`<div class="list-item clickable" data-doc="${d.id}"><div class="document-card"><div class="doc-icon">PDF</div><div class="main"><div class="title">${esc(d.filename)}</div><div class="sub">${fmtDateTime(d.createdAt)} · ${esc(d.kind||'PDF')}</div><div class="status-row">${docStatusHtml(d)}</div></div></div><span>›</span></div>`).join('')}</div>`:'<div class="empty">Deze map is nog leeg.</div>'}`;$$('[data-doc]').forEach(x=>x.addEventListener('click',()=>showDocument(x.dataset.doc)))}
  function chooseImportFolder(){
    if(['offerte','factuur','diversen'].includes(state.docFolder)){state.importFolderTarget=state.docFolder;$('#hiddenExistingPdfInput').click();return;}
    modal(`${modalHead('PDF uploaden')}<p class="muted small">Kies in welke map je het bestand wilt plaatsen.</p><div class="grid two"><button class="quick" data-import-folder="offerte"><span class="emoji">📄</span><strong>Offertes</strong></button><button class="quick" data-import-folder="factuur"><span class="emoji">🧾</span><strong>Facturen</strong></button><button class="quick" data-import-folder="diversen"><span class="emoji">📁</span><strong>Diversen</strong></button></div>`);
    $$('[data-import-folder]').forEach(b=>b.addEventListener('click',()=>{state.importFolderTarget=b.dataset.importFolder;closeModal();$('#hiddenExistingPdfInput').click();}));
  }
  async function importExistingPdfs(files,folder='diversen'){let count=0;folder=['offerte','factuur','diversen'].includes(folder)?folder:'diversen';for(const file of files){if(!file.name.toLowerCase().endsWith('.pdf'))continue;await JKDB.put('documents',{id:JKDB.id('doc'),filename:file.name,kind:folder==='offerte'?'Offerte':folder==='factuur'?'Factuur':'Diversen',folder,blob:new Blob([await file.arrayBuffer()],{type:'application/pdf'}),createdAt:new Date().toISOString(),meta:{sent:false,paid:false,confirmed:false}});count++;}toast(`${count} PDF${count===1?'':'s'} geüpload naar ${folder==='offerte'?'Offertes':folder==='factuur'?'Facturen':'Diversen'}`);state.docFolder=folder;if(state.route==='documents')renderDocuments();}

  async function nextDocNumber(kind){
    const prefix=kind==='Factuur'?'FAC':'OFF',year=new Date().getFullYear(),docs=await JKDB.all('documents');let max=0;for(const d of docs){const n=d.meta?.number||d.number||d.filename||'',m=String(n).match(new RegExp(`${prefix}-${year}-(\\d+)`,'i'));if(m)max=Math.max(max,Number(m[1]));}return `${prefix}-${year}-${String(max+1).padStart(3,'0')}`;
  }
  async function createBusinessDoc(kind,prefill={}){
    const [clients,entries,company,jobs]=await Promise.all([JKDB.all('clients'),JKDB.all('timeEntries'),JKDB.get('settings','company'),JKDB.all('jobs')]);
    const number=await nextDocNumber(kind),isInvoice=kind==='Factuur',docDate=today();
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
    modal(`${modalHead('Nieuwe '+kind.toLowerCase())}<form id="businessDocForm"><div class="card form-section"><h3>Document</h3><div class="field"><label>Kies klus</label><select id="jobPick" required><option value="">Selecteer een klus</option>${jobs.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(j=>`<option value="${j.id}" ${prefill.jobId===j.id?'selected':''}>${esc(j.title)}${j.clientName?' · '+esc(j.clientName):''}${j.date?' · '+nlDate(j.date):''}</option>`).join('')}</select><small class="muted">De gekozen klus wordt gebruikt voor klantgegevens, datum werkzaamheden en de koppeling met uren. De klusnaam wordt niet als documentregel toegevoegd.</small><button type="button" class="secondary" id="calendarBusinessJob" style="margin-top:8px">📅 Zet gekozen klus in Google Agenda</button></div><div class="form-grid"><div class="field"><label>${kind}nummer</label><input name="number" required value="${esc(number)}"></div><div class="field"><label>${isInvoice?'Factuurdatum':'Datum'}</label><input type="date" name="docDate" required value="${esc(docDate)}"></div><div class="field"><label>${isInvoice?'Datum werkzaamheden':'Werkzaamheden op'}</label>${isInvoice?`<input name="workDate" placeholder="bijv. 04-10-2026" value="${esc(initialWorkDate)}">`:`<input type="date" name="workDate" value="${esc(initialWorkDate)}">`}</div><div class="field"><label>${isInvoice?'Vervaldatum':'Geldig t/m'}</label><input type="date" name="deadline" required value="${esc(deadline)}" ${isInvoice?'':`max="${esc(deadline)}"`}>${isInvoice?'<small class="muted">Standaard 14 dagen na de factuurdatum. Je kunt de vervaldatum handmatig aanpassen.</small>':'<small class="muted">Automatisch maximaal 4 weken na offertedatum, of uiterlijk de dag vóór de werkzaamheden.</small>'}</div></div></div>
      <div class="card form-section"><h3>Klant</h3><div class="field"><label>Kies bestaande klant</label><select id="clientPick"><option value="">Handmatig invullen</option>${clients.map(c=>`<option value="${c.id}" ${prefill.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Naam/bedrijf</label><input name="clientName" value="${esc(pClient.name||'')}"></div><div class="field"><label>T.a.v.</label><input name="attention" value="${esc(pClient.attention||'')}"></div><div class="field"><label>Adres</label><input name="address" value="${esc(pClient.address||pClient.street||'')}"></div><div class="field"><label>Postcode/Plaats</label><input name="postalCity" value="${esc(pClient.postalCity||[pClient.postal,pClient.city].filter(Boolean).join(' '))}"></div><div class="form-grid"><div class="field"><label>Telefoon</label><input name="phone" value="${esc(pClient.phone||'')}"></div><div class="field"><label>E-mail</label><input type="email" name="email" value="${esc(pClient.email||'')}"></div></div><p class="muted small">Kies je een bestaande klant, dan worden alle klantgegevens automatisch overgenomen.</p></div>
      <div class="card form-section"><div class="section-inline"><h3>Werkzaamheden / materiaal</h3><span class="muted small">max. 4 regels in huidig sjabloon</span></div><div class="line-head"><span>Aantal</span><span>Omschrijving</span><span>Prijs p/st</span><span>Totaal</span></div>${lines.map((l,i)=>`<div class="invoice-line" data-line="${i}"><input inputmode="decimal" name="qty${i}" placeholder="1" value="${esc(l.qty||'')}"><input name="desc${i}" placeholder="${isInvoice&&i===0?'Werkuren':'Omschrijving'}" value="${esc(isInvoice&&i===0?(l.description||'Werkuren'):(l.description||''))}" ${isInvoice&&i===0?'readonly':''}><input inputmode="decimal" name="price${i}" placeholder="0,00" value="${esc(l.price||'')}"><output id="lineTotal${i}">€ 0,00</output></div>`).join('')}<div class="doc-total"><span>Totaal te betalen</span><strong id="grandTotal">€ 0,00</strong></div></div>
      ${entries.length?`<div class="card form-section"><div class="section-inline"><h3>Uren uit urenregistratie</h3><span class="muted small">optioneel</span></div><p class="muted small">Selecteer registraties van de gekozen klus. De app telt ze op en zet ze als één werkurenregel op regel 1.</p><div class="hours-select">${entries.sort((a,b)=>entryDate(b).localeCompare(entryDate(a))).slice(0,30).map(e=>`<label class="packing-row"><input type="checkbox" data-hour-entry="${e.id}"><span><strong>${nlDate(entryDate(e))}</strong> · ${esc(e.jobTitle||'Algemeen')} · ${durationHM(entryMinutes(e))} u</span></label>`).join('')}</div><div class="form-grid" style="margin-top:10px"><div class="field"><label>Uurtarief voor geselecteerde uren</label><input id="hourRate" inputmode="decimal" value="${esc(company?.defaultRate||'')}"></div><div class="field action-field"><button type="button" class="secondary" id="hoursToLine">Voeg geselecteerde uren toe</button></div></div></div>`:''}
      <div class="button-row"><button class="primary">Maak PDF</button><button type="button" class="secondary" data-close>Annuleren</button></div></form>`);

    function recalc(){let grand=0;for(let i=0;i<4;i++){const q=num($(`[name=qty${i}]`).value),p=num($(`[name=price${i}]`).value),t=q*p;grand+=t;$(`#lineTotal${i}`).textContent=money(t)}$('#grandTotal').textContent=money(grand);return grand}
    $$('[name^=qty], [name^=price]').forEach(x=>x.addEventListener('input',recalc));recalc();
    const fillDocClient=(c)=>{if(!c)return;$('#clientPick').value=c.id||'';$('[name=clientName]').value=c.name||'';$('[name=attention]').value=c.attention||'';$('[name=address]').value=c.street||c.address||'';$('[name=postalCity]').value=c.postalCity||[c.postal,c.city].filter(Boolean).join(' ');$('[name=phone]').value=c.phone||'';$('[name=email]').value=c.email||'';};
    $('#clientPick').addEventListener('change',e=>fillDocClient(clients.find(x=>x.id===e.target.value)));
    $('#jobPick').addEventListener('change',async e=>{const j=jobs.find(x=>x.id===e.target.value);if(!j)return;let c=j.clientId?clients.find(x=>x.id===j.clientId):null;if(!c)c={id:j.clientId||'',name:j.clientName||'',attention:j.attention||'',street:j.street||j.address||'',postal:j.postal||'',city:j.city||'',phone:j.phone||'',email:j.email||''};fillDocClient(c);if(j.date)$('[name=workDate]').value=isInvoice?nlDate(j.date):j.date;if(!isInvoice){const ev=new Event('change');$('[name=workDate]').dispatchEvent(ev);}});
    if(prefill.clientId)$('#clientPick').dispatchEvent(new Event('change'));
    if(prefillJob)$('#jobPick').dispatchEvent(new Event('change'));
    if(isInvoice){
      const syncInvoiceDeadline=()=>{const issue=$('[name=docDate]').value||docDate,el=$('[name=deadline]');if(!el.value||el.dataset.auto!=='0')el.value=addDays(issue,14);el.dataset.auto=el.dataset.auto||'1';};
      $('[name=docDate]').addEventListener('change',syncInvoiceDeadline);
      $('[name=deadline]').addEventListener('input',e=>e.target.dataset.auto='0');
      $('[name=deadline]').dataset.auto='1';
      syncInvoiceDeadline();
    }else{
      const syncQuoteDeadline=()=>{const max=maxQuoteDeadline(),el=$('[name=deadline]');el.max=max;if(!el.value||el.value>max)el.value=max;else if(el.dataset.auto==='1')el.value=max;el.dataset.auto='1';};
      $('[name=docDate]').addEventListener('change',syncQuoteDeadline);$('[name=workDate]').addEventListener('change',syncQuoteDeadline);$('[name=deadline]').addEventListener('input',e=>e.target.dataset.auto='0');syncQuoteDeadline();
    }
    $('#calendarBusinessJob')?.addEventListener('click',()=>{const j=jobs.find(x=>x.id===$('#jobPick').value);if(!j){alert('Selecteer eerst een klus.');return;}openGoogleCalendarForJob(j,{kind,number:document.querySelector('[name=number]')?.value||''});});
    $('#hoursToLine')?.addEventListener('click',()=>{const ids=$$('[data-hour-entry]:checked').map(x=>x.dataset.hourEntry);if(!ids.length){alert('Selecteer eerst één of meer urenregistraties.');return}const jobId=$('#jobPick').value;let selected=entries.filter(e=>ids.includes(e.id));if(jobId){const matching=selected.filter(e=>!e.jobId||e.jobId===jobId);if(matching.length!==selected.length){alert('Selecteer alleen urenregistraties die bij de gekozen klus horen.');return;}selected=matching;}const minutes=selected.reduce((s,e)=>s+entryMinutes(e),0),hours=Math.round(minutes/60*100)/100,rate=num($('#hourRate').value);const idx=0,dates=[...new Set(selected.map(entryDate))].sort();$(`[name=qty${idx}]`).value=String(hours).replace('.',',');$(`[name=desc${idx}]`).value='Werkuren';$(`[name=price${idx}]`).value=rate?String(rate).replace('.',','):'';if(!$('[name=workDate]').value&&dates.length)$('[name=workDate]').value=dates.length===1?nlDate(dates[0]):`${nlDate(dates[0])} t/m ${nlDate(dates.at(-1))}`;recalc();toast('Geregistreerde uren op regel 1 gezet');});
    $('#businessDocForm').addEventListener('submit',async e=>{e.preventDefault();const selectedJob=jobs.find(x=>x.id===$('#jobPick').value);if(!selectedJob){alert('Selecteer eerst een klus.');return;}const f=new FormData(e.target),items=[];for(let i=0;i<4;i++)items.push({qty:f.get(`qty${i}`),description:f.get(`desc${i}`),price:f.get(`price${i}`)});let chosenDeadline=f.get('deadline');if(isInvoice){if(!chosenDeadline)chosenDeadline=addDays(f.get('docDate'),14);}else{const max=maxQuoteDeadline();if(!chosenDeadline||chosenDeadline>max)chosenDeadline=max;}const data={kind,number:f.get('number'),docDate:f.get('docDate'),workDate:f.get('workDate'),deadline:chosenDeadline,jobId:$('#jobPick').value,clientId:$('#clientPick').value,client:{name:f.get('clientName'),attention:f.get('attention'),address:f.get('address'),postalCity:f.get('postalCity'),phone:f.get('phone'),email:f.get('email')},lines:items,total:recalc()};try{const d=await generateBusinessPdf(data);closeModal();toast(kind+' opgeslagen');state.docFolder=isInvoice?'factuur':'offerte';await showDocument(d.id);if(state.route==='documents')renderDocuments();}catch(err){console.error(err);alert('PDF maken mislukt: '+err.message)}});
  }
  function setPdfText(form,name,value){try{const f=form.getTextField(name);f.setText(String(value??''));f.setFontSize(12);}catch(e){console.warn('PDF field',name,e.message)}}
  async function generateBusinessPdf(data){
    await ensurePdfLib();const isInvoice=data.kind==='Factuur',path=isInvoice?'templates/factuur-kor.pdf':'templates/offerte-kor.pdf',res=await fetch(path);if(!res.ok)throw new Error('PDF-sjabloon niet gevonden.');const pdf=await PDFLib.PDFDocument.load(await res.arrayBuffer()),form=pdf.getForm(),helvetica=await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    setPdfText(form,isInvoice?'Factuurnummer':'Offertenummer',data.number);setPdfText(form,isInvoice?'Factuurdatum':'Datum',nlDate(data.docDate));setPdfText(form,isInvoice?'Datum werkzaamheden':'Werkzaamheden op',isInvoice?(data.workDate||''):nlDate(data.workDate));setPdfText(form,isInvoice?'Vervaldatum':'Geldig t/m',nlDate(data.deadline));setPdfText(form,'Naam/bedrijf',data.client.name);setPdfText(form,'T.a.v',data.client.attention);setPdfText(form,'Adres',data.client.address);setPdfText(form,'Postcode/Plaats',data.client.postalCity);
    let total=0;for(let i=0;i<4;i++){const l=data.lines[i]||{},q=num(l.qty),p=num(l.price),t=q*p;total+=t;setPdfText(form,`Aantal ${i+1}`,l.qty||'');setPdfText(form,`Omschrijving ${i+1}`,l.description||'');setPdfText(form,`Prijs ${i+1}`,l.price?moneyNumber(p):'');setPdfText(form,`Totaal ${i+1}`,(l.qty||l.description||l.price)?moneyNumber(t):'');}setPdfText(form,'Totaal te betalen EUR',moneyNumber(total));
    try{form.updateFieldAppearances(helvetica);form.flatten();}catch(e){console.warn('Flatten',e)}
    const bytes=await pdf.save(),blob=new Blob([bytes],{type:'application/pdf'}),filename=`${data.number}.pdf`,folder=isInvoice?'factuur':'offerte',doc={id:JKDB.id('doc'),filename,kind:data.kind,folder,blob,createdAt:new Date().toISOString(),meta:{...data,total,lines:data.lines,sent:false,paid:false,confirmed:false}};await JKDB.put('documents',doc);return doc;
  }
  function moneyNumber(v){return Number(v||0).toFixed(2).replace('.',',')}
  async function showDocument(id){
    const d=await JKDB.get('documents',id),folder=docFolder(d),m=d.meta||{},linkedJob=m.jobId?await JKDB.get('jobs',m.jobId):null;
    const statusBox=folder==='factuur'?`<div class="card" style="margin-top:12px"><h3>Status factuur</h3><label class="checkline"><input type="checkbox" id="docSent" ${m.sent?'checked':''}><span>Verstuurd</span></label><label class="checkline"><input type="checkbox" id="docPaid" ${m.paid?'checked':''}><span>Betaald</span></label></div>`:folder==='offerte'?`<div class="card" style="margin-top:12px"><h3>Status offerte</h3><label class="checkline"><input type="checkbox" id="docSent" ${m.sent?'checked':''}><span>Verstuurd</span></label><label class="checkline"><input type="checkbox" id="docConfirmed" ${m.confirmed?'checked':''}><span>Bevestigd</span></label></div>`:'';
    modal(`${modalHead(d.filename)}<div class="card"><div class="document-card"><div class="doc-icon">PDF</div><div><h3>${esc(d.filename)}</h3><div class="muted small">${esc(d.kind||'PDF')} · ${fmtDateTime(d.createdAt)}</div>${d.meta?.total!=null?`<div class="big-number" style="margin-top:8px">${money(d.meta.total)}</div>`:''}</div></div><div class="button-row" style="margin-top:14px"><button class="primary" id="previewDoc">Bekijk PDF</button><button class="secondary" id="shareDoc">Delen / bewaar in iCloud</button><button class="secondary" id="downloadDoc">Download</button>${folder==='offerte'||folder==='factuur'?'<button class="secondary" id="calendarDoc">📅 Google Agenda</button>':''}</div><div id="pdfPreviewHost" class="pdf-preview-host" hidden></div>${folder==='offerte'&&d.meta?.lines?`<button class="secondary" id="quoteToInvoice" style="width:100%;margin-top:10px">Zet offerte om naar factuur</button>`:''}</div>${statusBox}<div class="card" style="margin-top:12px"><h3>Documentnaam</h3><div class="field"><label>Bestandsnaam</label><input id="docFilename" value="${esc(d.filename)}"></div><button class="secondary" id="renameDoc" style="width:100%">Naam opslaan</button></div><div class="card" style="margin-top:12px"><h3>Map</h3><div class="field"><label>Verplaats document naar</label><select id="moveDocFolder"><option value="offerte" ${folder==='offerte'?'selected':''}>Offertes</option><option value="factuur" ${folder==='factuur'?'selected':''}>Facturen</option><option value="diversen" ${folder==='diversen'?'selected':''}>Diversen</option></select></div></div><button class="danger-btn" id="delDoc" style="width:100%">Uit app verwijderen</button>`);
    $('#previewDoc').addEventListener('click',()=>{const host=$('#pdfPreviewHost');if(!host)return;if(!host.hidden){host.hidden=true;host.innerHTML='';if(state.activeBlobUrl){URL.revokeObjectURL(state.activeBlobUrl);state.activeBlobUrl=null;}$('#previewDoc').textContent='Bekijk PDF';return;}if(!(d.blob instanceof Blob)){alert('Dit PDF-bestand is nog niet lokaal beschikbaar. Synchroniseer opnieuw en probeer het nog eens.');return;}state.activeBlobUrl=URL.createObjectURL(d.blob);host.innerHTML=`<iframe class="pdf-preview-frame" src="${state.activeBlobUrl}#toolbar=0&navpanes=0" title="Voorbeeld ${esc(d.filename)}"></iframe>`;host.hidden=false;$('#previewDoc').textContent='Sluit voorbeeld';});
    $('#shareDoc').addEventListener('click',()=>shareBlob(d.blob,d.filename));$('#downloadDoc').addEventListener('click',()=>downloadBlob(d.blob,d.filename));$('#calendarDoc')?.addEventListener('click',async()=>{let job=linkedJob;if(!job){const jobs=await JKDB.all('jobs');const work=String(m.workDate||'');const clientName=normGearName(m.client?.name||'');job=jobs.find(j=>(!work||j.date===work||nlDate(j.date)===work)&&(!clientName||normGearName(j.clientName)===clientName));}if(!job){alert('Dit document is niet aan een klus gekoppeld. Open de offerte/factuur vanuit een klus om Google Agenda te gebruiken.');return;}openGoogleCalendarForJob(job,{kind:d.kind||folder,number:m.number||d.filename.replace(/\.pdf$/i,'')});});$('#quoteToInvoice')?.addEventListener('click',()=>{const meta=d.meta;closeModal();createBusinessDoc('Factuur',{jobId:meta.jobId,clientId:meta.clientId,client:meta.client,lines:meta.lines,workDate:meta.workDate})});
    const saveStatus=async()=>{d.meta=d.meta||{};if($('#docSent'))d.meta.sent=$('#docSent').checked;if($('#docPaid'))d.meta.paid=$('#docPaid').checked;if($('#docConfirmed'))d.meta.confirmed=$('#docConfirmed').checked;await JKDB.put('documents',d);toast('Status opgeslagen');};
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
    title('Meer');const [checks,clients,entries,company,backup,cloudStatus]=await Promise.all([JKDB.all('checklists'),JKDB.all('clients'),JKDB.all('timeEntries'),JKDB.get('settings','company'),JKDB.get('settings','backup'),JKDB.get('settings','cloudStatus')]);const cs=JKCloud.status();
    $('#view').innerHTML=`<div class="list"><div class="list-item clickable" id="cloudMenu"><div class="main"><div class="title">☁️ Synchronisatie</div><div class="sub">${cs.signedIn?(cs.email+' · '+(cloudStatus?.lastSync?'laatst '+fmtDateTime(cloudStatus.lastSync):'nog niet gesynchroniseerd')):'Niet ingelogd'}</div></div><span>›</span></div><div class="list-item clickable" id="timeMenu"><div class="main"><div class="title">🕒 Urenregistratie</div><div class="sub">${entries.length} registraties · handmatig van-tot</div></div><span>›</span></div><div class="list-item clickable" id="timeStatsMenu"><div class="main"><div class="title">📊 Urenstatistieken</div><div class="sub">Grafieken per maand, kwartaal en kalenderjaar</div></div><span>›</span></div><div class="list-item clickable" id="checkMenu"><div class="main"><div class="title">✅ Algemene checklists</div><div class="sub">${checks.length} lijsten</div></div><span>›</span></div><div class="list-item clickable" id="clientMenu"><div class="main"><div class="title">👥 Klanten</div><div class="sub">${clients.length} klanten</div></div><span>›</span></div><div class="list-item clickable" id="companyMenu"><div class="main"><div class="title">🏢 Bedrijfsgegevens</div><div class="sub">${esc(company?.companyName||'JK Works Dordrecht')}</div></div><span>›</span></div><div class="list-item clickable" id="backupMenu"><div class="main"><div class="title">☁️ Back-up & herstel</div><div class="sub">${backup?.lastBackup?'Laatst '+fmtDateTime(backup.lastBackup):'Nog geen back-up'}</div></div><span>›</span></div></div>`;
    $('#cloudMenu').addEventListener('click',showCloud);$('#timeMenu').addEventListener('click',showTimeEntries);$('#timeStatsMenu').addEventListener('click',showTimeStats);$('#checkMenu').addEventListener('click',showChecklists);$('#clientMenu').addEventListener('click',showClients);$('#companyMenu').addEventListener('click',showCompany);$('#backupMenu').addEventListener('click',showBackup);
  }

  function showCloud(){
    const cs=JKCloud.status();
    if(cs.signedIn){
      modal(`${modalHead('Synchronisatie')}<div class="card"><h3>Ingelogd</h3><p class="small"><strong>${esc(cs.email)}</strong></p><p class="muted small">Wijzigingen worden lokaal opgeslagen en, zodra internet beschikbaar is, naar Supabase gesynchroniseerd. Dezelfde login op iPhone en Mac gebruikt dezelfde gegevens.</p><div class="button-row"><button class="primary" id="syncNow">Nu synchroniseren</button><button class="secondary" id="cloudLogout">Uitloggen</button></div></div><div class="card"><h3>Cloud opschonen</h3><p class="muted small">Gebruik dit alleen op een apparaat waarop Klussen, Uren en Documenten nu correct zijn. Oude cloudrecords die op dit apparaat niet meer bestaan worden dan definitief verwijderd, zodat een nieuw apparaat ze niet meer terughaalt.</p><button class="danger-btn" id="pruneCloud" style="width:100%">Maak dit apparaat leidend voor Klussen, Uren en Documenten</button></div>`);
      $('#syncNow').addEventListener('click',async()=>{try{await JKCloud.syncNow();toast('Synchronisatie voltooid');closeModal();render();}catch(e){alert('Synchroniseren mislukt: '+e.message)}});
      $('#pruneCloud').addEventListener('click',async()=>{
        const ok=confirm('LET OP: gebruik dit alleen op een apparaat waarop Klussen, Urenregistraties en Documenten compleet en correct zijn. Oude cloudgegevens die hier niet meer staan worden definitief verwijderd. Doorgaan?');
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
  function periodBuckets(entries,mode){
    const now=new Date(), map=new Map();
    for(const e of entries){const d=new Date(entryDate(e)+'T12:00:00');if(Number.isNaN(d.getTime()))continue;let key,label,sort;
      if(mode==='month'){key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;label=`${monthName(d.getMonth())} '${String(d.getFullYear()).slice(-2)}`;sort=key}
      else if(mode==='quarter'){const q=Math.floor(d.getMonth()/3)+1;key=`${d.getFullYear()}-Q${q}`;label=`Q${q} '${String(d.getFullYear()).slice(-2)}`;sort=`${d.getFullYear()}-${q}`}
      else {key=String(d.getFullYear());label=key;sort=key}
      const b=map.get(key)||{key,label,sort,minutes:0};b.minutes+=entryMinutes(e);map.set(key,b);
    }
    if(mode==='month'){
      const arr=[];for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;arr.push(map.get(key)||{key,label:`${monthName(d.getMonth())} '${String(d.getFullYear()).slice(-2)}`,sort:key,minutes:0})}return arr;
    }
    if(mode==='quarter'){
      const arr=[];const cq=Math.floor(now.getMonth()/3)+1;for(let i=7;i>=0;i--){let q=cq-i,y=now.getFullYear();while(q<=0){q+=4;y--}while(q>4){q-=4;y++}const key=`${y}-Q${q}`;arr.push(map.get(key)||{key,label:`Q${q} '${String(y).slice(-2)}`,sort:`${y}-${q}`,minutes:0})}return arr;
    }
    const years=[...map.values()].sort((a,b)=>a.sort.localeCompare(b.sort));if(!years.length)years.push({key:String(now.getFullYear()),label:String(now.getFullYear()),sort:String(now.getFullYear()),minutes:0});return years;
  }
  function statsChartHtml(buckets){
    const max=Math.max(1,...buckets.map(b=>b.minutes)), total=buckets.reduce((s,b)=>s+b.minutes,0), nonzero=buckets.filter(b=>b.minutes>0), avg=nonzero.length?Math.round(total/nonzero.length):0, best=nonzero.slice().sort((a,b)=>b.minutes-a.minutes)[0];
    return `<div class="kpi-row stats-kpis"><div class="kpi"><strong>${hoursLabel(total)}</strong><span>Totaal</span></div><div class="kpi"><strong>${hoursLabel(avg)}</strong><span>Gem. actieve periode</span></div><div class="kpi"><strong>${best?esc(best.label):'-'}</strong><span>Meeste uren</span></div></div><div class="hours-chart-wrap"><div class="hours-chart">${buckets.map(b=>{const pct=b.minutes?Math.max(4,(b.minutes/max)*100):0;return `<div class="hours-bar-col"><div class="hours-value">${b.minutes?hoursLabel(b.minutes):''}</div><div class="hours-bar-track"><div class="hours-bar" style="height:${pct}%"></div></div><div class="hours-label">${esc(b.label)}</div></div>`}).join('')}</div></div>`;
  }
  async function showTimeStats(){
    const entries=await JKDB.all('timeEntries');let mode='month';
    const draw=()=>{const buckets=periodBuckets(entries,mode);modal(`${modalHead('Urenstatistieken')}<div class="tabs"><button class="tab ${mode==='month'?'active':''}" data-stat-mode="month">Per maand</button><button class="tab ${mode==='quarter'?'active':''}" data-stat-mode="quarter">Per kwartaal</button><button class="tab ${mode==='year'?'active':''}" data-stat-mode="year">Per kalenderjaar</button></div>${entries.length?statsChartHtml(buckets):'<div class="empty">Nog geen uren geregistreerd.</div>'}<p class="muted small stats-note">Gebaseerd op je urenregistraties. Maand toont de laatste 12 maanden, kwartaal de laatste 8 kwartalen en kalenderjaar alle geregistreerde jaren.</p>`);$$('[data-stat-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.statMode;draw()}));};draw();
  }

  async function showTimeEntries(){
    const es=(await JKDB.all('timeEntries')).sort((a,b)=>(entryDate(b)+entryFrom(b)).localeCompare(entryDate(a)+entryFrom(a)));
    modal(`${modalHead('Urenregistratie')}<button class="primary" id="addTime" style="width:100%;margin-bottom:12px">+ Uren toevoegen</button>${es.length?`<div class="list">${es.map(e=>`<div class="list-item clickable" data-time="${e.id}"><div class="main"><div class="title">${nlDate(entryDate(e))} · ${esc(e.jobTitle||'Algemeen')}</div><div class="sub">${esc(entryFrom(e))} - ${esc(entryTo(e))}${e.note?' · '+esc(e.note):''}</div></div><strong>${durationHM(entryMinutes(e))}</strong></div>`).join('')}</div>`:'<div class="empty">Nog geen uren geregistreerd.</div>'}`);$('#addTime').addEventListener('click',()=>{closeModal();editTimeEntry()});$$('[data-time]').forEach(x=>x.addEventListener('click',()=>{closeModal();editTimeEntry(x.dataset.time)}));
  }
  async function editTimeEntry(id,jobId=''){
    const jobs=(await JKDB.all('jobs')).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),old=id?await JKDB.get('timeEntries',id):null,e=old||{id:JKDB.id('time'),jobId,jobTitle:'',date:today(),from:'08:00',to:'16:30',note:''};
    if(old&&!e.date&&e.start){e.date=entryDate(e);e.from=entryFrom(e);e.to=entryTo(e)}
    modal(`${modalHead(id?'Uren bewerken':'Uren toevoegen')}<form id="timeForm"><div class="field"><label>Klus</label><select name="jobId"><option value="">Algemene werkzaamheden</option>${jobs.map(j=>`<option value="${j.id}" ${j.id===e.jobId?'selected':''}>${esc(j.title)}${j.clientName?' · '+esc(j.clientName):''}</option>`).join('')}</select></div><div class="field"><label>Datum</label><input type="date" name="date" required value="${esc(e.date||today())}"></div><div class="form-grid"><div class="field"><label>Van</label><input type="time" name="from" required value="${esc(e.from||'')}"></div><div class="field"><label>Tot</label><input type="time" name="to" required value="${esc(e.to||'')}"></div></div><div class="field"><label>Notitie</label><input name="note" value="${esc(e.note||'')}" placeholder="Optioneel"></div><div class="card small" id="timePreview"></div><div class="button-row"><button class="primary">Opslaan</button><button type="button" class="secondary" id="calendarTime">📅 Google Agenda</button>${id?'<button type="button" class="danger-btn" id="delTime">Verwijderen</button>':''}</div></form>`);
    const preview=()=>{const f=new FormData($('#timeForm')),tmp={date:f.get('date'),from:f.get('from'),to:f.get('to')};$('#timePreview').innerHTML=`Tijdsduur: <strong>${durationHM(entryMinutes(tmp))} uur</strong>`};$$('#timeForm input').forEach(x=>x.addEventListener('input',preview));preview();$('#calendarTime').addEventListener('click',()=>{const f=new FormData($('#timeForm')),j=jobs.find(x=>x.id===f.get('jobId'))||{};openGoogleCalendarForTimeEntry({jobTitle:j.title||e.jobTitle||'Algemene werkzaamheden',date:f.get('date'),from:f.get('from'),to:f.get('to'),note:f.get('note')},j)});$('#timeForm').addEventListener('submit',async ev=>{ev.preventDefault();const f=new FormData(ev.target),j=jobs.find(x=>x.id===f.get('jobId'));Object.assign(e,{jobId:j?.id||'',jobTitle:j?.title||'Algemene werkzaamheden',date:f.get('date'),from:f.get('from'),to:f.get('to'),note:f.get('note'),start:null,end:null});await JKDB.put('timeEntries',e);closeModal();toast('Uren opgeslagen');if(state.route==='dashboard')render();else showTimeEntries();});$('#delTime')?.addEventListener('click',async()=>{if(confirm('Deze urenregistratie verwijderen?')){await JKDB.remove('timeEntries',id);closeModal();showTimeEntries();}});
  }

  async function showClients(){const cs=(await JKDB.all('clients')).sort((a,b)=>a.name.localeCompare(b.name));modal(`${modalHead('Klanten')}<button class="primary" id="addClient" style="width:100%;margin-bottom:12px">+ Nieuwe klant</button>${cs.length?`<div class="list">${cs.map(c=>`<div class="list-item clickable" data-client="${c.id}"><div class="main"><div class="title">${esc(c.name)}</div><div class="sub">${esc([c.city,c.phone].filter(Boolean).join(' · ')||'Geen extra gegevens')}</div></div><span>›</span></div>`).join('')}</div>`:'<div class="empty">Nog geen klanten.</div>'}`);$('#addClient').addEventListener('click',()=>{closeModal();editClient()});$$('[data-client]').forEach(x=>x.addEventListener('click',()=>{closeModal();editClient(x.dataset.client)}));}
  async function editClient(id){const c=id?await JKDB.get('clients',id):{id:JKDB.id('client'),name:'',attention:'',street:'',postal:'',city:'',phone:'',email:'',notes:''};modal(`${modalHead(id?'Klant bewerken':'Nieuwe klant')}<form id="clientForm"><div class="field"><label>Naam/bedrijf</label><input name="name" required value="${esc(c.name)}"></div><div class="field"><label>T.a.v.</label><input name="attention" value="${esc(c.attention||'')}"></div><div class="field"><label>Adres</label><input name="street" value="${esc(c.street||'')}"></div><div class="form-grid"><div class="field"><label>Postcode</label><input name="postal" value="${esc(c.postal||'')}"></div><div class="field"><label>Plaats</label><input name="city" value="${esc(c.city||'')}"></div><div class="field"><label>Telefoon</label><input name="phone" value="${esc(c.phone||'')}"></div><div class="field"><label>E-mail</label><input type="email" name="email" value="${esc(c.email||'')}"></div><div class="field full"><label>Notities</label><textarea name="notes">${esc(c.notes||'')}</textarea></div></div><div class="button-row"><button class="primary">Opslaan</button>${id?'<button type="button" class="danger-btn" id="delClient">Verwijderen</button>':''}</div></form>`);$('#clientForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);['name','attention','street','postal','city','phone','email','notes'].forEach(k=>c[k]=f.get(k));await JKDB.put('clients',c);closeModal();toast('Klant opgeslagen');if(state.route==='more')render();});$('#delClient')?.addEventListener('click',async()=>{if(confirm('Klant verwijderen?')){await JKDB.remove('clients',id);closeModal();}});}
  async function showChecklists(){const cs=await JKDB.all('checklists');modal(`${modalHead('Algemene checklists')}<button class="primary" id="addCheck" style="width:100%;margin-bottom:12px">+ Nieuwe checklist</button><div class="list">${cs.map(c=>`<div class="list-item clickable" data-checklist="${c.id}"><div class="main"><div class="title">${esc(c.name)}</div><div class="sub">${c.items.length} punten</div></div><span>›</span></div>`).join('')}</div>`);$('#addCheck').addEventListener('click',()=>{closeModal();editChecklist()});$$('[data-checklist]').forEach(x=>x.addEventListener('click',()=>{closeModal();editChecklist(x.dataset.checklist)}));}
  async function editChecklist(id){const c=id?await JKDB.get('checklists',id):{id:JKDB.id('check'),name:'',items:[]};modal(`${modalHead(id?'Checklist bewerken':'Nieuwe checklist')}<form id="checkForm"><div class="field"><label>Naam</label><input name="name" required value="${esc(c.name)}"></div><div class="field"><label>Punten - één per regel</label><textarea name="items" style="min-height:260px">${esc(c.items.join('\n'))}</textarea></div><div class="button-row"><button class="primary">Opslaan</button>${id?'<button type="button" class="danger-btn" id="delCheck">Verwijderen</button>':''}</div></form>`);$('#checkForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);c.name=f.get('name');c.items=String(f.get('items')).split('\n').map(x=>x.trim()).filter(Boolean);await JKDB.put('checklists',c);closeModal();toast('Checklist opgeslagen')});$('#delCheck')?.addEventListener('click',async()=>{if(confirm('Checklist verwijderen?')){await JKDB.remove('checklists',id);closeModal();}})}
  async function showCompany(){const c=await JKDB.get('settings','company');modal(`${modalHead('Bedrijfsgegevens')}<form id="companyForm"><div class="field"><label>Bedrijfsnaam</label><input name="companyName" value="${esc(c.companyName||'')}"></div><div class="field"><label>Naam</label><input name="owner" value="${esc(c.owner||'')}"></div><label class="checkline"><input type="checkbox" name="kor" ${c.kor?'checked':''}><span>Kleineondernemersregeling (KOR) actief</span></label><div class="field"><label>KOR sinds</label><input type="date" name="korSince" value="${esc(c.korSince||'')}"></div><div class="field"><label>Standaard uurtarief voor facturen</label><input type="number" step="0.01" name="defaultRate" value="${esc(c.defaultRate||'')}"></div><div class="field"><label>Notities</label><textarea name="notes">${esc(c.notes||'')}</textarea></div><button class="primary" style="width:100%">Opslaan</button></form>`);$('#companyForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);Object.assign(c,{companyName:f.get('companyName'),owner:f.get('owner'),kor:f.get('kor')==='on',korSince:f.get('korSince'),defaultRate:f.get('defaultRate'),notes:f.get('notes')});await JKDB.put('settings',c);closeModal();toast('Bedrijfsgegevens opgeslagen');});}

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
