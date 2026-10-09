# JK Works Dordrecht v61

Deze versie combineert de openbare website en de beveiligde bedrijfsapp op `jkworks.nl`.

## Structuur

- `/` - openbare website voor klanten
- `/inloggen/` - beveiligde inlogpagina
- `/app/` - bestaande JK Works-bedrijfsapp als PWA

De bedrijfsapp bevat alle functies uit v60, inclusief KOR- en normale btw-offerte/factuurtemplates.

## Publiceren op GitHub Pages

Upload de **inhoud van deze map** naar de root van dezelfde GitHub-repository en commit de wijzigingen. Laat `CNAME` met `jkworks.nl` staan.

Na deployment:

1. Controleer `https://jkworks.nl/`.
2. Controleer `https://jkworks.nl/inloggen/`.
3. Log in en controleer dat je naar `https://jkworks.nl/app/` gaat.
4. Verwijder op iPhone het oude beginscherm-icoon dat nog naar de root verwijst.
5. Open `https://jkworks.nl/app/` in Safari en kies **Zet op beginscherm**. De nieuwe PWA start dan rechtstreeks in `/app/`.

## Supabase

Geen nieuwe SQL nodig. De bestaande Supabase-configuratie blijft gebruikt worden.

## Belangrijk bij volgende versies

- `CNAME` in de root behouden.
- De PWA-bestanden en service worker onder `/app/` houden.
- De openbare website mag geen bedrijfsdata uit Supabase laden.
