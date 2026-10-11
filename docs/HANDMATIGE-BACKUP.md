# Handmatige appback-up (voorstel v71.5.0)

Open **Meer → 💾 Back-up en herstellen → Back-up maken**. Eén gecontroleerd bestand wordt gedownload, met datum én tijd in de naam. Bewaar het zelf in iCloud Drive via Bestanden/Downloads. Gebruik desgewenst daarna **Bewaar laatste download via deelkaart**; delen vereist een nieuwe tik omdat iOS een gebruikersactie verlangt. De app kan niet vaststellen of de download werkelijk in iCloud is bewaard. Een tijdstip betekent: gecontroleerd en download gestart, lokaal op dit apparaat bekend.

Kies desgewenst wachtwoordversleuteling (minstens 12 tekens, tweemaal invoeren). AES-256-GCM met een willekeurige 16-byte salt, 12-byte IV en PBKDF2-HMAC-SHA256 met 600.000 iteraties. Wachtwoorden worden niet bewaard of gelogd. Bewaar ze apart: zonder wachtwoord bestaat geen herstelmogelijkheid. Zonder versleuteling is het JSON-bestand leesbaar voor iedereen die erover beschikt. Checksums herkennen beschadiging; bij onversleutelde bestanden bewijzen ze niet wie de maker is. Herstel uitsluitend eigen, vertrouwde back-ups.

## Wat zit erin?

De vorige V2-export las uitsluitend elf lokale IndexedDB-stores en alleen Blob-velden direct op records. Herstel wiste stores afzonderlijk en kon bij een fout halverwege stoppen. De nieuwe export leest een consistente lokale momentopname plus, indien bereikbaar en ingelogd, gegevens die met de **bestaande gebruikerssessie en RLS-rechten** zichtbaar zijn:

- `mboxes`, `tools`, `checklists`: indelingen, materialen/gereedschap en checklijsten.
- `clients`, `jobs`, `timeEntries`: contactgegevens, klusgegevens, materialen, uren en tarieven.
- `documents`, `pdfTemplates`, `jobPhotos`, `expenses`: facturen/offertes, betaal-/verzendstatus, PDF’s, sjablonen, foto’s en bonnetjes. Bestanden zijn ingebed; beschikbare namen, MIME-types en File-tijdstempels blijven behouden. Eerder gecomprimeerde foto’s worden niet omgezet in verdwenen originelen.
- `settings`: bedrijfsgegevens, meldingsvoorkeuren en overige appinstellingen. Auth-sessies, tokens, lokale back-uphistorie en herstelbeveiliging worden niet als overdraagbare instellingen geïmporteerd.
- Aanvullende bijlagen: eigen `app_records` (ook `websitePublic`), `app_deletions`, zichtbare `public_requests` en alle zichtbare bestanden uit `jkworks-files`, `jkworks-request-files` en `jkworks-website-assets`, ook losstaande bestanden. Bestandsverwijzingen en aanvraagfoto’s moeten in de bestandslijst terug te vinden zijn.

De app doet **geen sync vooraf**, geen upload, DELETE of databasewijziging. Gepagineerde databaselezingen controleren exacte aantallen; cloudlijsten worden na collectie opnieuw gelezen om wijzigingen te herkennen. Lokale, nog niet gesynchroniseerde wijzigingen krijgen voorrang op hun cloudversie; verwijdermarkeringen worden gerespecteerd. Bestandsinhoud is gededupliceerd en wordt met SHA-256 gecontroleerd, evenals het gehele back-upbestand. De exacte download wordt opnieuw ingelezen en indien gekozen ontsleuteld vóór de download start.

Een volledige **appback-up** is geen volledige Supabase-back-up: geen SQL-schema’s, RLS, rollen, Auth-accounts, wachtwoorden, niet-zichtbare rijen/buckets of nog uitsluitend op een ander apparaat aanwezige wijzigingen. Een lege door RLS gefilterde lijst bewijst niet dat het project leeg is. Er zijn geen beheersleutels in de website. Externe bestanden buiten de drie bekende buckets vallen buiten de cloudscope. De daadwerkelijke productierechten zijn niet met een ingelogde productiesessie getest.

Bij een cloudfout kan uitsluitend na een duidelijke bevestiging een **lokale kopie** worden gemaakt, met andere bestandsnaam en een expliciete onvolledige cloudscope. Een niet-lokaal beschikbaar bestand verhindert ook zo’n kopie. Een lokale kopie vervangt de datum van de laatste volledige appback-up niet. Boven 30 dagen volgt een waarschuwing. Browserback-ups zijn bewust begrensd: maximaal 75 MiB unieke bestandsinhoud en 150 MiB downloadbestand; beschikbare browsergeheugenruimte kan een lagere praktische grens geven.

## Veilig lokaal herstellen

1. Sluit andere JK Works-tabbladen/appvensters, ook op hetzelfde apparaat. Gebruik de huidige appversie; oudere open tabs kennen de nieuwe herstelbeveiliging niet.
2. Kies **Back-up herstellen**, eventueel na invullen van het wachtwoord. Alle stores, records, embedded bestanden en checksums worden vóór enige wijziging gecontroleerd. Bekijk datum, aantallen en waarschuwingen en bevestig expliciet.
3. Eerst wordt een gecontroleerde veiligheidskopie van de **huidige lokale gegevens** gedownload; bij een versleutelde invoer wordt die met hetzelfde wachtwoord versleuteld. Controleer dat deze download daadwerkelijk is bewaard en bevestig opnieuw. Zonder bevestiging gebeurt niets.
4. Alle appgegevens en lokale syncwachtrijen worden in één IndexedDB-transactie vervangen. Bij een fout of gelijktijdige lokale wijziging wordt die volledig afgebroken. Foto’s en documenten zijn daarna lokaal bruikbaar. Seed-migraties wijzigen de herstelde gegevens niet.
5. Na herstel blijft **synchronisatie geblokkeerd op dit apparaat**, ook na herladen of opnieuw inloggen. Zo kunnen een nieuwere cloudversie en verwijdermarkeringen een oude back-up niet meteen overschrijven. Normale synchronisatie buiten deze herstelstand blijft bestaan. Hervatten en terugschrijven naar de cloud vereist een afzonderlijk beoordeeld herstelplan; er is bewust geen knop die ongecontroleerd een oud bestand naar productie schrijft. Wis geen browseropslag om deze bescherming te omzeilen.

Website-inhoud, website-aanvragen, hun foto’s en losstaande cloudbestanden blijven als gecontroleerde bijlagen in het JSON-bestand beschikbaar. De lokale appstores worden hersteld, maar deze aanvullende gegevens worden niet in Supabase of de openbare website teruggezet. Andere apparaten blijven ongewijzigd. Een volledige Supabase-hersteltest is hiermee niet bewezen of gegarandeerd.

Volledige `JKWORKS_BACKUP_V1`/`V2`-bestanden blijven inleesbaar, inclusief V2 met datum 11 oktober 2026. Oudere bestanden hebben geen checksums: de app waarschuwt dat oorspronkelijke volledigheid niet aantoonbaar is. Ontbrekende stores, ongeldige/ontbrekende foto’s/PDF’s en cloudverwijzingen zonder inhoud worden afgewezen; ontbrekende onderdelen worden nooit stilzwijgend leeggemaakt. Het persoonlijke bestand van 11 oktober is niet aangeleverd; compatibiliteit is met een fictief V2-bestand getest.

## Cloudflare blijft buiten gebruik

`JK_BACKUPS_ENABLED=false` blijft de door de eigenaar bevestigde stand. De GitHub-integratie kan deze variabele niet lezen (HTTP 403); deze update verandert hem niet. De cronregels blijven commentaar. Er zijn geen dagelijkse back-ups of periodieke waarschuwingen actief. Bestaande R2-code, bucket, Secrets en eventuele gedeeltelijke uploads blijven ongemoeid. Geen R2-back-up of productieherstel is voor deze wijziging uitgevoerd.

## Validatie

`node scripts/check.cjs` voert de bestaande websitecontroles plus `scripts/test_manual_backup.cjs` uit met een geïsoleerde browser en een fictieve Supabase-SDK. De nieuwe tests blokkeren alle externe verzoeken, inclusief productielezingen. Ze testen export, AES-GCM, checksums, onvolledigheid, Storage/PDF/foto’s, V2, bevestigingen, veiligheidskopie, rollback, gewijzigde gegevens, paginering, offline kopie, normale fictieve sync, herstelbescherming en de echte downloadknop. Geen productiesessie of service-role nodig. De echte iOS-deelkaart en het opslaan in iCloud moeten na beoordeling op het eigen apparaat worden gecontroleerd.
