---
title: AI-connectors, bijlagen, regio's en talen
---
Mitra 0.7 werkt samen met de AI-assistenten die je al gebruikt, zodat ze je tijd direct in je agenda kunnen plannen. Je kunt nu bestanden aan je items toevoegen, Mitra schrijft datums zoals ze in je regio gebruikelijk zijn, en je thuistijdzone reist met je mee. Mitra is nu ook in het Chinees beschikbaar, en je leest wat er is veranderd zonder de app te verlaten. Slepen, zoomen en laden gaan ook sneller, en er zijn veel kleinere verbeteringen en oplossingen bijgekomen.

## AI-connectors
AI-assistenten zoals Claude en Cursor kunnen nu met je agenda werken. Verbind er een via het adres onder Instellingen → AI, en vraag de assistent wat je anders met de hand zou doen: je week bekijken, een item opzoeken, een reis plannen of een vergadering verplaatsen. Wat de assistent schrijft, komt in je agenda's terecht zoals elke andere wijziging, en wordt van daaruit gesynchroniseerd. Op een server waar mensen inloggen, krijgt elke assistent een eigen toegangstoken, dat je tot lezen kunt beperken en op elk moment kunt intrekken.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="connectors-dark.webp">
	<img src="connectors-light.webp" alt="Een AI-assistent zet een geplande reis naar Parijs in de week: de oude plannen verdwijnen, de reis komt erbij, en de Eiffeltoren gaat open met zijn foto en zijn ticket">
</picture>

Foto van de Eiffeltoren: David McSpadden, Wikimedia Commons, CC BY 2.0.

Documentatie: [AI-connectors](../../docs/ai-connectors.md)

## Regio's & talen
Kies naast je taal ook je land. Mitra schrijft datums, tijden en getallen dan zoals ze daar gebruikelijk zijn. Je week begint op de dag waarop hij daar begint, en het weekend valt op de dagen dat je vrij bent. Een voorbeeld laat zien hoe alles eruitziet voordat je kiest. Sneltoetsen werken nu ook als je toetsenbord een ander schrift typt, zoals Perzisch.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="locales-dark.webp">
	<img src="locales-light.webp" alt="De instelling Taal, open op de lijst met talen, met Italiaans uitgeklapt naar de landen waar het geschreven wordt">
</picture>

Documentatie: [Instellingen](../../docs/settings.md)

## Thuistijdzone
Mitra kent nu je thuistijdzone en bewaart die bij je account. Op reis volgt de agenda je apparaat, en je thuistijdzone blijft in de kolom ernaast staan. Je lijst met tijdzones blijft zoals hij was, dus als je terug bent, zie je weer één kolom. De tijdzones die je toevoegt en de namen die je ze geeft, zijn op elk apparaat hetzelfde. Boven elke kolom staat de korte naam die mensen echt voor die tijdzone gebruiken.

Ook de tijdzonekiezer is vernieuwd. Tijdzones met dezelfde naam en dezelfde tijd staan samen in één rij, en de tijdzones van je eigen land komen eerst. Een huisje markeert je thuis, en een speld de tijdzone waar je op reis bent.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="time-zones-dark.webp">
	<img src="time-zones-light.webp" alt="De tijdzonekiezer, open op thuis tussen de gegroepeerde tijdzones eromheen">
</picture>

> [!NOTE]
> Had je de tijdzone waarin je bent een eigen naam gegeven? Geef hem die naam dan nog één keer. Tot nu toe bleef zo'n naam op het apparaat waar je hem had ingesteld. Voortaan gaat een naam met je mee naar elk apparaat.

Documentatie: [Tijdzones](../../docs/time-zones.md)

## Bijlagen
Je kunt nu bestanden aan een item toevoegen, zoals een ticket, een vergaderagenda of een foto van een whiteboard. Voeg ze toe met de paperclip in de editor van het item, of sleep ze naar het geopende item. Klik op een bestand om het te openen. Je kunt een bestand ook in de beschrijving zetten: een afbeelding verschijnt daar als afbeelding, elk ander bestand als link. Verwijder je het bestand later, dan haalt Mitra het ook uit de beschrijving.

Bijlagen synchroniseren met je agenda. In een CalDAV-agenda zien andere apps die dezelfde agenda gebruiken de bestanden die jij toevoegt, en toont Mitra de bestanden die zij hebben toegevoegd. In Google Agenda toont Mitra de Google Drive-bestanden die bij een afspraak horen, maar kan het er geen toevoegen of verwijderen, omdat Google alleen Drive-bestanden bewaart. Afbeeldingen op een Notion-pagina verschijnen nu in de beschrijving van de taak.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="attachments-dark.webp">
	<img src="attachments-light.webp" alt="Een geopende taak naast haar item in de week, waarvan de paperclip laat zien dat er bestanden bij horen: de editor toont een pdf, een schets en een spreadsheet boven de beschrijving, waarin de schets staat">
</picture>

> [!NOTE]
> Mitra bewaart de bestanden die je toevoegt in zijn gegevensmap, dus met een back-up van die map maak je ook een back-up van je bestanden. Met `MITRA_FILE_MAX_SIZE` beperk je hoe groot één bestand mag zijn, en met `MITRA_FILE_QUOTA` hoeveel iemand in totaal mag opslaan.

Documentatie: [Bijlagen](../../docs/attachments.md)

## Releaseopmerkingen in de app
Je ziet nu wat er is veranderd zonder Mitra te verlaten. Het venster Over toont elke versie zoals de website dat doet, met de releaseopmerkingen en afbeeldingen van de versie die je gebruikt en de verbeteringen die daarna kwamen. Ook elke commit staat erbij, ingeklapt tot je hem nodig hebt.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="about-dark.webp">
	<img src="about-light.webp" alt="Het venster Over, open op de releaseopmerkingen en afbeeldingen van een versie">
</picture>

## Chinees
Mitra spreekt nu Chinees, in vereenvoudigde karakters. De app, de voorbeeldagenda, de documentatie en de website zijn allemaal vertaald, en Chinese tekst krijgt een lettertype dat er speciaal voor gemaakt is.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="chinese-detail-dark.webp">
	<img src="chinese-detail-light.webp" alt="De editor in het Chinees, met de datumkiezer open op de maand">
</picture>

Documentatie: [Instellingen](../../docs/settings.md)

## Bijdragers
- [@a11delavar](https://github.com/a11delavar)
- [@d8monx](https://github.com/d8monx)
