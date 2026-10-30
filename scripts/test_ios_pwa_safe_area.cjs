// iOS 27: verifieer alleen de geïnstalleerde app boven de wazige systeemstatusbalk.
const assert=require('node:assert/strict');

module.exports=async(browser,origin)=>{
  const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
  const desktop='Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';
  async function inspect({ua,installed}){
    const mobile=ua===iphone;
    const context=await browser.newContext({viewport:{width:390,height:844},userAgent:ua,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
    try{
      await context.addInitScript(value=>{Object.defineProperty(navigator,'standalone',{configurable:true,value});},installed);
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin===origin&&url.pathname==='/app/app.js')return route.fulfill({status:200,contentType:'application/javascript',body:''});
        if(url.origin!==origin)return route.fulfill({status:200,contentType:'application/javascript',body:''});
        if(!['GET','HEAD'].includes(route.request().method()))return route.abort();
        return route.continue();
      });
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin+'/app/',{waitUntil:'load'});
      const result=await page.evaluate(()=>{
        document.querySelector('#appShell').hidden=false;
        document.querySelector('#authGate').hidden=true;
        document.body.classList.remove('auth-locked');
        document.querySelector('#view').innerHTML='<div style="height:2000px">Testinhoud</div>';
        const topbar=document.querySelector('#appShell > .topbar');
        const data=()=>({headerTop:topbar.getBoundingClientRect().top,brandTop:document.querySelector('.brand-title').getBoundingClientRect().top,padding:parseFloat(getComputedStyle(topbar).paddingTop),background:getComputedStyle(topbar).backgroundColor,blur:getComputedStyle(topbar).backdropFilter});
        const before=data();window.scrollTo(0,300);const scrolled=data();
        const backdrop=document.createElement('div');backdrop.className='modal-backdrop';backdrop.innerHTML='<section class="modal" style="height:1600px">Testvenster</section>';document.body.append(backdrop);
        const modal=backdrop.querySelector('.modal').getBoundingClientRect();
        backdrop.remove();
        const view=document.querySelector('#view');
        const nav=document.querySelector('.bottom-nav');
        const viewCss=getComputedStyle(view),navCss=getComputedStyle(nav);
        return {installedClass:document.documentElement.classList.contains('ios-standalone'),before,scrolled,modalTop:modal.top,modalHeight:modal.height,
          viewTop:parseFloat(viewCss.paddingTop),viewBottom:parseFloat(viewCss.paddingBottom),
          navBottom:parseFloat(navCss.bottom),navHeight:nav.getBoundingClientRect().height,
          viewportHeight:window.innerHeight};
      });
      assert.deepEqual(errors,[],'Geen JavaScript-fouten in de app-pagina');
      return result;
    }finally{await context.close();}
  }
  const pwa=await inspect({ua:iphone,installed:true});
  assert.equal(pwa.installedClass,true,'De geïnstalleerde iOS-app moet herkend worden');
  assert.ok(pwa.before.padding>=100,'Genoeg ruimte onder iOS 27 systeemblur');
  assert.ok(pwa.before.brandTop>=100,'Logo en knoppen buiten de iOS 27-blurzone');
  assert.equal(pwa.before.blur,'none','Geen extra vervaging achter iOS-bovenbalk');
  assert.ok(pwa.scrolled.brandTop>=100,'Ook bij scrollen blijven de knoppen onder de systeemblur');
  assert.ok(pwa.modalTop>=108,'Dialogen blijven onder de iOS-statuszone');
  assert.ok(Math.abs(pwa.viewTop-12)<0.1,'Compactere 12px afstand tussen header en inhoud in geïnstalleerde iPhone-app');
  assert.ok(pwa.viewBottom>=82,'Voldoende vrije ruimte onderaan om de vaste navigatie niet te bedekken');
  assert.ok(pwa.navHeight<=pwa.viewBottom,'Eind van scrollende inhoud blijft boven de onderste navigatie');
  assert.equal(pwa.navBottom,0,'Onderste navigatie blijft vast aan de veilige ondergrens');
  const safari=await inspect({ua:iphone,installed:false});
  assert.equal(safari.installedClass,false,'Gewone Safari-weergave niet aanpassen');
  assert.ok(safari.before.padding<100,'Safari behoudt bestaande hoogte');
  assert.ok(safari.viewTop>pwa.viewTop,'Normale Safari houdt oorspronkelijke bovenmarge');
  assert.ok(safari.viewBottom>pwa.viewBottom,'Normale Safari houdt oorspronkelijke scrollruimte');
  const mac=await inspect({ua:desktop,installed:true});
  assert.equal(mac.installedClass,false,'Desktop/Mac niet aanpassen');
  assert.ok(mac.before.padding<100,'Desktop behoudt bestaande header');
  assert.ok(mac.viewTop>pwa.viewTop,'Desktop houdt oorspronkelijke inhoudsmarge');
  console.log('PASS: iOS 27 blurzone beschermd (>=100px), compactere contentmarges, tabbar vrij, Safari/desktop ongewijzigd');
};
