// Mobile zoom and logo behavior on a local fixture web server; never use production accounts.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async(browser,origin)=>{
  const root=path.resolve(__dirname,'..');
  const html=await fs.readFile(path.join(root,'app/index.html'),'utf8');
  const sw=await fs.readFile(path.join(root,'app/service-worker.js'),'utf8');
  assert.match(html,/maximum-scale=1,user-scalable=no/,'Mobile viewport must prohibit pinch zoom');
  assert.match(sw,/caches\.match\(e\.request\)[\s\S]*if\(cached\)return cached/,'Brand icon must be cache-first');
  for(const asset of ['apple-touch-icon.png','icon-192.png']){
    const bytes=await fs.readFile(path.join(root,'app/icons',asset));
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10],'PNG header: '+asset);
  }
  const mobile='Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
  const context=await browser.newContext({viewport:{width:390,height:844},userAgent:mobile,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  try{
    await context.addInitScript(()=>{
      Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
    });
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin)return route.fulfill({status:200,contentType:'application/javascript',body:''});
      if(url.pathname==='/app/app.js')return route.fulfill({status:200,contentType:'application/javascript',body:''});
      return route.continue();
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/app/',{waitUntil:'load'});
    const data=await page.evaluate(()=>{
      const icon=document.querySelector('.brand-title>img'),login=document.querySelector('.auth-logo');
      document.querySelector('#appShell').hidden=false;
      document.querySelector('#authGate').hidden=true;
      document.body.classList.remove('auth-locked');
      const eventTest=(type,touches)=>{
        const event=new Event(type,{bubbles:true,cancelable:true});
        if(touches)Object.defineProperty(event,'touches',{value:Array(touches).fill({})});
        document.dispatchEvent(event);
        return event.defaultPrevented;
      };
      return {
        naturalWidth:icon.naturalWidth,
        loginWidth:login.naturalWidth,
        source:new URL(icon.currentSrc).pathname,
        zoomEvents:[
          eventTest('gesturestart'),eventTest('gesturechange'),
          eventTest('dblclick'),eventTest('touchmove',2),eventTest('touchmove',1)
        ],
        touchAction:getComputedStyle(document.body).touchAction,
        horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+1
      };
    });
    assert.ok(data.naturalWidth>0 && data.loginWidth>0,'Both app logos must be fully decoded PNGs');
    assert.match(data.source,/\/app\/icons\/apple-touch-icon\.png$/);
    assert.deepEqual(data.zoomEvents,[true,true,true,true,false],
      'Pinch/double-tap blocked while single-finger scrolling allowed');
    assert.equal(data.touchAction,'pan-x pan-y','Normal page panning allowed without browser zoom');
    assert.equal(data.horizontalOverflow,false,'The logo must not widen iPhone viewport');
    await page.locator('.brand-title>img').evaluate(img=>{img.src='icons/nonexistent-test-logo.png';});
    await page.waitForFunction(()=>document.querySelector('.brand-title>img').naturalWidth>0
      && document.querySelector('.brand-title>img').src.endsWith('/icons/icon-192.png'));
    const fallback=await page.locator('.brand-title>img').evaluate(img=>img.naturalWidth);
    assert.ok(fallback>0,'Logo fallback must recover from a failed primary request');
    assert.deepEqual(errors,[],'No JavaScript runtime errors in mobile shell');
    console.log('PASS: iPhone pinch/double-tap disabled, scroll intact, lightweight logo loads and falls back on error');
  }finally{await context.close();}
};