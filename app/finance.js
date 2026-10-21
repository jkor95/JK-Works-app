/* One payment record in the existing synced settings store, shared by job and invoice.
   Legacy paid flags are read as undated receipts; never infer a payment date. */
const JKFinance = (() => {
  const number=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const cents=v=>Math.round(number(v)*100);
  const euro=v=>v/100;
  const type=j=>['fixed','manual'].includes(j?.pricingType)?j.pricingType:'hourly';
  const invoice=d=>String(d?.folder||d?.kind||'').toLowerCase().includes('fact');
  const jobId=d=>String(d?.meta?.jobId!==undefined?d.meta.jobId:(d?.jobId||''));
  const unique=rows=>[...new Map((rows||[]).map(r=>[r.id,r])).values()];
  function price(j,minutes,rate){
    const hoursValue=cents(minutes/60*number(rate)),extra=cents(j?.extraAmount),pricing=type(j);
    const pending=pricing==='manual'&&(j.agreedAmount==null||j.agreedAmount==='');
    const base=pricing==='hourly'?hoursValue:pending?null:cents(j.agreedAmount);
    const added=j?.extraIncluded&&pricing!=='hourly'?0:extra;
    return {type:pricing,hoursValue:euro(hoursValue),extra:euro(extra),base:base===null?null:euro(base),agreed:base===null?null:euro(base+added),pending};
  }
  function snapshot(jobs,documents,settings,priceForJob){
    const js=unique(jobs),docs=unique(documents).filter(invoice),stored=unique(settings).filter(r=>r.kind==='jkPayment');
    const byId=new Map(stored.map(p=>[p.id,p]));
    // Paid invoices take precedence over the historical job flag: never add both.
    for(const d of docs)if(d.meta?.paid&&!d.meta?.paymentLedger){
      const id='payment:legacy:invoice:'+d.id;
      if(!byId.has(id))byId.set(id,{id,kind:'jkPayment',invoiceId:d.id,amount:d.meta.total==null||d.meta.total===''?null:number(d.meta.total),unknownAmount:d.meta.total==null||d.meta.total==='',date:'',method:'unknown',legacy:true});
    }
    for(const j of js)if(j.paymentPaid&&!j.paymentLedger&&!docs.some(d=>jobId(d)===j.id&&(d.meta?.paid||d.meta?.paymentLedger))){
      const id='payment:legacy:job:'+j.id;
      if(!byId.has(id))byId.set(id,{id,kind:'jkPayment',jobId:j.id,amount:priceForJob(j).agreed??0,unknownAmount:!priceForJob(j).agreed,date:'',method:'unknown',legacy:true});
    }
    const receipts=[...byId.values()].filter(p=>!p.voided&&(cents(p.amount)>0||p.unknownAmount)).map(p=>({...p,amount:euro(cents(p.amount)),resolvedJobId:p.invoiceId&&docs.some(d=>d.id===p.invoiceId)?jobId(docs.find(d=>d.id===p.invoiceId)):String(p.jobId||'')}));
    const invoiceReceived=new Map(docs.map(d=>[d.id,receipts.filter(p=>p.invoiceId===d.id).reduce((s,p)=>s+cents(p.amount),0)]));
    // Unallocated job receipts are applied once, oldest invoice first. Explicit allocations stay fixed.
    for(const j of js){
      let pool=receipts.filter(p=>(!p.invoiceId||!docs.some(d=>d.id===p.invoiceId))&&p.resolvedJobId===j.id).reduce((s,p)=>s+cents(p.amount),0);
      for(const d of docs.filter(d=>jobId(d)===j.id).sort((a,b)=>String(a.meta?.docDate||a.createdAt||'').localeCompare(String(b.meta?.docDate||b.createdAt||''))||a.id.localeCompare(b.id))){
        const allocated=Math.min(pool,Math.max(0,cents(d.meta?.total)-(invoiceReceived.get(d.id)||0)));
        invoiceReceived.set(d.id,(invoiceReceived.get(d.id)||0)+allocated);pool-=allocated;
      }
    }
    const document=d=>{const received=euro(invoiceReceived.get(d.id)||0),total=euro(cents(d.meta?.total));return {total,received,open:euro(Math.max(0,cents(total)-cents(received))),paid:(total>0&&cents(received)>=cents(total))||(d.meta?.total==null&&receipts.some(p=>p.invoiceId===d.id&&p.unknownAmount))};};
    const job=j=>{const p=priceForJob(j),linked=docs.filter(d=>jobId(d)===j.id),invoiced=euro(linked.reduce((s,d)=>s+cents(d.meta?.total),0)),received=euro(receipts.filter(r=>r.resolvedJobId===j.id).reduce((s,r)=>s+cents(r.amount),0));return {...p,invoiced,received,open:euro(Math.max(0,Math.max(cents(p.agreed),cents(invoiced))-cents(received))),paid:!p.pending&&Math.max(cents(p.agreed),cents(invoiced))>0&&cents(received)>=Math.max(cents(p.agreed),cents(invoiced))};};
    return {jobs:js,documents:docs,stored,receipts,job,document};
  }
  return {number,cents,euro,type,invoice,jobId,price,snapshot};
})();
if(typeof module!=='undefined')module.exports=JKFinance;
