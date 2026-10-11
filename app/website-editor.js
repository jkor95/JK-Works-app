(()=>{'use strict';
const IDS=['hero','diensten','werkwijze','over','aanvragen','contact'];
const LABELS={hero:'Intro',diensten:'Diensten',werkwijze:'Werkwijze',over:'Over JK Works',aanvragen:'Opdracht aanvragen',contact:'Contact'};
const $=(s,r=document)=>r.querySelector(s);
const url='https://ercqiavruotoclhvfzud.supabase.co',key='sb_publishable_z4kkYgzjr-bYDEcSZlVciw_cP8MfOuX';
const copy=x=>JSON.parse(JSON.stringify(x));
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function open(){
 if(typeof JKCloud==='undefined'||!JKCloud.isSignedIn()){alert('Geen actieve Supabase-sessie. Controleer Meer > Synchronisatie.');return;}
 let content;try{content=await JKCloud.getWebsiteContent()||{}}catch(e){alert('Website laden mislukt: '+e.message);return;}
 content.siteImages ||= {};content.sectionImages ||= {};content.sectionVisibility ||= {};
 let published=copy(content),sections=[...new Set([...(content.sectionOrder||IDS).filter(x=>IDS.includes(x)),...IDS])],selection=null,previewReady=false,mode='desktop',dirty=false;
 const overlay=document.createElement('div');overlay.className='website-editor-overlay we-v714';
 overlay.innerHTML=`<div class="we-shell"><header class="we-bar"><strong>Website bewerken <small>v71.4</small></strong><div class="we-actions"><button class="we-btn" data-action="desktop">💻 Desktop</button><button class="we-btn" data-action="mobile">📱 Mobiel</button><button class="we-btn" data-action="reorder">↕ Volgorde</button><button class="we-btn" data-action="reset">↶ Herstellen</button><button class="we-btn primary" data-action="publish">Publiceren</button><button class="we-btn" data-action="close">✕</button></div></header><div class="we-hint" id="weHint">Klik rechtstreeks op een tekst, afbeelding of donker vlak om het te bewerken.</div><div class="we-preview"><div class="we-frame-wrap"><iframe id="weFrame" title="Bewerkbaar websitevoorbeeld" src="/?jkedit=714"></iframe></div></div><div class="we-dialog" id="weDialog" hidden><div class="we-dialog-head"><strong id="weDialogTitle">Bewerken</strong><button class="we-btn" data-action="dismiss">✕</button></div><div id="weDialogBody"></div></div></div>`;
 document.body.appendChild(overlay);const frame=$('#weFrame',overlay),dialog=$('#weDialog',overlay),body=$('#weDialogBody',overlay),title=$('#weDialogTitle',overlay);
 const post=payload=>{if(previewReady&&frame.contentWindow)frame.contentWindow.postMessage({type:'jkworks-v71-preview',content:copy({...content,sectionOrder:sections})},location.origin)};
 const refresh=()=>{dirty=true;post();};
 const closeDialog=()=>{dialog.hidden=true;selection=null;frame.contentWindow?.postMessage({type:'jkworks-editor-clear'},location.origin)};
 const imageControls=(group,id,label)=>`<div class="we-edit-photo"><label>${escapeHtml(label)}<input type="file" data-upload="${group}" data-id="${escapeHtml(id)}" accept="image/png,image/jpeg,image/webp"></label>${content[group]?.[id]?`<img src="${escapeHtml(content[group][id])}" alt="Huidige afbeelding"><button class="we-btn" data-remove="${group}" data-id="${escapeHtml(id)}">Afbeelding verwijderen</button>`:''}</div>`;
 const fieldsForSection=id=>{const el=frame.contentDocument?.querySelector('[data-section="'+id+'"]');const keys=[...new Set([...el?.querySelectorAll('[data-site]')||[]].map(e=>e.dataset.site))];return keys.map(k=>{const node=el.querySelector('[data-site="'+k+'"]');const val=content[k]??node?.textContent??'';return `<label class="we-edit-field"><span>${escapeHtml(node?.textContent?.trim().slice(0,35)||k)}</span><textarea data-key="${escapeHtml(k)}" rows="${String(val).length>85?4:2}">${escapeHtml(val)}</textarea></label>`}).join('')};
 function edit(sel){selection=sel;const section=sel.section||'hero';const label=LABELS[section]||section;title.textContent=sel.kind==='text'?'Tekst aanpassen · '+label:sel.kind==='image'?'Afbeelding aanpassen · '+label:'Onderdeel aanpassen · '+label;
 if(sel.kind==='text'){
  const node=frame.contentDocument?.querySelector('[data-site="'+CSS.escape(sel.key)+'"]');const val=content[sel.key]??node?.textContent??'';
  body.innerHTML=`<label class="we-edit-field">Tekst<textarea data-key="${escapeHtml(sel.key)}" rows="${String(val).length>100?5:3}">${escapeHtml(val)}</textarea></label>`;
 }else if(sel.kind==='image'){
  body.innerHTML=imageControls('siteImages',sel.key,'Foto vervangen');
 }else{
  body.innerHTML=`<label class="we-check"><input type="checkbox" id="weVisible" ${content.sectionVisibility[section]===false?'':'checked'}> Onderdeel zichtbaar</label><h4>Teksten in dit onderdeel</h4>${fieldsForSection(section)||'<p>Geen losse tekstvelden in dit onderdeel.</p>'}<h4>Afbeeldingen</h4>${section==='over'?imageControls('siteImages','about','Foto bij Over JK Works'):''}${section==='hero'?imageControls('siteImages','hero','Foto in introductie')+imageControls('siteImages','logo','Logo bovenaan'):''}${imageControls('sectionImages',section,'Extra afbeelding bij dit onderdeel')}<div class="we-move"><button class="we-btn" data-shift="-1">↑ Onderdeel omhoog</button><button class="we-btn" data-shift="1">↓ Onderdeel omlaag</button></div>`;
 }
 body.querySelectorAll('[data-key]').forEach(t=>t.oninput=()=>{content[t.dataset.key]=t.value;refresh()});
 $('#weVisible',body)?.addEventListener('change',e=>{content.sectionVisibility[section]=e.target.checked;refresh()});
 body.querySelectorAll('[data-upload]').forEach(t=>t.onchange=()=>upload(t.files?.[0],t.dataset.upload,t.dataset.id));
 body.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{delete content[b.dataset.remove][b.dataset.id];refresh();edit(sel)});
 body.querySelectorAll('[data-shift]').forEach(b=>b.onclick=()=>{const i=sections.indexOf(section),j=i+Number(b.dataset.shift);if(j<0||j>=sections.length)return;[sections[i],sections[j]]=[sections[j],sections[i]];refresh()});
 dialog.hidden=false;
 }
 async function upload(file,group,id){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){alert('Gebruik JPG, PNG of WebP.');return;}if(file.size>8*1024*1024){alert('Afbeelding is groter dan 8 MB.');return;}try{
 const token=await JKCloud.getAccessToken();const user=JKCloud.user();if(!token||!user?.id)throw Error('Geen actieve sessie');const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=user.id+'/'+crypto.randomUUID()+'.'+ext;
 const r=await fetch(url+'/storage/v1/object/jkworks-website-assets/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':file.type,'x-upsert':'false'},body:file});if(!r.ok)throw Error(await r.text());content[group][id]=url+'/storage/v1/object/public/jkworks-website-assets/'+path;refresh();edit(selection);
 }catch(e){alert('Upload mislukt: '+e.message)}}
 function reorder(){selection={kind:'order'};title.textContent='Volgorde van onderdelen';body.innerHTML='<p>Verplaats onderdelen met de pijltjes. Dit geldt voor mobiel én desktop.</p>'+sections.map((id,i)=>`<div class="we-order-row"><strong>${LABELS[id]}</strong><button class="we-btn" data-i="${i}" data-d="-1" ${i===0?'disabled':''}>↑</button><button class="we-btn" data-i="${i}" data-d="1" ${i===sections.length-1?'disabled':''}>↓</button></div>`).join('');body.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i),j=i+Number(b.dataset.d);[sections[i],sections[j]]=[sections[j],sections[i]];refresh();reorder()});dialog.hidden=false;}
 function handleClick(e){const a=e.target.closest('[data-action]');if(!a)return;const action=a.dataset.action;if(action==='close'){overlay.remove();window.removeEventListener('message',receive);return;}if(action==='dismiss'){closeDialog();return;}if(action==='desktop'||action==='mobile'){$('.we-frame-wrap',overlay).classList.toggle('mobile',action==='mobile');return;}if(action==='reorder'){reorder();return;}if(action==='reset'){if(!confirm('Alle niet-gepubliceerde wijzigingen herstellen?'))return;content=copy(published);content.siteImages||={};content.sectionImages||={};content.sectionVisibility||={};sections=[...new Set([...(content.sectionOrder||IDS),...IDS])];closeDialog();refresh();return;}if(action==='publish'){publish(a)}}
 async function publish(btn){btn.disabled=true;try{content.sectionOrder=[...sections];await JKCloud.saveWebsiteContent(content);published=copy(content);dirty=false;$('#weHint',overlay).textContent='Wijzigingen gepubliceerd! Controleer de openbare website in een nieuw tabblad.';alert('Website gepubliceerd.');}catch(e){alert('Publiceren mislukt: '+e.message)}finally{btn.disabled=false}}
 function receive(e){if(e.origin!==location.origin||e.source!==frame.contentWindow)return;const msg=e.data;if(msg?.type==='jkworks-editor-ready'){previewReady=true;post();return;}if(msg?.type==='jkworks-editor-select'){edit(msg.selection)}}
 window.addEventListener('message',receive);overlay.addEventListener('click',handleClick);frame.addEventListener('load',()=>{previewReady=false});
 }
 window.JKWebsiteEditor={open};
})();
