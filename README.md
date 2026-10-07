# JK Works Dordrecht App v54


## Nieuw in v54 - meldingen afstrepen

- Elke openstaande actie heeft nu naast openen ook een knop `Niet nodig`.
- Een weggeklikte actie verdwijnt direct uit het actiecentrum en telt niet meer mee in de rode badge of app-icoonbadge.
- Bij een weggeklikte urenmelding wordt ook de oude `Klus afgelopen`-herinnering voor die klus als afgehandeld gemarkeerd.
- Weggeklikte meldingen worden opgeslagen in de app en gaan bij de volgende handmatige synchronisatie mee naar Supabase, zodat ze ook op andere apparaten verborgen blijven.
- Onder `Meer > Meldingen` staat, zodra er weggeklikte meldingen zijn, een knop om alle verborgen meldingen weer te herstellen.
- De bestaande categorie-aan/uit-instellingen blijven ongewijzigd.

Geen nieuwe Supabase SQL nodig.

## Nieuw in v53 - meldingen, acties en badges

- Bovenin staat een meldingenknop met het aantal openstaande acties.
- Actiecentrum voor:
  - uren invoeren / controleren na een klus;
  - verplichte foto's voor, tijdens en na;
  - offerte opmaken;
  - offerte versturen;
  - factuur opmaken;
  - factuur versturen.
- Bij een klus kan nu `Offerte nodig voor deze klus` worden aangevinkt. Alleen dan ontstaat een actie om een offerte op te maken. Een bestaande, nog niet verstuurde offerte kan wel altijd als verstuuractie verschijnen.
- Factuuracties gelden alleen voor klussen met afhandeling `Factuur`; contante klussen krijgen geen factuurmelding.
- Onder `Meer > Meldingen` kan elke categorie afzonderlijk aan of uit.
- Daar kunnen ook het app-icoonbadge en iPhone/browser-systeemmeldingen worden ingesteld.
- Op ondersteunde geinstalleerde PWA's wordt het aantal openstaande acties via de Badging API op het app-icoon gezet.
- Systeemmeldingen vragen expliciet toestemming en worden alleen gebruikt als de gebruiker ze inschakelt.
- De bestaande herinnering na afloop van een klus respecteert nu de categorie `Uren` en verschijnt niet als die categorie is uitgezet.
- Handmatige synchronisatie blijft ongewijzigd; het controleren van meldingen veroorzaakt geen pagina-refresh en start geen cloud-sync.

## Belangrijk over iPhone

- Het in-app actiecentrum werkt altijd wanneer de app geopend is.
- Een badge op het iPhone-beginscherm en webmeldingen vereisen dat JK Works als web-app op het beginscherm is geinstalleerd en dat meldingen zijn toegestaan.
- Deze versie gebruikt geen Web Push-server. Daardoor kan een volledig afgesloten web-app niet zelfstandig op een exact later moment wakker worden. Wanneer de app wordt geopend, hervat of actief is, worden acties opnieuw gecontroleerd en badges bijgewerkt.

## Bestaande functies behouden

Alle functies uit v52 blijven behouden, waaronder handmatige Supabase-sync, klusfoto's, Materiaal-checklists, uren- en bedragstatistieken, documenten, automatische PDF-uitlezing, jaaroverzicht facturen, interne betaaltypen en automatische factuur-/offerteomschrijvingen.

Geen nieuwe Supabase SQL nodig.
