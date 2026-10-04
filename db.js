const JKDB = (() => {
  const DB_NAME = 'jkworks-dordrecht';
  const DB_VERSION = 3;
  const stores = ['mboxes','tools','checklists','clients','jobs','timeEntries','pdfTemplates','documents','settings'];
  const internalStores = ['syncQueue'];
  let dbPromise;

  function open(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        [...stores,...internalStores].forEach(name => {
          if(!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath:'id'});
        });
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    return dbPromise;
  }
  async function tx(store, mode='readonly'){
    const db=await open(); return db.transaction(store,mode).objectStore(store);
  }
  async function all(store){const s=await tx(store);return reqP(s.getAll());}
  async function get(store,id){const s=await tx(store);return reqP(s.get(id));}
  async function putLocal(store,obj){const s=await tx(store,'readwrite');await reqP(s.put(obj));return obj;}
  async function removeLocal(store,id){const s=await tx(store,'readwrite');return reqP(s.delete(id));}
  async function put(store,obj,opts={}){
    const stamped={...obj};
    if(!opts.preserveTimestamp) stamped._syncUpdatedAt=new Date().toISOString();
    await putLocal(store,stamped);
    if(!opts.localOnly && !window.__JK_SEEDING && window.JKCloud?.queuePut) window.JKCloud.queuePut(store,stamped).catch(()=>{});
    return stamped;
  }
  async function remove(store,id,opts={}){
    await removeLocal(store,id);
    if(!opts.localOnly && !window.__JK_SEEDING && window.JKCloud?.queueDelete) window.JKCloud.queueDelete(store,id).catch(()=>{});
  }
  async function clear(store){const s=await tx(store,'readwrite');return reqP(s.clear());}
  function reqP(req){return new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});}
  function id(prefix='id'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);}

  const canonicalMboxes = [
    {id:'m_schroef',name:'Mbox maat 3',type:'Schroefmachines',items:[
      'Makita DHP485Z klopboor-/schroefmachine','Makita DTD153ZJ slagschroevendraaier','Makita 18V acculader','Diverse bitjes','Diverse bithouders','Makita 18V 5,0Ah accu'
    ],notes:'1 accu vast in deze koffer.'},
    {id:'m_cirkel',name:'Mbox maat 3',type:'Cirkelzaag',items:[
      'Makita DHS680Z cirkelzaag','Afzuigadapter','Afstandhouder / geleider','Timmermansdriehoek'
    ],notes:'Geen vaste accu. Bij meenemen ook een losse 18V accu meenemen.'},
    {id:'m_kit',name:'Mbox maat 3',type:'Kit & afwerking',items:[
      '18V kitspuit (Makita-accucompatibel)','Handkitspuit','Kitkokers','Spuitmonden','Kitstrijkers','Stanleymes','Schilderstape','Keukenpapier','Afvalzakjes','Werkhandschoenen','Latex handschoenen','Spons','Sprayfles met water + Dreft'
    ],notes:'Voor de 18V kitspuit is een losse 18V accu nodig. Sprayfles met water + Dreft stond nog op toevoegen.'},
    {id:'m_div',name:'Mbox maat 3',type:'Diversen',items:[
      'Houtborenset','Metaalborenset','Steenborenset','Gatenzaagset','Speedboor','Ringstops voor boren','Glasboren','Handblazer voor stof','Ringen-set diverse maten','Snelspan lijmklem','Ducttape','Schilderstape','Nanotape','Sealtape','Dubbelzijdige tape','Tie-wraps','1x metalen tie-wrap','Opblaasbare montagewig (air wedge)','WD-40','PVC-lijm','18V adapter met USB / USB-C oplader','IJzerdraad','Extra pluggen','Grote S-haak voor aan ladder','Stoffer + blik','Digitale leidingzoeker'
    ],notes:''},
    {id:'m_hand',name:'Mbox maat 2',type:'Handgereedschap',items:[
      'Rolmaat','Kleine waterpas','Kleine hamer','WERA schroevendraaierset met diverse opzetstukken','Waterpomptang','Punttang','Zijkniptang','Verstelbare moersleutel','Inbussleutelset','Torx-sleutelset','Potlood, stift en overige aftekenspullen','Kleine koevoet','Kleine ijzerzaag','Popnageltang','Zaklampje','USB-C oplaadkabel','Schaar','Priem','Visitekaartjes','Mini-ratel voor bitjes','Werkhandschoenen','Winkelhaak','Timmermansdriehoek','Reserve ijzerzaagjes'
    ],notes:''},
    {id:'m_schuur',name:'Mbox maat 2',type:'Schuurmachine',items:[
      'Makita DBO180ZJ excentrische schuurmachine','Stofopvangbakje','Stofopvangzakken','Schuurpapier korrel 80','Schuurpapier korrel 120','Schuurpapier korrel 180','Schuurpapier korrel 250','Mondkapjes'
    ],notes:'Geen vaste accu. Bij meenemen ook een losse 18V accu meenemen.'},
    {id:'m_deco',name:'Mbox maat 2',type:'Decoupeerzaag',items:[
      'Makita DJV181ZJ decoupeerzaag','Geleider / afstandhouder','Diverse zaagjes','Stofafzuigadapter'
    ],notes:'Geen vaste accu. Bij meenemen ook een losse 18V accu meenemen.'},
    {id:'m_slijp',name:'Mbox maat 2',type:'Haakse slijper',items:[
      'Makita DGA506ZJ haakse slijper','Diverse slijpschijven','Handvat','Veiligheidsbril','Oordopjes'
    ],notes:'Geen vaste accu. Bij meenemen ook een losse 18V accu meenemen.'},
    {id:'m_multi',name:'Mbox maat 2',type:'Multitool',items:[
      'Makita DTM52ZJ multitool','Doosje met diverse multitoolzaagjes'
    ],notes:'Geen vaste accu. De accu die eerder hier lag is nu los/vrij.'},
    {id:'o_schroef',name:'Organizer',type:'Bevestigingsmateriaal',items:[
      'Diverse maten schroeven','Spijkers','Pluggen o.a. 6 mm en 8 mm','Popnagels'
    ],notes:''},
    {id:'o_elektra',name:'Organizer',type:'Elektra',items:[
      'Multimeter','Kniptang','Striptang','Pijpenknipper','Mes','Kabelstripper','Knijptang','Aftekenstift','Schroevendraaier PZ2','Schroevendraaier PH1','Kleine platte schroevendraaier','Brede platte schroevendraaier','Kleine platte schroevendraaier / 1-polige spanningstester','Diverse WAGO-lasklemmen','Stekkers','Overige elektra-benodigdheden'
    ],notes:''},
    {id:'loose_tools',name:'Los',type:'Gereedschap & transport',items:[
      'Makita DML805 bouwlamp','Kruislijnlaser','Statief voor kruislijnlaser','Plafondpaal voor kruislijnlaser','Wesco 230 mm slijptol, 2000W, bedraad','Kabelhaspel 10 m','Kabelhaspel 7,5 m','Opvouwbare steekwagen van Action'
    ],notes:'Bij de Makita DML805 bouwlamp eventueel de 14,4V accu\'s meenemen.'},
    {id:'loose_ladders',name:'Los',type:'Ladders & trappen',items:[
      '3-treeds huistrap','Telescoopladder tot 3,8 m','Multiladder / uitschuifbare vouwladder tot 5,2 m'
    ],notes:''},
    {id:'loose_reserve',name:'Los / reserve',type:'Niet in Mbox',items:[
      'Kniebeschermers','Grotere steeksleutels','Kleine multitool + accessoires','Contourmal / profielmal'
    ],notes:''},
    {id:'loose_batteries',name:'Los',type:'Accu\'s',items:[
      'Makita 18V 5,0Ah accu #2','Makita 18V 5,0Ah accu #3','Makita 18V 5,0Ah accu #4','Makita 14,4V accu 2,0Ah','Makita 14,4V accu 1,3Ah'
    ],notes:'1× 18V 5,0Ah accu blijft standaard in de Mbox schroefmachines. De andere 3× 18V 5,0Ah zijn los/vrij.'}
  ];

  const canonicalTools = [
    ['t_dga','Makita DGA506ZJ','Haakse slijper','m_slijp'],['t_dbo','Makita DBO180ZJ','Excentrische schuurmachine','m_schuur'],['t_djv','Makita DJV181ZJ','Decoupeerzaag','m_deco'],['t_dtd','Makita DTD153ZJ','Slagschroevendraaier','m_schroef'],['t_dhp','Makita DHP485Z','Klopboor-/schroefmachine','m_schroef'],['t_dtm','Makita DTM52ZJ','Multitool','m_multi'],['t_dhs','Makita DHS680Z','Cirkelzaag','m_cirkel'],['t_lamp','Makita DML805','Bouwlamp','loose_tools'],['t_kit','18V kitspuit','Kitspuit (Makita-accu compatibel)','m_kit'],['t_wesco','Wesco 230 mm 2000W','Slijptol bedraad','loose_tools'],['t_laser','Kruislijnlaser','Laser','loose_tools'],['t_lasertripod','Statief voor kruislijnlaser','Laser-accessoire','loose_tools'],['t_ceilingpole','Plafondpaal voor kruislijnlaser','Laser-accessoire','loose_tools'],['t_ladder1','3-treeds huistrap','Ladder','loose_ladders'],['t_ladder2','Telescoopladder 3,8 m','Ladder','loose_ladders'],['t_ladder3','Multiladder 5,2 m','Ladder','loose_ladders'],['t_has10','Kabelhaspel 10 m','Elektra','loose_tools'],['t_has75','Kabelhaspel 7,5 m','Elektra','loose_tools'],['t_cart','Opvouwbare steekwagen Action','Transport','loose_tools'],['t_old14','Oude Makita 14,4V schroeftol','Schroefmachine','loose_reserve']
  ];

  async function seed(){
    const v=Number((await get('settings','seedVersion'))?.value||0);
    if(v < 3){
      for(const m of canonicalMboxes){
        const old=await get('mboxes',m.id);
        await put('mboxes',{...m,checked:old?.checked||{},updatedAt:new Date().toISOString()});
      }
      for(const [id,name,category,location] of canonicalTools){
        const old=await get('tools',id);
        await put('tools',{id,name,category,location,serial:old?.serial||'',purchaseDate:old?.purchaseDate||'',notes:old?.notes||''});
      }
      for(let i=1;i<=4;i++){
        const id='t_bat'+i, old=await get('tools',id);
        await put('tools',{id,name:`Makita 18V 5,0Ah accu #${i}`,category:'Accu',location:i===1?'m_schroef':'loose_batteries',serial:old?.serial||'',purchaseDate:old?.purchaseDate||'',notes:i===1?'Standaard in Mbox schroefmachines':'Los / vrij inzetbaar'});
      }
      const old14a=await get('tools','t_bat14a');
      const old14b=await get('tools','t_bat14b');
      await put('tools',{id:'t_bat14a',name:'Makita 14,4V accu 2,0Ah',category:'Accu',location:'loose_batteries',serial:old14a?.serial||'',purchaseDate:old14a?.purchaseDate||'',notes:'Kan in DML805 bouwlamp'});
      await put('tools',{id:'t_bat14b',name:'Makita 14,4V accu 1,3Ah',category:'Accu',location:'loose_batteries',serial:old14b?.serial||'',purchaseDate:old14b?.purchaseDate||'',notes:'Kan in DML805 bouwlamp'});

      const checklists=[
        {id:'c_departure',name:'Korte vertrekcheck',items:['Juiste Mboxen voor de klus gepakt','Voldoende 18V accu\'s meegenomen','Acculader mee als de klus langer duurt','Bij DML805 bouwlamp: 14,4V accu\'s meenemen','PBM gecontroleerd: bril, gehoorbescherming, handschoenen en/of mondkapje waar nodig','Haspel / verlengmogelijkheid meegenomen als 230V nodig is']},
        {id:'c_general',name:'Algemene klus',items:['Werkadres en contact controleren','Benodigde Mboxen selecteren','Accu\'s opgeladen','PBM / veiligheidsmiddelen mee','Verlengkabel / haspel indien nodig','Foto vóór maken','Materiaal en bonnen registreren','Foto na maken','Werkplek schoon achterlaten','Uren registreren en klus afronden']},
        {id:'c_kit',name:'Kitklus',items:['Juiste kit + voldoende kokers','Handkitspuit','Kitstrijkers','Stanleymes / mesjes','Schilderstape indien nodig','Keukenpapier / doeken','Handschoenen','Spons','Sprayfles water + Dreft','Ondergrond schoon en droog','Foto vóór','Foto na','Afval opruimen']}
      ];
      for(const c of checklists){ if(!(await get('checklists',c.id))) await put('checklists',c); }

      const company=await get('settings','company');
      await put('settings',{id:'company',companyName:'JK Works Dordrecht',owner:'Jeremy Korstanje',kor:true,korSince:'2026-10-01',defaultRate:company?.defaultRate||'',notes:company?.notes||'Beschikbaar buiten kantooruren: avonden, weekenden en schoolvakanties.'});
      if(!(await get('settings','backup'))) await put('settings',{id:'backup',lastBackup:null});
      await put('settings',{id:'seedVersion',value:3,at:new Date().toISOString()});
    }
  }

  return {stores,open,all,get,put,remove,clear,id,seed,putLocal,removeLocal};
})();
