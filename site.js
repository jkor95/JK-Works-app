(() => {
  const menu=document.querySelector('.menu-btn');
  const nav=document.querySelector('.site-nav');
  menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu?.setAttribute('aria-expanded','false');}));

  const SUPABASE_URL='https://ercqiavruotoclhvfzud.supabase.co';
  const SUPABASE_KEY='sb_publishable_z4kkYgzjr-bYDEcSZlVciw_cP8MfOuX';
  const client=window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null;

  async function loadPublishedWebsiteText(){
    try{
      if(!client)throw new Error('Supabase client niet geladen');
      const {data:rows,error}=await client.from('app_records').select('data,updated_at').eq('store','websitePublic').eq('record_id','main').order('updated_at',{ascending:false}).limit(1);
      if(error)throw error;
      const content=rows?.[0]?.data;
      if(!content||typeof content!=='object')return;
      document.querySelectorAll('[data-site]').forEach(el=>{const key=el.dataset.site;if(Object.prototype.hasOwnProperty.call(content,key)&&String(content[key]).trim())el.textContent=content[key];});
    }catch(e){console.debug('Openbare website gebruikt ingebouwde standaardtekst.',e);}
  }


  async function compressRequestPhoto(file){
    const TARGET=200*1024;
    const url=URL.createObjectURL(file),img=new Image();
    try{
      await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url});
      const ow=img.naturalWidth||1,oh=img.naturalHeight||1;let maxSide=1400,quality=.72,best=null;
      for(let i=0;i<7;i++){
        const scale=Math.min(1,maxSide/Math.max(ow,oh)),canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(ow*scale));canvas.height=Math.max(1,Math.round(oh*scale));
        const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',quality));
        if(blob){best=blob;if(blob.size<=TARGET)break;}
        if(quality>.52)quality-=.07;else maxSide=Math.max(900,Math.round(maxSide*.85));
      }
      return best||file;
    }finally{URL.revokeObjectURL(url);}
  }

  async function submitPublicRequest(form){
    const status=document.querySelector('#requestStatus');
    const submit=form.querySelector('button[type="submit"]');
    const f=new FormData(form);
    if(String(f.get('website')||'').trim())return;
    if(!String(f.get('phone')||'').trim()&&!String(f.get('email')||'').trim()){
      status.textContent='Vul minimaal een telefoonnummer of e-mailadres in.';status.className='request-status err';return;
    }
    const requestId=crypto.randomUUID();
    const files=[...form.querySelector('input[name="photos"]')?.files||[]];
    if(files.length>3){status.textContent='Kies maximaal 3 foto\'s.';status.className='request-status err';return;}
    const photoPaths=files.map((_,i)=>`requests/${requestId}/foto-${i+1}.jpg`);
    const payload={
      id:requestId,
      name:String(f.get('name')||'').trim(),
      company:String(f.get('company')||'').trim()||null,
      phone:String(f.get('phone')||'').trim()||null,
      email:String(f.get('email')||'').trim()||null,
      request_type:String(f.get('request_type')||'').trim(),
      requested_date:String(f.get('requested_date')||'').trim()||null,
      start_time:String(f.get('start_time')||'').trim()||null,
      end_time:String(f.get('end_time')||'').trim()||null,
      location:String(f.get('location')||'').trim()||null,
      description:String(f.get('description')||'').trim(),
      preferred_contact:String(f.get('preferred_contact')||'').trim()||null,
      photo_paths:photoPaths,
      status:'new'
    };
    try{
      if(!client)throw new Error('Verbinding niet beschikbaar');
      submit.disabled=true;submit.textContent='Versturen...';status.textContent='';status.className='request-status';
      const {error}=await client.from('public_requests').insert(payload);
      if(error)throw error;
      for(let i=0;i<files.length;i++){
        const blob=await compressRequestPhoto(files[i]);
        const {error:uploadError}=await client.storage.from('jkworks-request-files').upload(photoPaths[i],blob,{contentType:'image/jpeg',upsert:false});
        if(uploadError)console.warn('Foto upload mislukt',uploadError);
      }
      form.reset();status.textContent='Aanvraag ontvangen. Ik neem zo snel mogelijk contact met je op.';status.className='request-status ok';
      submit.textContent='Verstuurd ✓';setTimeout(()=>{submit.disabled=false;submit.textContent='Aanvraag versturen';},1500);
    }catch(e){console.error(e);submit.disabled=false;submit.textContent='Aanvraag versturen';status.textContent='Versturen lukte niet. Probeer het nogmaals of neem contact op via WhatsApp.';status.className='request-status err';}
  }

  document.querySelector('#publicRequestForm')?.addEventListener('submit',e=>{e.preventDefault();submitPublicRequest(e.currentTarget);});
  loadPublishedWebsiteText();

  // Oude root-PWA opruimen. De bedrijfsapp heeft een eigen /app/-scope.
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(regs=>{const rootScope=location.origin+'/';regs.forEach(reg=>{if(reg.scope===rootScope)reg.unregister().catch(()=>{});});}).catch(()=>{});
  }
  if('caches' in window){
    caches.keys().then(keys=>keys.filter(k=>/^jkworks-v(59|60|61|62|63|64|65|66|67)/.test(k)).forEach(k=>caches.delete(k))).catch(()=>{});
  }
})();
