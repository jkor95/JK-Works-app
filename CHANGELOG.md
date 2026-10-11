# Wijzigingsgeschiedenis

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
