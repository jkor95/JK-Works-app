// Functionele, geisoleerde regressies van betaalstatus aan twee kanten en expliciete documentkoppelingen.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
module.exports=async function testInvoicePayment(){
  const source=fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8');
  const start=source.indexOf('  function linkedInvoiceJobId(');
  const end=source.indexOf('  function docStatusHtml(',start);
  assert.ok(start>=0&&end>start,'Betaalfuncties ontbreken');
  const jobs=[
    {id:'jobA',paymentType:'invoice',paymentPaid:false,title:'Klus A'},
    {id:'jobB',paymentType:'invoice',paymentPaid:false,title:'Klus B'},
    {id:'cash',paymentType:'cash',paymentPaid:false,title:'Contant'}
  ];
  const docs=[
    {id:'invoice1',folder:'factuur',meta:{jobId:'jobA',paid:true,sent:true,total:50}},
    {id:'invoice2',folder:'factuur',meta:{jobId:'jobA',paid:false,sent:true,total:100}},
    {id:'invoice3',folder:'factuur',meta:{jobId:'jobB',paid:false,sent:false,total:150}},
    {id:'imported',folder:'factuur',meta:{paid:true,manualImport:true}},
    {id:'quote',folder:'offerte',meta:{jobId:'jobA',paid:true}},
    {id:'legacy',folder:'factuur',jobId:'cash',meta:{paid:false}}
  ];
  const written=[];
  const JKDB={
    async get(store,id){return (store==='jobs'?jobs:docs).find(x=>x.id===id);},
    async all(store){return (store==='jobs'?jobs:docs).map(x=>({...x,meta:x.meta?{...x.meta}:undefined}));},
    async put(store,record){const list=store==='jobs'?jobs:docs;const idx=list.findIndex(x=>x.id===record.id);
      assert.ok(idx>=0);list[idx]={...record,meta:record.meta?{...record.meta}:undefined};written.push({store,id:record.id});
    }
  };
  const sandbox={JKDB,docFolder:d=>d.folder,Error};
  const functions=source.slice(start,end);
  vm.runInNewContext(functions+'\nglobalThis.test={linkedInvoiceJobId,linkedInvoicesForJob,invoicePaymentForJob,syncJobPaymentForInvoice,syncInvoicesFromJob,setInvoiceJobLink}',sandbox);
  const {linkedInvoiceJobId,invoicePaymentForJob,syncJobPaymentForInvoice,syncInvoicesFromJob,setInvoiceJobLink}=sandbox.test;
  assert.equal(linkedInvoiceJobId(docs[3]),'','Geimporteerde PDF moet eerst gekoppeld worden');
  assert.equal(linkedInvoiceJobId(docs[5]),'cash','Oude expliciete jobId werkt');
  assert.equal(invoicePaymentForJob(jobs[0],docs),false,'Een onbetaalde deelfactuur houdt de klus open');
  assert.equal(await syncJobPaymentForInvoice('jobA'),false,'Klus is al onbetaald');
  docs[1].meta.paid=true;
  assert.equal(await syncJobPaymentForInvoice('jobA'),true,'Factuur betaald: klus betaald');
  assert.equal(jobs[0].paymentPaid,true);
  docs[0].meta.paid=false;
  assert.equal(await syncJobPaymentForInvoice('jobA'),true,'Factuur terug naar onbetaald: klus onbetaald');
  assert.equal(jobs[0].paymentPaid,false);
  assert.equal(await syncInvoicesFromJob('jobA',true),1,'Klus betaald: alleen niet-betaalde factuur aanpassen');
  assert.equal(docs[0].meta.paid,true);
  assert.equal(docs[1].meta.paid,true);
  assert.equal(docs[0].meta.sent,true,'Verstuurd-vinkje onveranderd');
  assert.equal(docs[0].meta.total,50,'Bedrag blijft gelijk');
  assert.equal(await syncInvoicesFromJob('jobA',false),2,'Klus onbetaald: beide facturen onbetaald');
  assert.equal(docs[0].meta.paid,false);
  assert.equal(docs[1].meta.paid,false);
  assert.equal(docs[2].meta.paid,false,'Andere klus ongewijzigd');
  assert.equal(await syncInvoicesFromJob('cash',true),1,'Ook een expliciet aan cash-klus gekoppelde factuur wordt gevolgd');
  assert.equal(docs[5].meta.paid,true);
  assert.equal(await syncJobPaymentForInvoice('cash'),true);
  assert.equal(jobs[2].paymentPaid,true);
  assert.equal(await setInvoiceJobLink(docs[3],'jobB'),true,'Losse PDF bewust koppelen');
  assert.equal(docs[3].meta.jobId,'jobB');
  assert.equal(jobs[1].paymentPaid,false,'JobB is niet betaald zolang een andere factuur nog openstaat');
  docs[2].meta.paid=true;
  assert.equal(await syncJobPaymentForInvoice('jobB'),true);
  assert.equal(jobs[1].paymentPaid,true);
  assert.equal(await setInvoiceJobLink(docs[3],''),true,'Factuur kan worden ontkoppeld');
  assert.equal(docs[3].meta.jobId,'');
  assert.equal(await syncJobPaymentForInvoice('jobB'),false,'Andere betaalde factuur blijft betaald');
  await assert.rejects(()=>setInvoiceJobLink(docs[3],'unknown'),/bestaat niet meer/);
  assert.equal(await syncInvoicesFromJob('missing',true),0,'Onbekende klus: geen facturen');
  assert.equal(await syncJobPaymentForInvoice(''),false,'Geen klus-ID: geen statuswijziging');
  assert.equal(await setInvoiceJobLink(docs[3],'jobB'),true);
  assert.equal(await setInvoiceJobLink(docs[3],'jobB'),false,'Idempotent');
  assert.equal(docs.find(x=>x.id==='quote').meta.paid,true,'Offertes onveranderd');
  assert.match(source,/paymentWasReceived!==j\.paymentPaid\)await syncInvoicesFromJob\(j\.id,j\.paymentPaid\)/,'Klusformulier moet facturen echt aanpassen');
  assert.match(source,/syncJobPaymentForInvoice\(linkedInvoiceJobId\(d\)\)/,'Factuurvinkje moet klus aanpassen');
  assert.match(source,/id="docJobPick"/,'Factuur heeft expliciete kluskeuze');
  assert.match(source,/id="saveDocJobLink"/,'Factuurkoppeling wordt bewaard');
  assert.ok(written.some(x=>x.store==='jobs'),'Er worden klussen opgeslagen');
  assert.ok(written.some(x=>x.store==='documents'),'Er worden facturen opgeslagen');
};
