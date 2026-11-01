# Coolify testdeployment (originele JK Works)

Gebruik uitsluitend de branch `codex/coolify-original-test` van `jkor95/JK-Works-app`.
De bestaande GitHub Pages-publicatie en het `CNAME`-bestand blijven ongemoeid.

- Resource: GitHub repository, Dockerfile build pack, Dockerfile-pad `/Dockerfile`.
- Containerpoort: `80`; HTTP-domein: `https://test.jkworks.nl`.
- Activeer HTTPS/Let's Encrypt in Coolify nadat de DNS naar de juiste server/proxy verwijst.
- Laat de bestaande Supabase-configuratie in de clientbestanden staan. Geen database-migraties.
- Controleer dat de gebruikte Supabase Auth redirect allowlist `https://test.jkworks.nl/**` toestaat voordat je een echte inlogtest uitvoert. Wijzig deze instellingen niet zonder aparte toestemming.
- Test op een apart browserprofiel; een sessie op test.jkworks.nl is niet dezelfde als op jkworks.nl.
- Controleer in de browser Network-tab of scripts, CSS, afbeeldingen, PDF's en service worker 200 teruggeven.
- Bevestig na een herstart van de Coolify-resource dat de healthcheck weer healthy wordt.

Dit is een statische Nginx-container. De app blijft afhankelijk van de bestaande Supabase-diensten, waaronder eventuele Edge Functions en pushconfiguratie. Push en OAuth kunnen domeinspecifieke instellingen vereisen; de Dockerfile verandert die niet.
