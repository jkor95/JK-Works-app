# JK Works Dordrecht App v45

## Nieuw in v45 – klusfoto’s compact in de cloud
- Klusfoto’s synchroniseren weer via Supabase zodat ze op iPhone, MacBook en andere ingelogde apparaten zichtbaar zijn.
- Foto’s worden vóór opslag gecomprimeerd: lange zijde maximaal circa 1600 px, JPEG, met een doel/harde richtwaarde van maximaal circa 250 KB per foto.
- Gemiddeld 9 foto’s per klus is daarmee maximaal circa 2,25 MB per klus.
- Documenten → Klusfoto’s toont exact hetzelfde fotorecord als de klus; er is dus geen tweede foto/cloudbestand.
- Bestaande lokale v44-foto’s worden éénmalig gecomprimeerd en klaargezet voor de eerstvolgende handmatige Sync.
- Foto’s gaan nog steeds alleen naar de cloud wanneer de gebruiker handmatig op Sync drukt.

Geen nieuwe Supabase SQL nodig.
