# JK Works: vaste instructies voor Codex

## Grenzen
- Gebruik de bestaande checkout; elke cloudtaak is geïsoleerd. Maak geen worktree tenzij gevraagd.
- Bewaar lokale wijzigingen. Werk op een aparte `codex/<onderwerp>`-branch vanaf de actuele `main`; nooit rechtstreeks naar `main` pushen, force-pushen of geschiedenis herschrijven.
- Verander alleen wat de gebruiker vraagt. Behoud `CNAME` met exact `jkworks.nl`, de routes `/`, `/inloggen/`, `/app/`, relatieve assets en bestaande functionaliteit.
- Geen wijzigingen aan Supabase-tabellen, schema's, gebruikers, RLS/toegangsrechten, buckets, gegevens of productie-inhoud. Geen SQL-migraties uitvoeren, ook niet op basis van oude README-notities. Nieuwe databasevereisten afzonderlijk melden.
- Geen productieformulieren versturen, accounts maken of productiedata wijzigen tijdens tests. Geen wachtwoorden of geheime sleutels in chat, Git of logs. De bestaande publishable sleutel mag voor leescontroles worden gebruikt.
- Maak alleen noodzakelijke bestanden. Geen nieuwe buildketen voor deze statische site.

## Voor iedere update
1. Lees `docs/VERSIEBEHEER.md` en `CHANGELOG.md`. Controleer Git-status, remote `main`, Pages-instellingen en laatste succesvolle Pages-deployment. Verifieer dat de deployment de verwachte commit en `jkworks.nl` gebruikt. Onbereikbare API betekent onbekende publicatiestatus; nooit raden.
2. Controleer dat de huidige werkende deployment een herstel-tag heeft. Maak zo nodig een geannoteerde tag op precies die commit en push alleen die tag vóór bronwijzigingen. Verander of verwijder bestaande tags niet. Is de deployment onbekend, leg `main` apart vast als voorlopig herstelpunt en meld dat het live-herstelpunt onbevestigd is.
3. Gebruik versies `vMAJOR.MINOR.PATCH`: PATCH voor reparaties/kleine wijzigingen, MINOR voor nieuwe functies, MAJOR voor incompatibele wijzigingen. De aangetroffen broncode heet v71.4; de genormaliseerde uitgangsversie is v71.4.0. De eerste voorgestelde beheerupdate is v71.4.1. Controleer bestaande tags voordat je een nummer kiest.
4. Werk `CHANGELOG.md` bij met versie, wijziging, gebruikersimpact, controles en beperkingen. Geen release-tag op een nog niet goedgekeurde branch. Verander een service-worker-cacheversie alleen wanneer app-assets veranderen; behoud compatibiliteit met bestaande IndexedDB-gegevens.
5. Voer `node scripts/check.cjs` uit met Playwright geïnstalleerd; zie workflow voor reproduceerbare installatie. Voeg relevante regressiecontroles toe voor gewijzigd gedrag. Test lokale browseropslag uitsluitend in een geïsoleerd browserprofiel. Gebruik mocks/fixtures voor schrijfscenario's, nooit productie.
6. Controleer de publieke website, aanvraagvalidatie, inlogpagina, niet-ingelogde app-doorverwijzing, assets, PDF-sjablonen, PWA-manifest en service-worker-bestanden. Voor wijzigingen in ingelogde functies zijn tevens representatieve tests nodig van dashboard, klanten, klussen, uren, documenten/PDF, uitgaven, foto's en sync. De algemene smoke test bewijst deze functies niet. Rapporteer ontbrekende sessies/fixtures en uitgevoerde, mislukte en niet-uitgevoerde controles afzonderlijk.
7. Bekijk de volledige diff. Commit met herkenbare versie en beschrijving, push de werkbranch en open een PR naar `main`. Vermeld herstel-tag, Pages-status, tests en eventuele beperkingen. Gebruik voor multiline PR-teksten `--body-file`. Verander geen Pages-publicatiemethode of domein.

## Goedkeuring en publicatie
- Stop na het openen van de PR: niet mergen, releasen of naar live publiceren zonder expliciete publicatieopdracht van de gebruiker. Een verzoek om een PR is geen toestemming om te mergen.
- Na expliciete goedkeuring: controleer actuele `main`, branch, diff en groene checks opnieuw. Merge de beoordeelde PR volgens de bestaande repositorymethode. Controleer de Pages-deployment en het live resultaat, en maak daarna een onveranderlijke geannoteerde versie-tag op de goedgekeurde mergecommit. Noteer PR, commit, tag en verificatie. Bij uitblijvende of mislukte deployment geen werkende release claimen.
- Herstel via een nieuwe branch en PR, met een nieuwe commit die uitsluitend website/app-bestanden naar een gekozen werkende tag terugzet. Geen reset/force-push; behoud beheerinstructies en versiegeschiedenis. Herstel vereist expliciete goedkeuring voor publicatie.
- Git bewaart alleen repositorybestanden. Supabase-data, Storage-bestanden en lokale browsergegevens vereisen afzonderlijke back-ups; zie `docs/VERSIEBEHEER.md`. Geen automatische Free-databaseback-up of PITR aannemen.
