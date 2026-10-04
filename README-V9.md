# JK Works Dordrecht v9 - definitieve delete-merge fix + hernoemen

- Fix voor documenten en uren die na verwijderen terugkwamen: tombstones blijven gedurende de volledige merge leidend en kunnen niet meer als ontbrekend cloudrecord opnieuw worden geupload.
- Documentnamen kunnen vanuit het documentvenster worden aangepast. `.pdf` wordt automatisch toegevoegd als die ontbreekt.
- Geen nieuwe Supabase SQL nodig ten opzichte van v8.
