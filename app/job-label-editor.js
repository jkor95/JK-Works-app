/* JK Works - editable 4x6 work-order PNG controls; edits are print-only, job numbering persisted separately. */
window.JKJobLabelEditor=(()=>{
 'use strict';
 const query=(s)=>document.querySelector(s);
 const escapeHTML=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const digits=v=>Number.isFinite(Number(v))?Number(v):0;
 // Job IDs contain their immutable creation timestamp (job_<base36 milliseconds>_...).
 // Prefer that to editable execution/planning dates for historical order.
 const creationOrder=j=>{
   const match=String(j.id||'').match(/^job_([0-9a-z]+)_/i);
   const idTime=match?parseInt(match[1],36):NaN;
   if(Number.isFinite(idTime)&&idTime>=946684800000&&idTime<=4102444800000)return idTime;
   const created=Date.parse(j.createdAt||'');
   if(Number.isFinite(created))return created;
   const date=Date.parse(String(j.date||'').slice(0,10));
   return Number.isFinite(date)?date:Number.MAX_SAFE_INTEGER;
 };
 // De aanmaakdatum bepaalt het klusjaar (niet de later wijzigbare uitvoeringsdatum).
 const jobYear=j=>{
   const raw=creationOrder(j);
   const year=raw!==Number.MAX_SAFE_INTEGER?new Date(raw).getUTCFullYear():new Date().getFullYear();
   return year>=2000&&year<=2100?year:new Date().getFullYear();
 };
 const annualPattern=/^K-(\d{4})-(\d{3,})$/i;
 const savedNumber=j=>String(j?.jobNumber||j?.ticketNumber||j?.number||'').trim();
 const hasAnnualNumber=j=>annualPattern.test(savedNumber(j));
 const formatNumber=(year,index)=>'K-'+year+'-'+String(index).padStart(3,'0');
 async function ensureJobNumbers(jobs,write,lastByYear={}){
   // Eenmalige migratie van oude K-001-nummers; bestaande jaarcodes nooit hernummeren.
   const sorted=[...(jobs||[])].sort((a,b)=>creationOrder(a)-creationOrder(b)||String(a.id).localeCompare(String(b.id)));
   const taken=new Set();
   const nextByYear={};
   for(const [key,value] of Object.entries(lastByYear||{})){
     if(/^\d{4}$/.test(key))nextByYear[key]=Math.max(0,Math.floor(Number(value)||0));
   }
   for(const job of sorted){
     const found=annualPattern.exec(savedNumber(job));
     if(!found)continue;
     const number=String(found[0]).toUpperCase();
     taken.add(number);
     nextByYear[found[1]]=Math.max(nextByYear[found[1]]||0,Number(found[2]));
   }
   for(let i=0;i<sorted.length;i++){
     const job=sorted[i];
     if(hasAnnualNumber(job))continue;
     const year=jobYear(job),key=String(year);
     let candidate;
     do{
       nextByYear[key]=(nextByYear[key]||0)+1;
       candidate=formatNumber(year,nextByYear[key]);
     }while(taken.has(candidate));
     taken.add(candidate);
     const updated={...job,jobNumber:candidate};
     sorted[i]=typeof write==='function'?(await write(updated))||updated:updated;
   }
   return sorted;
 }
 function jobNumber(jobs,job){
   const assigned=savedNumber(job);
   if(hasAnnualNumber(job))return assigned;
   // Fallback bij een nog niet opgeslagen klus (normaliter krijgt deze bij bewaren direct een nummer).
   const year=jobYear(job);
   const all=[...(jobs||[])];
   if(!all.some(j=>String(j.id)===String(job.id)))all.push(job);
   const sameYear=all.filter(j=>jobYear(j)===year)
     .sort((a,b)=>creationOrder(a)-creationOrder(b)||String(a.id).localeCompare(String(b.id)));
   const index=sameYear.findIndex(j=>String(j.id)===String(job.id))+1;
   return formatNumber(year,Math.max(1,index));
 }
 const fullDate=iso=>new Date(iso+'T12:00:00').toLocaleDateString('nl-NL',{day:'2-digit',month:'short',year:'numeric'});
 const timeLabel=row=>[row.from||row.startTime,row.to||row.endTime].filter(Boolean).join(' - ');
 const timeMinutes=row=>{
   if(row.minutes!=null&&Number.isFinite(Number(row.minutes)))return Math.max(0,Number(row.minutes));
   const start=(row.from||row.startTime||''),end=(row.to||row.endTime||'');
   if(!/^\d{1,2}:\d{2}$/.test(start)||!/^\d{1,2}:\d{2}$/.test(end))return 0;
   const a=Number(start.slice(0,2))*60+Number(start.slice(-2));
   const b=Number(end.slice(0,2))*60+Number(end.slice(-2));
   return Math.max(0,(b<=a?b+1440:b)-a-Math.max(0,digits(row.breakMinutes)));
 };
 const hourText=minutes=>minutes>0?(minutes/60).toLocaleString('nl-NL',{maximumFractionDigits:2})+' uur':'';
 function actualPlanning(days,entries,today){
   const worked=(entries||[]).filter(e=>e&&(!e.autoFromJobSchedule||e.actualConfirmed===true))
     .map(e=>({...e,date:e.date||String(e.start||'').slice(0,10),from:e.from||String(e.start||'').slice(11,16),to:e.to||String(e.end||'').slice(11,16)}))
     .filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&e.from&&e.to)
     .sort((a,b)=>a.date.localeCompare(b.date)||a.from.localeCompare(b.from));
   const doneDates=new Set(worked.map(e=>e.date));
   const planned=(days||[]).filter(d=>d.date&&!doneDates.has(d.date) &&
     // Once work is registered on another date, omit stale old planning:
     // the user considers that an execution-date replacement.
     (!worked.length||d.date>=today)).sort((a,b)=>a.date.localeCompare(b.date));
   const rows=[
     ...worked.map(e=>({date:e.date,source:'Gewerkt',time:timeLabel(e),minutes:timeMinutes(e)})),
     ...planned.map(d=>({date:d.date,source:'Gepland',time:timeLabel(d),minutes:timeMinutes(d)}))
   ].sort((a,b)=>a.date.localeCompare(b.date)|| (a.source==='Gewerkt'?-1:1));
   return {rows,planning:rows.map(r=>[r.source,fullDate(r.date),r.time].filter(Boolean).join(' · ')).join('\n'),
     workDays:new Set(rows.map(r=>r.date)).size,
     workedMinutes:worked.reduce((s,e)=>s+timeMinutes(e),0),
     plannedMinutes:planned.reduce((s,e)=>s+timeMinutes(e),0)};
 }
 const joinAddress=(street,postal,city)=>[street,[postal,city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
 function defaultData({job,client,finance,days,entries,receipts,jobs,today}){
   const c=client||job;
   const address=job.executionAddress||{};
   const schedule=actualPlanning(days,entries,today||new Date().toLocaleDateString('sv-SE'));
   const payments=(receipts||[]).filter(x=>x.resolvedJobId===job.id);
   const payment=payments.length?({
     card:'Betaalverzoek',cash:'Contant',bank:'Bankoverschrijving',other:'Anders'
   }[payments[payments.length-1].method]||'Anders'):(job.paymentType==='cash'?'Contant':'Factuur');
   const priceLabel=({fixed:'Vaste prijs',manual:'Handmatig bedrag',hourly:'Op uurbasis'})[job.pricingType]||'Op uurbasis';
   // Bij een kosteloze klus met een vrijwillige betaling is de oorspronkelijke
   // afspraak 0 euro. Vermeld de werkelijk ontvangen vergoeding op de werkbon,
   // maar doe niet alsof de prijsafspraak achteraf is verhoogd.
   const receivedInstead=finance&&!finance.pending&&Number(finance.agreed)===0&&Number(finance.received)>0;
   const amountValue=receivedInstead?finance.received:finance?.agreed;
   return {
     number:jobNumber(jobs,job),
     status:job.status||'',title:job.title||'',
     client:c.name||job.clientName||'',contact:c.attention||job.attention||'',phone:c.phone||job.phone||'',
     clientAddress:joinAddress(c.street||job.street||job.address,c.postal||job.postal,c.city||job.city),
     executionAddress:joinAddress(address.street,address.postal,address.city),
     planning:schedule.planning,workDays:schedule.workDays?String(schedule.workDays):'',
     workedHours:hourText(schedule.workedMinutes),plannedHours:hourText(schedule.plannedMinutes),
     priceType:priceLabel,amountLabel:receivedInstead?'Ontvangen:':'Bedrag:',amount:finance?.pending?'':(amountValue!=null?new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(amountValue):''),
     payment,
     notes:String(job.notes||'')
   };
 }
 function input(name,label,value){
   return '<div class="field"><label for="jobLabel-'+name+'">'+escapeHTML(label)+'</label><input id="jobLabel-'+name+'" name="'+name+'" value="'+escapeHTML(value)+'"></div>';
 }
 function area(name,label,value,tip){
   return '<div class="field"><label for="jobLabel-'+name+'">'+escapeHTML(label)+'</label><textarea id="jobLabel-'+name+'" name="'+name+'" rows="4">'+escapeHTML(value)+'</textarea>'+(tip?'<small class="muted">'+escapeHTML(tip)+'</small>':'')+'</div>';
 }
 function dataFromForm(form){
   const f=new FormData(form),result={};
   for(const key of ['number','status','title','client','contact','phone','clientAddress','executionAddress','planning','workDays','workedHours','plannedHours','priceType','amountLabel','amount','payment','notes']){
     result[key]=String(f.get(key)||'').trim();
   }
   return result;
 }
 function pngBlobFromDataURL(dataURL){
   const bytes=atob(dataURL.split(',')[1]),arr=new Uint8Array(bytes.length);
   for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);
   return new Blob([arr],{type:'image/png'});
 }
 function open(info,api){
   if(!window.JKJobLabel)throw Error('Werkbonmodule kon niet worden geladen. Vernieuw de webapp.');
   const data=defaultData(info),formHTML=
     '<div class="card"><p class="muted small">Bewerk de werkbon voor deze afdruk. Wijzigingen hieronder wijzigen de klus, klant of factuur niet.</p>'+
     '<form id="jobLabelForm">'+input('number','Klusnummer (automatisch)',data.number)+
     input('status','Status',data.status)+input('title','Omschrijving klus',data.title)+
     '<h3>Klant</h3>'+input('client','Bedrijf / naam',data.client)+input('contact','Contactpersoon',data.contact)+input('phone','Telefoon',data.phone)+
     '<h3>Adressen</h3>'+input('clientAddress','Klantadres',data.clientAddress)+input('executionAddress','Uitvoeringsadres (optioneel)',data.executionAddress)+
     '<h3>Planning en uitvoering</h3>'+area('planning','Werkelijk gewerkt en nog gepland',data.planning,'Geregistreerde werkdagen krijgen voorrang; je kunt de printtekst aanpassen.')+
     input('workDays','Aantal werkdagen',data.workDays)+input('workedHours','Gewerkte uren',data.workedHours)+input('plannedHours','Nog geplande uren',data.plannedHours)+
     '<h3>Financieel</h3>'+input('priceType','Prijsafspraak',data.priceType)+input('amountLabel','Omschrijving bedrag op werkbon',data.amountLabel)+input('amount',data.amountLabel==='Ontvangen:'?'Ontvangen bedrag':'Klusbedrag',data.amount)+input('payment','Betaalwijze / afhandeling',data.payment)+
     '<h3>Notities</h3>'+area('notes','Notities voor werkbon',data.notes,'Eén notitie per regel. Verwijder regels die niet op de werkbon mogen komen.')+
     '</form></div>';
   api.modal(api.modalHead('Werkbon voor 4×6-label')+
     '<div class="card"><p class="muted small">Zwart-wit · staand · 4″ × 6″ · PNG 1200 × 1800 pixels. De werkbon wordt alleen op je apparaat gemaakt.</p>'+
     '<div class="job-label-actions button-row"><button type="button" class="secondary" id="jobLabelRefresh">Voorbeeld bijwerken</button><button type="button" class="primary" id="jobLabelShare">Delen / Bewaar in Foto’s</button><button type="button" class="secondary" id="jobLabelDownload">PNG downloaden</button></div>'+
     '<div id="jobLabelError" class="small" role="alert" hidden></div>'+
     '<img id="jobLabelPreview" class="job-label-preview" alt="Voorbeeld van de verticale zwart-witte werkbon" />'+
     '<p class="muted small">iPhone: kies bij Delen de optie ‘Bewaar afbeelding’ voor Foto’s, of deel rechtstreeks met de labelprinter-app. Als de deelkaart niet beschikbaar is, download de PNG of houd de voorbeeldafbeelding ingedrukt.</p></div>'+
     formHTML+
     '<div class="button-row"><button type="button" class="secondary" id="jobLabelBack">Terug naar klus</button></div>');
   const form=query('#jobLabelForm'),preview=query('#jobLabelPreview'),message=query('#jobLabelError');
   const filename='JK-Works-werkbon-'+String(info.job.date||'klus').replace(/[^0-9-]/g,'')+'-'+String(info.job.id||'').replace(/[^a-z0-9-]/gi,'').slice(-8)+'.png';
   function render(){
     try{
       const canvas=window.JKJobLabel.render(dataFromForm(form));
       const src=canvas.toDataURL('image/png');
       preview.src=src;
       message.hidden=true;message.textContent='';
       return src;
     }catch(e){
       preview.removeAttribute('src');
       message.hidden=false;message.textContent=e.message||'Werkbon kan niet worden gemaakt.';
       return '';
     }
   }
   query('#jobLabelRefresh').addEventListener('click',render);
   query('#jobLabelDownload').addEventListener('click',()=>{
     const src=render();if(!src)return;
     api.downloadBlob(pngBlobFromDataURL(src),filename);
     api.toast('PNG-download gestart. Gebruik Delen om op iPhone in Foto’s te bewaren.');
   });
   query('#jobLabelShare').addEventListener('click',()=>{
     const src=render();if(!src)return;
     const blob=pngBlobFromDataURL(src),file=new File([blob],filename,{type:'image/png'});
     if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
       // Share immediately in the click handler; iOS requires a live user gesture.
       try{navigator.share({files:[file]}).catch(e=>{
         if(e.name==='AbortError')return;
         message.hidden=false;message.textContent='Delen is niet gelukt. Gebruik PNG downloaden of bewaar de voorbeeldafbeelding.';
       });}catch(e){message.hidden=false;message.textContent='Delen niet beschikbaar: gebruik PNG downloaden of bewaar de voorbeeldafbeelding.';}
     }else{
       message.hidden=false;message.textContent='Deelkaart voor afbeeldingen is niet beschikbaar. Download de PNG of houd de voorbeeldafbeelding ingedrukt om deze op te slaan.';
     }
   });
   query('#jobLabelBack').addEventListener('click',()=>api.showJob(info.job.id));
   render();
 }
 return {open,defaultData,dataFromForm,pngBlobFromDataURL,ensureJobNumbers,jobNumber,jobYear,actualPlanning};
})();