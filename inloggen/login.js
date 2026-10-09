(() => {
  const SUPABASE_URL='https://ercqiavruotoclhvfzud.supabase.co';
  const SUPABASE_KEY='sb_publishable_z4kkYgzjr-bYDEcSZlVciw_cP8MfOuX';
  const form=document.getElementById('loginForm');
  const error=document.getElementById('loginError');
  const note=document.getElementById('alreadySignedIn');
  const params=new URLSearchParams(location.search);
  const requested=params.get('next')||'/app/';
  const safeNext=requested.startsWith('/app')?requested:'/app/';
  function go(){location.replace(safeNext);}
  if(!window.supabase?.createClient){error.hidden=false;error.textContent='De inlogmodule kon niet worden geladen. Controleer je internetverbinding.';return;}
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.getSession().then(({data})=>{if(data.session){note.hidden=false;form.hidden=true;setTimeout(go,250);}}).catch(()=>{});
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    error.hidden=true;error.textContent='';
    const btn=form.querySelector('button[type=submit]');
    const data=new FormData(form);
    btn.disabled=true;btn.textContent='Inloggen...';
    try{
      const {error:authError}=await client.auth.signInWithPassword({email:String(data.get('email')||'').trim(),password:String(data.get('password')||'')});
      if(authError)throw authError;
      go();
    }catch(err){error.textContent='Inloggen mislukt. Controleer je e-mailadres en wachtwoord.';error.hidden=false;console.warn(err);}
    finally{btn.disabled=false;btn.textContent='Inloggen';}
  });
})();
