/* JK Works - private, editable 4x6 work-order PNG controls. No database writes. */
window.JKJobLabelEditor=(()=>{
 'use strict';
 const query=(s)=>document.querySelector(s);
 const escapeHTML=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const digits=v=>Number.isFinite(Number(v))?Number(v):0;
 const joinAddress=(street,postal,city)=>[street,[postal,city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
 function defaultData({job,client,check,finance,days,minutes,receipts}){
   const c=client||job;
   const address=job.executionAddress||{};
   const planning=(days||[]).map(d=>{
     const hours=[d.startTime,d.endTime].filter(Boolean).join(' - ');
     return [d.date?new Date(d.date+'T12:00:00').toLocaleDateString('nl-NL',{day:'2-digit',month:'short',year:'numeric'}):'',hours].filter(Boolean).join('  ');
   }).join('\n');
   const payments=(receipts||[]).filter(x=>x.resolvedJobId===job.id);
   const payment=payments.length?({
     card:'Betaalverzoek',cash:'Contant',bank:'Bankoverschrijving',other:'Anders'
   }[payments[payments.length-1].method]||'Anders'):(job.paymentType==='cash'?'Contant':'Factuur');
   const hrs=digits(minutes)>0?(minutes/60).toLocaleString('nl-NL',{maximumFractionDigits:2})+' uur':'';
   const priceLabel=({fixed:'Vaste prijs',manual:'Handmatig bedrag',hourly:'Op uurbasis'})[job.pricingType]||'Op uurbasis';
   return {
     number:job.ticketNumber||job.jobNumber||job.number||'',
     status:job.status||'',title:job.title||'',
     client:c.name||job.clientName||'',contact:c.attention||job.attention||'',phone:c.phone||job.phone||'',
     clientAddress:joinAddress(c.street||job.street||job.address,c.postal||job.postal,c.city||job.city),
     executionAddress:joinAddress(address.street,address.postal,address.city),
     planning,workDays:days?.length?String(days.length):'',hours:hrs,
     priceType:priceLabel,amount:finance?.pending?'':(finance?.agreed!=null?new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(finance.agreed):''),
     payment,
     items:(check?.items||[]).filter(x=>typeof x==='string').join('\n'),
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
   for(const key of ['number','status','title','client','contact','phone','clientAddress','executionAddress','planning','workDays','hours','priceType','amount','payment','items','notes']){
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
     '<form id="jobLabelForm">'+input('number','Klusnummer (optioneel)',data.number)+
     input('status','Status',data.status)+input('title','Omschrijving klus',data.title)+
     '<h3>Klant</h3>'+input('client','Bedrijf / naam',data.client)+input('contact','Contactpersoon',data.contact)+input('phone','Telefoon',data.phone)+
     '<h3>Adressen</h3>'+input('clientAddress','Klantadres',data.clientAddress)+input('executionAddress','Uitvoeringsadres (optioneel)',data.executionAddress)+
     '<h3>Planning</h3>'+area('planning','Werkdagen en tijd',data.planning,'Bij meerdere werkdagen mag je regels weghalen of aanpassen.')+
     input('workDays','Aantal werkdagen',data.workDays)+input('hours','Geplande uren',data.hours)+
     '<h3>Financieel</h3>'+input('priceType','Prijsafspraak',data.priceType)+input('amount','Klusbedrag',data.amount)+input('payment','Betaalwijze / afhandeling',data.payment)+
     '<h3>Mee te nemen</h3>'+area('items','Meeneemlijst',data.items,'Eén item per regel. Voeg nieuwe regels toe of verwijder wat niet geprint moet worden.')+
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
 return {open,defaultData,dataFromForm,pngBlobFromDataURL};
})();