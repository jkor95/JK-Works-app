## v71.13.7 — statistieken tonen alleen eigen verdiensten, geen doorbelaste bonnetjes
- **Meer → Statistieken**: Ontvangen en Afgesproken tonen eigen werkzaamheden/opbrengsten **zonder expliciet voorgeschoten materiaal en doorbelaste extra kosten**. Zowel het bedrag bovenaan, de klant-/periode-rijen als de staafgrafiek gebruiken dezelfde gecorrigeerde waarden.
- **Expliciete kostenherkenning**: bedragen die bij een klus zijn ingevuld onder `extraAmount` en in factuurregels met `expenseId` of de omschrijving ‘Extra kosten / materiaal’. Dubbel vermelde kosten (zowel in de klus als op de factuur) worden niet tweemaal afgetrokken. Een los opgeslagen uitgave zonder doorbelasting wordt niet automatisch in mindering gebracht.
- Bij gedeeltelijke betalingen worden uitsluitend daadwerkelijk ontvangen bedragen aan eigen inkomsten toegerekend, met materialen als nog niet terugbetaalde kosten totdat de eigen werkzaamheden zijn voldaan. Ontvangsten blijven op hun werkelijke betaaldatum; geldige extra betaling boven het afgesproken totaal blijft onderdeel van de verdiensten. Ook losse, niet aan een klus gekoppelde facturen met bonregels worden gecorrigeerd.
- **Alle betalingsgegevens, factuurtotalen, openstaande bedragen, verzonden documenten, uitgaven en klantrecords blijven ongewijzigd**. Dit is uitsluitend een aparte interpretatie voor de persoonlijke inkomstenstatistieken; het is geen fiscale omzet- of winstberekening. Handmatig toegevoegde, niet herkenbaar als kosten gemarkeerde regels kunnen niet betrouwbaar automatisch worden onderscheiden.
- Geïsoleerde browserregressies controleren `€ 150` werkzaamheden + `€ 40` voorgeschoten kosten = `€ 190` ontvangen maar `€ 150` eigen verdiensten, met gespreide betaling, vaste prijzen, inbegrepen materialen, KOR-facturen, extra kosten en losse facturen. De eerdere statistiek- en appregressies blijven van kracht.
- **Herstelpunt:** laatst geverifieerde en gepubliceerde v71.13.6 op branch `recovery/2026-10-21-v71-13-6` commit `f99b0667f501419dcfa7a23bcd15655b4bbeece6`. Productiegegevens of Supabase-configuratie worden niet aangepast.

## v71.13.6 — staafgrafiek terug onder eenvoudige statistieken
- Onder de compacte getallenlijst van Meer → Statistieken staat weer een staafgrafiek met het bijbehorende bedrag of het aantal uren direct bij elke staaf.
- Per week, maand, kwartaal en jaar: één verticale balk per periode, met periode en waarde erbij; horizontaal schuifbaar op de iPhone. Per klant: compacte horizontale balken met klantnaam en exacte waarde.
- Grafiek volgt automatisch de al bestaande selectie Ontvangen / Afgesproken / Uren en de gekozen periode of klant/kalenderjaar. Ontvangen blijft de werkelijk geregistreerde ontvangst; er is geen dubbel tellen of omzetberekening gewijzigd.
- De eerder verwijderde zesdelige KPI-kaarten, btw, effectieve uurtarieven en gecombineerde uren/geldgrafieken komen niet terug. Geen wijzigingen aan gebruikers-, betaal-, uren-, klanten- of Supabase-gegevens.
- Uitbreiding van Playwright-statistiektests met waarden en schakelmomenten in de staafgrafiek; GitHub Actions, GitGuardian en Pages na PR te bevestigen.
- Herstelbranch voor de vooraf succesvol gepubliceerde v71.13.5: `recovery/2026-10-21-v71-13-5`, commit `69d7a3cf14a6167637841777a2009ae250c50ad0`. Echte iPhone/PWA visuele controle blijft aan gebruiker.

## v71.13.5 — overzichtelijke statistieken per klant en periode
- Meer → Statistieken toont voortaan één duidelijk bedrag per klant, week, maand, kwartaal of jaar, met één totaal erboven. Het standaardoverzicht toont werkelijk **ontvangen** bedragen op betaaldatum.
- Via een eenvoudige keuze **Ontvangen / Afgesproken / Uren** kun je ook de afgesproken klussom of gewerkte uren bekijken, zonder alle cijfers naast elkaar. Alleen periodes of klanten met activiteit binnen de gekozen maatstaf worden getoond; klanten sorteren op het geselecteerde bedrag.
- Overbodige zesdelige financiële kaarten, dubbele samenvattingen, extra grafieken, effectieve uurtarieven en btw-cijfers verdwijnen uit dit statistiekenscherm. Maand-, kwartaal- en klantberekeningen worden niet aangepast; bedragen met een ontbrekende betaaldatum worden indien aanwezig apart vermeld.
- Geen financiële berekeningen, betalingsregistraties, uren, documenten, klanten, IndexedDB of Supabase aangepast. Mobiele app-layout en andere schermen blijven intact.
- Playwright-regressies controleren de compacte standaardweergave, wisselen tussen klanten/perioden/maatstaven en bestaande inkomstenbedragen. GitHub Actions, GitGuardian en Pages-publicatie volgen de bestaande werkwijze.
- Herstelbranch van laatst bevestigde productieversie v71.13.4: `recovery/2026-10-21-v71-13-4` op `d952578d98adf0493eb315b2740d4945d4d26a4f`. Fysieke iPhone/browserprofiel en productiegegevens zijn niet rechtstreeks getest.

## v71.13.4 — iOS 27-systeemvervaging boven logo en knoppen
- iOS 27 kan in geïnstalleerde webapps zelf de bovenste schermzone vervagen wanneer `black-translucent` is ingeschakeld. Het extra CSS-blurfilter stond al uit; de compacte v71.13.3-bovenbalk kwam opnieuw in deze systeemzone.
- Alleen in de geïnstalleerde iPhone-webapp wordt de eerder op het echte toestel scherpe veilige bovenruimte uit v71.13.2 hersteld: `max(100px, safe-area-top + 44px)`; iOS-PWA modals behouden ook hun veilige marge (`max(112px, safe-area-top + 50px)`). Geen verandering aan openbare website, gewone Safari of desktop.
- CSS `-webkit-backdrop-filter:none` en `backdrop-filter:none` blijven ongewijzigd. De iOS statusbalkstijl blijft `black-translucent` om te voorkomen dat herinstallatie (met mogelijke lokale opslaggevolgen) noodzakelijk wordt.
- Playwright-tests op geïsoleerde iPhone-standalone, Safari, desktop, sticky scrollen en modals bijgewerkt. GitHub Actions, GitGuardian en Pages apart te verifiëren op de nieuwe commit. De echte iOS-systeemeffecten zijn alleen op de iPhone te beoordelen.
- Herstelbranch vorige versie: `recovery/2026-10-21-v71-13-3` op commit `975df8cae7acd50f051cb82104d428661ce53eb9`. Geen gebruikersgegevens, Supabase, betalingen of notificaties gewijzigd.

## v71.13.3 — iPhone-webapp bovenbalk compacter zonder wazigheid
- De bovenbalk van alleen de geïnstalleerde iPhone-webapp staat circa 25–30 CSS-pixels hoger dan in v71.13.2, zodat meer dashboard, klussen en documenten direct zichtbaar zijn. De minimale ruimte past zich aan de daadwerkelijke iOS-safe-area aan.
- De vaste, niet-transparante achtergrond en uitgeschakelde backdrop blur blijven behouden, zodat logo, titel, Sync en knoppen scherp en bereikbaar zijn, ook tijdens scrollen.
- Hoge modalvensters mogen iets meer schermhoogte gebruiken, maar blijven onder de iOS-statuszone.
- Geen wijziging aan normale Safari-weergave of openbare website. Geen wijzigingen aan Supabase, betaalgegevens, gebruikers, klussen of opslag.
- Bijgewerkte geautomatiseerde iPhone-standalone, Safari, desktop, scroll- en modaltests in de bestaande GitHub Actions-suite. Fysieke iOS-27-vervaging blijft visueel op het toestel te verifiëren.
- Laatst bevestigde werkende release: v71.13.2, herstelbranch `recovery/2026-10-21-v71-13-2` op commit `ae061246f6b8e7b09d459f47774681cb07fc8761`.

## v71.13.2 — iPhone-standalone app bovenbalk buiten wazige statuszone
- In de geïnstalleerde iPhone-webapp wordt de gedeelde sticky bovenbalk (logo, paginatitel, Sync, meldingen, knoppen) circa 25–35 px verder onder het iOS-statusgebied gezet. Ook bij scrollen blijven die knoppen onder het systeemgebied; de PWA-bovenbalk krijgt geen eigen blurfilter meer.
- Hoge modalvensters krijgen in de iOS-webapp een veilige maximale hoogte, zodat de titel en sluitknop niet onder de wazige statusbalk vallen.
- Detectie uitsluitend voor geïnstalleerde iOS-webapp; normale Safari-versie, openbare website, Mac/desktop en andere platformen blijven gelijk. Geen database-, gebruikers-, betalings-, notificatie- of Supabase-wijzigingen.
- Nieuwe Playwright-regressies simuleren iPhone-standalone én gewone Safari en desktop, met scroll- en modalcontrole. `node scripts/check.cjs`, GitGuardian en Pages op de actuele commit te verifiëren voordat als gepubliceerd wordt gemeld.
- Herstelbranch van laatst succesvol gepubliceerde v71.13.1: `recovery/2026-10-21-v71-13-1` op `6acb0151dbae5f649a4841ec9d8d318173772c5e`. Fysieke iPhone/iOS 27-weergave is niet rechtstreeks te simuleren; laatste visuele controle op het toestel blijft gewenst.

## v71.13.1 — overbodige gele uitlegkaarten verwijderd
- Grote gele uitlegblokken verwijderd uit klusfoto’s, Documenten → Klusfoto’s, materiaal-inpaklijsten, kluschecklists en gereedschapsregister. Ook het gele succesbericht bij uitgelezen PDF’s verdwijnt. Lege toestanden worden compact en neutraal getoond.
- Overbodige begeleidende teksten onder klusfoto’s en bonnetjes weggehaald; knoppen voor foto’s, bonnetjes, checklists en register blijven werken.
- Echte meldingen over verplichte klusfoto’s, achterstallige facturen, back-upherinneringen, herstelbeveiliging en PDF-leesfouten blijven beschikbaar, zonder de oude gele uitlegstijl.
- Geen wijzigingen aan klussen, betalingen, uren, Supabase of opgeslagen gegevens. App-cacheversie bijgewerkt. Nieuwe regressiecontrole voorkomt dat vaste uitlegkaarten ongemerkt terugkeren.
- Controles: `node scripts/check.cjs` (inclusief browserfixtures, PDF-/PWA-tests en regressies) en GitGuardian op de PR-commit vereist. Fysieke iPhone, ingelogde productie-Supabase en live UI alleen beperkt controleerbaar.
- Herstelpunt: branch `recovery/2026-10-21-v71-13-0` op laatst succesvol gepubliceerde commit `727418b23df6c00e5bc6aaa42b0c708de048fd95` (er was nog geen geannoteerde v71.13.0-tag beschikbaar); oudere tag `v71.12.3` behouden.

## v71.13.0 — compact betalingenoverzicht en afronden van betaalverschillen
- Klusdetail toont gewerkt, afgesproken, daadwerkelijk ontvangen en nog te ontvangen; overige financiële afgeleiden blijven in statistieken. Geen btw-uitleg in het compacte KOR-klusscherm.
- Bij een deelbetaling kan een restbedrag expliciet en omkeerbaar als afrondingsverschil worden afgeboekt. Het openstaande saldo kan dan nul zijn zonder fictieve ontvangst; ontvangen blijft het echte ontvangen bedrag. Gekoppelde facturen en losse facturen delen deze logica.
- Rode tegel Openstaand bedrag is een aanklikbaar filter op afgeronde klussen met openstaande bedragen, met het exacte restant in de kluslijst; open losse facturen blijven zichtbaar. Alles tonen herstelt de volledige lijst.
- Geen database-/schemawijziging, geen herschrijving van bestaande uren, documenten of betalingen. Afboekingen staan als afzonderlijke gesynchroniseerde settings-records. Gerichte pure en browserfixture-regressies toegevoegd voor betalen/afronden/terugdraaien en het filter.
- **Beperking:** fysieke iPhone-/Mac-tests, echte ingelogde sync, GitGuardian en Pages-publicatiestatus moeten nog apart worden gecontroleerd vóór samenvoegen. Dit is een voorbereidende PR, nog niet gepubliceerd.

## v71.12.3 — gecentreerd openstaand en totalen van ontvangen betalingen
- Openstaand bedrag staat gecentreerd op een eigen rij met rode tekst en lichtrode achtergrond. Totaal contant en Totaal factuur blijven wit op de rij eronder, op mobiel en desktop.
- De kleine toelichting onder de drie totalen is verwijderd. Totaal contant en Totaal factuur bevatten uitsluitend werkelijk ontvangen bedragen, verdeeld naar de klusafhandeling. Onbetaalde prijsafspraken tellen niet mee, deelbetalingen alleen voor de ontvangen som. Gekoppelde facturen tellen niet dubbel; losse factuurontvangsten tellen bij factuur. Bestaande gegevens blijven behouden.
- Volledige lokale browsersuite en gerichte controles voor onbetaald/deels/betaald, contant/factuur, gedeelde factuurbetalingen, losse facturen en het wijzigen/verwijderen van betalingen. Centrering, kleuren en verwijderde toelichting op 390 en 1024 px gecontroleerd. Fictieve gegevens; geen fysieke iPhone/Mac-test.
- App-/cacheversie vernieuwd. Herstelpunt: geannoteerde tag v71.12.2 op 613a1737020f3bd7ef3f0b2a4949330dbc6d33af, bevestigd als succesvolle Pages-publicatie via main / met jkworks.nl. Geen database-/schemawijzigingen.

## v71.12.2 — drie klustotalen en openstaand pas na afronding
- Compacte totalen Openstaand bedrag, Totaal contant en Totaal factuur terug boven Klussen. Contant/factuur volgen de afgesproken klusbedragen; de rest van de uitgebreide statistieken blijft in details.
- Een klus telt pas mee als openstaand na expliciete status afgerond én na alle werkdagen/eindtijden. Zelfde berekening voor dashboard, klustotaal, betaalbadge, klusdetails en klantgeschiedenis. Een toekomstige dag toevoegen of de klus heropenen sluit het bedrag opnieuw uit.
- Prijsafspraak, referentie-urenwaarde, ontvangen betalingen en facturen blijven behouden. Nog af te rekenen na afronding blijft afzonderlijk zichtbaar; nul openstaand betekent niet automatisch betaald. Gekoppelde facturen tellen niet dubbel mee; facturen zonder klus behouden hun eigen saldo.
- Tijdgrenzen in Europe/Amsterdam, inclusief nachtwerk en datumloze bestaande klussen. Zonder geplande tijden telt een werkdag pas na middernacht als voorbij. Geen gegevensmigratie of herschrijving van bestaande uren/betalingen.
- Volledige lokale browsersuite met fictieve gegevens en gerichte regressies voor status-/tijdvoorwaarden, meerdere dagen, nachtwerk, herplannen, deelbetalingen, de drie totalen, filters en behoud van gegevens. Geen fysieke iPhone/Mac-test of echte productiesynchronisatie.
- Versie/cache vernieuwd. Herstelpunt v71.12.1 op 8a367c79e6951d971bd1bce4b484713f281e9229, bevestigd als succesvolle Pages-publicatie via main / en jkworks.nl.

## v71.12.1 — betaalbadge bij toekomstige werkdagen en duidelijke uitlijning
- Klussen met nog geplande toekomstige/lopende werkdagen krijgen geen rode rij of ‘Nog te ontvangen’-badge, ook als een extra werkdag later is toegevoegd. Alle werkdagen worden gecontroleerd, inclusief nachtwerk; het financiële saldo en de gekozen klusstatus blijven behouden.
- De statusbadge open/gepland/afgerond staat rechts naast de klusomschrijving, ook op mobiel. Een eventuele betaalbadge staat eronder.
- Meer ruimte tussen de aankomende/huidige klus en ‘Snel openen’ op het dashboard.
- Gerichte browserregressies voor datumwijziging, extra toekomstige werkdag, tijdgrenzen/nachtwerk, betaalbehoud, mobiele/desktopuitlijning en dashboardafstand; volledige bestaande suite met fictieve gegevens. Geen productiegegevens gewijzigd tijdens tests; geen fysieke iPhone/Mac-test.
- App-/cacheversie vernieuwd. Herstelpunt: geannoteerde tag v71.12.0 op 6a68dfefef0a8916a159df3511abc121032ce5c3, bevestigd als succesvolle Pages-publicatie via main / op jkworks.nl. Geen database-/schemawijzigingen.

## v71.12.0 — eenvoudige ureninvoer, compacte overzichten en één klusfotomap
- Eén formulier ‘Uren & bedrag’ vanuit een klus: meerdere gewerkte dagen met tijden en pauzes invoeren, kiezen tussen gewerkte uren × uurtarief of een vast bedrag, vervolgens extra kosten en direct het totaal zien. Inbegrepen kosten bij een vaste prijs blijven ondersteund.
- Alleen expliciet ingevoerde werkelijke uren worden opgeslagen. Planning wordt niet overgenomen. Bestaande ongewijzigde uren en bevestigingsvlaggen blijven exact behouden; oude onbevestigde registraties vereisen een expliciet vinkje. Prijswijzigingen herschrijven geen bestaande facturen of betalingen.
- Gewijzigde uren en klusbedrag worden lokaal samen opgeslagen in één gecontroleerde IndexedDB-transactie. Gelijktijdige wijzigingen of een conflicterend uren-ID breken de hele opslag af. De bestaande synchronisatie verwerkt alleen daadwerkelijk gewijzigde records; geen schemawijziging of migratie.
- De zes financiële statistiekkaarten zijn verwijderd van het dashboard. Klusrijen tonen alleen omschrijving, klant, datum/tijden en compacte statusmeldingen. Uitgebreide cijfers blijven in klusdetails en Urenstatistieken beschikbaar.
- Eén fotomap per klus en één uploadknop voor meerdere foto’s uit de fotorol. Na upload optioneel per foto indelen als vóór/tijdens/na, of niet ingedeeld laten. Ook Documenten toont alle foto’s per klus samen; bestaande categorieën, foto-ID’s, compressie, synchronisatie en back-up blijven behouden. Bestaande expliciet verplichte fotochecklists blijven van toepassing.
- Regressies voor multi-upload, optionele indeling, behoud van oude foto’s, gedeelde verwijdering via Documenten, mobiele weergave en back-upformaat. Regressies voor de volledige eenvoudige invoer, 17 uur / €170 urenwaarde / €150 vaste prijs, extra kosten, directe totalen, dubbel opslaan, behoud van bevestigde/onbevestigde uren en afbreken bij conflicten; de bestaande volledige suite inclusief PDF's, betalingen, syncformaat en back-up/herstel wordt uitgevoerd met fictieve data.
- App-/cacheversie vernieuwd. Herstelpunt: geannoteerde tag v71.11.0 op 3afe3f9e3c2dee071a1a62375c569f693c1677b7, bevestigd als succesvolle Pages-publicatie op jkworks.nl. Geen productiegegevens gewijzigd tijdens tests; fysieke iPhone/Mac-test niet uitgevoerd.

## v71.11.0 — flexibele prijsafspraken en gekoppelde financiële statistieken
- Klussen ondersteunen uurbasis, vaste prijs en een later handmatig definitief bedrag. Werkelijke uren, referentietarief, berekende urenwaarde en afgesproken bedrag blijven onafhankelijk; extra kosten kunnen inbegrepen zijn of erbovenop komen.
- Gedeelde betalingsregistratie vanuit klus en gekoppelde factuur met deelbetalingen, betaaldatum en betaalwijze. Eén record per betaling voorkomt dubbele ontvangst; betaald-status volgt de bedragen. Algemene klusbetalingen worden eenmaal over open gekoppelde facturen verdeeld.
- Klusdetails en klussenoverzicht tonen de financiële uitsplitsing en effectieve afgesproken/ontvangen uurtarieven. Dashboard, klantgeschiedenis, week/maand/kwartaal/jaar- en klantstatistieken onderscheiden afgesproken, gefactureerd en ontvangen. Vaste boekingsdatums en aparte vermelding van historische ontvangsten zonder bekende datum; PDF-jaaroverzicht rekent met werkelijke deelbetalingen.
- Nieuwe facturen/offertes bij vaste prijs gebruiken één inhoudelijke arbeidsregel (1 × afgesproken bedrag), met eventuele extra kosten apart. Uurbasis blijft werkelijke uren gebruiken op facturen en geplande uren op offertes. Werkzaamhedenherkenning, eigen regels, vier PDF-sjablonen, KOR en 21% btw blijven behouden. Bestaande facturen veranderen niet mee.
- Geen schema-, RLS-, database- of IndexedDB-migraties en geen herschrijving van bevestigde uren. Bestaande klussen blijven standaard uurbasis. Historische betaald-vinkjes blijven zonder verzonnen betaaldatum herkenbaar; bedragen worden vóór relevante prijs-/urenwijzigingen vastgelegd. Betalingen gebruiken afzonderlijke bestaande gesynchroniseerde settings-records en gaan mee in de bestaande back-up/herstelroute.
- Controles: alle bestaande regressies en nieuwe fictieve reken-/browsertests voor de gevraagde scenario's, daadwerkelijke PDF-generatie voor KOR/normaal en factuur/offerte, tweerichtingsbetalingen, koppelen/ontkoppelen, klant/maand/jaar, behoud van bevestigde uren, syncformaat en daadwerkelijk lokaal back-up/herstel. Geen productiegegevens gewijzigd tijdens tests. Echte iPhone/Mac-sessie en productiesynchronisatie zijn niet getest; er is geen productieback-up of -herstel uitgevoerd.
- Herstelpunt vóór wijziging: geannoteerde tag v71.10.0 op 4a9b49edf41e6dfaa06cd8440b6d250b55754233, bevestigd als succesvolle Pages-publicatie via main / en jkworks.nl. App-/cacheversie bijgewerkt. Zie docs/FINANCIEN.md voor reken- en boekingsregels.

## v71.10.0 — meerdaagse klussen en werkelijke totaaluren
- Eén klus met meerdere zelfgekozen, niet-aaneengesloten werkdagen. Planning toevoegen, wijzigen en verwijderen; bestaande eendaagse klussen blijven leesbaar zonder migratie.
- Werkdagen & uren toont planning en de bestaande urenregistratie naast elkaar: werkelijke begin-/eindtijd, pauze, notitie en netto uren. Beide schermen bewerken dezelfde records; stabiele dag-ID’s voorkomen dubbele nieuwe registraties. Verwijderen van planning wist geen werkelijke uren.
- Planning maakt geen gewerkte uren meer aan en overschrijft handmatige uren niet. Eerder automatisch uit planning aangemaakte uren blijven bewaard en zichtbaar als ‘nog te bevestigen’; ze tellen pas mee na expliciet opslaan van de werkelijke uren.
- Totaal geplande en werkelijke uren, arbeid tegen klustarief en extra bedrag/materiaal blijven apart zichtbaar. Gekoppelde bonnetjes blijven een apart inkoopoverzicht zodat materiaal niet dubbel wordt opgeteld.
- Factuur krijgt standaard één samengevoegde regel met werkelijke netto uren en klustarief; ook bij omzetten van een offerte. Offertes gebruiken duidelijk benoemde geplande uren. Omschrijving, uren en tarief blijven aanpasbaar; werkzaamhedenherkenning, KOR en gewone btw blijven behouden.
- Dashboard houdt rekening met iedere plandag; klussenoverzicht blijft één rij per klus. Google Agenda per werkdag en ICS voor alle werkdagen. Urenactie na iedere nog niet geregistreerde werkdag; definitieve afronding van moderne klussen uitsluitend via de handmatige status.
- Bestaande jk-push-controle aangepast voor werkdagen; geen nieuwe tabellen, schema, toegangsrechten, secrets of Edge Functions. Handmatige deployment stopt bij afwijkende live bron en kan voor deze release geen ontbrekende tabel aanmaken. Bestaande automatische back-upplanning blijft ongemoeid.
- Nieuwe fictieve browser-/IndexedDB-tests voor CRUD, vijf losse dagen, bestaande klussen, pauzes/nachtwerk, beide bewerkingsroutes, totalen, factuur/offerte/btw, ICS, herinneringen, statistieken en het syncformaat tussen geïsoleerde browserprofielen. Ook alle bestaande regressietests worden uitgevoerd. Echte gebruikerssessies, apparaat-sync en iPhone-agenda/push niet met productiegegevens getest.
- Serviceworker-cache/appversie vernieuwd. Herstelpunt vóór wijzigingen: recovery-2026-10-19-v71.9.1 op 570bd738e2fe57df6b246dbd1ad17d71b1c9a4b7, bevestigd als succesvolle Pages-versie.

## v71.9.1 — uitgestelde acties tonen herkenbare klus of document
- Onder Meldingen → Uitgestelde acties verschijnen voortaan Nederlandse actietitels zoals 'Offerte opmaken' of 'Factuur versturen' in plaats van interne codes zoals 'quoteCreate'.
- Bij een klus toont het overzicht waar mogelijk zowel de werknaam als de klant en de datum. Bij een offerte, factuur of betaalherinnering wordt het documentnummer of de bestandsnaam getoond.
- Ook wanneer een actie niet meer actief is, verschijnt een begrijpelijke omschrijving in plaats van de technische sleutel.
- Alleen presentatie van het overzicht is gewijzigd. Bestaande snoozes, uitsteltijden, pushmeldingen, rode badges, klantgegevens en Supabase blijven ongewijzigd.
- Browserregressietest voor een uitgestelde klus en een document, plus een nieuwe app-cacheversie.

## v71.9.0 — alle actieherinneringen uitstellen en offerte-na-edit melden
- Elke actie in Acties heeft nu een Uitstellen-knop met 1 uur, 12 uur, 7 dagen, 14 dagen en 1 kalendermaand.
- Tijdens het uitstel verdwijnen actie en appicoon-badge; bij verlopen uitstel wordt de actie opnieuw zichtbaar. Onder Meldingsinstellingen kun je uitgestelde acties eerder herstellen.
- Uitstel wordt centraal door de ingelogde Supabase Edge Function opgeslagen. De server controleert de bestaande geautoriseerde pushplanning nu elke 5 minuten en verstuurt de herhaal-push ook wanneer de PWA is gesloten (mits push op het toestel aanstaat en het toestel bereikbaar is).
- Offerte nodig levert ook bij afgeronde klussen een actie op; later opnieuw aanvinken verwijdert oude afwijzingen en probeert direct een pushmelding naar je eigen apparaten te versturen.
- Uitstel-API valideert actietype en gebruikersidentiteit; snoozegegevens in Supabase zijn met RLS afgesloten van publieke gebruikers en lopen uitsluitend via de beveiligde functie.
- Regressietests voor alle uitsteltijden, badgeonderdrukking, iPhone-layout, push en offerteacties. Back-up/herstel, overige documenten en klantdata zijn niet veranderd.
- Technische beperking: pushlevering hangt af van webpush-toestemming, browser/iOS en bereikbaarheid; serverplanning heeft maximaal vijf minuten wachttijd na afloop van het uitstel.

## v71.8.9 — bedienbare bovenrand in iPhone-webapp
- De schermvullende website-editor houdt voortaan alleen in de geïnstalleerde standalone webapp rekening met de veilige iOS-statusbalkruimte (ook bij dynamische inkepingen).
- De bovenste editorbediening blijft hierdoor onder de klok/statusindicatoren bereikbaar. De openbare website en gewone Safari-weergave krijgen geen extra ruimte.
- Script- en CSS-cacheversies en de service-worker-cache vernieuwd, zodat de geïnstalleerde app de aanpassing ophaalt.
- Regressietests voor standalone-herkenning en safe-area-styling toegevoegd; geen wijzigingen aan Supabase, ingevoerde teksten, aanvragen of bedrijfsapp-functies.
- Beperking: iOS-installatie en daadwerkelijke statusbalkhit-testing moeten na publicatie op een echte iPhone gecontroleerd worden.

## v71.8.8 — website-editor toont voortaan actuele homepage-teksten
- De ingelogde website-editor haalt voortaan standaardteksten rechtstreeks uit de huidige HTML van de homepage, niet uit oude teksten in de database.
- Oude opgeslagen standaardteksten worden in de editor genegeerd (zoals vroegere koppen en het verwijderde kitwerk); eigen tekstwijzigingen blijven behouden.
- Alleen eigen tekstafwijkingen worden gepubliceerd. Een niet-aangepaste tekst blijft gekoppeld aan de website-standaard, zodat latere websitewijzigingen automatisch in de editor te zien zijn.
- De iframe-preview laadt geen oude cloudinhoud over het voorbeeld heen; daardoor blijven preview en invulvelden gelijk.
- Versienummers voor de editor en de preview vernieuwd en PWA-cache bijgewerkt. Extra regressietests toegevoegd.
- Geen wijziging aan productie-Supabase, bestaande klantgegevens, website-aanvragen, autorisaties of betaalverwerking.

## v71.8.7 — Instagram bij Contact
- Instagram toegevoegd aan de contactknoppen op de openbare homepage met herkenbaar icoon en de zichtbare gebruikersnaam @jkworksdordrecht (geen lange URL).
- De HTTPS-profielkoppeling maakt gebruik van de normale app-/webkoppeling van het toestel: als Instagram app-links ondersteunt en dat toestel ze toelaat, opent de app; anders de website.
- Instagram-profiel is ook gekoppeld in LocalBusiness structured data via sameAs.
- Geen wijzigingen aan bedrijfsapp, Supabase, aanvraagverwerking, betalingen, publieke website-editor of andere pagina's.
- Regressietest voor contactknop, label, pictogram, HTTPS-doel en JSON-LD.

## v71.8.6 — diensten met links eerst en KOR in footer
- Dienstkaarten op de homepage gesorteerd: Catering & horeca, Kleine klussen, Meubels & montage, Verbouwing & demontage, Extra ondersteuning, Andere praktische hulp.
- De vier kaarten met een detailpagina staan bovenaan, de twee zonder link onderaan. Bestaande teksten, links en website-editor zijn ongewijzigd.
- Footer vermeldt dat JK Works deelneemt aan de kleineondernemersregeling (KOR), een btw-vrijstelling, en daarom geen btw in rekening brengt.
- Regresstest toegevoegd voor kaartvolgorde, linkverdeling en KOR-footer. Geen wijzigingen aan Supabase, interne app of klantgegevens.

## v71.8.5 — minder herhaling op homepage
- De doelgroep (bedrijven én particulieren) staat duidelijk in de hoofdtitel en wordt niet langer in vrijwel elke sectie herhaald.
- Hero, dienstenintro, zes dienstkaarten, persoonlijke introductie, aanvraagblok en contactblok zijn compacter en elk inhoudelijk verschillend gemaakt.
- Horeca, catering, montage en verbouwingshulp blijven herkenbaar en via eigen dienstenpagina's vindbaar; kitwerk keert niet terug in het aanbod.
- Bestaande website-editor bewaart eigen teksten; eerdere standaardteksten worden herkend zodat de verkorte versie zichtbaar blijft.
- Alle bestaande website- en appfuncties blijven ongewijzigd. Controle op herhaling toegevoegd aan SEO-regressietests.

## v71.8.4 — kitwerk niet langer als dienst aangeboden
- Kitwerk verwijderd uit homepage, meta-omschrijvingen, zoekmachinegegevens, dienstenkaarten en het opdrachtformulier. Andere losse klusvragen blijven mogelijk via de algemene aanvraag.
- Dienstkaart 'Meubels & montage' en nieuwe openbare /montage/-pagina met montagehulp voor bedrijven en particulieren; de oude /montage-kitwerk/-pagina verwijst naar /montage/ en is niet indexeerbaar.
- Interne links en sitemap verwijzen nu naar /montage/; bestaande bedrijfsapp, klantdata en aanvraagverwerking blijven ongewijzigd.
- Website-editorcompatibiliteit voorkomt dat oude opgeslagen kitwerk-teksten terugkeren, terwijl andere handmatig bewerkte teksten behouden blijven.
- Regressietests uitgebreid voor zichtbare inhoud, sitemap, canonicals, aanvraagcategorie en oude URL.

## v71.8.3 — teksten voor particulieren én bedrijven
- Homepage, dienstenkaarten, aanvraagteksten en vier SEO-dienstenpagina's presenteren JK Works voor zowel particulieren als zakelijke opdrachtgevers.
- SEO-omschrijvingen, sociale metadata en lokale bedrijfsomschrijving aangepast zonder wijzigingen aan domein of routes.
- Verouderde standaardteksten uit de website-editor worden in de browser genegeerd zodat de nieuwe teksten zichtbaar zijn; eigen afwijkende teksten van de eigenaar blijven behouden.
- Geen wijzigingen aan productie-Supabase, bedrijfsapp, inlogroutes, klantdata, aanvraagverwerking of betaalinstellingen.
- Extra regressiecontrole voor beide klantgroepen en compatibiliteit met website-editor. Google-indexering kan opnieuw tijd kosten.

## v71.8.2 — lokale SEO JK Works (voorstel)
- Vier zelfstandige, indexeerbare dienstenpagina's voor horeca/catering, kleine klussen, montage en kitwerk, en praktische ondersteuning bij verbouwen. Elke pagina heeft eigen titel, meta-omschrijving, canonical, sociale metadata, Service/BreadcrumbList-gegevens, originele beschrijving en interne navigatie.
- Links vanuit de bestaande dienstkaarten, mobiele menu's en gerelateerde diensten, zonder wijzigingen aan de publieke aanvraaglogica, Supabase, bedrijfsapp of de bewerkbare homepage-inhoud.
- Sitemap uitgebreid met de vier openbare URL's; app- en inlogroutes blijven uitgesloten van robots en sitemap.
- Styling sluit aan op bestaande website. Validatie: bronstructuur, canonicals, robots- en sitemapdekking; GitHub PR- en GitGuardian-controles volgen.
- Beperking: indexering en posities in Google worden niet gegarandeerd; publieke Pages-publicatie pas na succesvolle checks.

## v71.8.1 — handmatige testpush met serververtraging
- Meer → Meldingen → Echte pushmeldingen krijgt ‘Test pushmelding versturen’. De bestaande gebruikerssessie vraagt uitsluitend een test naar de eigen geregistreerde apparaten aan.
- Supabase plant de test circa 30 seconden later via EdgeRuntime.waitUntil; geen browsertimer, open app of actieve iPhone nodig na de bevestiging. Titel ‘JK Works – Testmelding’, bericht ‘Je pushmeldingen werken! ✅’.
- Afzonderlijk register met unieke aanvraagcodes en atomische claim vóór verzending voorkomt dubbele verzending per druk. Bij een onzekere transportuitkomst wordt niet opnieuw verzonden. Alleen de service role heeft toegang; geen wijziging aan bestaande bedrijfsgegevens, automatische meldingsstatus of klantaanvragen.
- De eigenaar heeft uitsluitend de nieuwe tabel jk_push_test_requests afzonderlijk goedgekeurd. Deployment via een handmatige GitHub Actions-job is geslaagd; repository-secret SUPABASE_ACCESS_TOKEN blijft afgeschermd. Live bronvergelijking, commit-/GitGuardian-controle en hash van exact goedgekeurde SQL beschermen de uitrol. Bestaande VAPID-secrets en functie-JWT/webhookconfiguratie blijven behouden. Op 14 oktober 2026 is jk-push versie 7 uitgerold en de live bron is gelijk aan de beoordeelde code (Actions-run 38640155298). De nieuwe tabel en RLS/toegangsafscherming zijn gecontroleerd. De echte iPhone-test is nog niet uitgevoerd.
- Geïsoleerde tests voor authenticatie, eigen apparaten, serververtraging, dubbele aanvragen/tikken, verzending na achtergrond-wachtperiode, veilige foutmeldingen, bestaande webhook/planning en serviceworker. Alle bestaande appregressies worden uitgevoerd; productie krijgt geen testmelding.
- Serviceworker-cache en appversie bijgewerkt. Herstelpunt: recovery-2026-10-14-v71.8.0 op 07793fedac41427abd70f747a21df17c50261ad3, bevestigd als succesvolle Pages-publicatie.

## v71.8.0 — achtergrondpush voor bestaande meldingscategorieën (voorbereid)
- Zeven bestaande actie-/herinneringscategorieën kunnen via een geplande Supabase-controle pushmeldingen verzenden naar ingeschreven apparaten.
- Eerste servercontrole legt bestaande openstaande acties vast zonder oude achterstand ineens te versturen; per actie volgt een melding wanneer deze nieuw ontstaat. Status wordt na verdwijnen teruggezet.
- Bestaande categorievoorkeuren en weggeklikte acties worden uit gesynchroniseerde cloudgegevens gelezen. Lokale niet-gesynchroniseerde wijzigingen zijn niet zichtbaar op de server.
- Afzonderlijke beveiligde statusregistraties; geen wijzigingen aan bestaande bedrijfsgegevens. Websiteaanvraag-push blijft behouden.
- Beperking: servercontrole moet worden gepland en Edge Function moet worden uitgerold; daadwerkelijke iPhone-end-to-end-test is nog niet uitgevoerd.

# Wijzigingsgeschiedenis

## v71.7.0 — voorbereide echte Web Push (nog niet geactiveerd)
- Nieuwe Push-instellingen per apparaat; Push API-abonnement via ingelogde Supabase Edge Function, achtergrondmelding in serviceworker.
- Voorbereide beveiligde Edge Function, SQL-tabel en webhook voor nieuwe websiteaanvragen. Geen geheime sleutels in repository.
- Niet actief vóór afzonderlijk goedgekeurde Supabase-migratie, secrets, functie-deployment en database-webhook. Geen wijzigingen aan bestaande data of betalingslogica.
- Controles: JavaScript-syntax en statische bestandsintegratie; echte iOS-push, Supabase, ingelogde regressies en Pages-publicatie nog niet geverifieerd.


## v71.6.1 — bonnetjes zichtbaar en te openen in klusdetails
- Klusdetails tonen nu een apart onderdeel ‘Bonnetjes & uitgaven’ met aantal, totaal aan inkoopuitgaven en de gekoppelde bonnetjes per leverancier, datum en bedrag. Bij fotobonnen verschijnt een miniatuur; bij PDF-bonnen een documentpictogram. Dit is alleen een intern overzicht en verandert het klusbedrag niet.
- Tik op een gekoppeld bonnetje om de foto of PDF in de bestaande uitgavendetailweergave te bekijken en de uitgave te bewerken. Bonbestanden en bestaande koppelingen blijven ongewijzigd.
- ‘Bonnetje toevoegen’ opent het bestaande bonformulier, met de huidige klus al geselecteerd. Na opslaan ga je terug naar de klus; ‘Alle bonnetjes’ gaat naar de map Documenten → Inkoop & bonnetjes.
- Ook na bewerken/verwijderen via een klus keert de weergave terug naar de klus. Geen wijziging aan bestaande factuur- of btw-logica, database- of Supabase-schema.
- Fictieve regressietests voor klusspecifieke selectie, uitgaven zonder gekoppelde klus, PDF-weergave en beide navigatieknoppen. Ingelogde productiegegevens en handmatige Sync op andere apparaten zijn niet getest.
- Herstelbranch: `recovery/v71-6-0-before-job-receipts` op `c70f9c136150a7b2f5d1336a76f29c898d0985f8`.


## v71.6.0 — bonnetjes koppelen aan klussen en toevoegen aan facturen
- In Documenten → Inkoop & bonnetjes kan een bonfoto of PDF bij het invoeren of bewerken aan een bestaande klus worden gekoppeld. De gekoppelde klus staat in lijst/detail. Bestaande uitgaven blijven intact.
- Bij een nieuwe factuur selecteer je de aan de gekozen klus gekoppelde, nog niet gefactureerde bonnetjes. De app vult voor ieder geselecteerd bonnetje een lege factuurregel met aantal 1, omschrijving, winkel, bondatum en bedrag. Werkuren en eigen regels blijven behouden. Bonbestanden blijven uitsluitend intern en worden niet met de factuur meegestuurd.
- De factuursjablonen bevatten maximaal 4 regels. Bij onvoldoende plaats verschijnt een waarschuwing; overschrijven van bestaande regels is uitgesloten. De bron-uitgave-ID blijft vastgelegd in de factuurmetadata en eerder gefactureerde bonnetjes worden niet opnieuw selecteerbaar.
- Voor KOR is het voorgestelde factuurbedrag gelijk aan het bonbedrag incl. btw. Voor normale facturen wordt het voorgestelde bedrag omgerekend naar een prijs excl. 21% btw; de gebruiker moet de prijs en btw altijd controleren. Bij een gewijzigde KOR-keuze worden uitsluitend automatisch ingevulde bonprijzen herberekend.
- Geen automatische uitlezing/OCR van foto's, geen Supabase-schemawijziging, geen productiedatamigratie en geen wijzigingen aan bestaande facturen of back-ups. Handmatige Sync tussen apparaten blijft vereist.
- Fictieve regressietests geïntegreerd in de reguliere controles. Herstelbranch: `recovery/v71-5-4-before-receipts` op `772f25485cbe3aa6905661a91b3a188fe7530bab`.


## v71.5.4 — herstel tweerichtingskoppeling betaalstatus
- De eerdere fix werkte alleen van factuur naar klus bij een exact opgeslagen `meta.jobId`. De klusbewerker werkte de facturen helemaal niet bij.
- Wijzig je in Klussen > Bewerken de betaalstatus en sla je op, dan worden alle expliciet gekoppelde facturen mee op betaald of onbetaald gezet. Bij een wijziging aan een individuele factuur wordt de klus alleen betaald zodra al haar gekoppelde facturen betaald zijn.
- Facturen tonen nu hun gekoppelde klus in een keuzelijst, inclusief een optie om een eerder geïmporteerde PDF expliciet aan een bestaande klus te koppelen. Nooit automatisch raden op datum of klantnaam. Oude `jobId`-velden worden herkend.
- Verplaatsen/verwijderen van facturen behoudt de bestaande herberekening; meerdere facturen, contante klussen met expliciete factuur, onbetaald terugzetten en statusvelden zoals verzonden blijven afgedekt.
- Alleen een gebruikersactie wijzigt bestaande betaalstatussen; geen automatische massawijziging, Supabase-migratie of back-upherstel. Andere apparaten blijven afhankelijk van de bestaande handmatige Sync.
- Regressies met uitsluitend fictieve klussen/facturen en bestaande GitHub Actions-browsercontroles. Geen echte ingelogde productiegegevens gewijzigd tijdens tests.
- Herstelpunt voor de code: branch `recovery/v71-5-3-before-payment-sync` op `6dea88d0343383b85963a9760575b6e88a679ef0`. De gebruikelijke geannoteerde releasetag wordt niet via deze GitHub-koppeling ondersteund.


## v71.5.3 — vrijwillige back-upherinnering per apparaat
- De permanente back-upwaarschuwing op het dashboard is verwijderd voor browsers/apparaten die nog nooit zelf een back-up maakten. Een back-up blijft volledig handmatig.
- Na de eerste succesvolle handmatige (volledige of lokale) back-up op dit apparaat toont het dashboard pas na 30 dagen weer een niet-verplichte herinnering.
- Via 'Herinner mij over 30 dagen' verdwijnt de melding onmiddellijk; zonder nieuwe back-up komt ze na 30 dagen opnieuw. Een nieuwe back-up begint een nieuwe periode. De data en het uitstel blijven uitsluitend lokaal op dat apparaat en synchroniseren niet naar andere apparaten.
- Back-upscherm geeft voortaan een rustige uitleg in plaats van een waarschuwing die direct verschijnt op nieuwe apparaten; export, herstel, encryptie, lokale/cloudcontroles en back-upbestanden zijn functioneel ongewijzigd.
- Fictieve regressietests voor nooit geback-upt, nieuw apparaat, 29/30 dagen, lokale kopieën, wegklikken, herhaling en per-apparaat opslag in bestaande controleworkflow. Echte apparaatexports en ingelogde productiegegevens niet getest.


## v71.5.2 — betaalstatus factuur en klus
- Bij het (uit)vinken van ‘Betaald’ op een aan een klus gekoppelde factuur wordt ‘Betaling ontvangen’ op de klus automatisch aangepast. Met meerdere gekoppelde facturen staat de klus pas op betaald als alle facturen betaald zijn.
- Nieuwe facturen en het verplaatsen/verwijderen van facturen houden de gekoppelde betaalstatus consistent. Contante klussen, niet-gekoppelde PDF's en handmatig geregistreerde betalingen zonder factuur blijven ongemoeid.
- Het openstaande klusbedrag en dashboard lezen dezelfde opgeslagen klusstatus; bestaande Supabase-gegevens en database-instellingen zijn niet gemigreerd.
- Geïsoleerde regressietest met fictieve facturen voor meerdere betalingen, onbetaald terugzetten, geen koppeling en contante afhandeling, geïntegreerd in de bestaande controleworkflow. Ingelogde productiedata en cross-device Sync niet getest.


## v71.5.1 — werkwijze voor zelfstandige publicatie
- Doorlopende eigenaarstoestemming vastgelegd in AGENTS.md: iedere gewone update via PR, relevante tests en GitGuardian; bij groen zelfstandig samenvoegen en de exacte Pages-publicatie/live website controleren.
- Afzonderlijke toestemming blijft verplicht bij databaseaanpassingen, beveiligingsinstellingen, gebruikersrechten, betaalgegevens en herstelacties. Latere instructies om niet te publiceren hebben voorrang; geen omzeiling van GitHub-regels/rechten.
- Versiebeheerhandleiding bijgewerkt; app-/websitebestanden, Supabase, Cloudflare en bestaande herstelpunten ongewijzigd.
- Herstelpunt vóór deze documentatiewijziging: v71.5.0 op `22fd1b0ea810cce1aaab8e19ad303d06811417a2`, bevestigd als succesvolle Pages-build van PR #4. Regressies worden via de bestaande browser-/fixturetest en GitGuardian gecontroleerd.

## v71.5.0 — gepubliceerd op 11 oktober 2026
- Bestaande handmatige back-up uitgebreid: lokale appgegevens en uitsluitend leesbare cloudrecords/bestanden in één gedateerde download; voortgang, aantallen, bestandsgrootte en 30-dagenwaarschuwing.
- V3 met ingebedde bestanden, SHA-256-controles en optionele AES-256-GCM-wachtwoordversleuteling; volledig aanwezige V1/V2 blijven inleesbaar. Bij cloudstoring uitsluitend expliciet gekozen lokale kopie zonder volledigheidsclaim.
- Herstel valideert vooraf, vraagt tweemaal toestemming inclusief bewaren veiligheidskopie, vervangt gegevens atomair en beschermt de lokale herstelkopie tegen sync. Geen browserherstel naar Supabase; aanvullende websitegegevens blijven bijlagen.
- Fictieve browsertests voor export/herstel, PDF’s/foto’s, beschadiging, onvolledigheid, encryptie, oude V2, rollback, paginering, offline gedrag en synchronisatie; geïntegreerd in bestaande GitHub Actions-regressietest.
- Openbare website, login, domein, Supabase-schema’s/productiegegevens en herstelpunten behouden. R2-code/Secrets/uploads ongemoeid; dagelijkse planning blijft uit en eigenaarstand `JK_BACKUPS_ENABLED=false` niet gewijzigd (API 403).
- Herstelpunt vóór wijzigingen: v71.4.2 op `87ff2f0a5daca11934173b330442ae16fe81c03f`, bevestigd als succesvolle Pages-build. Geen merge/publicatie of productieback-up uitgevoerd voor deze update.
- Beperkingen en gebruik: docs/HANDMATIGE-BACKUP.md. Geen volledige Supabase/Auth-herstelgarantie; iOS-deelkaart/iCloud en de persoonlijke V2-back-up niet op echte apparaten/gegevens getest.

## v71.4.2 — gepubliceerd op 11 oktober 2026
- Lokale Docker Desktop-herstelproef vervallen na twee mislukte Mac-starts; Mac-testbestanden verwijderd. Back-up en fictieve GitHub-tests gebruiken native PostgreSQL-tools.
- Eén handmatige productieback-up voorbereid; dagelijkse planning en uurlijkse bewaking bleven uit. De later goedgekeurde eerste poging op 11 oktober mislukte (Actions-run 38162402924); geen geslaagde productieback-up bevestigd.
- Supabase wordt uitsluitend uitgelezen; database-export met read-only verbindingen en geverifieerde TLS, Storage uitsluitend GET zonder redirects. Versleutelde R2-upload met volledige ontsleutelde download, checksums en als laatste COMPLETE.
- Negen secret- en twee variabelenbindings gecontroleerd; aanwezigheid wordt in de goedgekeurde workflow zonder waarden gecontroleerd. Metadata momenteel ontoegankelijk (HTTP 403).
- Fictieve PostgreSQL-/Storage-/encryptietests bewijzen geen volledige Supabase-herstelbaarheid. Volledige hersteltest niet geslaagd; herstelbaarheid niet gegarandeerd.
- Eigenaar heeft de negen GitGuardian-testmeldingen genegeerd en `JK_BACKUPS_ENABLED=false` bevestigd; documentatie bijgewerkt om een nieuwe beveiligingscontrole te starten. Scanner en Git-geschiedenis behouden.
- Website, main, versietags en Supabase-productie ongewijzigd; voorbereiding en herstelprocedure in docs/CLOUDBACKUPS.md.

## v71.4.1 — gepubliceerd op 11 oktober 2026
- Vaste Codex-instructies voor branches, beoordeling, regressietests en versietags.
- Gedocumenteerde publicatie- en herstelprocedure en afzonderlijke Supabase Free-back-ups.
- Automatische controles van statische bestanden en browsergedrag bij pull requests.
- Websitefunctionaliteit, domein en Supabase zijn ongewijzigd.
- PR #1 is samengevoegd; Pages en regressietests geslaagd. Actieve release-tag `v71.4.1` verwijst naar mergecommit `26e505c3ceb5ede8aea5733f6a9c70f6ff2bd529`.

## v71.4.0 — uitgangsversie (nummer genormaliseerd uit broncode v71.4)
- Vastgelegde `main`: `40e5f3cee281a17c528ea2e70f7eee9358f63d08`.
- Herstelpunt: `recovery-2026-10-11-main` (geannoteerde Git-tag).
- Deze tag bewaart de repository vóór de inrichting van versiebeheer. Op 11 oktober 2026 is via de GitHub API bevestigd dat de oorspronkelijke `main` en de laatste succesvolle Pages-build naar dezelfde commit wijzen. Pages publiceert vanuit `main`, map `/`, op `jkworks.nl` met afgedwongen HTTPS.
- Geen back-up van Supabase of lokale browsergegevens.
