# JK Works — geverifieerde clientcontracten voor een eigen backend

**Datum:** 12 november 2026  
**Status:** alleen-lezen broncode-inventarisatie; **geen** deployment, datamigratie, gewijzigde appwerking of productieautorisatie.  
**Bron:** GitHub `jkor95/JK-Works-app`, `main` op `a748e449b84938f50e0e1f204f221d8a68f505be`. Controleer vóór implementatie altijd of de productieclient hiervan afwijkt.

## Waarom dit document bestaat

Dit is een apart, documentatie-only overdrachtspunt voor Work. De werkende Dell V2-release van **alleen de SchermLoop-verkoopsite** blijft ongemoeid. De JK Works-servermigratie is een ander werkspoor en mag niet onder dezelfde website-only publicatietoestemming worden uitgevoerd.

**Belangrijke branch-waarschuwing:** GitHub concept-PR [#86](https://github.com/jkor95/JK-Works-app/pull/86) beschrijft 27 tests, cursorpaginering en inhoudsversies in een **Forgejo-voorbereidingsbranch**. De via GitHub zichtbare `codex/zelfstandige-backend-voorbereiding` bevat nog `src/records.mjs` en `src/routes.mjs` met slechts `clients`/`jobs`, zonder die beschreven paginering en versiecontrole. Dit is **niet** genoeg bewijs dat die features ontbreken in Forgejo: verifieer de exacte Forgejo-SHA en diff voordat een branch wordt aangepast of samengevoegd. **Niet opnieuw implementeren op basis van alleen het oudere GitHub-beeld.**

## Bewezen contracten vanuit de bestaande client

| Onderdeel | Codebron | Bestaand gedrag dat behouden moet blijven |
| --- | --- | --- |
| Lokale hoofdgegevens | `app/db.js` | IndexedDB `jkworks-dordrecht` versie 6 heeft **11** gebruikersstores: `mboxes`, `tools`, `checklists`, `clients`, `jobs`, `jobPhotos`, `timeEntries`, `pdfTemplates`, `documents`, `expenses`, `settings`. |
| Lokale pending state | `app/db.js`, `app/cloud.js` | Twee interne stores: `syncQueue` en `deleteMarkers`; beide meenemen in een apparaat-herstelproef. Een cloudexport alleen omvat mogelijk niet de laatste lokale wijzigingen. |
| Data- en tombstonetabellen | `app/cloud.js` | `app_records` bewaart `user_id,store,record_id,data,updated_at`; `app_deletions` bewaart `user_id,store,record_id,deleted_at`. Legacy records met `data.__deleted` worden bij sync gemigreerd naar tombstones. |
| Handmatige synchronisatie | `app/cloud.js` | Normale gegevens worden **niet** automatisch gesynchroniseerd bij opstarten/focus/online/timer. Aanmelden of expliciete Sync start synchronisatie. De toekomstige backend mag dit gedrag niet stilzwijgend vervangen. |
| Verwijderen versus offline bewerken | `app/db.js`, `app/cloud.js` | Eerst lokale markering, daarna DELETE in `app_deletions`, dan verwijderen uit `app_records` en bestandsopruiming. Deletes eerst uit de wachtrij; een oude PUT mag verwijderde data niet terugbrengen. |
| Bestanden in records | `app/cloud.js` | Blobvelden worden naar de bucket `jkworks-files` geüpload; JSON krijgt `__storagePath` en `__mime`. Bij ophalen worden de blobs weer opgebouwd. Bestandsinhoud, niet alleen padverwijzingen, hoort bij een volledig herstelbewijs. |
| Back-upinvoer | `app/cloud.js` | Browserback-up inventariseert ook `public_requests` en drie buckets: `jkworks-files`, `jkworks-request-files`, `jkworks-website-assets`. Leesrechten/eigenaarsscope van `public_requests` moeten vóór een migratie expliciet worden gevalideerd. |
| Auth en login | `app/cloud.js`, `inloggen/login.js` | Supabase sessies en `signInWithPassword`; eigenaar is gebaseerd op de geverifieerde sessiegebruiker, nooit een clientgestuurd `owner_id`. Accountidentiteiten en sessiegedrag moeten apart worden gemigreerd/getest. |
| Publieke website | `site.js` | Leest `app_records` met `store='websitePublic'`, `record_id='main'` voor teksten. Publieke aanvragen worden aan `public_requests` toegevoegd; foto's naar `jkworks-request-files`. Houd publieke routes gescheiden van privé-appgegevens. |
| Push | `app/push.js`, `app/cloud.js` | `jk-push` verwerkt config, aanmelden, afmelden, test, uitstellen en meldingstatus. Een beperkte `notificationSnapshot` wordt apart gepubliceerd; implementeer niet simpelweg alle privé-records als pushpayload. |
| Kalender | `app/calendar-sync.js` | `jk-calendar-feed` biedt enable, rotate, disable en publish. De privé agenda-URL is een bearer-geheim en blijft in localStorage, niet in gesynchroniseerde `settings`. Publicatie is een afzonderlijke opt-in van handmatige gegevenssync. |

## Concreet te verifiëren gaten vóór een productiemigratie

1. **Bronversies reconciliëren:** exacte Forgejo-branch/SHA met eerdere 27 tests vergelijken tegen GitHub PR #86; bestaand werk niet overschrijven, geen concurrerende wijzigingen op dezelfde branch.
2. **Compleet datamodel:** alle 11 hoofd- en 2 interne stores plus `app_records`, `app_deletions`, publieke aanvragen en drie buckets afdekken. De zichtbare GitHub-test-API ondersteunt vooralsnog alleen `clients` en `jobs`; dit zegt niets over een nieuwere Forgejo-versie.
3. **Paginering aan beide kanten:** de browserfunctie `readBackupSnapshot()` gebruikt expliciete paginering, maar `syncUnlocked()` haalt `app_records` en `app_deletions` op zonder zichtbare range-lus. Test met meer records dan de ingestelde serverlimiet; beoordeel beide clients en backend zonder productie-instellingen te wijzigen.
4. **Offline-conflicten:** test twee apparaten met lokale PUT, DELETE, herhaald versturen, verouderde versie, netwerkinval en herstart. Delete wint; een dubbel verzoek mag geen dubbele factuur, klus of bestand creëren.
5. **Herstelbewijs:** fictieve data voor Auth, records, tombstones, alle buckets, blobinhoud, publieke aanvragen, bijlagen en lokale niet-verzonden wijzigingen. Controleer referenties, aantallen en hashes na herstel in een lege geïsoleerde omgeving.
6. **Publicatie- en notificatiecontract:** eigen server mag pas na afzonderlijke tests publieke website-aanvragen, pushregistraties, vervallen tokens, agenda-linkrotatie en de beperkte notificatieprojectie overnemen.
7. **Veiligheidsgrenzen:** aparte testomgeving, server-side authenticatie en eigenaarsscheiding, geen publiek bereikbare DB, geen geheimen in broncode, veilige uploadlimieten, gedeelde login-rate-limit bij schaalvergroting.
8. **Go/no-go:** een werkende login en volledige twee-apparaten-proef met fictieve klanten, klussen, uren, offertes, facturen en bestanden; herstart én rollback bewezen. Pas na een **nieuwe afzonderlijke toestemming** productie omschakelen.

## Niet doen / overdracht naar Work

- **Niet** de bestaande V2 SchermLoop-site-release opnieuw posten; deze is al `published_verified`.
- **Niet** PR #86 mergeklaar verklaren op basis van alleen de GitHub-weergave of deze audit.
- **Niet** live Supabase-tabellen, Storage, gebruikers of de bestaande Coolify-app aanpassen.
- **Niet** een nieuwe deployment-toestemming afleiden van de eerdere website-only toestemming.
- **Wel:** eerst Forgejo- en GitHub-SHA's naast elkaar leggen, dit document als reviewchecklist gebruiken en daarna één afzonderlijk backendonderdeel plus fictieve tests per keer opleveren.

Dit document is **broncodeanalyse**, geen bewijs van een uitgevoerde end-to-end test of live database-inventarisatie. De productiegegevens zijn niet geraadpleegd.
