# JK Works: gecontroleerde migratie naar Dell

## Huidige status
- Een geïsoleerde Docker/Nginx-testpagina draait op test.jkworks.nl met HTTPS en HTTP Basic Auth.
- Live jkworks.nl en de Supabase-productieomgeving blijven ongewijzigd.
- GitHub-codebackup: backup-before-dell-migration-20261031.
- De eigenaar heeft een extra in-app-back-up in iCloud. Deze is **niet** bewezen voldoende voor volledig herstel.

## Inventaris broncode
- app/cloud.js: Supabase Auth, app_records, app_deletions, public_requests, Storage en pushprojectie.
- site.js: openbare website-aanvragen en aanvraagfoto's met Supabase.
- app/db.js: IndexedDB op gebruikersapparaat; synchronisatie en herstel zijn apart te testen.
- Supabase Edge Functions: jk-push, jk-calendar-feed (aanvullende functies aanwezig mogelijk via dashboard).
- Supabase Storage: jkworks-files, jkworks-request-files, jkworks-website-assets.
- Supabase Auth: bestaande login mag niet zonder plan vervangen worden.

## Geverifieerde Supabase-structuur (geen gegevens gekopieerd)
- public.app_records, public.app_deletions, public.public_requests;
- push-gerelateerde tabellen: jk_push_subscriptions, jk_push_action_state, jk_push_user_state, jk_push_schedule_auth, jk_push_test_requests, jk_push_action_snoozes;
- jk_calendar_feeds; auth.users/identities/sessions; storage.buckets/objects.
- Structuurinventaris is read-only. Rijaantallen zijn momentopnames, geen integriteitscontrole.

## Migratie in veilige fases
1. **Volledige productieback-up** van database inclusief Auth-metadata en Storage-objectinhoud naar versleutelde opslag buiten GitHub; daarna herstelproef. Zonder deze stap geen productiegegevens importeren.
2. Ontwerp afzonderlijke Dell-database `jkworks_app`, eigen niet-superuser rol en opslagvolume. Behoud bestaande MijnLoop-testdatabase en Coolify DB.
3. Bouw zelfstandige backend met sessies, authorization checks per owner, data-API en geauthenticeerde bestanden. Geen publieke directe SQL/API zonder toegangscontrole.
4. Implementeer client-configuratie met standaard **cloudverbinding uitgeschakeld** op test.jkworks.nl. Test met fictieve accounts/records en testbestand. Geen live Supabase-sync, e-mail, push of publiek aanvraagformulier.
5. Migreer kopieën van echte data naar geïsoleerde testomgeving; vergelijk aantallen, schema, verwijdermarkeringen, bestandshashes en factuurnummers. Test mobiel en desktop.
6. Auth-migratie beoordelen: GoTrue wachtwoordhashes alleen met bewezen compatibele Auth-server overzetten; anders gecontroleerde password-reset. Niet aannemen dat wachtwoorden automatisch werken.
7. Onafhankelijke off-site back-up, hersteltest, app-controles, beveiligingsreview, rollbackplan.
8. Pas na expliciete toestemming en finale sync omschakelen. Supabase niet verwijderen totdat alles geverifieerd is.

## Onmiddellijke technische prioriteit
Ontwerp en test een aparte backend met fictieve data; pas daarna kunnen we de echte JK Works-front-end veilig aansluiten. De bestaande Nginx-stagingcontainer is alleen een netwerk-/hostingtest, **niet** de bedrijfsapp.

## Belangrijke veiligheidsregels
- Nooit service_role, databasewachtwoorden, Auth-export of klantdata in GitHub.
- Verander de productiebranch `main`, GitHub Pages, live Supabase-project of hun DNS niet.
- Een test-frontend mag nooit een schrijvende verbinding met productie-Supabase maken.
