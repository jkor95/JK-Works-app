// Contextual media zoom: no live accounts, no real documents, only in-memory fixtures.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
module.exports=async(browser,origin)=>{
 const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'app/app.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
 const worker=fs.readFileSync(path.join(root,'app/service-worker.js'),'utf8');
 assert.match(html,/media-viewer\.js\?v=71\.13\.40/,'The viewer must load in the app');
 assert.match(worker,/\.\/media-viewer\.js/,'Viewer must be cached for PWA');
 for(const id of ['zoomJobPhoto','zoomExpensePreview','zoomExpensePdf','zoomDocumentPdf']){
  assert.ok(source.includes(id),'Missing zoom entry point: '+id);
 }
 assert.match(source,/showMediaZoom\(d\.blob,d\.filename,'pdf'\)/,'PDF invoices and quotations open via dedicated viewer');
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.fulfill({status:200,contentType:'application/javascript',body:''});
   if(url.pathname==='/app/app.js')return route.fulfill({status:200,contentType:'application/javascript',body:''});
   return route.continue();
  });
  await page.goto(origin+'/app/',{waitUntil:'load'});
  const imageResult=await page.evaluate(async()=>{
   const image=new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/P9sAAAAASUVORK5CYII='),x=>x.charCodeAt(0))],{type:'image/png'});
   const viewer=JKMediaViewer.open({blob:image,title:'Fictieve klusfoto'});
   const root=viewer.overlay,stage=root.querySelector('.jk-media-stage');
   const zoomStart=parseInt(root.querySelector('[data-zoom-reset]').textContent);
   root.querySelector('[data-zoom-in]').click();
   const zoomed=parseInt(root.querySelector('[data-zoom-reset]').textContent);
   const event=(type,points)=>{
    const e=new Event(type,{bubbles:true,cancelable:true});
    Object.defineProperty(e,'touches',{value:points.map(([clientX,clientY])=>({clientX,clientY}))});
    stage.dispatchEvent(e);
    return e.defaultPrevented;
   };
   event('touchstart',[[120,250],[220,250]]);
   const pinchPrevented=event('touchmove',[[80,250],[260,250]]);
   event('touchend',[]);
   const pinch=parseInt(root.querySelector('[data-zoom-reset]').textContent);
   root.querySelector('[data-zoom-reset]').click();
   const reset=parseInt(root.querySelector('[data-zoom-reset]').textContent);
   const tap=()=>{event('touchstart',[[150,200]]);event('touchend',[]);};
   tap();tap();
   const doubleTap=parseInt(root.querySelector('[data-zoom-reset]').textContent);
   stage.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,clientX:150,clientY:200}));
   const doubleClick=parseInt(root.querySelector('[data-zoom-reset]').textContent);
   const hint=root.querySelector('.jk-media-hint').textContent;
   const documentViewport=document.querySelector('meta[name=viewport]').content;
   root.querySelector('[data-zoom-close]').click();
   return {zoomStart,zoomed,pinchPrevented,pinch,reset,doubleTap,doubleClick,hint,closed:!document.querySelector('.jk-media-overlay'),
     viewport:documentViewport};
  });
  assert.equal(imageResult.zoomStart,100);
  assert.ok(imageResult.zoomed>100,'Zoom buttons increase only media scale');
  assert.ok(imageResult.pinch>imageResult.zoomed,'Two fingers increase image scale');
  assert.equal(imageResult.pinchPrevented,true,'Native page zoom is blocked');
  assert.equal(imageResult.reset,100);
  assert.equal(imageResult.doubleTap,100,'Double tap does not zoom image');
  assert.equal(imageResult.doubleClick,100,'Double-click does not zoom image');
  assert.doesNotMatch(imageResult.hint,/dubbel/i,'Viewer explanation no longer mentions double tapping');
  assert.ok(imageResult.closed,'Viewer closes cleanly');
  assert.match(imageResult.viewport,/user-scalable=no/,'Rest of app retains fixed zoom');
  const pdfResult=await page.evaluate(async()=>{
    const pdf=new Blob(['%PDF-1.4 fixture'],{type:'application/pdf'});
    let pages=0;
    const fake={getDocument:()=>({promise:Promise.resolve({
      numPages:2,
      getPage:async()=>({
        getViewport:({scale})=>({width:200*scale,height:280*scale}),
        render:()=>({promise:Promise.resolve(++pages)})
      }),
      destroy:async()=>{}
    })})};
    const ui=JKMediaViewer.open({blob:pdf,title:'Fictieve offerte',kind:'pdf',getPdfJs:async()=>fake});
    await new Promise(resolve=>setTimeout(resolve,50));
    const count=ui.overlay.querySelectorAll('canvas.jk-media-pdf-page').length;
    ui.overlay.querySelector('[data-zoom-in]').click();
    const zoomed=parseInt(ui.overlay.querySelector('[data-zoom-reset]').textContent);
    ui.close();
    return {count,pages,zoomed};
  });
  assert.equal(pdfResult.count,2,'All PDF pages appear as zoomable canvases');
  assert.equal(pdfResult.pages,2,'Each PDF page rendered');
  assert.ok(pdfResult.zoomed>100,'PDF supports zoom');
  assert.deepEqual(errors,[],'No browser errors');
  console.log('PASS: app stays fixed; photo, receipt and PDF viewer support pinch and buttons but no double tap; PDF pages and close work');
 }finally{await context.close();}
};