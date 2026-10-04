# JK Works Dordrecht App

Persoonlijke PWA voor JK Works Dordrecht.

## v14 - Klus, klant, offerte en factuur gekoppeld

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
Voor v14 hoeft `SUPABASE_SETUP.sql` niet opnieuw uitgevoerd te worden als v10 of nieuwer al correct is ingesteld.


## v14
Telefoonnummer en e-mailadres worden niet meer los op offerte- en factuur-PDFs geplaatst. Ze blijven wel in klant- en klusgegevens beschikbaar voor synchronisatie en hergebruik.
