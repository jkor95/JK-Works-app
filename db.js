const JKDB = (() => {
  const DB_NAME = 'jkworks-dordrecht';
  const DB_VERSION = 1;
  const stores = ['mboxes','tools','checklists','clients','jobs','timeEntries','pdfTemplates','documents','settings'];
  let dbPromise;

  function open(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        stores.forEach(name => {
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
  async function put(store,obj){const s=await tx(store,'readwrite');await reqP(s.put(obj));return obj;}
  async function remove(store,id){const s=await tx(store,'readwrite');return reqP(s.delete(id));}
  async function clear(store){const s=await tx(store,'readwrite');return reqP(s.clear());}
  function reqP(req){return new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});}
  function id(prefix='id'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)};

  async function seed(){
    const marker=await get('settings','seeded'); if(marker) return;
    const mboxes=[
      ['m_schroef','Mbox 3','Schroefmachines',['Makita DHP485Z klopboor-/schroefmachine','Makita DTD153ZJ slagschroevendraaier','Makita 18V oplader','1× Makita 18V 5,0Ah accu','Bitjes en bithouders']],
      ['m_cirkel','Mbox 3','Cirkelzaag',['Makita DHS680Z 18V cirkelzaag','Afzuigadapter','Parallelgeleider / afstandhouder']],
      ['m_kit','Mbox 3','Kitpistool',['18V kitspuit (Makita-accu compatibel)']],
      ['m_div','Mbox 3','Diversen',['Vrij / nader in te delen']],
      ['m_hand','Mbox 2','Handgereedschap',['Handgereedschap – indeling verder aan te vullen']],
      ['m_schuur','Mbox 2','Schuurmachine',['Makita DBO180ZJ excentrische schuurmachine','Stofbakje + stofzakken','Schuurpapier korrel 80 / 120 / 180 / 250','Mondkapjes']],
      ['m_deco','Mbox 2','Decoupeerzaag',['Makita DJV181ZJ T-greep decoupeerzaag','Geleider / afstandhouder','Zaagjes','Afzuigadapter']],
      ['m_slijp','Mbox 2','Haakse slijper',['Makita DGA506ZJ 125 mm','Diverse slijp-/doorslijpschijven','Zijhandvat','Veiligheidsbril','Oordopjes']],
      ['m_multi','Mbox 2','Multitool',['Makita DTM52ZJ 18V LXT multitool','Doosje met zaagjes / accessoires']],
      ['o_schroef','Organizer','Schroeven & bevestiging',['Schroeven','Spijkers','Pluggen','Popnagels']],
      ['o_elektra','Organizer','Elektra',['Multimeter','Kniptang','Striptang','Pijpenknipper','Mes','Kabelstripper','Knijptang','Aftekenstift','PZ2 schroevendraaier','PH1 schroevendraaier','Kleine platte schroevendraaier','Brede platte schroevendraaier','1-polige spanningzoeker / kleine platte schroevendraaier','WAGO’s en stekkers']]
    ];
    for(const [id,name,type,items] of mboxes) await put('mboxes',{id,name,type,items,notes:'',updatedAt:new Date().toISOString()});
    const tools=[
      ['t_dga','Makita DGA506ZJ','Haakse slijper','m_slijp'],['t_dbo','Makita DBO180ZJ','Excentrische schuurmachine','m_schuur'],['t_djv','Makita DJV181ZJ','Decoupeerzaag','m_deco'],['t_dtd','Makita DTD153ZJ','Slagschroevendraaier','m_schroef'],['t_dhp','Makita DHP485Z','Klopboor-/schroefmachine','m_schroef'],['t_dtm','Makita DTM52ZJ','Multitool','m_multi'],['t_dhs','Makita DHS680Z','Cirkelzaag','m_cirkel'],['t_lamp','Makita DML805','Bouwlamp','los'],['t_kit','18V kitspuit','Kitspuit (Makita accu compatibel)','m_kit'],['t_wesco','Wesco 230 mm 2000W','Slijptol bedraad','los'],['t_laser','Kruislijnlaser','Laser + statief + plafondpaal','los'],['t_ladder1','Huistrap 3-treeds','Ladder','los'],['t_ladder2','Telescoopladder 3,8 m','Ladder','los'],['t_ladder3','Multiladder 5,2 m','Ladder','los'],['t_has10','Kabelhaspel 10 m','Elektra','los'],['t_has75','Kabelhaspel 7,5 m','Elektra','los'],['t_cart','Opvouwbare steekwagen','Transport','los']
    ];
    for(const [id,name,category,location] of tools) await put('tools',{id,name,category,location,serial:'',purchaseDate:'',notes:''});
    for(let i=1;i<=4;i++) await put('tools',{id:'t_bat'+i,name:`Makita 18V 5,0Ah accu #${i}`,category:'Accu',location:i===1?'m_schroef':'los',serial:'',purchaseDate:'',notes:i===1?'Standaard in Mbox schroefmachines':'Vrij inzetbaar'});
    const checklists=[
      {id:'c_general',name:'Algemene klus',items:['Werkadres en contact controleren','Benodigde Mboxen selecteren','Accu’s opgeladen','PBM / veiligheidsmiddelen mee','Verlengkabel / haspel indien nodig','Foto vóór maken','Materiaal en bonnen registreren','Foto na maken','Werkplek schoon achterlaten','Uren stoppen en klus afronden']},
      {id:'c_kit',name:'Kitklus',items:['Juiste kit + voldoende kokers','Handkitspuit','Kitmes / afstrijkgereedschap','Ontvetter + doeken','Tape indien nodig','Stanleymes / mesjes','Handschoenen','Ondergrond schoon en droog','Foto vóór','Naden controleren en kitten','Foto na','Afval meenemen / opruimen']},
      {id:'c_elektra',name:'Elektra klein werk',items:['Spanning uitschakelen waar nodig','Multimeter / spanningzoeker','Elektra-organizer mee','WAGO’s / stekkers','Striptang / kniptang','Juiste schroevendraaiers','Werk controleren vóór inschakelen','Foto na']},
      {id:'c_timmer',name:'Timmer-/montageklus',items:['Maten / tekening controleren','DHP485 + DTD153','DHS680 / DJV181 indien nodig','Multitool indien nodig','Meetgereedschap / potlood','Bevestigingsmateriaal','Stofafzuiging / mondkap','Foto vóór','Eindcontrole','Foto na']}
    ];
    for(const c of checklists) await put('checklists',c);
    const settings=[
      {id:'company',companyName:'JK Works Dordrecht',owner:'Jeremy Korstanje',kor:true,korSince:'2026-10-01',defaultRate:'',notes:'Beschikbaar buiten kantooruren: avonden, weekenden en schoolvakanties.'},
      {id:'backup',lastBackup:null},
      {id:'seeded',at:new Date().toISOString()}
    ];
    for(const s of settings) await put('settings',s);
  }

  return {stores,open,all,get,put,remove,clear,id,seed};
})();
