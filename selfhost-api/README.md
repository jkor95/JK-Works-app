# JK Works eigen backend — geïsoleerde basis

**Niet in productie gebruiken.** Deze eerste versie bevat uitsluitend
`GET /health/live` en `GET /health/ready`. Er zijn bewust nog geen
login-, klant-, factuur- of schrijfroutes. Geen bestaande Supabase-data
wordt gelezen of gewijzigd.

## Lokaal testen
Node.js 20+ en een test-PostgreSQL nodig voor de readinesscheck.
```sh
cd selfhost-api
npm install
NODE_ENV=test npm test
```
De tests gebruiken een gesimuleerde database; ze veranderen geen data.

## Coolify (pas bij afzonderlijke testinstallatie)
Maak een **nieuwe, afzonderlijke testapplicatie**, niet de bestaande
JK Works-productie- of testapp overschrijven. Dockerfile build,
repository subdirectory `selfhost-api`, interne poort 3000.
Gebruik uitsluitend een *aparte lege testdatabase* via een Coolify
environment secret `DATABASE_URL`; plak nooit credentials in chat/Git.
Zet voorlopig geen publiek domein op deze API totdat toegangsbeveiliging,
netwerk en rate limiting zijn ingericht. Een interne readinesscheck
geeft 200 bij databaseverbinding, anders 503.

## Nog te bouwen
Veilige sessies, eigenaarsscheiding, schema, synchronisatie,
bestandsopslag, agenda en push. Productiemigratie pas na expliciete
goedkeuring en geteste volledige back-up en herstel.
