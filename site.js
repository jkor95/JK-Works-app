(() => {
  const menu=document.querySelector('.menu-btn');
  const nav=document.querySelector('.site-nav');
  menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu?.setAttribute('aria-expanded','false');}));

  const SUPABASE_URL='https://ercqiavruotoclhvfzud.supabase.co';
  const SUPABASE_KEY='sb_publishable_z4kkYgzjr-bYDEcSZlVciw_cP8MfOuX';
  async function loadPublishedWebsiteText(){
    try{
      if(!window.supabase?.createClient)throw new Error('Supabase client niet geladen');
      const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      const {data:rows,error}=await client.from('app_records').select('data,updated_at').eq('store','websitePublic').eq('record_id','main').order('updated_at',{ascending:false}).limit(1);
      if(error)throw error;
      const content=rows?.[0]?.data;
      if(!content||typeof content!=='object')return;
      document.querySelectorAll('[data-site]').forEach(el=>{const key=el.dataset.site;if(Object.prototype.hasOwnProperty.call(content,key)&&String(content[key]).trim())el.textContent=content[key];});
    }catch(e){console.debug('Openbare website gebruikt ingebouwde standaardtekst.',e);}
  }
  loadPublishedWebsiteText();
  // Oude root-PWA van v59/v60 opruimen. De nieuwe bedrijfsapp heeft een eigen /app/-scope.
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(regs=>{
      const rootScope=location.origin+'/';
      regs.forEach(reg=>{if(reg.scope===rootScope)reg.unregister().catch(()=>{});});
    }).catch(()=>{});
  }
  if('caches' in window){
    caches.keys().then(keys=>keys.filter(k=>k==='jkworks-v59-jkworks-nl'||k==='jkworks-v60-btw-templates').forEach(k=>caches.delete(k))).catch(()=>{});
  }
})();
