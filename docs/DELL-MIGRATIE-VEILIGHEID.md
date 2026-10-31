# JK Works migratie naar Dell — alleen testomgeving

## Veiligheidskopie (code)
- Onaangeroerde reservebranch: `backup-before-dell-migration-20261031`.
- Afzonderlijke ontwikkelbranch: `dell-migration-staging-20261031`.
- `main` en de live GitHub Pages-website blijven ongemoeid.
- Een Git-branch bewaart **geen** Supabase-database, Auth-accounts, Storage-bestanden of lokale IndexedDB-inhoud.

## Broninventaris (alleen-lezen, 31-10-2026)
- Supabase-project: JK Works, PostgreSQL 17, EU-west.
- Applicatietabellen waaronder app_records, app_deletions, public_requests en push/calendar-tabellen.
- Supabase Auth voor inloggen; Storage heeft 3 buckets.
- De app gebruikt ook lokaal IndexedDB; niet-gesynchroniseerde gegevens kunnen daar uitsluitend voorkomen.
- Er is **nog geen gecontroleerde volledige productieback-up** gemaakt.
- De Dell-server bevat een ander testproject; deze database **niet** gebruiken als originele JK Works-data.

## Verplichte stopvoorwaarden
1. Originele data plus Auth + Storage (alle bestanden) onafhankelijk van Supabase exporteren, versleuteld en buiten de Dell bewaren.
2. Controle van volledigheid en herstel in een geïsoleerde omgeving.
3. Auth/Storage/Edge Functions, kalendertoegang, pushmeldingen, RLS en lokale synchronisatie inventariseren.
4. Dell staging krijgt eigen database, secrets, domein en opslag; geen productiepush of e-mail.
5. Voor omschakelen expliciete toestemming; rollbackplan en gegevensvergelijking verplicht.
6. Geen gevoelige gegevens of back-ups committen naar GitHub.

## Status
Alleen code veiliggesteld via branch; migratie of productieback-up is nog niet uitgevoerd.
