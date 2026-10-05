# JK Works Dordrecht - PWA v26

Persoonlijke bedrijfsapp voor JK Works Dordrecht.

## v26 - app volledig achter Supabase-login

- De app-interface wordt niet meer getoond voordat er is ingelogd.
- Dezelfde Supabase-inlog wordt gebruikt voor toegang tot de app en voor synchronisatie.
- Er is op het toegangsscherm alleen een knop **Inloggen**; nieuwe accounts worden daar niet aangemaakt.
- Na uitloggen wordt de volledige app direct weer vergrendeld.
- Een bestaande Supabase-sessie blijft bewaard, zodat je op je eigen iPhone/MacBook niet bij ieder openen opnieuw hoeft in te loggen.
- Alle bestaande JK Works-functies uit v24 blijven behouden.

## Bijwerken

Voor v26 is geen nieuwe SQL nodig. Vervang de bestaande GitHub Pages-bestanden door deze map en commit de wijziging.

Voor extra bescherming is het verstandig om in Supabase Auth het aanmaken van nieuwe gebruikers uit te schakelen nadat jouw eigen account bestaat.

## Belangrijk over GitHub Pages

GitHub Pages is statische publieke hosting. De login vergrendelt de app-interface en de bedrijfsdata in Supabase blijft afgeschermd door de bestaande Row Level Security-regels. De statische bronbestanden van de website zelf (HTML/JavaScript, logo en meegeleverde lege PDF-sjablonen) zijn bij een publieke GitHub-repository echter niet geheim. Zet daarom nooit geheime sleutels of klantdata rechtstreeks in de broncode.


## v26 - Google Agenda tijden
Google Agenda-links gebruiken voor afspraken met tijden nu expliciete UTC-tijdstippen die vanuit Europe/Amsterdam worden berekend. Hierdoor worden start- en eindtijd op mobiel als tijdsblok geopend in plaats van als hele-dagafspraak. Klussen zonder starttijd blijven bewust hele-dagafspraken.
