(() => {
  const menu=document.querySelector('.menu-btn');
  const nav=document.querySelector('.site-nav');
  menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu?.setAttribute('aria-expanded','false');}));
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
