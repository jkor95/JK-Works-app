# JK Works Dordrecht App

Persoonlijke PWA voor JK Works Dordrecht.

## Installatie / update

1. Upload alle bestanden uit deze map naar de bestaande GitHub Pages repository.
2. Voer `SUPABASE_SETUP.sql` uit in Supabase > SQL Editor. Het script is idempotent en mag opnieuw worden uitgevoerd.
3. Wacht tot GitHub Pages is bijgewerkt en laad de app opnieuw op iPhone en Mac.
4. Log op beide apparaten in met hetzelfde account.

## Opslag

- GitHub bevat alleen de app-code en standaardtemplates.
- Bedrijfsgegevens en uren staan in Supabase `app_records`.
- Verwijderingen staan in Supabase `app_deletions`.
- Geuploade PDF-bestanden staan in Supabase Storage, bucket `jkworks-files`; documentmetadata staat in `app_records`.

## v10

Verwijderen is opnieuw opgebouwd met een aparte permanente verwijderlog (`app_deletions`). Hierdoor kunnen documenten en urenregistraties niet meer door een oud lokaal apparaat of een vertraagde upload worden teruggezet. Documentnamen blijven bewerkbaar.
