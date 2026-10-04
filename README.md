# JK Works Dordrecht App

Persoonlijke PWA voor JK Works Dordrecht.

## v15 - Klus, klant, offerte en factuur gekoppeld

- Een klus gebruikt dezelfde klantvelden als Klanten, Offertes en Facturen.
- Kies bij een klus een bestaande klant om alle contactgegevens automatisch over te nemen.
- Wijzigingen aan een gekoppelde klant vanuit de klus worden teruggeschreven naar de klantkaart.
- Vul je bij een nieuwe klus handmatig een nieuwe klant in, dan maakt de app automatisch een klantkaart aan en koppelt die aan de klus.
- Vanuit een klus kun je direct een offerte of factuur maken.
- Bij Offerte/Factuur kun je ook een klus kiezen; klantgegevens en datum werkzaamheden worden dan automatisch ingevuld.
- De klusomschrijving wordt als eerste omschrijvingsregel voorgesteld als die nog leeg is.
- Bestaande Supabase-sync en documentfuncties blijven behouden.

## Bijwerken

Vervang de bestanden in de bestaande GitHub Pages repository door de inhoud van deze map en commit de wijzigingen.
Voor v15 hoeft `SUPABASE_SETUP.sql` niet opnieuw uitgevoerd te worden als v10 of nieuwer al correct is ingesteld.


## v15
Telefoonnummer en e-mailadres worden niet meer los op offerte- en factuur-PDFs geplaatst. Ze blijven wel in klant- en klusgegevens beschikbaar voor synchronisatie en hergebruik.


## v17
Facturen krijgen standaard een vervaldatum van 14 dagen na de factuurdatum. Deze datum blijft handmatig aanpasbaar.


## v17 wijziging
Bij het maken van een offerte of factuur is een klus nu verplicht. De gekozen klus wordt altijd als eerste regel gebruikt; de omschrijving van regel 1 komt rechtstreeks uit Klussen.


## v19
- Het onderdeel 'Installatie & iCloud' is verwijderd uit Meer.
- Urenstatistieken toegevoegd met grafieken per maand, kwartaal en kalenderjaar.


## Dashboard v19
Het dashboard is vereenvoudigd: de zwarte merk/headerkaart en KPI-blokken zijn verwijderd. Snel openen bevat Inpakchecklist, Nieuwe factuur, Nieuwe offerte, Uren invoeren, Nieuwe klus, Klanten en Urenstatistieken met een mini-grafiek van het huidige kalenderjaar.
