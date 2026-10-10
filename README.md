# JK Works Dordrecht v68

Deze versie bevat de openbare website op `jkworks.nl`, de beveiligde bedrijfsapp onder `/app/` en de inlogpagina onder `/inloggen/`.

Nieuw in v68:
- Publiek opdrachtformulier op de website, inclusief maximaal 3 automatisch gecomprimeerde foto's.
- Website-aanvragen direct zichtbaar in de persoonlijke app; omzetten naar klant + klus.
- Dashboardoverzicht met nieuwe aanvragen, open acties en openstaand bedrag.
- Documenten > Inkoop & bonnetjes voor zakelijke uitgaven en compact opgeslagen bonfoto's/PDF's.
- Betaalherinneringen voor verstuurde facturen waarvan de vervaldatum is verstreken.
- Klus herhalen met dezelfde klant/instellingen en een nieuwe datum/tijd.
- Klantgeschiedenis met klussen, uren, intern bedrag, openstaand bedrag en gekoppelde documenten.
- Alle functies uit v67 blijven behouden, inclusief de verbeterde PDF-uitlijning.

De benodigde Supabase-uitbreiding voor v68 is al toegepast op het huidige JK Works-project. De bijgewerkte `SUPABASE_SETUP.sql` zit alleen als naslag/herstelbestand in deze release.

Publiceren: vervang de bestaande GitHub Pages-bestanden door de inhoud van deze map en commit.


Update v69: de WhatsApp- en e-mailknoppen bovenaan de openbare website zijn verwijderd; contactmogelijkheden onderaan blijven behouden.

## Versie 70 - website opgeschoond
- Informatiebalk met horeca, kantooruren en persoonlijk contact verwijderd.
- Herhalingen in introductie, badges en footer beperkt.
- Inloggen alleen als subtiele link Beheer onderaan.
- Geen vast aantal foto's meer in het aanvraagformulier. Foto's worden nog steeds gecomprimeerd.
- **Belangrijk:** voer na het uploaden eenmalig `SUPABASE_V70_FOTOS.sql` uit in de Supabase SQL Editor, anders blijft de bestaande databasebeveiliging maximaal drie foto's toestaan.
- De bedrijfsapp zelf is ongewijzigd. Uploads zijn afhankelijk van de opslaglimieten van Supabase; grote aantallen foto's kunnen tijd kosten.
