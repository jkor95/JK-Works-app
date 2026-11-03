# JK Works zelfstandige backend — veilige testfase

De bestaande website, Supabase-productiegegevens en lokale IndexedDB-stores blijven ongemoeid.

## Bestaande appgegevens
De huidige app gebruikt de stores `clients`, `jobs`, `timeEntries`, `documents`, `pdfTemplates`, `jobPhotos`, `expenses`, `settings`, `mboxes`, `tools` en `checklists`. Supabase bewaart onder meer `app_records`, `app_deletions`, `public_requests`, Auth-gebruikers en bestanden in Storage. De lokale syncwachtrij kan nieuwer zijn dan de cloud.

## Afbakening
- De aparte records-module ondersteunt voorlopig alleen lezen van `clients` en `jobs`.
- Iedere query filtert op `owner_id`; parameters worden gebonden.
- Geen records-HTTP-routes: daarvoor moet eerst een betrouwbare authenticatielaag zijn geïmplementeerd en getest. Een vrij instelbare `owner_id` in de URL of request body is nadrukkelijk **niet veilig**.
- De schemafile `schema/jk_records.test-only.sql` is een **voorstel** en wordt niet automatisch uitgevoerd.
- Geen kopie van productiegegevens; gebruik fictieve testrecords.
- Geen automatische synchronisatie, accountmigratie of bestandsmigratie.

## Eerstvolgende veilige controles
1. Draai `npm test` vanuit `selfhost-api`; controleer de tests op de exacte branchcommit.
2. Laat de eigenaar afzonderlijk toestemming geven voor het aanmaken van de tabel **uitsluitend in de lege testdatabase**.
3. Bouw en test authenticatie en gebruikersisolatie voordat gegevens via HTTP beschikbaar worden.
4. Maak een volledig overdrachtsplan voor lokale én Supabase-gegevens, Auth, bijlagen en delete-markeringen voordat productie ooit omschakelt.
