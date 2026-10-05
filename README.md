# JK Works Dordrecht App v37

## Agenda via .ics
- Google Agenda-links zijn vervangen door lokale .ics-agendabestanden.
- Bij Klussen, Urenregistratie en gekoppelde Offertes/Facturen staat nu `Toevoegen aan agenda`.
- Het .ics-bestand bevat titel, datum, begin- en eindtijd, klant, adres en notities waar beschikbaar.
- Op iPhone wordt waar mogelijk het deelmenu geopend met het agenda-bestand; anders wordt het bestand gedownload.
- Er is geen Google Cloud Console, Apps Script, Google API-key of Supabase Edge Function nodig.
- Bij een klus zonder starttijd wordt een hele-dagafspraak gemaakt.

## Synchronisatie
De handmatige Supabase-synchronisatie uit eerdere versies blijft ongewijzigd. Formulieren worden niet periodiek door cloud-sync ververst.

## Installeren/updaten
Vervang de bestaande bestanden in de GitHub Pages-repository door de bestanden uit deze map en commit de wijziging. Er is geen nieuwe Supabase SQL nodig.
