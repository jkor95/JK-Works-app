# JK Works Dordrecht App v48

## Nieuw in v48 - jaaroverzicht verkoopfacturen
- Onder Documenten staat een kleine knop **Jaaroverzicht PDF**.
- Kies een kalenderjaar en download een PDF met samenvatting en detailregels van de opgeslagen facturen.
- Het overzicht bevat o.a. factuurnummer, factuurdatum, klant, werkzaamheden, aantallen/prijzen, totaal en betaalstatus voor zover opgeslagen.
- Het rapport is aanvullend; de originele facturen blijven de fiscale brondocumenten en moeten volgens de geldende bewaarplicht worden bewaard.
- Geen nieuwe Supabase SQL nodig.


## Nieuw in v47 – duidelijkere kluschecklists
- Klusfoto’s synchroniseren weer via Supabase zodat ze op iPhone, MacBook en andere ingelogde apparaten zichtbaar zijn.
- Foto’s worden vóór opslag gecomprimeerd: lange zijde maximaal circa 1600 px, JPEG, met een doel/harde richtwaarde van maximaal circa 250 KB per foto.
- Gemiddeld 9 foto’s per klus is daarmee maximaal circa 2,25 MB per klus.
- Documenten → Klusfoto’s toont exact hetzelfde fotorecord als de klus; er is dus geen tweede foto/cloudbestand.
- Bestaande lokale v44-foto’s worden éénmalig gecomprimeerd en klaargezet voor de eerstvolgende handmatige Sync.
- Foto’s gaan nog steeds alleen naar de cloud wanneer de gebruiker handmatig op Sync drukt.

Geen nieuwe Supabase SQL nodig.


- Makita-machines worden in kluschecklists voortaan met volledige productnaam getoond.
- Dubbele checklistregels zijn opgeschoond: als een complete Organizer of Mbox wordt meegenomen, worden losse inhoudsitems niet nogmaals als aparte regel genoemd.