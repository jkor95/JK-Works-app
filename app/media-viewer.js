/* JK Works: zoom only in dedicated photo, receipt, quote and invoice viewer.
   Does not change the fixed zoom behavior of the rest of the app. */
(function(){
  let current=null;
  const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
  function open({blob,src,title='Document',kind='image',getPdfJs}={}){
    close();
    if(!(blob instanceof Blob)&&!src)throw new Error('Geen afbeelding of document beschikbaar.');
    const overlay=document.createElement('div');
    overlay.className='jk-media-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label',title);
    overlay.innerHTML='<div class="jk-media-bar"><strong class="jk-media-title"></strong><div class="jk-media-tools"><button type="button" data-zoom-out aria-label="Uitzoomen">−</button><button type="button" data-zoom-reset aria-label="Op normale grootte">100%</button><button type="button" data-zoom-in aria-label="Inzoomen">+</button><button type="button" data-zoom-close aria-label="Sluiten">×</button></div></div><div class="jk-media-stage"><div class="jk-media-surface"><div class="jk-media-content"></div></div></div><div class="jk-media-hint">Knijp met twee vingers om te vergroten. Sleep om te verschuiven.</div>';
    overlay.querySelector('.jk-media-title').textContent=title;
    const stage=overlay.querySelector('.jk-media-stage'),surface=overlay.querySelector('.jk-media-surface');
    const content=overlay.querySelector('.jk-media-content');
    const state={overlay,scale:1,x:0,y:0,objectUrl:null,closed:false,touch:null};
    current=state;
    document.body.appendChild(overlay);
    const previous=document.activeElement,oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const getPoint=touches=>({x:(touches[0].clientX+(touches[1]?.clientX??touches[0].clientX))/2,
      y:(touches[0].clientY+(touches[1]?.clientY??touches[0].clientY))/2});
    const distance=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
    function draw(){
      const rect=stage.getBoundingClientRect();
      const maxX=Math.max(0,(rect.width*(state.scale-1))/2);
      const maxY=Math.max(0,(rect.height*(state.scale-1))/2);
      state.x=clamp(state.x,-maxX,maxX);state.y=clamp(state.y,-maxY,maxY);
      stage.classList.toggle('zoomed',state.scale>1);
      surface.style.transform='translate('+state.x+'px,'+state.y+'px) scale('+state.scale+')';
      overlay.querySelector('[data-zoom-reset]').textContent=Math.round(state.scale*100)+'%';
    }
    const zoomTo=(value,point)=>{
      const next=clamp(value,1,5),previous=state.scale;
      if(point&&next!==previous){
        const box=stage.getBoundingClientRect(),cx=box.left+box.width/2,cy=box.top+box.height/2;
        const ratio=next/previous;
        state.x=point.x-cx-(point.x-cx-state.x)*ratio;
        state.y=point.y-cy-(point.y-cy-state.y)*ratio;
      }
      state.scale=next;if(next===1){state.x=0;state.y=0;}draw();
    };
    const touchStart=e=>{
      if(e.touches.length===2){
        state.touch={kind:'pinch',distance:distance(e.touches),scale:state.scale,point:getPoint(e.touches),x:state.x,y:state.y};
      }else if(e.touches.length===1){
        state.touch={kind:'pan',point:getPoint(e.touches),x:state.x,y:state.y};
      }
    };
    const touchMove=e=>{
      if(e.touches.length>1 || state.scale>1)e.preventDefault();
      const gesture=state.touch;if(!gesture)return;
      if(e.touches.length===2&&gesture.kind==='pinch'){
        const next=clamp(gesture.scale*distance(e.touches)/Math.max(1,gesture.distance),1,5);
        const point=getPoint(e.touches),box=stage.getBoundingClientRect(),cx=box.left+box.width/2,cy=box.top+box.height/2;
        const ratio=next/gesture.scale;
        state.scale=next;
        state.x=point.x-cx-(gesture.point.x-cx-gesture.x)*ratio;
        state.y=point.y-cy-(gesture.point.y-cy-gesture.y)*ratio;
        if(next===1){state.x=0;state.y=0;}draw();
      }else if(e.touches.length===1&&gesture.kind==='pan'&&state.scale>1){
        const point=getPoint(e.touches);
        state.x=gesture.x+point.x-gesture.point.x;
        state.y=gesture.y+point.y-gesture.point.y;
        draw();
      }
    };
    const touchEnd=e=>{
      if(e.touches.length===0)state.touch=null;
      else if(e.touches.length===1)
        state.touch={kind:'pan',point:getPoint(e.touches),x:state.x,y:state.y};
    };
    stage.addEventListener('touchstart',touchStart,{passive:true});
    stage.addEventListener('touchmove',touchMove,{passive:false});
    stage.addEventListener('touchend',touchEnd,{passive:true});
    overlay.querySelector('[data-zoom-in]').addEventListener('click',()=>zoomTo(state.scale*1.5));
    overlay.querySelector('[data-zoom-out]').addEventListener('click',()=>zoomTo(state.scale/1.5));
    overlay.querySelector('[data-zoom-reset]').addEventListener('click',()=>zoomTo(1));
    const onKey=e=>{if(e.key==='Escape')close();};
    document.addEventListener('keydown',onKey);
    function dispose(){
      if(state.closed)return;state.closed=true;document.removeEventListener('keydown',onKey);
      overlay.remove();document.body.style.overflow=oldOverflow;
      if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
      if(previous?.isConnected&&typeof previous.focus==='function')previous.focus();
    }
    state.dispose=dispose;
    overlay.querySelector('[data-zoom-close]').addEventListener('click',close);
    overlay.querySelector('[data-zoom-close]').focus();
    if(kind==='pdf'){
      content.classList.add('jk-media-pdf');
      content.textContent='PDF laden...';
      Promise.resolve().then(async()=>{
        if(typeof getPdfJs!=='function')throw new Error('PDF-voorbeeld niet beschikbaar');
        const pdfjs=await getPdfJs();if(state.closed)return;
        const bytes=new Uint8Array(await blob.arrayBuffer());
        const pdf=await pdfjs.getDocument({data:bytes}).promise;
        if(state.closed){await pdf.destroy();return;}
        content.textContent='';
        const count=Math.min(pdf.numPages,12);
        for(let i=1;i<=count&&!state.closed;i++){
          const page=await pdf.getPage(i),view=page.getViewport({scale:2});
          const canvas=document.createElement('canvas');
          canvas.className='jk-media-pdf-page';
          canvas.width=Math.round(view.width);canvas.height=Math.round(view.height);
          content.appendChild(canvas);
          await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
        }
        if(count<pdf.numPages&&!state.closed){
          const note=document.createElement('p');note.textContent='Alleen de eerste 12 pagina’s worden hier getoond. Bekijk het originele PDF-bestand voor alle pagina’s.';content.appendChild(note);
        }
        await pdf.destroy();
      }).catch(error=>{if(!state.closed){content.textContent='PDF-vergroting niet beschikbaar: '+(error.message||error)+'. Gebruik de gewone PDF-weergave om het bestand te bekijken.';}});
    }else{
      const image=document.createElement('img');image.alt=title;image.draggable=false;
      image.addEventListener('error',()=>{if(!state.closed)content.textContent='De afbeelding kon niet worden geladen.';});
      content.appendChild(image);
      if(blob){state.objectUrl=URL.createObjectURL(blob);image.src=state.objectUrl;}else image.src=src;
    }
    return {close,zoomTo,overlay};
  }
  function close(){if(current){const c=current;current=null;c.dispose?.();}}
  window.JKMediaViewer={open,close};
})();
