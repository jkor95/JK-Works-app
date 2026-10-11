# Voorstel: automatische cloudback-ups voor JK Works

**Status: voorbereid, niet geactiveerd.** Deze branch maakt geen productieback-up en wijzigt geen website, Supabase of opgeslagen gegevens. De workflow heeft geen actieve dagelijkse trigger. Productietoegang, eerste back-up en herstel naar een echt Supabase-testproject vereisen afzonderlijke goedkeuring. Een PR-test gebruikt uitsluitend fictieve lokale data.

## Bevindingen
- Actieve bronversie: v71.4.1; website en app worden door GitHub Pages uit `main`, map `/`, gepubliceerd.
- Uit de broncode: `public.app_records` bevat onder meer klanten, klussen, uren, documenten/facturen/offertes, uitgaven en instellingen. Ook `app_deletions` en `public_requests` moeten worden behouden. Gebruikers/accounts zitten in Supabase Auth.
- De app verwijst naar `jkworks-files` (bedrijfsbestanden), `jkworks-request-files` (aanvraagfoto's) en `jkworks-website-assets` (website-editorafbeeldingen).
- Met de publieke sleutel is de volledige schema-inventaris niet toegankelijk (HTTP 401). De publieke bucketlijst is leeg, maar dat bewijst niet dat er geen buckets zijn: zichtbaarheid is beperkt. Er zijn geen database/back-upcredentials in deze cloudtaak gevonden. De GitHub-integratie mag secret- en variablemetadata niet uitlezen (HTTP 403).
- Werkelijk aanwezige schema's, buckets, objectaantallen, omvang en PostgreSQL-versie zijn dus **nog niet bevestigd**. Geen klantrecords, facturen of bestandsinhoud zijn voor dit onderzoek opgehaald.
- Supabase adviseert voor Free regelmatig logische exports buiten Supabase. Databaseback-ups bevatten alleen Storage-metadata, niet de bestandsinhoud.

## Aanbevolen opslag en kosten
**Cloudflare R2 Standard**, in een privébucket, bij voorkeur met EU-jurisdictie indien beschikbaar voor het account. Gebruik geen r2.dev-link, openbaar domein of zakelijke OneDrive. Cloudflare beheert de externe opslag; verwerkersvoorwaarden en regio moeten door de eigenaar worden beoordeeld voor persoonsgegevens.

Officiële prijslijst, geraadpleegd 11 oktober 2026: 10 GB-month opslag, 1 miljoen Class A- en 10 miljoen Class B-verzoeken per maand gratis; egress gratis. Daarboven Standard-opslag $0,015/GB-month, Class A $4,50/miljoen en Class B $0,36/miljoen. Belasting en valutaomrekening kunnen bijkomen. R2 kan betaalgegevens vereisen; overschrijding van de gratis ruimte is geen harde gratis limiet.

Elke dag is zelfstandig herstelbaar. Bij 35 kopieën van ongeveer 1 GB blijft ongeveer 35 GB opgeslagen: circa **$0,375/maand** aan opslag boven de gratis 10 GB, exclusief verzoeken. Om gratis te blijven moet iedere volledige kopie grofweg maximaal 285 MB zijn, met marge voor groei en tijdelijke overlap. De werkelijke omvang moet eerst worden vastgesteld. Gebruik Standard, niet Infrequent Access: de gratis limiet geldt alleen voor Standard.

Stel een lifecycle in die objecten pas **na 35 dagen** verwijdert en, indien beschikbaar, een bucket-lock met minimaal 35 dagen retentie. Zo blijven minimaal 30 dagen bewaard. De back-upcode verwijdert nooit externe snapshots. Beveilig de beheeraccount met MFA; een lifecycle is zonder lock geen bescherming tegen een accountbeheerder die handmatig verwijdert. Sleutelhouders met object-write kunnen mogelijk ook verwijderen: houd de bucket-lock en accountbeheertoegang apart.

GitHub-hosted runners kunnen voor publieke repositories gratis zijn; privérepositories hebben abonnementsafhankelijke minuten. Controleer het abonnement en budget. Supabase-downloads gebruiken de Free-egressquota; deze quota zijn geen back-upopslag. De code hergebruikt ongewijzigde objecten uit de vorige R2-kopie en downloadt van Supabase alleen nieuwe/gewijzigde objecten. Eerste back-up, grote wijzigingen en veel hersteltests kunnen alsnog limieten overschrijden. Als limieten/kosten niet acceptabel blijken, activeer de workflow niet.

## Wat de voorbereide workflow doet
1. Eerst een lokale integratietest met fictieve PostgreSQL/Auth/Storage-data, zonder productiecredentials.
2. Alleen op goedgekeurde `main`, met repositoryvariabele `JK_BACKUPS_ENABLED=true` en een expliciete handmatige keuze `BACKUP_APPROVED`, kan de productiejob draaien. De cron is bewust uitgecommentarieerd. De eerste geplande dagelijkse tijd is 02:15 UTC (03:15 wintertijd / 04:15 zomertijd in Amsterdam).
3. Databaseverbinding via directe verbinding of **session pooler**, poort 5432; TLS `verify-full` met de Supabase-CA. Geen transaction pooler, geen wachtwoord in een CLI-URL. De transacties voor inventaris en export zijn read-only.
4. Een native `pg_dump` in custom-formaat exporteert alle door PostgreSQL exporteerbare niet-systeemschema's, inclusief beschikbare Auth- en Storage-data, definities, eigenaarinformatie en rechten. Een aparte rollenexport bevat geen rolwachtwoorden. De client-major volgt de server; de gebruikte officiële containerdigest wordt vastgelegd.
5. Inventarisatie van alle niet-systeemtabellen, aantallen, **alle** buckets en **alle** Storage-objecten, niet alleen de drie bekende buckets. Ontbrekende bekende tabellen/buckets of onvoldoende leesrechten veroorzaken een fout. Geen globaal SELECT-filter met de beperkte publieke API-key.
6. De database-export en objectinventaris gebruiken dezelfde PostgreSQL-snapshot. Bestanden komen via geauthenticeerde HTTPS-GET-verzoeken. De code doet geen Storage-upload/verwijdering en voert geen SQL-writes uit. Hergebruikte bestanden worden op SHA-256 gecontroleerd.
7. Na verzamelen wordt Storage opnieuw geïnventariseerd. Als de structuur/metadata in de tussentijd verandert, faalt de back-up. Supabase biedt geen gezamenlijke atomaire database-plus-object-snapshot: neem de back-up tijdens een rustig moment en test deze beperking vóór activatie. Niet gesynchroniseerde browserdata zitten niet in Supabase en moeten via de bestaande app-export worden bewaard.
8. Een volledige kopie met database, rollen, Storage-bytes en manifest wordt **vóór upload** versleuteld met rclone crypt, inclusief bestands- en mapnamen. Rclone gebruikt authenticated encryption; de wachtwoorden zijn sterke afzonderlijke geheimen, niet de R2-toegangssleutel. `rclone obscure` is alleen een interne configuratievorm, niet de beveiligingslaag.
9. Upload naar R2, daarna volledige downloadvergelijking van ontsleutelde inhoud. SHA-256 en bestandsgroottes staan in het versleutelde manifest. Pas daarna wordt een versleutelde `COMPLETE`-markering geschreven en teruggelezen. Zonder die markering is een kopie niet herstelbaar verklaard. Onderbroken uploads tellen nooit als succes.
10. Geen GitHub-artifacts, caches, repositorycommits of openbare links voor de back-updata. Tijdelijke plaintext staat alleen in een afgeschermde runnerdirectory en wordt verwijderd. Logs tonen alleen status, niet recordinhoud, bestandsnamen, credentials of ruwe foutmeldingen. Workflowrechten zijn `contents: read`.

Verlies of ongeplande rotatie van het cryptwachtwoord of de salt maakt bestaande kopieën onleesbaar. Bewaar ook oudere sleutelversies veilig en test vóór rotatie.

De logische export is geen fysieke serverkopie/PITR. PostgreSQL-systeemcatalogi, platformconfiguratie, API-sleutels, database-/rolwachtwoorden, OAuth/SMTP-configuratie en externe diensten zijn geen automatisch herstelbare onderdelen. Managed extensions kunnen extra herstelstappen vereisen. Als Vault/pgsodium/root-key-versleuteling wordt gebruikt, zijn de bijbehorende root keys apart nodig: een dump met ciphertext alleen is onvoldoende. Controleer dit met de eigenaar vóór de eerste echte back-up; claim geen volledige herstelbaarheid voordat een Supabase-testherstel slaagt.

## Eenmalige handelingen door de eigenaar — pas na goedkeuring
1. Accepteer het voorstel, de mogelijke kosten en de gekozen opslagregio. Maak privé R2-bucket, 35-dagen lifecycle/lock en een bucketgebonden API-token aan. Houd publieke toegang uit. Stel budgetmeldingen en MFA in. Deel geen sleutels in chat.
2. Maak GitHub Environment `jkworks-backups` met toegang uitsluitend voor `main`. Voor de eerste echte handmatige run is een reviewer verstandig; dagelijkse runs vereisen daarna een bewust gekozen instelling die onbeheerd uitvoeren toestaat. Houd de productievariabele nog uit.
3. Vul onderstaande **GitHub Environment Secrets** veilig in. Ik kan bestaande secretbindings niet inspecteren: hergebruik passende bindings waar mogelijk. Geen waarden in Git-bestanden/logs of PR's.

| Secret | Waarde/scope |
| --- | --- |
| `JK_DB_HOST`, `JK_DB_USER`, `JK_DB_PASSWORD` | Supabase Connect: session pooler-host, bijbehorende gebruiker en bestaande databasecredentials; niets resetten of aan bestaande rollen wijzigen |
| `JK_DB_CA` | PEM-CA uit de officiële Supabase database-/SSL-instellingen; controleer herkomst |
| `JK_STORAGE_READ_KEY` | Server-side sleutel met toegang om alle buckets/objecten te lezen; **nooit** de publiek beperkte publishable key |
| `JK_R2_ACCESS_KEY_ID`, `JK_R2_SECRET_ACCESS_KEY` | Afzonderlijke token, beperkt tot deze privé-back-upbucket |
| `JK_BACKUP_PASSWORD`, `JK_BACKUP_SALT` | Elk minimaal 32 cryptografisch willekeurige tekens; bewaar onafhankelijke herstelkopieën in een wachtwoordkluis/offline veilige locatie |

Een Supabase service-role/secret key kan meer dan alleen lezen, ook al gebruikt deze code uitsluitend GET. Er wordt in dit voorstel geen nieuwe databasegebruiker, RLS-policy of Supabase-toegangsrecht gemaakt. Beoordeel deze brede bevoegdheid expliciet vóór activatie. Bij een eis voor technisch afgedwongen read-only toegang is een afzonderlijk goedgekeurd credential-/rollenontwerp nodig; activeer dan deze variant niet.

4. Variabelen: repository `JK_BACKUPS_ENABLED=false`; Environment `JK_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` en `JK_R2_BUCKET=<privébucketnaam>`. Geef voor een handmatige download de scriptvariabelen `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `BACKUP_CRYPT_PASSWORD`, `BACKUP_CRYPT_SALT` via een veilige lokale secretbinding mee.
5. Stel GitHub **Settings → Notifications → Actions** en e-mailontvangst voor mislukte workflows in; controleer adres en deelname/subscriptie voor de workflow. De workflow geeft bij fouten exit 1. Voer na goedkeuring een gecontroleerde fouttest uit om de daadwerkelijke melding te bevestigen. Deze melding is nu niet verstuurd/getest. Github-e-mail waarschuwt niet als een schedule helemaal niet start; controleer periodiek de laatste `COMPLETE`. Publieke repos kunnen schedules na 60 dagen inactiviteit uitschakelen. Cron heeft geen exacte starttijdgarantie.
6. Maak een afzonderlijk Supabase-testproject. Laat alleen na expliciete toestemming productie-exports ophalen, ontsleutelen en daarin herstellen. Verifieer in dat testproject alle tabellen/aantallen, Auth-identiteiten, RLS/policies, buckets en bestanden, plus login, klanten, klussen, uren, facturen/offertes/PDF en uploads/sync met veilige testacties. Kopieer geen productie-e-mail-/webhookintegraties; voorkom mail aan klanten. Dit project kan een Free-projectslot of kosten gebruiken.
7. Na geslaagde proef: merge alleen na toestemming, zet de variabele aan en voer één goedgekeurde handmatige `BACKUP_APPROVED` uit. Pas na bewezen extern opslaan, ontsleutelen, Supabase-testherstel en foutmelding activeert een tweede expliciet goedgekeurde PR de uitgecommentarieerde dagelijkse cron. Leg resultaten vast. Er gebeurt nu niets van dit alles.

## Veilige herstelprocedure
1. Herstel nooit direct over productie. Vraag een afzonderlijke herstelgoedkeuring, kies de gewenste `COMPLETE`-snapshot en bewaar de actuele productieversie/data apart. Stop eventuele automatische bedrijfsacties niet zonder overleg.
2. Download/ontsleutel op een beveiligde machine naar een **nieuwe lege directory**, met bovenstaande R2-/cryptbindingen (geen databasecredentials nodig):
   ```sh
   python scripts/cloud_backup.py --download <snapshotnaam> --output /veilige/nieuwe-directory
   ```
   Dit controleert markering, manifest, volledige bestandslijst, groottes en checksums en voert **geen** database- of Storage-herstel uit. De directory bevat persoonsgegevens; behandel die vertrouwelijk en verwijder plaintext na het gecontroleerde herstel.
3. Bekijk met de juiste PostgreSQL-client `pg_restore --list database.dump`. In een wegwerp-PostgreSQL-fixture kan een lege database worden hersteld met `pg_restore --exit-on-error --dbname=<testdatabase> database.dump`; injecteer de verbindingsgegevens veilig, niet als wachtwoord-URL. Rollen zonder wachtwoorden en benodigde extensions moeten eerst passend bestaan.
4. Een nieuw Supabase-project bevat al managed Auth/Storage-schema's. **Voer niet blind `--clean` of de volledige rollenexport uit.** Volg de actuele officiële Supabase backup/restore-handleiding en laat de TOC beoordelen: applicatieschema/data en relevante Auth-data herstellen met correcte volgorde; managed migratietabellen/rollen/extension- en root-keyverschillen apart oplossen. Verander geen productierollen. Dit maatwerk moet vóór ingebruikname op het afzonderlijke project worden bewezen.
5. Maak de buckets in het testproject met de eigenschappen uit het manifest. Upload de ontsleutelde bytes met de oorspronkelijke `bucket_id`/`name` en contenttype. Zet niet alleen oude `storage.objects`-metadata terug: dat maakt geen bestanden aan en kan met de nieuwe Storage-server botsen. De manifestbestandsnamen zijn hashes; de oorspronkelijke namen staan uitsluitend in het ontsleutelde manifest. Dit voorstel bevat bewust geen script dat willekeurige productie-buckets overschrijft.
6. Vergelijk herstel met `table_counts`, bucket/objectinventaris en SHA-256. Test de app op een afgeschermde testconfiguratie; stel de productie-URL/API-key en `jkworks.nl` niet om. Controleer login/RLS, referenties naar foto's/documenten en lokale nog niet gesynchroniseerde gegevens.
7. Alleen na succesvolle proef en afzonderlijke goedkeuring een productieherstel-/omschakelplan uitvoeren. Databaseherstel kan nieuwe klanten/facturen verliezen; Git-versionering lost dat niet op. Bewaar de oude omgeving en neem een terugvalplan op.

## Uitgevoerde tests en resterende grenzen
De lokale test maakt eigen PostgreSQL-bron- en hersteldatabases, een HTTP Storage-fixture en een uitsluitend lokale versleutelde vault. Getest: gate dicht zonder goedkeuring; volledige fictieve applicatie/Auth/extra-schema/RLS-export en herstel; alle vier fictieve buckets (ook een extra); twee bestanden; encryptie en geverifieerd teruglezen; hergebruik zonder nieuwe bron-download; wijziging/verwijdering alleen in nieuwe snapshots; oude snapshot blijft herstelbaar; corrupte bestanden en ontbrekende bucket falen. Er zijn geen productiecredentials gebruikt.

Niet getest/geconfigureerd: echte databasevolledigheid, werkelijke buckets/omvang, echte R2-upload/lifecycle/lock, GitHub-mailmelding, een echte Supabase-restore en dagelijkse uitvoering. Dit is een beoordeelbare voorbereiding, **geen actieve back-upvoorziening**.

Bronnen: [Supabase back-ups](https://supabase.com/docs/guides/platform/backups), [Supabase logisch herstel en Storage-migratie](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [R2-prijzen](https://developers.cloudflare.com/r2/pricing/), [rclone crypt](https://rclone.org/crypt/). De actuele Supabase- en R2-documentatie is tijdens voorbereiding gelezen uit de officiële GitHub-bronrepositories omdat de documentatiewebsites door het cloudnetwerk werden geblokkeerd.
