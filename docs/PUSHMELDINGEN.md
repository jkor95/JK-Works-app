# Echte pushmeldingen — voorbereide configuratie (niet live)
1. Goedkeuring nodig vóór SQL-migratie (nieuw schema en RLS). SQL: supabase/migrations/20261014_jk_push_subscriptions.sql.
2. Maak VAPID-sleutelpaar aan met web-push CLI; voeg **JK_VAPID_PUBLIC** en **JK_VAPID_PRIVATE** toe als Supabase Edge Function secrets. Bewaar private sleutel nooit in Git.
3. Stel **JK_PUSH_WEBHOOK_SECRET** in als lang willekeurig geheim. Deploy Edge Function 'jk-push' met JWT-validatie uit **uitsluitend omdat** deze functie zelf gebruikers-JWT controleert én webhook met apart geheim beschermt. Test Deno npm-web-push ondersteuning.
4. Maak Database Webhook voor INSERT op public.public_requests naar https://ercqiavruotoclhvfzud.supabase.co/functions/v1/jk-push met HTTP header x-jk-push-secret gelijk aan het ingestelde geheim. Let op: Supabase webhook-body heeft type='INSERT', table='public_requests', record.id.
5. Test met fictieve webhook en geïsoleerd account, zonder echte klantaanvragen. Zet pas daarna live.
6. Op iPhone: Safari > Deel > Zet op beginscherm, open /app/ via icoon, log in en kies Meer > Meldingen > Push inschakelen. Test met vergrendelde telefoon.
Let op: alleen nieuwe klantaanvragen worden door serverpush verstuurd. Andere bestaande actie- en betaalherinneringen blijven lokaal totdat een afzonderlijke veilige serverplanning is toegevoegd.
