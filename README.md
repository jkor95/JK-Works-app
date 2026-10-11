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

Updates en herstel verlopen voortaan via Codex-branches en beoordeelde pull requests. Zie [versiebeheer en herstel](docs/VERSIEBEHEER.md) en [wijzigingsgeschiedenis](CHANGELOG.md). Upload geen losse bestanden naar `main`.


Update v69: de WhatsApp- en e-mailknoppen bovenaan de openbare website zijn verwijderd; contactmogelijkheden onderaan blijven behouden.

## Versie 70 - website opgeschoond
- Informatiebalk met horeca, kantooruren en persoonlijk contact verwijderd.
- Herhalingen in introductie, badges en footer beperkt.
- Inloggen alleen als subtiele link Beheer onderaan.
- Geen vast aantal foto's meer in het aanvraagformulier. Foto's worden nog steeds gecomprimeerd.
- **Historische notitie v70:** deze release verwees naar `SUPABASE_V70_FOTOS.sql`. Voer bij website-updates geen SQL uit; databasewijzigingen vereisen een afzonderlijke opdracht. Het bestand zit niet in deze checkout.
- De bedrijfsapp zelf is ongewijzigd. Uploads zijn afhankelijk van de opslaglimieten van Supabase; grote aantallen foto's kunnen tijd kosten.
