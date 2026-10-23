/* JK Works: 4x6 inch black/white list of outstanding payments, generated locally. */
window.JKOpenPaymentsLabel=(()=>{
 'use strict';
 const WIDTH=1200,HEIGHT=1800,SCALE=2,W=600,H=900;
 const clean=x=>String(x??'').trim();
 const euroCents=x=>{
   let s=clean(x).replace(/[\s\u00a0\u202f€]/g,'');
   if(!s||!/^\d[\d.,]*$/.test(s))return null;
   if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
   else if(s.includes(','))s=s.replace(',','.');
   else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
   const val=Number(s);
   return Number.isFinite(val)&&val>=0&&val<=99999999?Math.round(val*100):null;
 };
 const money=cents=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
 function font(ctx,size,bold){ctx.font=(bold?'700 ':'400 ')+size+'px Arial,Helvetica,sans-serif';}
 function wrap(ctx,value,maxWidth,size,bold=false){
   font(ctx,size,bold);
   const result=[];
   for(const paragraph of clean(value).split(/\n/)){
     if(!paragraph.trim())continue;
     let line='';
     for(const word of paragraph.trim().split(/\s+/)){
       const combined=line?line+' '+word:word;
       if(ctx.measureText(combined).width<=maxWidth){line=combined;continue;}
       if(line){result.push(line);line='';}
       let rest=word;
       while(rest&&ctx.measureText(rest).width>maxWidth){
         let take=rest.length;
         while(take>1&&ctx.measureText(rest.slice(0,take)).width>maxWidth)take--;
         result.push(rest.slice(0,take));rest=rest.slice(take);
       }
       line=rest;
     }
     if(line)result.push(line);
   }
   return result;
 }
 function selectedRows(data){
   const rows=(data.items||[]).filter(x=>x&&x.include!==false);
   if(!rows.length)throw Error('Selecteer minimaal één openstaande betaling voor de werkbon.');
   return rows.map((x,i)=>{
     const cents=euroCents(x.amount);
     if(cents===null)throw Error('Ongeldig openstaand bedrag bij regel '+(i+1)+'.');
     const client=clean(x.client)||'Onbekende klant';
     return {id:x.id||String(i),client,job:clean(x.job)||'Openstaande betaling',
       date:clean(x.date),times:clean(x.times),amount:cents};
   });
 }
 function itemLayout(ctx,row){
   const textW=W-72;
   const client=wrap(ctx,row.client,textW,21,true),title=wrap(ctx,row.job,textW,18,false);
   const schedule=wrap(ctx,[row.date,row.times].filter(Boolean).join(' · '),textW,16,false);
   const height=15+client.length*24+title.length*21+schedule.length*19+36+10;
   return {row,client,title,schedule,height};
 }
 function canvasPage(){
   const c=document.createElement('canvas');c.width=WIDTH;c.height=HEIGHT;
   const ctx=c.getContext('2d',{alpha:false});
   if(!ctx)throw Error('De browser ondersteunt geen afbeeldingslabels.');
   ctx.scale(SCALE,SCALE);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
   ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.textBaseline='top';
   return {canvas:c,ctx};
 }
 function pages(data){
   const rows=selectedRows(data),scratch=canvasPage().ctx;
   const layouts=rows.map(r=>itemLayout(scratch,r));
   const groups=[],maxY=H-97; // reserve space for grand total on the final page
   let group=[],used=0;
   for(const item of layouts){
     if(item.height>maxY-127)throw Error('Eén regel is te lang. Kort de klantnaam, klus of tijden in.');
     if(group.length&&used+item.height+9>maxY-127){groups.push(group);group=[];used=0;}
     group.push(item);used+=item.height+9;
   }
   if(group.length)groups.push(group);
   const total=rows.reduce((n,r)=>n+r.amount,0),title=clean(data.title)||'OPENSTAANDE BETALINGEN';
   return groups.map((group,i)=>{
     const {canvas,ctx}=canvasPage();
     let y=23;
     const heading=wrap(ctx,title,W-60,30,true);
     if(heading.length>3)throw Error('De bon-titel is te lang. Maak deze korter.');
     for(const h of heading){font(ctx,30,true);ctx.fillText(h,30,y);y+=35;}
     font(ctx,14,false);ctx.fillText('JK WORKS DORDRECHT',30,y+1);y+=31;
     ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(30,y);ctx.lineTo(W-30,y);ctx.stroke();y+=10;
     font(ctx,14,false);ctx.fillText('PAGINA '+(i+1)+' / '+groups.length,30,y);y+=25;
     for(const item of group){
       const x=30;
       for(const t of item.client){font(ctx,21,true);ctx.fillText(t,x,y);y+=24;}
       for(const t of item.title){font(ctx,18,false);ctx.fillText(t,x,y);y+=21;}
       for(const t of item.schedule){font(ctx,16,false);ctx.fillText(t,x,y);y+=19;}
       y+=5;
       font(ctx,14,false);ctx.fillText('Nog te ontvangen',x,y+5);
       font(ctx,23,true);const price=money(item.row.amount);
       ctx.fillText(price,W-30-ctx.measureText(price).width,y);y+=35;
       ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(W-x,y);ctx.stroke();y+=15;
     }
     if(i===groups.length-1){
       // Last page only, for the complete selection (not a per-page subtotal).
       y+=12;
       font(ctx,17,true);ctx.fillText('TOTAAL OPENSTAAND',30,y);
       font(ctx,28,true);const sum=money(total);
       ctx.fillText(sum,W-30-ctx.measureText(sum).width,y+28);y+=73;
     }
     if(y>H-12)throw Error('Werkbon overschrijdt het etiket; verkort enkele teksten.');
     return canvas;
   });
 }
 return {pages,selectedRows,euroCents,money,width:WIDTH,height:HEIGHT};
})();