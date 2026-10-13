// Geïsoleerde betaalstatus-regressietests: geen echte gegevens of backendverzoeken.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

module.exports=async function testInvoicePayment(){
  const src=fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8');
  function extract(signature){
    const start=src.indexOf('  '+signature);
    assert.ok(start>=0,'Ontbrekende helper: '+signature);
    const end=src.indexOf('\n  }',start);
    assert.ok(end>start,'Helper sluit niet af: '+signature);
    return src.slice(start,end+4);
  }
  const jobs=[
    {id:'j1',paymentType:'invoice',paymentPaid:false},
    {id:'j2',paymentType:'invoice',paymentPaid:true},
    {id:'cash',paymentType:'cash',paymentPaid:false}
  ];
  const docs=[
    {id:'inv1',folder:'factuur',meta:{jobId:'j1',paid:true}},
    {id:'inv2',folder:'factuur',meta:{jobId:'j1',paid:false}},
    {id:'quote',folder:'offerte',meta:{jobId:'j1',paid:true}},
    {id:'other',folder:'factuur',meta:{jobId:'j2',paid:true}},
    {id:'cashinvoice',folder:'factuur',meta:{jobId:'cash',paid:true}}
  ];
  const updates=[];
  const sandbox={
    jobPaymentType:j=>j?.paymentType==='cash'?'cash':'invoice',
    docFolder:d=>d.folder==='factuur'?'factuur':d.folder==='offerte'?'offerte':'diversen',
    JKDB:{
      get:async(store,id)=>store==='jobs'?jobs.find(j=>j.id===id):null,
      all:async(store)=>store==='documents'?docs:[],
      put:async(store,record)=>{
        assert.equal(store,'jobs');
        updates.push({...record});
        const index=jobs.findIndex(j=>j.id===record.id);
        jobs[index]={...record};
      }
    }
  };
  vm.runInNewContext(extract('function invoicePaymentForJob')+'\n'+extract('async function syncJobPaymentForInvoice')+'\n'+'globalThis.payment={invoicePaymentForJob,syncJobPaymentForInvoice};',sandbox);
  const {invoicePaymentForJob:payment,syncJobPaymentForInvoice:sync}=sandbox.payment;
  assert.equal(payment(jobs[0],docs),false,'Niet alle facturen voldaan');
  assert.equal(payment(jobs[1],docs),true);
  assert.equal(payment({id:'no-docs'},docs),null,'Geen facturen: behoud handmatige betaalstatus');
  assert.equal(payment(jobs[2],docs),null,'Contante klus niet aanpassen');
  assert.equal(await sync('j1'),false,'Al correct onbetaald; geen onnodige schrijfactie');
  assert.equal(updates.length,0);
  docs[1].meta.paid=true;
  assert.equal(await sync('j1'),true,'Laatste factuur betaald');
  assert.equal(jobs[0].paymentPaid,true);
  assert.equal(updates.length,1);
  assert.equal(await sync('j1'),false,'Herhaald synchroniseren is idempotent');
  docs[0].meta.paid=false;
  assert.equal(await sync('j1'),true,'Een factuur opnieuw onbetaald');
  assert.equal(jobs[0].paymentPaid,false);
  assert.equal(updates.length,2);
  assert.equal(await sync('cash'),false,'Contante betalingen ongemoeid');
  assert.equal(await sync('unknown'),false,'Onbekende klus ongemoeid');
  assert.equal(await sync(''),false,'Zonder expliciete koppeling geen synchronisatie');
  assert.equal(jobs[1].paymentPaid,true,'Andere klussen blijven ongewijzigd');
  docs.splice(0,2);
  assert.equal(await sync('j1'),false,'Geen facturen meer: betaalstatus niet overschrijven');
  assert.equal(updates.length,2);
};
