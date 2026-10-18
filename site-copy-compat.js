/* Herken uitsluitend verouderde standaardteksten in bewaarde website-inhoud.
   Handmatig aangepaste teksten blijven bewerkbaar en worden niet overschreven. */
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
    "Inzetbaar als extra mankracht in catering en horeca, bij evenementen en andere ondersteunende werkzaamheden. \nOok beschikbaar voor kleine montage- en praktische klussen in en om huis. Beschikbaar buiten kantooruren in Dordrecht en omgeving."
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
    "JK Works is in de eerste plaats beschikbaar als flexibele extra kracht, met name in catering en horeca. Daarnaast kun je ook terecht voor kleine, overzichtelijke montage- en praktische klussen."
  ],
  "service1Text": [
    "Flexibele inzet als extra mankracht bij catering, evenementen, feesten en andere horecawerkzaamheden. Denk aan op- en afbouw, uitgifte, bediening, voorbereiding en algemene ondersteuning."
  ],
  "service2Text": [
    "Een extra paar handen nodig voor een tijdelijke opdracht of druk moment? JK Works kan praktisch ondersteunen waar extra capaciteit nodig is."
  ],
  "service3Text": [
    "Overzichtelijke klussen zoals een schilderij of plank ophangen, iets monteren, afstellen, bevestigen of een kleine reparatie uitvoeren."
  ],
  "service4Text": [
    "Nette afwerking van onder andere plinten, naden en aansluitingen, passend bij de afgesproken klus."
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
  ]
};
    return typeof value === 'string' && Array.isArray(legacy[key]) && legacy[key].includes(value);
  }
});
