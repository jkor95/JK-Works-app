# Wijzigingsgeschiedenis

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
