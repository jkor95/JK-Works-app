/* JK Works: work-order sized outstanding-payments label editor, print only. */
window.JKOpenPaymentsEditor=(()=>{
 'use strict';
 const $=selector=>document.querySelector(selector);
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const bytesFromDataURL=dataURL=>{
   const binary=atob(dataURL.split(',')[1]),arr=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)arr[i]=binary.charCodeAt(i);
   return new Blob([arr],{type:'image/png'});
 };
 function open(initial,api){
   if(!window.JKOpenPaymentsLabel)throw Error('Openstaande-werkbon kan niet worden geladen. Vernieuw de app.');
   const rows=(initial.items||[]).map(x=>({...x,include:true}));
   if(!rows.length){api.toast('Er staan geen betalingen open om af te drukken.');return;}
   const itemHtml=rows.map((row,i)=>
     '<fieldset class="open-label-row" data-open-label-row="'+i+'">'+
     '<label class="checkline"><input type="checkbox" name="include" checked><strong>Post '+(i+1)+' opnemen</strong></label>'+
     '<div class="form-grid">'+
     '<div class="field"><label>Naam / klant<input name="client" value="'+escape(row.client)+'"></label></div>'+
     '<div class="field"><label>Klus / factuur<input name="job" value="'+escape(row.job)+'"></label></div>'+
     '<div class="field"><label>Datum<input name="date" value="'+escape(row.date)+'"></label></div>'+
     '<div class="field"><label>Werkelijke tijden / gepland<input name="times" value="'+escape(row.times)+'"></label></div>'+
     '<div class="field"><label>Nog te ontvangen (€)<input name="amount" inputmode="decimal" value="'+escape(row.amount)+'"></label></div>'+
     '</div></fieldset>'
   ).join('');
   api.modal(api.modalHead('Openstaande betalingen · label')+
     '<div class="card"><p class="muted small">4″ × 6″ staand · zwart-wit · PNG. De bon is uitsluitend voor jezelf, zonder wijzigingen in betalingen of klussen.</p>'+
     '<div class="field"><label>Titel op de bon<input id="openLabelTitle" value="OPENSTAANDE BETALINGEN"></label></div>'+
     '<div id="openLabelSummary" class="open-label-summary" aria-live="polite"></div>'+
     '<div class="job-label-actions button-row"><button class="secondary" type="button" id="openLabelRefresh">Voorbeeld bijwerken</button><button class="primary" type="button" id="openLabelShare">Delen / Bewaar in Foto’s</button><button class="secondary" type="button" id="openLabelDownload">Huidige PNG downloaden</button></div>'+
     '<div id="openLabelError" role="alert" class="small" hidden></div>'+
     '<div class="open-label-preview-wrap"><img class="job-label-preview" id="openLabelPreview" alt="4x6 zwart-wit openstaande-betalingenbon"></div>'+
     '<div class="button-row open-label-pages"><button class="secondary" type="button" id="openLabelPrev">← Vorige</button><span id="openLabelPageCount" class="muted small">Pagina 1</span><button class="secondary" type="button" id="openLabelNext">Volgende →</button></div>'+
     '<p class="muted small">Bij meerdere stickers kun je ze samen delen met je iPhone of iedere pagina apart als PNG bewaren. In de iPhone-deelkaart kun je ‘Bewaar afbeelding’ of je printer-app kiezen.</p></div>'+
     '<div class="card"><h3>Posten voor dit overzicht</h3><p class="muted small">Vink ongewenste posten uit of pas de tekst en bedragen uitsluitend voor deze afdruk aan. De geselecteerde bedragen bepalen het totaal op de laatste sticker.</p>'+
     '<form id="openLabelForm">'+itemHtml+'</form></div>'+
     '<div class="button-row"><button class="secondary" id="openLabelBack" type="button">Terug naar Klussen</button></div>');
   const form=$('#openLabelForm'),preview=$('#openLabelPreview'),message=$('#openLabelError'),summary=$('#openLabelSummary');
   const prev=$('#openLabelPrev'),next=$('#openLabelNext'),pageCount=$('#openLabelPageCount');
   let canvases=[],pageIndex=0,blobSrc=[];
   const filename=(i)=>'JK-Works-openstaand-'+new Date().toISOString().slice(0,10)+'-'+String(i+1).padStart(2,'0')+'.png';
   function read(){
     const title=$('#openLabelTitle').value.trim();
     return {title,items:[...form.querySelectorAll('[data-open-label-row]')].map(row=>{
       const val=n=>row.querySelector('[name="'+n+'"]').value.trim();
       return {include:row.querySelector('[name=include]').checked,client:val('client'),job:val('job'),
         date:val('date'),times:val('times'),amount:val('amount')};
     })};
   }
   function render(){
     try{
       const data=read(),made=JKOpenPaymentsLabel.pages(data);
       canvases=made;pageIndex=Math.min(pageIndex,made.length-1);
       const selected=JKOpenPaymentsLabel.selectedRows(data);
       const total=selected.reduce((sum,row)=>sum+row.amount,0);
       summary.textContent=selected.length+' openstaande '+(selected.length===1?'post':'posten')+
         ' · Totaal: '+JKOpenPaymentsLabel.money(total);
       message.hidden=true;message.textContent='';
       showPage();
       return true;
     }catch(e){
       message.hidden=false;message.textContent=e?.message||'Afbeelding maken mislukt.';
       summary.textContent='Controleer de ingevoerde bedragen en de geselecteerde posten.';
       preview.removeAttribute('src');canvases=[];prev.disabled=true;next.disabled=true;
       pageCount.textContent='Geen voorbeeld';
       return false;
     }
   }
   function showPage(){
     if(!canvases.length)return;
     preview.src=canvases[pageIndex].toDataURL('image/png');
     pageCount.textContent='Pagina '+(pageIndex+1)+' van '+canvases.length;
     prev.disabled=pageIndex===0;next.disabled=pageIndex===canvases.length-1;
   }
   $('#openLabelRefresh').addEventListener('click',render);
   form.addEventListener('change',()=>render());
   $('#openLabelTitle').addEventListener('change',render);
   prev.addEventListener('click',()=>{if(pageIndex>0){pageIndex--;showPage();}});
   next.addEventListener('click',()=>{if(pageIndex<canvases.length-1){pageIndex++;showPage();}});
   $('#openLabelDownload').addEventListener('click',()=>{
     if(!render())return;
     api.downloadBlob(bytesFromDataURL(canvases[pageIndex].toDataURL('image/png')),filename(pageIndex));
     api.toast('PNG-download gestart voor pagina '+(pageIndex+1)+' van '+canvases.length+'.');
   });
   $('#openLabelShare').addEventListener('click',()=>{
     if(!render())return;
     // Synchronously build files: iOS needs navigator.share in the originating tap.
     const files=canvases.map((canvas,i)=>new File([bytesFromDataURL(canvas.toDataURL('image/png'))],filename(i),{type:'image/png'}));
     const shareFiles=!navigator.canShare||navigator.canShare({files})?files:
       navigator.canShare&&navigator.canShare({files:[files[pageIndex]]})?[files[pageIndex]]:[];
     if(navigator.share&&shareFiles.length){
       try{navigator.share({files:shareFiles}).catch(error=>{
         if(error?.name==='AbortError')return;
         message.hidden=false;message.textContent='Delen lukte niet. Download de afbeeldingen één voor één of probeer de deelknop opnieuw.';
       });}catch{
         message.hidden=false;message.textContent='Delen is niet beschikbaar. Download de afbeeldingen één voor één.';
       }
     }else{
       message.hidden=false;message.textContent='Afbeeldingen delen wordt hier niet ondersteund. Download elke pagina via Huidige PNG downloaden.';
     }
   });
   $('#openLabelBack').addEventListener('click',()=>api.closeModal());
   render();
 }
 return {open};
})();