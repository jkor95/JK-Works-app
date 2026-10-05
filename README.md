# JK Works Dordrecht app v42

## Nieuw in v42
- Per klus kun je bij het aanmaken/bewerken instellen of foto's **niet nodig**, **optioneel** of **verplicht voor, tijdens en na** zijn.
- Bij een gekozen checklist wordt voor een nieuwe klus automatisch een logisch voorstel gedaan: Catering / horeca = niet nodig, overige kluschecklists = verplicht. Dit is altijd handmatig aanpasbaar.
- In een klus staat een nieuwe sectie **Foto's** met drie aparte delen: Voor, Tijdens en Na.
- Per deel kun je op iPhone direct **Foto maken** of bestaande foto's **Uploaden**.
- Meerdere foto's per fase zijn toegestaan en foto's kunnen weer worden verwijderd.
- Foto's worden lokaal in de app bewaard en gaan bij de handmatige Sync mee naar Supabase Storage.
- Grote foto's worden waar mogelijk verkleind tot maximaal ongeveer 1600 px om opslag en dataverbruik te beperken.
- Verwijder je een klus, dan worden de gekoppelde klusfoto's ook verwijderd.
- Cloud opschonen neemt nu ook klusfoto's mee.

## Kluschecklists
Alle kluschecklists behalve **Catering / horeca** krijgen drie losse fotopunten:
- Foto vóór de klus maken
- Foto tijdens de klus maken
- Foto na de klus maken

Catering / horeca krijgt deze fotopunten bewust niet.

## Supabase
Geen nieuwe SQL nodig. Foto's gebruiken dezelfde bestaande `app_records`-opzet en de bestaande Storage-bucket `jkworks-files`.
