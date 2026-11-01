/* Dell UI preview: external production integrations are never loaded. */
const blocked=async()=>{throw Error('Deze koppeling is in de Dell-testpreview uitgeschakeld.');};
window.JKCalendarFeed={schedule:()=>{},publish:blocked,status:async()=>({enabled:false}),own:blocked};
window.JKWebsiteEditor={open:()=>alert('Websitebeheer is in de Dell-testpreview uitgeschakeld.')};
window.JKPush={subscribe:blocked,unsubscribe:blocked,test:blocked,status:async()=>({enabled:false}),quoteNeeded:()=>false,snoozes:()=>[],snooze:()=>{},unsnooze:()=>{}};
