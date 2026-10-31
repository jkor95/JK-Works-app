# Fase 1: technische hostingtest JK Works op Dell

Deze container toont bewust **niet** de echte bedrijfsapp. Geen gebruikersdata, Supabase-keys, service_role, cookies, productie-sync, inkomende klantaanvragen of pushdiensten.

## Configuratie Coolify (later; nog niet toegepast)
- Repository: jkor95/JK-Works-app
- Branch: dell-migration-staging-20261031
- Dockerfile-pad: dell-staging/Dockerfile
- Build context: repository root
- Containerpoort: 8080
- Gebruik een NIEUW Coolify-resource; bestaande resources niet aanpassen.
- Gebruik een apart testdomein of uitsluitend interne toegang.
- Geen productievariabelen of bestaande database koppelen.

## Test
- GET /health => HTTP 200 met 'ok'
- GET / => duidelijke technische testpagina
- Geen Supabase- of externe API-aanroepen.

**Dit is een deploybare infrastructuurtest, geen voltooide JK Works-migratie.**
