JK Works Dordrecht v65

Nieuw in deze versie:
- SEO voor de openbare website: canonical URL, verbeterde titel/meta-description, Open Graph, LocalBusiness structured data, robots.txt en sitemap.xml.
- /app/ en /inloggen/ zijn expliciet noindex zodat alleen de klantenwebsite bedoeld is voor Google.
- Factuur- en offerteomschrijvingen worden niet meer afgekapt. Een lange omschrijving wordt netjes over maximaal twee regels in dezelfde rij gezet.
- Tijdvakken zoals 10:00 - 16:00 blijven als geheel op één regel staan.
- Eénregelige omschrijvingen blijven op 12 pt; tweeregelige omschrijvingen worden passend verkleind zodat beide regels binnen dezelfde rij blijven.
- De omschrijving is in het invoerscherm nu een tweeregelig tekstvak.
- Alle vier de templates uit v64 (KOR en normaal/btw voor offerte en factuur) blijven behouden.
- Websitebeheer, beveiligde bedrijfsapp en jkworks.nl blijven behouden.

Publiceren:
1. Upload de volledige inhoud van deze map naar de root van de GitHub-repository en commit.
2. Wacht op GitHub Pages deployment.
3. Controleer https://jkworks.nl/ en https://jkworks.nl/sitemap.xml.
4. Voeg daarna in Google Search Console https://jkworks.nl/ toe en dien sitemap.xml in.

Supabase:
- Geen nieuwe SQL nodig ten opzichte van v64.
- Als de v63 websitebeheer-policy nog niet is uitgevoerd, voer SUPABASE_SETUP.sql wel eenmalig uit.
