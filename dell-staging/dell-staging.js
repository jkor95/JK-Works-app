'use strict';
const $ = id => document.getElementById(id);
const state = $('serverState');
async function api(path, opts={}) {
 const response = await fetch('/api/v1/'+path,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...opts});
 let value={};try{value=await response.json()}catch{}
 if(!response.ok)throw new Error(response.status===401?'Niet ingelogd':value.error||'Server niet beschikbaar');
 return value;
}
async function refreshState(){
 try{
  const status=await api('status');
  const ready=status.database_connected && status.authentication_enabled;
  state.textContent=ready?'Backend en database bereikbaar; inloggen mogelijk.':'Backend nog niet geactiveerd voor testgebruik. Login blijft voorlopig uitgeschakeld.';
  $('loginForm').querySelector('button').disabled=!ready;
  if(ready){try{await api('auth/me');await showWorkspace()}catch{}}
 }catch{state.textContent='Kan de Dell-backend nog niet bereiken. Testomgeving is nog niet gekoppeld.';$('loginForm').querySelector('button').disabled=true}
}
async function showWorkspace(){$('loginPanel').hidden=true;$('workspace').hidden=false;await loadRecords()}
async function loadRecords(){
 const result=await api('records');
 const items=result.records.filter(r=>r.store==='test_customers');
 const target=$('records');target.replaceChildren();
 if(!items.length){const p=document.createElement('p');p.textContent='Nog geen testklanten opgeslagen.';target.append(p);return}
 for(const record of items){
  const row=document.createElement('div');row.className='item row';
  const label=document.createElement('span');label.textContent=String(record.data?.name||'Naamloos')+' — '+String(record.data?.note||'');
  const remove=document.createElement('button');remove.className='secondary';remove.textContent='Verwijderen';remove.onclick=async()=>{
    try{await api('records/test_customers/'+encodeURIComponent(record.record_id),{method:'DELETE'});await loadRecords()}catch(e){$('recordMsg').textContent=e.message}
  };
  row.append(label,remove);target.append(row);
 }
}
$('loginForm').onsubmit=async ev=>{
 ev.preventDefault();const msg=$('loginMsg');msg.textContent='Bezig met aanmelden…';
 try{await api('auth/login',{method:'POST',body:JSON.stringify({email:$('email').value,password:$('password').value})});$('password').value='';await showWorkspace()}
 catch{msg.textContent='Inloggen niet gelukt. Controleer je Dell-testaccount of de backendinstellingen.'}
};
$('recordForm').onsubmit=async ev=>{
 ev.preventDefault();$('recordMsg').textContent='Opslaan…';
 try{
  const data={name:$('customer').value.trim(),note:$('note').value.trim(),created_at:new Date().toISOString()};
  await api('records/test_customers/'+crypto.randomUUID(),{method:'PUT',body:JSON.stringify(data)});
  $('recordForm').reset();$('recordMsg').textContent='Testklant opgeslagen op de Dell-server.';await loadRecords();
 }catch(e){$('recordMsg').textContent='Opslaan mislukt: '+e.message}
};
$('logout').onclick=async()=>{try{await api('auth/logout',{method:'POST'})}catch{}location.reload()};
refreshState();
