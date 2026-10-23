/* JK Works - monochrome 4x6 inch job ticket as 1200x1800 PNG, no PDF or cloud. */
window.JKJobLabel=(()=>{
  'use strict';
  const WIDTH=1200,HEIGHT=1800,SCALE=2,PAGE_W=600,PAGE_H=900;
  const clean=x=>String(x==null?'':x).replace(/\r/g,'').trim();
  const lines=x=>clean(x).split('\n').map(x=>x.trim()).filter(Boolean);
  const scalar=x=>Math.max(0,Number(x)||0);
  function blockRows(data){
    const row=(name,value)=>clean(value)?{name,value:clean(value)}:null;
    const keep=rows=>rows.filter(Boolean);
    const sections=[
      {heading:'',rows:keep([row('Klusnummer:',data.number),row('Status:',data.status),row('Klus:',data.title)])},
      {heading:'Klant',rows:keep([row('Bedrijf / naam:',data.client),row('Contact:',data.contact),row('Telefoon:',data.phone)])},
      {heading:'Adressen',rows:keep([row('Klantadres:',data.clientAddress),row('Uitvoering:',data.executionAddress)])},
      {heading:'Planning & uitvoering',rows:keep([row('Datum / tijd:',data.planning),row('Werkdagen:',data.workDays),row('Gewerkte uren:',data.workedHours),row('Nog gepland:',data.plannedHours)])},
      {heading:'Financieel',rows:keep([row('Prijsafspraak:',data.priceType),row(data.amountLabel||'Bedrag:',data.amount),row('Afhandeling:',data.payment)])}
    ];
    const notes=lines(data.notes);
    if(notes.length)sections.push({heading:'Notities',notes});
    return sections.filter(s=>s.rows?.length||s.items?.length||s.notes?.length);
  }
  function font(ctx,size,bold=false){ctx.font=(bold?'700 ':'400 ')+size+'px Arial, Helvetica, sans-serif';}
  function wrap(ctx,text,width){
    const result=[];
    for(const part of clean(text).split('\n')){
      if(!part.trim())continue;
      let current='';
      for(const word of part.split(/\s+/)){
        if(!word)continue;
        const next=current?current+' '+word:word;
        if(ctx.measureText(next).width<=width){current=next;continue;}
        if(current){result.push(current);current='';}
        let rest=word;
        while(rest&&ctx.measureText(rest).width>width){
          let at=rest.length;
          while(at>1&&ctx.measureText(rest.slice(0,at)).width>width)at--;
          result.push(rest.slice(0,at));rest=rest.slice(at);
        }
        current=rest;
      }
      if(current)result.push(current);
    }
    return result.length?result:[''];
  }
  function drawRound(ctx,x,y,w,h,r){
    const rad=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+rad,y);ctx.lineTo(x+w-rad,y);ctx.quadraticCurveTo(x+w,y,x+w,y+rad);
    ctx.lineTo(x+w,y+h-rad);ctx.quadraticCurveTo(x+w,y+h,x+w-rad,y+h);
    ctx.lineTo(x+rad,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-rad);
    ctx.lineTo(x,y+rad);ctx.quadraticCurveTo(x,y,x+rad,y);ctx.closePath();
    ctx.stroke();
  }
  function sectionsLayout(ctx,sections,sz){
    const body=sz,lineHeight=Math.ceil(body*1.25),labelW=188,contentW=PAGE_W-50-labelW;
    const rows=[];
    for(const sec of sections){
      const prepared={...sec,entries:[],height:10};
      if(sec.heading)prepared.height+=body+13;
      if(sec.rows)for(const row of sec.rows){
        font(ctx,body,false);const text=wrap(ctx,row.value,contentW-10);
        const h=Math.max(lineHeight,text.length*lineHeight)+6;
        prepared.entries.push({kind:'row',name:row.name,text,h});
        prepared.height+=h;
      }
      if(sec.notes)for(const note of sec.notes){
        font(ctx,body,false);const t=wrap(ctx,note,PAGE_W-92);
        const h=t.length*lineHeight+4;
        prepared.entries.push({kind:'note',text:t,h});
        prepared.height+=h;
      }
      prepared.height+=7;
      rows.push(prepared);
    }
    return {blocks:rows,contentHeight:rows.reduce((n,s)=>n+s.height+10,0),body,lineHeight,labelW,contentW};
  }
  function render(data){
    const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw Error('Afbeelding maken wordt niet ondersteund door deze browser.');
    ctx.scale(SCALE,SCALE);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,PAGE_W,PAGE_H);
    const sections=blockRows(data);
    let layout=null;
    for(let size=19;size>=13;size--){
      const candidate=sectionsLayout(ctx,sections,size);
      if(candidate.contentHeight+114<=PAGE_H-18){layout=candidate;break;}
    }
    if(!layout)throw Error('Te veel tekst voor één 4×6-sticker. Kort de notities of de planning in en maak opnieuw een voorbeeld.');
    ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.textBaseline='top';
    font(ctx,49,true);
    let h='JK WORKS';ctx.fillText(h,(PAGE_W-ctx.measureText(h).width)/2,13);
    font(ctx,29,true);h='KLUSOPDRACHT';ctx.fillText(h,(PAGE_W-ctx.measureText(h).width)/2,72);
    let y=119;
    for(const section of layout.blocks){
      const x=24,w=PAGE_W-48;
      ctx.lineWidth=1.75;drawRound(ctx,x,y,w,section.height,9);
      let cursor=y+8;
      if(section.heading){
        font(ctx,layout.body+2,true);ctx.fillText(section.heading,x+10,cursor);
        cursor+=layout.body+11;
        ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(x,cursor);ctx.lineTo(x+w,cursor);ctx.stroke();
        cursor+=6;
      }
      for(const entry of section.entries){
        if(entry.kind==='row'){
          font(ctx,layout.body,true);ctx.fillText(entry.name,x+10,cursor);
          font(ctx,layout.body,false);
          entry.text.forEach((line,i)=>ctx.fillText(line,x+layout.labelW,cursor+i*layout.lineHeight));
        }else if(entry.kind==='note'){
          font(ctx,layout.body,false);ctx.fillText('-',x+12,cursor);
          entry.text.forEach((line,i)=>ctx.fillText(line,x+31,cursor+i*layout.lineHeight));
        }
        cursor+=entry.h;
      }
      y+=section.height+10;
    }
    return canvas;
  }
  async function png(data){
    const canvas=render(data);
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('De afbeelding kon niet worden opgeslagen.')),'image/png'));
  }
  return {render,png,width:WIDTH,height:HEIGHT};
})();