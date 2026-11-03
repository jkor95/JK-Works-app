# JK Works: veilige overgang naar eigen server (voorbereiding)

Status: **ontwerp, niet gedeployed**. De huidige productie-app blijft Supabase gebruiken.
Deze voorbereiding voert geen SQL uit, wijzigt geen gebruikers, en verplaatst geen gegevens.

## Vastgestelde afhankelijkheden
- `app/cloud.js`: Supabase Auth, app_records, app_deletions, Storage en synchronisatie.
- `inloggen/login.js` en `site.js`: Supabase-sessies en openbare aanvragen.
- `app/push.js`: Supabase Edge Function voor push.
- `app/calendar-sync.js`: Supabase Edge Function voor agenda.
- `supabase/functions/`: serverfuncties.
- Alleen een draaiende PostgreSQL-container is **geen** bewijs van een werkende JK Works-datamigratie.

## Veilige volgorde en acceptatiecriteria
1. **Inventarisatie (alleen lezen).** Leg alle tabellen, RLS, Auth-identiteiten,
   buckets, objecten, triggers, functies en gegevensaantallen vast. Vergelijk
   dit met de client-API en met lokale IndexedDB-gegevens. Bewaar geen
   persoonsgegevens of credentials in GitHub.
2. **Geïsoleerde testbackend.** Maak een eigen API op een afzonderlijk
   testdomein en een afzonderlijke PostgreSQL-database. De API moet
   server-side authenticatie, autorisatie per eigenaar, validatie,
   requestlimieten en auditlogging afdwingen. Nooit een service-role
   credential in de browser of repository.
3. **Contracttests met fictieve data.** Test aanmaken, wijzigen, verwijderen,
   conflicten, offline opnieuw verbinden, paginering, dubbele verzoeken,
   bijlagen, PDF-referenties en synchronisatie op twee apparaten.
4. **Volledige back-up en herstelproef.** Exporteer database, Auth-identiteiten
   en Storage-bestandsinhoud afzonderlijk. Controleer aantallen en hashes;
   herstel in een *lege* geïsoleerde testomgeving. Behoud herstelpunten.
5. **Proefmigratie.** Vergelijk per entiteit aantallen, eigenaarschap,
   referenties en checksums. Bevestig expliciet welke accounts opnieuw
   moeten inloggen en hoe wachtwoorden veilig worden overgezet.
6. **Omschakelplan.** Plan een korte schrijfstop of aantoonbaar correcte
   incrementele synchronisatie. Voer een laatste export en verificatie uit.
   Houd de bestaande Supabase-productiegegevens intact als rollback.
7. **Pas na afzonderlijke toestemming:** productie-omschakeling, migratie
   van echte gegevens, DNS-/domeinwijziging of uitschakelen van Supabase.

## Vereiste beveiliging
- Geen publieke PostgreSQL-poort; alleen API via HTTPS en interne
  databaseverbinding.
- Test en productie hebben aparte databases, credentials, opslag en sessies.
- Geen automatische productie-mutaties tijdens healthchecks.
- Back-ups versleuteld en buiten de primaire server bewaard; herstel
  periodiek met fictieve of afzonderlijk goedgekeurde testdata controleren.
- Secrets uitsluitend in beveiligde Coolify-instellingen, nooit in Git.
- Auth-sessies en RLS-gedrag moeten aantoonbaar equivalent of strenger zijn.
- Rate limiting, CSRF/CORS, veilige cookies en uploadlimieten testen.

## Huidige blokkades
- De bestaande GitHub-koppeling geeft toegang tot broncode en serverrapporten,
  niet tot de Supabase-productiedatabase of een geauthenticeerde Coolify-API.
- Zonder die toegang kan een echte gegevensmigratie niet veilig worden
  uitgevoerd of geverifieerd.
- Het agentrapport toont Docker-containers maar bevestigt geen mapping
  tussen alle appnamen en domeinen.
- Een gezonde container bewijst niet dat inloggen en synchronisatie werken.

## Definitie van klaar
Een testgebruiker kan op twee apparaten fictieve klanten, klussen, uren,
offertes, facturen en bestanden beheren, ook na een serverherstart;
push en agenda zijn getest; een back-up is succesvol hersteld;
geen testdata belandt in productie; alle relevante regressietests slagen.
