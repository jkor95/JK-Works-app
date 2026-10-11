# Wijzigingsgeschiedenis

## v71.4.2 — voorstel, nog niet gepubliceerd
- Uitgeschakelde GitHub Actions-productieback-up met versleutelde externe R2-opslag, inventaris en integriteitscontrole.
- Lokale fixturetests voor database/Auth/RLS en Storage-export/herstel; geen productiecredentials of productieback-up.
- Voorstel met kosten, 35 dagen retentie, secretinstellingen, foutmeldingen en veilig testherstel; zie [cloudback-ups](docs/CLOUDBACKUPS.md).
- Dagelijkse cron en productietoegang blijven uit; activatie en eerste echte back-up vereisen afzonderlijke goedkeuring.

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
