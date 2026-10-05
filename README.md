# JK Works Dordrecht - v31

## Nieuw in v31
- Een klus met datum, starttijd en eindtijd maakt automatisch een gekoppelde urenregistratie aan.
- Als de klusplanning later wordt aangepast, wordt de automatische urenregistratie bijgewerkt.
- Na de geplande eindtijd verschijnt bij de eerstvolgende keer dat de app wordt bekeken een herinnering: uren controleren en eventueel direct factureren.
- De herinnering kan worden afgehandeld, naar de urenregistratie leiden, direct een factuur openen of tot de volgende appsessie worden uitgesteld.

## Updaten
Vervang de bestaande bestanden in de GitHub Pages repository door deze versie en commit de wijziging. Voor v31 is geen nieuwe Supabase SQL nodig.


## v31 - invoer niet meer onderbroken
Automatische cloud-synchronisatie pauzeert zolang een formulier of venster open staat. Na opslaan/sluiten wordt de synchronisatie hervat. De periodieke achtergrondcontrole is verlengd naar 2 minuten en veroorzaakt geen scherm-refresh tijdens invoer.


## v32
- Urenstatistieken uitgebreid met **Per klant**.
- Per klant kan een kalenderjaar worden gekozen.
- Toont uren per klant, totaaluren, aantal klanten en de klant met de meeste uren.
