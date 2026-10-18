/* Compatibiliteit voor bestaande website-editorinhoud: handmatig aangepaste andere teksten blijven bewaard.
   Oude standaardteksten van kitwerk mogen het vernieuwde dienstenaanbod niet overschrijven. */
window.JKCopyCompat = Object.freeze({
  isLegacy(key, value) {
    const legacy = {
  "heroTitle1": [
    "Flexibele ondersteuning waar"
  ],
  "heroTitle2": [
    "extra handen nodig zijn."
  ],
  "heroCopy": [
    "Vooral inzetbaar als extra mankracht in catering en horeca, bij evenementen en andere ondersteunende werkzaamheden. Daarnaast ook beschikbaar voor kleine montage- en praktische klussen in en om huis. Beschikbaar buiten kantooruren in Dordrecht en omgeving.",
    "Inzetbaar als extra mankracht in catering en horeca, bij evenementen en andere ondersteunende werkzaamheden. \nOok beschikbaar voor kleine montage- en praktische klussen in en om huis. Beschikbaar buiten kantooruren in Dordrecht en omgeving.",
    "JK Works helpt bedrijven én particulieren in Dordrecht en omgeving. Van extra mankracht bij horeca, catering en evenementen tot montage, kleine klussen en afwerkwerk in woningen en bedrijfsruimtes. Vooral beschikbaar in de avonduren, weekenden en schoolvakanties."
  ],
  "heroCardTitle": [
    "Ondersteunen waar het nodig is."
  ],
  "heroCardText": [
    "Praktische hulp voor opdrachten in Dordrecht en omgeving."
  ],
  "servicesTitle": [
    "Ondersteuning staat voorop"
  ],
  "servicesIntro": [
    "JK Works is in de eerste plaats beschikbaar als flexibele extra kracht, met name in catering en horeca. ",
    "JK Works is in de eerste plaats beschikbaar als flexibele extra kracht, met name in catering en horeca. Daarnaast kun je ook terecht voor kleine, overzichtelijke montage- en praktische klussen.",
    "JK Works biedt extra mankracht voor bedrijven, horeca, catering en evenementen. Ook voor montage, kleine klussen en afwerkwerk bij particulieren en bedrijven kun je terecht."
  ],
  "service1Text": [
    "Flexibele inzet als extra mankracht bij catering, evenementen, feesten en andere horecawerkzaamheden. Denk aan op- en afbouw, uitgifte, bediening, voorbereiding en algemene ondersteuning."
  ],
  "service2Text": [
    "Een extra paar handen nodig voor een tijdelijke opdracht of druk moment? JK Works kan praktisch ondersteunen waar extra capaciteit nodig is."
  ],
  "service3Text": [
    "Overzichtelijke klussen zoals een schilderij of plank ophangen, iets monteren, afstellen, bevestigen of een kleine reparatie uitvoeren.",
    "Kleine klussen thuis, op kantoor of in een bedrijfsruimte: iets ophangen, monteren, afstellen of bevestigen en eenvoudige reparaties uitvoeren."
  ],
  "service4Text": [
    "Nette afwerking van onder andere plinten, naden en aansluitingen, passend bij de afgesproken klus.",
    "Plinten, naden en aansluitingen netjes afwerken in woningen, kantoren en andere werkruimtes, passend bij de opdracht en ondergrond."
  ],
  "service5Text": [
    "Ondersteuning bij montage, voorbereiding, stripwerk en hand- en spandiensten tijdens een verbouwing of renovatie."
  ],
  "service6Text": [
    "Staat je opdracht er niet tussen? Stuur een bericht. Kleine praktische klussen zijn welkom; volledig schilderwerk behoort in principe niet tot de diensten."
  ],
  "workflowIntro": [
    "Een eenvoudige aanpak, zodat vooraf duidelijk is wat er nodig is en wat je kunt verwachten."
  ],
  "aboutTitle": [
    "Persoonlijke hulp, zonder groot bedrijf eromheen."
  ],
  "aboutP1": [
    "Ik ben Jeremy Korstanje en ben JK Works Dordrecht gestart voor opdrachten waarbij flexibel extra hulp nodig is. De nadruk ligt op ondersteuning en inzet als extra mankracht, met daarnaast ruimte voor kleine praktische klussen en montage."
  ],
  "aboutP2": [
    "JK Works is vooral beschikbaar buiten reguliere kantooruren. Dat maakt het geschikt voor klussen die in de avond, in het weekend of tijdens schoolvakanties uitgevoerd kunnen worden."
  ],
  "contactTitle": [
    "Extra ondersteuning nodig?"
  ],
  "contactText": [
    "Stuur gerust een korte omschrijving van de opdracht, gewenste datum/tijden en wat voor ondersteuning je zoekt. Gaat het om een kleine klus, voeg dan eventueel een paar foto's toe. Dan kan ik snel aangeven of JK Works beschikbaar is."
  ],
  "service3Title": [
    "Kleine montage & klusjes"
  ],
  "service4Title": [
    "Kit- & afwerkwerk"
  ]
};
    if (typeof value !== 'string') return false;
    if ((key === 'service4Title' || key === 'service4Text') && /\bkit(?:ten|werk)?\b|plinten.*(?:naden|aansluitingen)/i.test(value)) return true;
    return Array.isArray(legacy[key]) && legacy[key].includes(value);
  }
});
