// Fictieve tijdstippen en per-apparaat back-upgegevens; geen productie- of cloudschrijfacties.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

module.exports=async function testBackupReminders(){
  const app=fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8');
  const start=app.indexOf('  function backupReminderInfo(');
  const end=app.indexOf('\n  }',start);
  assert.ok(start>=0&&end>start,'Back-upherinneringsfunctie ontbreekt');
  const context={};
  vm.runInNewContext(app.slice(start,end+4)+'\nglobalThis.backupReminderInfo=backupReminderInfo;',context);
  const remind=context.backupReminderInfo;
  const day=86400000,now=Date.parse('2026-10-13T12:00:00Z');
  const daysAgo=n=>new Date(now-n*day).toISOString();
  assert.equal(remind(undefined,now),null,'Nieuwe omgeving vraagt niet om back-up');
  assert.equal(remind({id:'backup',lastBackup:null},now),null,'Lege backup-initialisatie vraagt niet');
  assert.equal(remind({lastBackup:'invalid'},now),null,'Ongeldige datum vraagt niet');
  assert.equal(remind({lastBackup:daysAgo(29)},now),null,'Binnen 30 dagen geen melding');
  assert.equal(remind({lastBackup:daysAgo(30)},now)?.daysSinceBackup,30,'Na 30 dagen opnieuw vragen');
  assert.equal(remind({lastLocalBackup:daysAgo(42)},now)?.daysSinceBackup,42,'Lokale kopie telt ook als back-up');
  assert.equal(remind({lastBackup:daysAgo(45),lastLocalBackup:daysAgo(12)},now),null,'Meest recente kopie wint');
  assert.equal(remind({lastBackup:daysAgo(40),reminderDismissedAt:daysAgo(1)},now),null,'Wegklikken verbergt de melding');
  assert.equal(remind({lastBackup:daysAgo(90),reminderDismissedAt:daysAgo(30)},now)?.daysSinceBackup,90,'Na 30 dagen opnieuw herinneren');
  assert.equal(remind({lastBackup:daysAgo(90),reminderDismissedAt:daysAgo(31)},now)?.daysSinceBackup,90,'Niet permanent uitgeschakeld');
  assert.equal(remind({lastBackup:daysAgo(31),reminderDismissedAt:daysAgo(45)},now)?.daysSinceBackup,31,'Oude uitsteldatum hoort niet bij nieuwe back-up');
  assert.equal(remind({lastBackup:daysAgo(-1)},now),null,'Geen melding bij toekomstig apparaatmoment');
  assert.match(app,/JKDB\.putLocal\('settings',\{\.\.\.local,id:'backup',reminderDismissedAt:/,'Uitstel is lokaal');
  assert.match(app,/reminderDismissedAt:null,counts:payload\.counts/,'Nieuwe back-up heft oud uitstel op');
  assert.match(app,/\$\{backupReminder\?\x60/,'Dashboard toont herinnering alleen als nodig');
  const cloud=fs.readFileSync(path.join(__dirname,'../app/cloud.js'),'utf8');
  assert.match(cloud,/\['cloudStatus','backup','backupRestoreGuard'\]/,'Back-upinstellingen worden niet naar de cloud verstuurd');
};
