(()=>{'use strict';
const url='https://ercqiavruotoclhvfzud.supabase.co',key='sb_publishable_z4kkYgzjr-bYDEcSZlVciw_cP8MfOuX';
const editorMode=new URLSearchParams(location.search).has('jkedit')&&window.parent!==window;
const defaults=new Map();const remember=()=>document.querySelectorAll('[data-site]').forEach(el=>defaults.set(el.dataset.site,el.textContent));
function image(el,src){if(el)el.src=src;}
function apply(c){if(!c||typeof c!=='object')return;
 for(const [k,v] of defaults){const el=document.querySelector('[data-site="'+CSS.escape(k)+'"]');if(el)el.textContent=typeof c[k]==='string'&&!window.JKCopyCompat?.isLegacy(k,c[k])?c[k]:v;}
 const main=document.querySelector('main');if(main){const sections=[...main.querySelectorAll('[data-section]')],byId=new Map(sections.map(s=>[s.dataset.section,s]));for(const id of c.sectionOrder||[]){const el=byId.get(id);if(el){main.appendChild(el);byId.delete(id)}}for(const el of byId.values())main.appendChild(el);}
 for(const id of ['hero','diensten','werkwijze','over','aanvragen','contact']){const el=document.querySelector('[data-section="'+id+'"]');if(!el)continue;el.hidden=c.sectionVisibility?.[id]===false;let extra=el.querySelector('.managed-section-image');const src=c.sectionImages?.[id];if(typeof src==='string'&&/^https:\/\//.test(src)){if(!extra){extra=document.createElement('img');extra.className='managed-section-image';extra.alt='Afbeelding '+id;el.insertBefore(extra,el.firstChild)}extra.src=src;}else extra?.remove();}
 const img=c.siteImages||{};for(const [name,selector,original] of [['logo','.site-brand img','/assets/jk-works-logo.jpg'],['hero','.hero-logo','/assets/jk-works-logo.jpg'],['about','.about-mark img','/assets/jk-works-logo.jpg']]){const src=img[name];image(document.querySelector(selector),typeof src==='string'&&/^https:\/\//.test(src)?src:original);}
}
remember();
const client=window.supabase?.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
async function load(){try{if(!client)return;const {data,error}=await client.from('app_records').select('data').eq('store','websitePublic').eq('record_id','main').limit(1);if(!error&&data?.length)apply(data[0].data||{})}catch(e){console.warn('Website-inhoud niet geladen',e)}}
if(editorMode){
 const css=document.createElement('style');css.textContent=`[data-site],.site-brand img,.hero-logo,.about-mark img,[data-section],.managed-section-image{cursor:pointer!important} [data-site]:hover,.site-brand img:hover,.hero-logo:hover,.about-mark img:hover,[data-section]:hover{outline:3px solid #1caa72!important;outline-offset:3px!important} .jk-edit-selected{outline:4px solid #1caa72!important;outline-offset:3px!important}`;document.head.appendChild(css);
 document.addEventListener('click',e=>{let target=e.target.closest('[data-site],.site-brand img,.hero-logo,.about-mark img,.managed-section-image,[data-section]');if(!target)return;e.preventDefault();e.stopPropagation();let section=target.closest('[data-section]')?.dataset.section||'hero';let selection;
 if(target.matches('[data-site]'))selection={kind:'text',key:target.dataset.site,section};
 else if(target.matches('.site-brand img'))selection={kind:'image',key:'logo',section};
 else if(target.matches('.hero-logo'))selection={kind:'image',key:'hero',section};
 else if(target.matches('.about-mark img'))selection={kind:'image',key:'about',section};
 else if(target.matches('.managed-section-image'))selection={kind:'section',section};
 else selection={kind:'section',section};
 document.querySelectorAll('.jk-edit-selected').forEach(el=>el.classList.remove('jk-edit-selected'));target.classList.add('jk-edit-selected');window.parent.postMessage({type:'jkworks-editor-select',selection},location.origin);
 },true);
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==window.parent)return;if(e.data?.type==='jkworks-v71-preview')apply(e.data.content||{});if(e.data?.type==='jkworks-editor-clear')document.querySelectorAll('.jk-edit-selected').forEach(el=>el.classList.remove('jk-edit-selected'));});

}
if(editorMode)window.parent.postMessage({type:'jkworks-editor-ready',defaults:Object.fromEntries(defaults)},location.origin);
else load();
})();
