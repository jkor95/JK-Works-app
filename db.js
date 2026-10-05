const JKDB = (() => {
  const DB_NAME = 'jkworks-dordrecht';
  const DB_VERSION = 5;
  const stores = ['mboxes','tools','checklists','clients','jobs','jobPhotos','timeEntries','pdfTemplates','documents','settings'];
  const internalStores = ['syncQueue','deleteMarkers'];
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
  async function markDeleteLocal(store,id,deletedAt=new Date().toISOString()){
    const marker={id:`${store}|${id}`,store,recordId:id,deletedAt};
    await putLocal('deleteMarkers',marker);
    return marker;
  }
  async function isDeletedLocal(store,id){
    return !!(await get('deleteMarkers',`${store}|${id}`));
  }
  async function remove(store,id,opts={}){
    // Eerst een blijvende lokale verwijdermarkering opslaan. Hierdoor kan geen
    // oude of nog lopende upload dit record na verwijderen opnieuw tot leven brengen.
    if(!opts.localOnly) await markDeleteLocal(store,id);
    await removeLocal(store,id);
    if(!opts.localOnly && !window.__JK_SEEDING && window.JKCloud?.queueDelete){
      await window.JKCloud.queueDelete(store,id);
    }
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

    if(v < 4){
      const jobChecklists=[
        {id:'c_departure',name:'Korte vertrekcheck',items:[
          'Drinkfles meenemen',
          'Werkadres en contactpersoon controleren',
          'Juiste Mboxen / inpaklijsten voor de klus gepakt',
          'Voldoende Makita 18V 5,0Ah accu’s meenemen en controleren of ze geladen zijn',
          'Makita 18V acculader meenemen als de klus langer duurt',
          'PBM controleren: werkhandschoenen, veiligheidsbril, gehoorbescherming en/of mondkapje waar nodig',
          'Kabelhaspel / verlengmogelijkheid meenemen als 230V nodig is',
          'Eten alleen meenemen bij een grotere / langere klus'
        ]},
        {id:'c_general',name:'Algemene klus',items:[
          'Drinkfles meenemen',
          'Werkadres, contactpersoon en werkzaamheden controleren',
          'Juiste Mboxen / inpaklijsten selecteren',
          'Voldoende 18V accu’s opgeladen en meegenomen',
          'PBM / veiligheidsmiddelen meenemen',
          'Kabelhaspel / verlengmogelijkheid indien nodig',
          'Eten meenemen als het een grotere / langere klus is',
          'Foto vóór maken',
          'Gebruikte materialen / bonnetjes registreren',
          'Foto na maken',
          'Werkplek schoon achterlaten',
          'Uren registreren en klus afronden'
        ]},
        {id:'c_kitchen',name:'Keuken monteren',items:[
          'Drinkfles meenemen',
          'Eten / lunch meenemen',
          'Mbox maat 3 – Schroefmachines: DHP485Z, DTD153ZJ, acculader, bitjes/bithouders en vaste 5,0Ah accu',
          'Mbox maat 3 – Cirkelzaag: DHS680Z, afzuigadapter en geleider',
          'Mbox maat 2 – Decoupeerzaag: DJV181ZJ, zaagjes, geleider en afzuigadapter',
          'Mbox maat 2 – Multitool: DTM52ZJ + diverse zaagjes',
          'Mbox maat 2 – Handgereedschap: rolmaat, waterpas, hamer, schroevendraaiers, tangen, sleutels, aftekenspullen, koevoet, winkelhaak / timmermansdriehoek',
          'Mbox maat 3 – Diversen: hout/steen/metaalboren, gatenzaag, speedboor, ringstops, montagewig, tapes, WD-40, leidingzoeker en stoffer + blik',
          'Organizer – Bevestigingsmateriaal: schroeven, pluggen, spijkers en popnagels',
          'Organizer – Elektra meenemen als stopcontacten / aansluitingen gecontroleerd moeten worden',
          'Los: kruislijnlaser + statief / plafondpaal',
          'Los: bouwlamp indien nodig',
          'Los: minimaal 2–3 extra 18V 5,0Ah accu’s',
          'Los: passende trap / ladder indien bovenkasten worden gemonteerd',
          'Kabelhaspel meenemen indien 230V nodig is',
          'Kniebeschermers meenemen',
          'Foto vóór en na maken',
          'Werkplek schoon en zaagselvrij achterlaten'
        ]},
        {id:'c_kit',name:'Kitten',items:[
          'Drinkfles meenemen',
          'Mbox maat 3 – Kit & afwerking compleet meenemen',
          'Juiste kit + voldoende kokers controleren',
          'Handkitspuit meenemen; 18V kitspuit alleen als gewenst',
          'Kitstrijkers en spuitmonden',
          'Stanleymes / mesjes',
          'Schilderstape indien nodig',
          'Keukenpapier / doeken en afvalzakjes',
          'Latex handschoenen + werkhandschoenen',
          'Spons + sprayfles water/Dreft',
          'Ondergrond controleren: schoon, droog en vetvrij',
          'Foto vóór maken',
          'Naden kitten en strak afwerken',
          'Foto na maken',
          'Afval en overtollige kit opruimen'
        ]},
        {id:'c_catering',name:'Catering / horeca',items:[
          'Drinkfles meenemen',
          'Werkkleding / nette kleding volgens afspraak',
          'Werkschoenen / geschikte dichte schoenen',
          'Telefoon volledig opgeladen',
          'Powerbank / laadkabel indien lange dienst',
          'Eventueel schort of bedrijfskleding als dit vooraf is afgesproken',
          'Starttijd, locatie en contactpersoon controleren',
          'Geen eten meenemen',
          'Na afloop gewerkte uren direct registreren'
        ]},
        {id:'c_renovation',name:'Verbouwing / renovatie',items:[
          'Drinkfles meenemen',
          'Eten / lunch meenemen',
          'Mbox maat 3 – Schroefmachines compleet',
          'Mbox maat 3 – Cirkelzaag compleet',
          'Mbox maat 3 – Diversen compleet',
          'Mbox maat 2 – Handgereedschap compleet',
          'Mbox maat 2 – Multitool compleet',
          'Mbox maat 2 – Decoupeerzaag compleet',
          'Mbox maat 2 – Schuurmachine + schuurpapier indien afwerking nodig is',
          'Mbox maat 2 – Haakse slijper + schijven indien nodig',
          'Organizer – Bevestigingsmateriaal',
          'Organizer – Elektra indien elektra onderdeel van de werkzaamheden is',
          'Los: kruislijnlaser + statief / plafondpaal',
          'Los: bouwlamp',
          'Los: 2–3 extra 18V 5,0Ah accu’s + acculader',
          'Los: kabelhaspels 10 m / 7,5 m',
          'Los: juiste trap / ladder voor de werkzaamheden',
          'Los / reserve: kniebeschermers en contourmal indien nodig',
          'PBM: veiligheidsbril, gehoorbescherming, handschoenen en mondkapjes',
          'Afvalzakken / schoonmaakmiddelen meenemen',
          'Foto vóór, tussendoor en na maken',
          'Materialen / bonnetjes registreren',
          'Werkplek schoon achterlaten'
        ]},
        {id:'c_drill_mount',name:'Boren & ophangen',items:[
          'Drinkfles meenemen',
          'Mbox maat 3 – Schroefmachines: DHP485Z + DTD153ZJ, bitjes en accu',
          'Mbox maat 3 – Diversen: juiste hout/steen/metaal/glasboor, ringstops, gatenzaag / speedboor indien nodig en leidingzoeker',
          'Mbox maat 2 – Handgereedschap: rolmaat, waterpas, hamer, schroevendraaiers en aftekenspullen',
          'Organizer – Bevestigingsmateriaal: juiste pluggen en schroeven',
          'Los: kruislijnlaser indien recht / op lijn gemonteerd moet worden',
          'Los: trap / ladder indien nodig',
          'Stoffer + blik meenemen voor boorstof',
          'Controleren op leidingen voordat je boort',
          'Foto na maken en werkplek schoon achterlaten'
        ]},
        {id:'c_small_repair',name:'Kleine montage / reparatie',items:[
          'Drinkfles meenemen',
          'Mbox maat 3 – Schroefmachines meenemen als er geschroefd / geboord wordt',
          'Mbox maat 2 – Handgereedschap compleet',
          'Mbox maat 3 – Diversen voor boren, tape, WD-40, pluggen en leidingzoeker',
          'Organizer – Bevestigingsmateriaal indien nodig',
          'Eén losse 18V 5,0Ah accu extra meenemen als elektrisch gereedschap nodig is',
          'Passende trap / ladder alleen indien nodig',
          'Geen eten meenemen',
          'Foto vóór / na indien relevant',
          'Werkplek schoon achterlaten'
        ]},
        {id:'c_paint_finish',name:'Schilderen & afwerken',items:[
          'Drinkfles meenemen',
          'Eten / lunch meenemen als dit een grotere dagklus is',
          'Mbox maat 2 – Schuurmachine: DBO180ZJ, stofopvang en korrel 80/120/180/250',
          'Mbox maat 3 – Kit & afwerking indien naden / kieren moeten worden afgewerkt',
          'Mbox maat 3 – Diversen: schilderstape, ducttape en stoffer + blik',
          'Mbox maat 2 – Handgereedschap: stanleymes, schaar en aftekenspullen',
          'Los: bouwlamp voor controle van de afwerking',
          'Los: trap / ladder indien nodig',
          'Mondkapjes en werkhandschoenen',
          'Afdekfolie / afdekmateriaal, rollers, kwasten, bakjes en verf meenemen volgens de klus',
          'Ondergrond voorbereiden, stofvrij en schoon maken',
          'Foto vóór en na maken',
          'Werkplek schoon achterlaten'
        ]},
        {id:'c_strip_demo',name:'Sloop / stripwerk',items:[
          'Drinkfles meenemen',
          'Eten / lunch meenemen',
          'Mbox maat 2 – Handgereedschap: hamer, koevoet, tangen, ijzerzaag en handschoenen',
          'Mbox maat 2 – Multitool + zaagjes',
          'Mbox maat 2 – Haakse slijper + juiste schijven indien nodig',
          'Mbox maat 3 – Schroefmachines voor demonteren',
          'Mbox maat 3 – Diversen: leidingzoeker, tapes, tie-wraps, WD-40 en stoffer + blik',
          'Los: bouwlamp',
          'Los: kabelhaspel indien nodig',
          'Los: juiste trap / ladder',
          'PBM: veiligheidsbril, gehoorbescherming, handschoenen en mondkapje',
          'Afvalzakken / bakken regelen',
          'Vooraf controleren op elektra / leidingen',
          'Foto vóór en na maken',
          'Werkplek bezemschoon achterlaten'
        ]}
      ];
      for(const c of jobChecklists) await put('checklists',c);
      await put('settings',{id:'seedVersion',value:4,at:new Date().toISOString()});
    }
    if(v < 5){
      const photoPoints=['Foto vóór de klus maken','Foto tijdens de klus maken','Foto na de klus maken'];
      for(const c of await all('checklists')){
        let items=(c.items||[]).filter(x=>!/^Foto\b/i.test(String(x).trim()));
        const catering=/catering|horeca/i.test(String(c.name||''));
        if(!catering) items=[...items,...photoPoints];
        const checked={};
        for(const item of items) if(c.checked?.[item]) checked[item]=true;
        await put('checklists',{...c,items,checked,updatedAt:new Date().toISOString()});
      }
      await put('settings',{id:'seedVersion',value:5,at:new Date().toISOString()});
    }
  }

  return {stores,open,all,get,put,remove,clear,id,seed,putLocal,removeLocal,markDeleteLocal,isDeletedLocal};
})();
