# JK Works Dordrecht v4 - Supabase synchronisatie

## Eenmalig in Supabase
1. Open je project.
2. Ga naar SQL Editor > New query.
3. Open `SUPABASE_SETUP.sql`, kopieer alles, plak het in de SQL Editor en klik Run.
4. Ga naar Authentication > Providers > Email en laat Email aan staan.
   - Als 'Confirm email' aan staat, moet je na Account maken eerst de link in de bevestigingsmail openen.

## Nieuwe versie op GitHub zetten
Vervang de bestanden van je huidige GitHub Pages repository door de inhoud van deze map en commit de wijzigingen.
Je bestaande GitHub Pages URL blijft hetzelfde.

## Eerste keer koppelen
1. Open de app op je iPhone.
2. Meer > Synchronisatie > Account maken.
3. Gebruik je eigen e-mailadres en kies een wachtwoord.
4. Bevestig eventueel de e-mail.
5. Log in en druk één keer op 'Nu synchroniseren'.
6. Open daarna dezelfde app op je MacBook en log in met exact hetzelfde account.

Vanaf dat moment worden klanten, klussen, uren, checklists, instellingen en PDF-documenten via Supabase gesynchroniseerd. De app blijft daarnaast lokaal werken; wijzigingen die je offline doet worden in een wachtrij gezet en bij de volgende internetverbinding verstuurd.

Let op: je kunt PDF's nog steeds vanuit de app naar iCloud Drive delen/bewaren. Supabase bewaart daarnaast een synchronisatiekopie zodat dezelfde documenten ook op je andere apparaat in de app beschikbaar zijn.
