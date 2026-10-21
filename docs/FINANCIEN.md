# Prijsafspraken en betalingen (v71.11.0)

Kies bij een klus **Op uurbasis**, **Vaste prijs** of **Handmatig bedrag**. Het referentie-uurtarief blijft altijd behouden. Handmatig mag nog leeg zijn: het overzicht vermeldt dan ‘Nog te bepalen’. Extra kosten worden apart ingevuld, met de keuze inbegrepen of erbovenop. Inkoopbonnetjes zijn afzonderlijke zakelijke uitgaven en verhogen het klusbedrag alleen wanneer je ze zelf factureert.

Een klus van 17 werkelijke uren tegen €10 met een vaste prijs van €150 toont €170 urenwaarde, €150 afgesproken en €8,82 effectief afgesproken per uur. Na €100 ontvangst blijft €50 open en is het effectieve ontvangen tarief €5,88. Het totaal is pas ontvangen zodra de betalingen het verschuldigde bedrag dekken.

Gebruik **Betalingen bekijken / registreren** in de klus of factuur. Beide schermen bewerken dezelfde records, inclusief bedrag, betaaldatum en betaalwijze. Een betaling kan rechtstreeks aan een factuur worden toegewezen of als algemene klusbetaling worden bewaard. Algemene klusbetalingen worden één keer toegewezen aan de oudste open gekoppelde facturen; expliciete toewijzingen blijven staan. Overbetaling wordt als ontvangen bedrag behouden. Openstaand is maximaal nul naar beneden: hoogste van afgesproken totaal of som van facturen, min ontvangen. Zo verdwijnt een hoger daadwerkelijk gefactureerd bedrag niet uit openstaand.

Afspraken en urenwaarde zijn exclusief eventuele btw; bij KOR komt geen btw erbij. Factuurtotalen en ontvangsten zijn inclusief eventuele btw. De twee effectieve tarieven volgen respectievelijk het afgesproken bedrag en de werkelijk ontvangen bedragen. Een nieuwe vasteprijsfactuur heeft standaard één inhoudelijke arbeidsregel met aantal 1. Eventuele extra kosten erbovenop krijgen een aparte regel. Uurbasis gebruikt werkelijke bevestigde uren; een offerte op uurbasis gebruikt de planning. Omschrijvingen, regels, tarieven en btw-keuze blijven bewerkbaar. Prijswijzigingen veranderen geen bestaande PDF of factuurregels.

## Datum van de statistieken

| Maatstaf | Boekingsdatum |
| --- | --- |
| Werkelijke uren en referentie-urenwaarde | Datum van de urenregistratie |
| Afgesproken omzet, eenmaal per klus | Eerste klusdatum; zonder klusdatum de eerste geregistreerde werkdag |
| Gefactureerde omzet, eenmaal per factuur | Factuurdatum, met bestaande terugval op aanmaakdatum |
| Ontvangsten, eenmaal per betaling | Werkelijke betaaldatum |

De week-, maand-, kwartaal-, jaar- en klantoverzichten gebruiken dezelfde gebeurtenissen. Het zijn afzonderlijke maatstaven: tel afgesproken, gefactureerd en ontvangen niet bij elkaar op. Bij werk en betaling in verschillende periodes kan het effectieve tarief van een periode afwijken van het tarief van de gehele klus. Het PDF-jaaroverzicht toont apart de ontvangsten op de facturen van dat jaar (ongeacht betaaldatum), alle ontvangsten op betaaldatum in het kalenderjaar en historische ontvangsten zonder bekende datum.

## Bestaande gegevens en apparaten

Er is geen database- of IndexedDB-migratie. Nieuwe prijsvelden staan op de bestaande klus. Iedere betaling heeft een eigen ID in de reeds gesynchroniseerde `settings`-records; de bestaande cloudcodering en back-up nemen die mee. Een wijziging op hetzelfde betalingsrecord volgt de bestaande synchronisatieregels. Afzonderlijke betalingen hebben afzonderlijke records, zodat een nieuwe betaling niet een hele betalingslijst van een ander apparaat overschrijft.

Oude betaald-vinkjes worden gelezen als historische ontvangsten zonder verzonnen datum. Betaalde gekoppelde facturen gaan vóór het klusvinkje, zodat dezelfde oude betaling niet dubbel meetelt. Vóór wijzigingen die het oude bedrag zouden veranderen, wordt dat historische bedrag bewaard. Bij een onbekend factuurtotaal blijft ook het bedrag als onbekend herkenbaar. Vul bedrag en datum alleen in wanneer ze bekend zijn. Ontvangsten zonder betaaldatum staan apart, buiten alle periodebedragen. Verwijderen van een betaling bewaart een markering, zodat een oud vinkje de betaling niet opnieuw kan aanmaken.

Klussen, documenten en uren worden niet automatisch omgezet of opnieuw aangemaakt. Bevestigingsvlaggen van bestaande uren veranderen niet door deze functionaliteit. Gebruik op iPhone en Mac dezelfde bijgewerkte appversie en dezelfde account; bestaande handmatige Sync en de back-up-/herstelbescherming blijven van toepassing.

## Validatie

`node scripts/check.cjs` voert de bestaande site-, uren-, push-, bonnetjes- en back-upregressies uit, plus financiële reken- en browsertests met fictieve records. De nieuwe tests gebruiken echte lokale IndexedDB en formulieren, alle vier PDF-sjablonen, twee geïsoleerde browserprofielen voor het cloudformaat en back-up/herstel met prijsafspraak, betaling en bevestigde uren. Geen productiedata, echte betalingen, accounts of productieherstel worden gebruikt. Een fysieke iPhone/Mac-test met een echte gebruikerssessie is niet uitgevoerd.
