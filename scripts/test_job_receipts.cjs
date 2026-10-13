// Geisoleerde tests met fictieve bonnetjes. Geen echte gegevens en geen netwerk.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

module.exports=async function testJobReceipts(){
  const source=fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8');
  const start=source.indexOf('  function jobLinkedExpenses(');
  const end=source.indexOf('  async function showJob(',start);
  assert.ok(start>=0&&end>start,'Ontbrekende jobLinkedExpenses-helper');
  const scope={};
  vm.runInNewContext(source.slice(start,end)+'\nglobalThis.select=jobLinkedExpenses;',scope);
  const select=scope.select;
  const input=[
    {id:'r1',jobId:'job-a',supplier:'Bouwmarkt',date:'2026-10-01',amountIncl:'8.50',receiptBlob:{type:'image/jpeg'}},
    {id:'r2',jobId:'job-b',supplier:'Parkeren',date:'2026-10-12',amountIncl:'3.00'},
    {id:'r3',jobId:'job-a',supplier:'IJzerhandel',date:'2026-10-10',amountIncl:'11.00',receiptBlob:{type:'application/pdf'}},
    {id:'r4',supplier:'Los',date:'2026-10-08',amountIncl:'13.00'}
  ];
  assert.deepEqual([...select('job-a',input)].map(x=>x.id),['r3','r1'],'Alleen eigen bonnetjes, nieuwste eerst');
  assert.deepEqual([...select('job-b',input)].map(x=>x.id),['r2'],'Andere klus toont andere bonnen');
  assert.equal(select('job-c',input).length,0,'Klus zonder bonnen toont leeg');
  assert.equal(select('',input).length,0,'Geen lege jobId koppelen aan algemene uitgaven');
  assert.equal(input[0].id,'r1','Bronarray niet gemuteerd');
  assert.match(source,/jobLinkedExpenses\(id,await JKDB\.all\('expenses'\)\)/,'Klus leest actuele uitgaven');
  assert.match(source,/id="addReceiptThisJob"/,'Direct toevoegen vanuit klus');
  assert.match(source,/id="allReceiptsThisJob"/,'Doorlinken naar alle bonnetjes');
  assert.match(source,/data-job-expense=/,'Klikbare bonnen in de klus');
  assert.match(source,/editExpense\(null,\{jobId:id,returnJobId:id\}\)/,'Nieuwe bon heeft klus vooraf geselecteerd');
  assert.match(source,/showExpense\(x\.dataset\.jobExpense,\{returnJobId:id\}\)/,'Detail is bereikbaar vanuit klus');
  assert.match(source,/if\(returnJobId\)await showJob\(returnJobId\);else await renderExpenses\(\)/,'Opslaan en verwijderen keren terug naar klus');
  assert.match(source,/src="\$\{previewUrl\}#toolbar=0"/,'PDF-bon is te bekijken');
  assert.match(source,/state\.docFolder='expenses';await renderDocuments\(\)/,'Knop naar bonnetjesmap');
};
