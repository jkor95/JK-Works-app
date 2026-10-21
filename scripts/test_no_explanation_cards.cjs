// Houd uitlegkaarten buiten de bedrijfsapp; relevante waarschuwingen blijven behouden.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'app/styles.css'),'utf8');

assert.doesNotMatch(app,/class="successbox/,'Geen grote gele uitlegkaarten tonen');
assert.doesNotMatch(css,/\.successbox\s*\{/,'Verouderde uitlegkaart-stijl verwijderd');
for(const phrase of [
 'Foto’s op al je apparaten','Foto’s optioneel</strong>',
 'Inpakken = afvinken','Klus voorbereiden = afvinken',
 'Gekoppeld register','Cloudfoto’s zonder dubbele opslag',
 'PDF automatisch uitgelezen','Hier zie je alle uitgaven die aan deze klus gekoppeld zijn.',
 'Kies meerdere foto’s tegelijk uit je fotorol.'
]){
 assert.ok(!app.includes(phrase),'Uitlegtekst onterecht zichtbaar: '+phrase);
}
assert.match(app,/const photoNotice=policy==='required'/,'Verplichte foto’s blijven gesignaleerd');
assert.match(app,/id="makePaymentReminder"/,'Betaalherinnering blijft werken');
assert.match(app,/Herstelkopie beschermd/,'Bescherming van herstel blijft zichtbaar');
assert.match(app,/id="addReceiptThisJob"/,'Bonnetjes toevoegen blijft werken');
assert.match(app,/data-upload="general"/,'Foto’s uploaden blijft werken');
assert.match(css,/\.warning\{background:var\(--surface\)/,'Echte waarschuwingen zijn geen gele uitlegkaarten');
console.log('PASS: uitlegkaarten verwijderd in Foto’s, Materialen, Documenten en klussen; acties en echte waarschuwingen behouden');
