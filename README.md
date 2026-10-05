# JK Works Dordrecht - v35

## Nieuw
- Google Agenda vanuit Klussen opent op iPhone nu direct vanuit de tikactie, net als bij Urenregistratie. Dit voorkomt dat iOS de link blokkeert na een asynchrone databasecheck.
- Klusdatum, starttijd en eindtijd worden rechtstreeks meegestuurd. Alleen oude klussen zonder opgeslagen tijd gebruiken nog de gekoppelde urenregistratie als fallback.
- In Meer -> Bedrijfsgegevens kan een Google Agenda kalender-ID voor `Werk` worden ingesteld. Als die is ingevuld, wordt die kalender via de Google Agenda-link voorselecteerd.
- Dezelfde kalenderkeuze wordt gebruikt voor Klussen, Urenregistratie, Offertes en Facturen.

## Google Agenda kalender-ID vinden
Open Google Agenda op een computer -> Instellingen -> kies de agenda `Werk` -> Agenda integreren -> Agenda-ID. Plak die ID in Meer -> Bedrijfsgegevens.

## Updaten
Vervang de bestanden in de bestaande GitHub Pages repository door deze versie en commit de wijziging. Er is geen nieuwe Supabase SQL nodig.
