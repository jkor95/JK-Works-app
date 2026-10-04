# JK Works Dordrecht - persoonlijke app (v3)

Deze versie is aangepast op jouw werkwijze op iPhone.

## Nieuw in v3

- JK Works-logo in de app en als app-icoon.
- Offertes en facturen worden rechtstreeks in de app gemaakt met de meegeleverde KOR-sjablonen.
- Per regel: **Aantal × Prijs p/st = Totaal** wordt automatisch berekend.
- **Totaal te betalen** wordt automatisch opgeteld en in de PDF ingevuld.
- Offerte- en factuurnummers lopen automatisch op: `OFF-2026-001`, `FAC-2026-001`, enz.
- Een opgeslagen offerte kan vanuit de app worden omgezet naar een factuur.
- Urenregistratie is nu handmatig: datum + van/tot + klus + notitie.
- Bij een factuur kun je geregistreerde uren selecteren. De app telt die uren op en maakt er één factuurregel van; het standaard uurtarief kun je instellen bij **Meer > Bedrijfsgegevens**.
- Materiaal is nu ingericht als **inpakchecklist** per Mbox/organizer/losse groep. Vink af tijdens inpakken en reset de lijst voor een volgende klus.
- De actuele volledige Mbox-/gereedschapsindeling is voorgevuld.
- Documenten zijn verdeeld in **Offertes**, **Facturen** en **Diversen**.
- Bestaande PDF's uit iCloud Drive kunnen nog steeds worden geïmporteerd.

## Bestaande online app bijwerken via GitHub

1. Maak in je huidige JK Works-app eerst een back-up via **Meer > Back-up & herstel** en bewaar die in iCloud Drive.
2. Pak `JK-Works-Dordrecht-App-v3.zip` uit op je MacBook.
3. Open op GitHub dezelfde repository waar je huidige JK Works-app in staat.
4. Kies **Add file > Upload files**.
5. Sleep **alle bestanden en mappen uit de uitgepakte map** naar GitHub. `index.html` moet dus rechtstreeks bovenaan de repository staan.
6. Kies **Commit changes**.
7. Wacht meestal 1-2 minuten tot GitHub Pages opnieuw gepubliceerd is.
8. Open de bestaande app-link één keer in Safari op je iPhone en ververs de pagina. Daarna kun je het beginscherm-icoon weer gebruiken.

Belangrijk: houd dezelfde GitHub Pages-URL/repository. Dan blijft de lokale browserdatabase normaal behouden. De back-up uit stap 1 is voor de zekerheid.

## Nieuwe installatie

Publiceer de map via GitHub Pages. Open daarna de GitHub Pages-link op de iPhone in Safari en kies **Deel > Zet op beginscherm**.

## Offerte of factuur maken

1. Open **Documenten**.
2. Tik op **+ Offerte** of **+ Factuur**.
3. Kies een bestaande klant of vul de klant handmatig in.
4. Vul per regel aantal, omschrijving en prijs per stuk in.
5. De regelbedragen en het totaal worden direct automatisch berekend.
6. Bij een factuur kun je eventueel geregistreerde uren aanvinken en met **Voeg geselecteerde uren toe** als factuurregel overnemen.
7. Tik op **Maak PDF**.
8. Open het document en kies **Delen / bewaar in iCloud** > **Bewaar in Bestanden** > jouw iCloud Drive-map.

De app gebruikt de meegeleverde PDF's:
- `templates/offerte-kor.pdf`
- `templates/factuur-kor.pdf`

Het huidige sjabloon heeft vier regels voor werkzaamheden/materialen. De app gebruikt daarom maximaal vier regels per offerte/factuur.

## Inpakchecklists

Ga naar **Materiaal > Inpakchecklists**. Open een Mbox, organizer of losse groep en vink ieder onderdeel af terwijl je inpakt. De status blijft bewaard. Gebruik **Reset checklist** voor een nieuwe klus.

## Urenregistratie

Ga naar **Meer > Urenregistratie > + Uren toevoegen**. Kies datum, begintijd en eindtijd. De app berekent de tijdsduur automatisch. Je kunt de registratie aan een klus koppelen.

## Back-up

De gegevens worden lokaal in de web-app op het apparaat opgeslagen. Maak daarom regelmatig via **Meer > Back-up & herstel** een volledige back-up en bewaar het `.jkbackup.json`-bestand in iCloud Drive.
