---
title: Routines & reeksen, Todoist, afspraakstatus en vervaldatums in één oogopslag
---
Mitra 0.8 geeft je routines een eigen plek, waar je ziet hoe het met elke routine gaat en haar reeks gaande houdt. Mitra koppelt ook met Todoist, laat zien wanneer een taak vervalt en of een afspraak nog doorgaat, en is er in vier talen meer, met veel kleinere verbeteringen en oplossingen.

## Routines & reeksen
Mitra bundelt de dingen die je vaak doet al tot routines, zoals de sportschool of elke vijf weken naar de kapper. Nu krijgen ze een eigen plek, waar een vlam in één oogopslag de reeks van elke routine toont, en haar detail de keren die je hebt gedaan, geannuleerd of gemist. Je kunt een routine een andere naam geven, twee routines die bij elkaar horen samenvoegen, of Mitra laten weten dat iets helemaal geen routine is. Routines blijven in de maand- en jaarweergave ook rustig staan, hoe ver je ook scrolt, en je AI-connector kan je vertellen hoe het ermee gaat. Het tabblad toont eerst de routines van **Vandaag**, dan de **Lopend**e, en klapt de routines van lang geleden weg onder **Verleden**. Wil je de routines van een agenda weglaten, zoals die van je werkagenda, kies dan **Routines verbergen** in het menu ervan.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="routines-dark.webp">
	<img src="routines-light.webp" alt="Het tabblad Routines naast de maandweergave, elke routine met haar reeks, met het detail van de sportschool ernaast geopend">
</picture>

Documentatie: [Routines](../../docs/routines.md)

## Overal dezelfde tijd
Sommige dingen hangen niet af van je tijdzone: medicijnen om 7:30 neem je om 7:30, thuis of op reis. Kies **Overal dezelfde tijd** bovenaan de tijdzones van een item, en het blijft op dat uur staan waar je ook bent, gemarkeerd met een doorgestreepte wereldbol. Items die zonder tijdzone uit andere apps komen, tonen het ook. Verplaats je er een naar een agenda die zulke tijden niet kent, zoals Google Agenda, dan laat Mitra je eerst weten dat het een vaste tijdzone krijgt.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="same-time-dark.webp">
	<img src="same-time-light.webp" alt="De editor van de ochtendmedicatie, met de tijdzones geopend op Overal dezelfde tijd">
</picture>

Documentatie: [Overal dezelfde tijd](../../docs/time-zones.md#same-time-everywhere)

## Afspraakstatus
Een afspraak heeft nu een eigen status, net als een taak: **Bevestigd**, **Misschien** of **Geannuleerd**. Een geannuleerde afspraak houdt haar plek, doorgestreept, zodat je bijhoudt wat niet is doorgegaan, en je routines tellen haar mee. Een misschien blijft vaag tot je beslist. De status wordt gesynchroniseerd met andere CalDAV-apps, en de tabel toont hem naast die van de taken. **Afgeronde taken verbergen** verbergt nu alleen afgeronde taken, en het nieuwe **Geannuleerd verbergen** verbergt geannuleerde taken en afspraken.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="event-status-dark.webp">
	<img src="event-status-light.webp" alt="De editor van een afspraak met het statusmenu open: Bevestigd, Misschien en Geannuleerd">
</picture>

Documentatie: [Afspraakstatus](../../docs/entries.md#event-status)

## Vervaldatums in één oogopslag
Een ingeplande taak laat nu op zijn vlaggetje zien wanneer hij klaar moet zijn, als tijd, weekdag of datum, afhankelijk van hoe snel dat is. Wijs een taak aan in de week- of maandweergave, of op de tijdlijn, en hij rekt zich uit tot zijn vervaldatum, zodat je ziet hoeveel ruimte je nog hebt. Heb je een taak zo ingepland dat hij pas na zijn vervaldatum af is, dan wordt het vlaggetje rood. En de tabel heeft een nieuwe kolom voor vervaldatums.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="due-stretch-dark.webp">
	<img src="due-stretch-light.webp" alt="Wie de taak van dinsdag aanwijst, rekt hem uit tot zijn vervaldatum, als woensdag het planningsoverleg begint">
</picture>

Documentatie: [Een vervaldatum instellen](../../docs/planning.md#set-a-due-date)

## Personalisatie
Geef elke agenda een van twee nieuwe kleuren, of een kleur naar keuze. Hernoem de kop van een account met een dubbelklik en verberg al zijn agenda's in één keer.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="personalization-dark.webp">
	<img src="personalization-light.webp" alt="Het menu van een agenda open in de zijbalk, met de kleuren naast de agenda's die ze kleuren">
</picture>

## Eigen CSS
Het uiterlijk van Mitra is gewone CSS, en nu kun je je eigen CSS eroverheen leggen. Open **Instellingen → Algemeen → Eigen CSS** en typ een regel: Mitra past die toe terwijl je typt en bewaart hem in je account, zodat hij je naar elk apparaat volgt. Geef Mitra je favoriete kleur, maak alle hoeken vierkant of verberg wat je nooit gebruikt. Waar mensen inloggen, vindt wie de server beheert onder **Beheer** ook **Eigen CSS voor iedereen**, om de hele server een eigen uiterlijk te geven.

**Delen op GitHub** onder het vak begint een bericht in de [Custom CSS-discussies](https://github.com/a11delavar/mitra/discussions/categories/custom-css) met je stylesheet er al in, en daar vind je ook wat anderen hebben gemaakt. Tot Mitra 1.0 kan een update veranderen waar je regels op mikken, dus kijk na een update even of alles nog klopt.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="custom-css-dark.webp">
	<img src="custom-css-light.webp" alt="Mitra in het goud van zijn logo, met de regel onder Eigen CSS die dat doet open in de instellingen">
</picture>

Documentatie: [Eigen CSS](../../docs/custom-css.md)

## Dupliceren naar andere dagen
Sommige dingen vallen op dagen die geen herhaling kan beschrijven. Een verwijzing voor acht fysiotherapiesessies wordt verdeeld over de vrije plekken van de praktijk, en een klant boekt je voor de 3e, de 9e en de 17e. Voeg de eerste toe, kies **Naar andere dagen dupliceren** in het ⋯-menu en vink de rest aan in de twee maanden die verschijnen. Houd Shift ingedrukt om een reeks dagen in één keer te kiezen. Elke dag krijgt een kopie op hetzelfde tijdstip, een eigen item dat je net als elk ander kunt verplaatsen of wijzigen.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="duplicate-days-dark.webp">
	<img src="duplicate-days-light.webp" alt="Het venster Naar andere dagen dupliceren voor een fysiotherapiesessie, met nog zeven sessies gekozen in oktober en november">
</picture>

Documentatie: [Dupliceren naar andere dagen](../../docs/entries.md#the--menu)

## Todoist
Verbind je Todoist-projecten, en hun taken staan op dezelfde tijdlijn als je afspraken, in beide richtingen gesynchroniseerd. Elk project wordt een agenda in zijn kleur uit Todoist. De datum, duur en deadline van een taak worden het tijdvak, de lengte en de vervaldatum. Een taak die in Todoist terugkeert, staat op zijn volgende datum. Rond je hem af in Mitra, dan schuift hij door, net als in Todoist. Prioriteit, labels en secties blijven zoals ze zijn.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="todoist-dark.webp">
	<img src="todoist-light.webp" alt="Het venster Integratie toevoegen, met de aanwijzer op Todoist tussen de andere aanbieders">
</picture>

Documentatie: [Todoist](../../docs/integrations/todoist.md)

## Meer talen
Mitra leert Arabisch, Russisch, Pools en Nederlands. Met elke versie is Mitra beter gaan werken in andere talen, schriften en kalenders. Elke nieuwe taal is volledig vertaald, ook de documentatie en de website.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="arabic-week-dark.webp">
	<img src="arabic-week-light.webp" alt="De week in het Arabisch, van rechts naar links opgemaakt, met een afspraak geopend in de editor">
</picture>

## Bijdragers
- [@a11delavar](https://github.com/a11delavar)
- [@jkngale](https://github.com/jkngale)
- [@d8monx](https://github.com/d8monx)
- [@libnewton](https://github.com/libnewton)
