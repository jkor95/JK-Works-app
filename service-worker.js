const CACHE='jkworks-v48-jaaroverzicht-facturen';
const LOCAL=[
  './','./index.html','./styles.css','./db.js','./cloud.js','./app.js','./manifest.webmanifest',
  './assets/jk-works-logo.jpg',
  './templates/factuur-kor.pdf','./templates/offerte-kor.pdf',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'
];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(LOCAL);self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);self.clients.claim()})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;
  e.respondWith((async()=>{
    try{
      const r=await fetch(e.request,{cache:'no-store'});
      const c=await caches.open(CACHE);c.put(e.request,r.clone()).catch(()=>{});
      return r;
    }catch(err){
      const cached=await caches.match(e.request);
      if(cached)return cached;
      if(e.request.mode==='navigate')return caches.match('./index.html');
      throw err;
    }
  })());
});
