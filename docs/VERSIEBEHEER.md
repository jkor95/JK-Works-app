# Updates publiceren en herstellen

## Huidige situatie en eerste herstelpunt
Gecontroleerd op 11 oktober 2026: GitHub Pages gebruikt **Deploy from a branch** (`build_type: legacy`), bronbranch `main`, map `/`. Het custom domain is `jkworks.nl`, HTTPS is afgedwongen en de laatste build heeft status `built`. De site is statisch en heeft geen buildstap. De nieuwe regressieworkflow publiceert niets. Laat de bestaande Pages-instellingen en DNS intact. Controleer bij toekomstige updates opnieuw **GitHub → repository → Settings → Pages**.

Het eerste herstelpunt is de geannoteerde tag `recovery-2026-10-11-main` op commit `40e5f3cee281a17c528ea2e70f7eee9358f63d08`. Deze is vóór wijzigingen in GitHub opgeslagen. De GitHub API bevestigt dat zowel de oorspronkelijke `main` als de laatste succesvolle Pages-build exact deze commit gebruiken. De build dateert van 11 oktober 2026, 11:16:30 uur (Europe/Amsterdam). Het herstelpunt komt dus overeen met de oorspronkelijke gepubliceerde GitHub-versie. De API en het live domein waren tijdens de eerste inrichting geblokkeerd; die beperking is nu opgeheven. Dit controleert de bronversie, niet alle ingelogde bedrijfsfuncties.

Leescontroles voor Codex:
```sh
gh api repos/jkor95/JK-Works-app/pages --jq '{build_type,source,cname,status,https_enforced}'
gh api repos/jkor95/JK-Works-app/pages/builds/latest --jq '{status,commit,error}'
```
Bij Pages via Actions kan de builds-API ontbreken: bekijk dan de succesvolle Pages-workflow en het `github-pages`-deployment met exacte commit. Controleer live `/`, `/inloggen/`, `/app/` en relevante assets zonder productiegegevens te wijzigen. Komt de live commit niet overeen met het herstelpunt, maak eerst een extra herstel-tag op de echte werkende deploymentcommit. Wijzig geen bestaande tag.

## Een update laten maken
Vraag bijvoorbeeld: “Maak de volgende update met [wijziging], test bestaande functies en open een PR.” Sinds 11 oktober 2026 heeft Codex doorlopende toestemming om gewone updates na succesvolle relevante tests en GitGuardian zelfstandig samen te voegen en te publiceren. Voor databaseaanpassingen, beveiligingsinstellingen, gebruikersrechten, betaalgegevens en herstelacties blijft afzonderlijke expliciete toestemming vereist. Een opdracht “publiceer nog niets” of “niet samenvoegen” geldt als uitzondering. Codex werkt op een branch, werkt het changelog bij en pusht commits naar GitHub. Iedere voorgestelde update is via branch en PR terug te vinden; goedgekeurde updates blijven in `main` en krijgen na verificatie een versie-tag. Bewaar tags ook als branches worden verwijderd.

De workflow **JK Works controles** test pull requests en `main`, maar publiceert niets. Bescherming van `main` is daarmee nog niet automatisch ingesteld. Stel indien de GitHub-repository/het abonnement dit ondersteunt een branchregel in: PR verplicht, minimaal één bevoegde beoordelaar, deze check verplicht en force-push/verwijderen verboden. Laat die regel controleren; instructies alleen voorkomen geen handmatige directe push.

## Publiceren zonder bestanden te uploaden
1. Codex bekijkt de PR, het versienummer, de volledige diff, tests en beperkingen en voert ontbrekende relevante functietests uit. Je kunt de PR altijd zelf bekijken; gewone updates vereisen geen extra bevestiging.
2. Codex controleert op de actuele PR-commit alle relevante tests en GitGuardian en voegt gewone updates zelfstandig samen zodra alles slaagt. Bij risicovolle wijzigingen of een expliciet publicatieverbod wacht Codex op afzonderlijke toestemming. Bij ontbrekende/mislukte controles of beperkende GitHub-rechten/regels blijft de PR open en wordt de beperking gemeld; beveiligingsregels worden niet omzeild.
3. Bij Pages **Deploy from a branch** publiceert GitHub de ingestelde bronbranch/map automatisch nadat die branch verandert. Bij **GitHub Actions** bepaalt de bestaande deployworkflow het moment. Merge alleen wanneer de echte publicatiebron bevestigd is; wijzig de Pages-instellingen niet op goed geluk.
4. Controleer de succesvolle Pages-deployment, live pagina's en ingelogde functies die zijn gewijzigd. Codex legt daarna de mergecommit vast als geannoteerde tag, bijvoorbeeld `v71.4.1`, met wijzigingsbeschrijving en PR-verwijzing. Een release in GitHub kan naar deze tag verwijzen, maar is niet nodig voor Pages-publicatie.

De controleworkflow deployt niet; samenvoegen naar de bestaande Pages-bron `main` start wel publicatie. Codex controleert daarna de exacte deploymentcommit en het live resultaat. Herstelacties blijven afzonderlijke toestemming vereisen.

## Een vorige versie herstellen
Vraag: “Maak een herstel-PR naar [werkende versie-tag]. Behoud jkworks.nl en de beheerbestanden. Publiceer nog niets.” Codex haalt de actuele `main` en tags op, maakt een nieuwe herstelbranch en zet alleen de website/app-bestanden terug. Een nieuwe commit bewaart de volledige geschiedenis. Geen force-push of reset van `main`.

Voor deze repository kan Codex na controle van een schone branch deze afgebakende restore gebruiken (vervang de tag bewust):
```sh
git fetch origin main --tags
git switch -c codex/herstel-v71-4-0 origin/main
git restore --source=recovery-2026-10-11-main --staged --worktree -- \
  CNAME index.html site.css site.js site-editor-public.js robots.txt sitemap.xml \
  assets icons inloggen app templates
node scripts/check.cjs
git diff --cached --stat
```
Deze paden bestaan in het eerste herstelpunt. Voor latere releases: vergelijk de bestandslijst met de doeltag, verwijder expliciet na die versie toegevoegde websitebestanden en neem eventuele nieuwe runtimepaden mee. Behoud `AGENTS.md`, workflow, tests, herstelhandleiding en changelog. Controleer dat `CNAME` exact `jkworks.nl` blijft. Geef de herstelupdate een nieuw PATCH-nummer en vermeld van welke versie is teruggezet. Commit, push en open een PR; merge pas na expliciete publicatiegoedkeuring. Controleer daarna Pages en live gedrag en tag de nieuwe mergecommit.

Bij app-herstel kunnen service-worker-caches en oude IndexedDB-gegevens aanwezig blijven. Test met zowel een schoon browserprofiel als bestaande lokale gegevens. Wis geen klantgegevens of lokale opslag om een test te laten slagen. Een teruggezette oudere client kan incompatibel zijn met inmiddels gewijzigde gegevens; onderzoek dat vóór publicatie.

## Wat de controles aantonen
`node scripts/check.cjs` vereist Node en Playwright (zie `.github/workflows/check.yml` voor de gepinde installatie). Het start en stopt een eigen lokale server, controleert JavaScript-syntax, `CNAME`, HTML-assets, PWA-manifest, service-worker-precache en PDF-bestanden. In een geïsoleerde Chromium-browser controleert het het openbare formulier, validatie zonder contactgegevens, de login en de niet-ingelogde app-doorverwijzing. Externe schrijfacties worden geblokkeerd.

Dit bewijst geen ingelogde klanten/klussen, uren, sync, uploads, e-mail/WhatsApp, PDF-generatie, RLS of herstel van bestaande lokale data. Wijzigingen daarin vereisen gerichte regressietests met fixtures/mocks en, waar nodig, een apart goedgekeurde veilige testomgeving/sessie. Nooit echte productieaanvragen versturen om te testen. De workflow heeft geen Supabase-beheersleutel nodig.

## Supabase Free: afzonderlijk back-uppen
Een Git-tag bevat code en sjablonen, geen database, gebruikers, uploads of lokale browserdata. Ga bij Free niet uit van beschikbare automatische databaseback-ups of point-in-time recovery. Maak vóór risicovolle wijzigingen en periodiek een afzonderlijke export met de door Supabase ondersteunde CLI/databasebackup-procedure; controleer de actuele documentatie en exportscope.

De projecteigenaar voert dit apart uit met beveiligd opgeslagen databasecredentials. Bewaar exports versleuteld buiten deze repository en buiten publieke Pages. Controleer schema, data, relevante rollen en benodigde authenticatiegegevens; neem niet aan dat een standaard export alle beheerde schema's/authenticatiegegevens bevat. Download Storage-objecten afzonderlijk: een database-export bevat niet de bestandsinhoud. Leg het exportmoment, project en scopes vast, en bewijs herstel in een apart project. Lokale, nog niet gesynchroniseerde browserdata vereisen de bestaande app-export/back-upfunctie.

Een websiteherstel zet Supabase niet terug. Een databaseherstel kan nieuwe gegevens overschrijven en vereist een afzonderlijke expliciete opdracht en herstelplan. Tijdens deze versiebeheerinrichting worden geen databaseback-ups, migraties, rechtenwijzigingen of restores uitgevoerd.
