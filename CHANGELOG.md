# Wijzigingsgeschiedenis

## v71.4.2 — voorstel, nog niet gepubliceerd
- Lokale Docker Desktop-herstelproef vervallen na twee mislukte Mac-starts; Mac-testbestanden verwijderd. Back-up en fictieve GitHub-tests gebruiken native PostgreSQL-tools.
- Eén handmatige productieback-up voorbereid, uitsluitend na expliciete goedkeuring; dagelijkse planning en uurlijkse bewaking blijven uit. Geen productieback-up uitgevoerd.
- Supabase wordt uitsluitend uitgelezen; database-export met read-only verbindingen en geverifieerde TLS, Storage uitsluitend GET zonder redirects. Versleutelde R2-upload met volledige ontsleutelde download, checksums en als laatste COMPLETE.
- Negen secret- en twee variabelenbindings gecontroleerd; aanwezigheid wordt in de goedgekeurde workflow zonder waarden gecontroleerd. Metadata momenteel ontoegankelijk (HTTP 403).
- Fictieve PostgreSQL-/Storage-/encryptietests bewijzen geen volledige Supabase-herstelbaarheid. Volledige hersteltest niet geslaagd; herstelbaarheid niet gegarandeerd.
- GitGuardian blijft eerdere fictieve testwaarden in commit ac3f4d4 melden; afhandeling vereist GitGuardian-beheerrechten. Scanner en Git-geschiedenis behouden.
- Website, main, versietags en Supabase-productie ongewijzigd; voorbereiding en herstelprocedure in docs/CLOUDBACKUPS.md.

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
