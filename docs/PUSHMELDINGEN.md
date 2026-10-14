# Echte pushmeldingen

## Testmelding — v71.8.1 (voorbereid)

Onder Meer → Meldingen → Echte pushmeldingen vraagt **Test pushmelding versturen** één test aan. Na de serverbevestiging kan de gebruiker de app sluiten en de iPhone vergrendelen. De server wacht tot circa 30 seconden na de aanvraag en gebruikt de bestaande Web Push-transportlaag en VAPID-sleutels. De melding verschijnt via de serviceworker, niet via een browsermelding of browsertimer. Op iPhone blijven installatie op het beginscherm, pushabonnement en meldingstoestemming vereist; Focus-/systeeminstellingen kunnen zichtbaarheid beïnvloeden.

De server valideert de Supabase-gebruikerssessie en selecteert apparaten uitsluitend met `user_id` uit `auth.getUser`. De client mag geen ontvanger of inhoud bepalen. Titel: **JK Works – Testmelding**. Bericht: **Je pushmeldingen werken! ✅**.

Iedere druk maakt een nieuwe UUID-aanvraagcode. De aparte tabel `jk_push_test_requests` heeft een unieke sleutel op gebruiker + aanvraagcode. Herhaalde verzoeken plannen geen tweede verzending. Een atomische statusovergang van queued naar sending vóór Web Push voorkomt dubbele verzending door meerdere workers. Geen automatische retry na een onzekere netwerkuitkomst en geen verwijdering/wijziging van apparaatabonnementen. Een unieke notificatietag met renotify=false vervangt ook een eventuele dubbele push van dezelfde aanvraag zonder opnieuw te waarschuwen. Een bewuste nieuwe druk heeft een nieuwe code en dus een nieuwe test.

Het register bevat alleen gebruiker, aanvraagcode, tijdstippen, status en aantallen; geen klant- of bedrijfsinhoud, tokens of endpoints. RLS is aan, anon/authenticated hebben geen tabeltoegang. Alleen de Edge Function met bestaande service-role kan lezen/invoegen/bijwerken. Aanvraagcodes blijven bewaard voor blijvende deduplicatie. Bestaande actie-/webhooktabellen en cronjobs worden niet gewijzigd.

**Uitrollen:**
1. Eerst afzonderlijke eigenaarstoestemming voor uitsluitend `supabase/migrations/20261014_jk_push_test_requests.sql`. Voer alleen die nieuwe migratie uit, geen oudere voorbereide migraties en geen algemene db push.
2. Controleer de daadwerkelijk uitgerolde jk-push-code/configuratie via de Supabase Management API. Behoud bestaande VAPID-/webhooksecrets en de huidige verify_jwt-instelling; geen secrets opnieuw genereren. Voor beheer ontbreekt hier nog SUPABASE_ACCESS_TOKEN. Dit geheim hoort uitsluitend in de beveiligde Codex-omgevingsinstellingen, met api.supabase.com als toegestane bestemming, nooit in chat of Git.
3. Rol alleen jk-push uit met de beoordeelde broncode. De bestaande automatische acties, klantaanvraag-webhook en authenticatiepaden blijven inhoudelijk gelijk. Controleer de uitgerolde versie/configuratie voordat de frontend wordt samengevoegd/gepubliceerd.
4. Na geslaagde tests/GitGuardian en backendcontrole: PR samenvoegen en Pages controleren. Echte push na 30 seconden op een vergrendelde iPhone vereist een afzonderlijke handmatige test door de gebruiker. Codex stuurt tijdens fictieve tests geen echte melding.

EdgeRuntime.waitUntil houdt de servertaak onafhankelijk van de HTTP-response in leven. Dertig seconden past binnen de normale Supabase Free-wall-clocklimiet. Workeruitval/platformlimieten kunnen levering verhinderen; een bevestiging bewijst inplannen, niet tonen op de iPhone. Er is geen nieuwe periodieke job of automatisch herhaalproces. Maximaal één poging per apparaat krijgt voorrang boven mogelijk dubbel verzenden na een storing; er is geen exactly-once-levergarantie van de pushprovider.

## Bestaande configuratie (historische voorbereidingsstappen)
1. Goedkeuring nodig vóór SQL-migratie (nieuw schema en RLS). SQL: supabase/migrations/20261014_jk_push_subscriptions.sql.
2. Maak VAPID-sleutelpaar aan met web-push CLI; voeg **JK_VAPID_PUBLIC** en **JK_VAPID_PRIVATE** toe als Supabase Edge Function secrets. Bewaar private sleutel nooit in Git.
3. Stel **JK_PUSH_WEBHOOK_SECRET** in als lang willekeurig geheim. Deploy Edge Function 'jk-push' met JWT-validatie uit **uitsluitend omdat** deze functie zelf gebruikers-JWT controleert én webhook met apart geheim beschermt. Test Deno npm-web-push ondersteuning.
4. Maak Database Webhook voor INSERT op public.public_requests naar https://ercqiavruotoclhvfzud.supabase.co/functions/v1/jk-push met HTTP header x-jk-push-secret gelijk aan het ingestelde geheim. Let op: Supabase webhook-body heeft type='INSERT', table='public_requests', record.id.
5. Test met fictieve webhook en geïsoleerd account, zonder echte klantaanvragen. Zet pas daarna live.
6. Op iPhone: Safari > Deel > Zet op beginscherm, open /app/ via icoon, log in en kies Meer > Meldingen > Push inschakelen. Test met vergrendelde telefoon.
v71.8.0 bevat daarnaast de bestaande beveiligde servercontrole voor actie- en betaalherinneringen. Die code, de planning en websiteaanvraag-push blijven in v71.8.1 ongewijzigd. De actuele productieconfiguratie moet vóór deployment worden gelezen; oude voorbereidingsstappen zijn geen bewijs dat een configuratie ontbreekt.
