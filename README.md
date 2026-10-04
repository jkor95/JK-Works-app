# JK Works Dordrecht — persoonlijke PWA

Gratis, serverloze bedrijfsapp voor iPhone/Mac. De app gebruikt IndexedDB in de browser voor lokale opslag en kan als PWA op het iPhone-beginscherm worden geïnstalleerd.

## Functies
- Dashboard
- Klanten en klussen
- Checklists per klus
- Urenregistratie met timer
- Mboxen, organizers, gereedschap en accu's
- Eigen invulbare PDF-sjablonen importeren
- PDF-formuliervelden uitlezen en invullen
- Gegenereerde PDF's lokaal bewaren en via iOS delen / in iCloud Drive opslaan
- Bestaande offerte-/factuur-PDF's in bulk uit iCloud Drive importeren
- Volledige back-up inclusief PDF's en sjablonen naar één `.jkbackup.json` bestand
- Offline cache via service worker

## Belangrijk over iCloud
Safari/iOS geeft web-apps geen permanente schrijfrechten naar een willekeurige iCloud-map. Daarom genereert de app de PDF en opent hij de iOS-deelkaart. Kies daar `Bewaar in Bestanden` > iCloud Drive. Safari-downloads kunnen op de iPhone ook standaard naar iCloud Drive worden gezet.

## Publiceren (gratis)
De map kan ongewijzigd worden gepubliceerd op iedere HTTPS static host, bijvoorbeeld GitHub Pages, Cloudflare Pages of Netlify. HTTPS is nodig voor de service worker / volledige PWA-installatie.

## Lokaal testen op Mac
Open Terminal in deze map en start bijvoorbeeld:

    python3 -m http.server 8080

Open daarna http://localhost:8080 op de Mac. Voor installatie op de iPhone is een HTTPS-gepubliceerde versie aanbevolen.

## PDF-module
De app gebruikt `pdf-lib` 1.17.1 via jsDelivr. De service worker probeert deze bij de eerste online installatie te cachen, zodat PDF-invullen daarna ook offline kan werken.

## Privacy
Er is geen eigen server en geen analytics. Gegevens worden in de lokale browseropslag van de geïnstalleerde web-app bewaard. Maak regelmatig een back-up naar iCloud Drive.
