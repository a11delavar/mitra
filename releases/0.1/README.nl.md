---
title: Mitra, een agenda helemaal van jezelf
---
De eerste versie van Mitra: een agenda die je taken op dezelfde tijdlijn zet als je afspraken, en die in twee richtingen synchroniseert met de agenda's die je al bijhoudt.

## Waarom Mitra
Er zijn goede agenda-apps, en er zijn agenda's die je zelf kunt hosten. Lange tijd waren dat niet dezelfde.

De verzorgde apps draaien op de servers van een ander en lezen alles wat je erin zet. Wat je thuis kunt draaien, zijn vooral servers: ze bewaren je agenda's trouw en laten het aan jou over om ze te bekijken met welke app je maar kunt vinden. Mitra begon met de wens om allebei tegelijk te hebben: een agenda waarin je graag je dag doorbrengt, op een machine van jezelf, en aan niemand anders verantwoording schuldig.

Je hoeft er niet voor te verhuizen. Mitra is een laag over de agenda's die je al bijhoudt, geen nieuwe plek om ze bij te houden. Elke bron van je tijd is een integratie die je naast de andere aansluit, eerst een CalDAV-server en sindsdien nog veel meer. Ze komen allemaal samen op één tijdlijn, terwijl de gegevens van elke integratie blijven waar ze staan. Ook je afspraken en je taken delen die tijdlijn, zodat je ze niet meer in je hoofd in elkaar hoeft te passen.

Het is ook een gok op het web van nu, niet op dat van tien jaar geleden. Mitra is geschreven voor de huidige browsers en leunt op wat die zelf al kunnen: lay-outs die zich aanpassen aan de ruimte die ze krijgen, popovers die op hun plek verankerd zijn, overgangen tussen weergaven, een echt model van datums en tijdzones. Omdat Mitra geen compatibiliteitslagen en geen zwaar framework meesleept, blijft het klein en snel, kun je het als app installeren en voelt het op een telefoon net zo thuis als op een computer. De prijs is dat het een recente browser vraagt, en dat zal zo blijven.

Daaronder ligt een eenvoudige overtuiging: hoe je je tijd besteedt, is het meest persoonlijke dat je vastlegt. Waar dat staat, wie het kan lezen en hoe rustig het oogt, hoor jij te bepalen. Mitra is een poging om dat makkelijk te maken.

[@a11delavar](https://github.com/a11delavar)

## Weekweergave
Een dag is een kolom van 24 uur met een lijn op het huidige tijdstip, en een week is zeven van die kolommen naast elkaar. Met één knop ben je terug bij vandaag.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="week-dark.webp">
	<img src="week-light.webp" alt="De weekweergave, met de lijn op het huidige tijdstip">
</picture>

Documentatie: [Weekweergave](../../docs/views/week.md)

## Maandweergave
De maand scrolt eindeloos door, met een rij voor elke week en een balk voor elk item over al zijn dagen. Bovenin wissel je tussen de maand en de week.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="month-dark.webp">
	<img src="month-light.webp" alt="De maandweergave, met een rij voor elke week">
</picture>

Documentatie: [Maandweergave](../../docs/views/month.md)

## Afspraken en taken
Een taak staat in een dag net als een afspraak, met een vakje om af te vinken als hij klaar is. Sleep in het raster om een item te maken, sleep het item om het te verplaatsen, en geef elke agenda een eigen kleur.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="entries-dark.webp">
	<img src="entries-light.webp" alt="Afspraken en taken naast elkaar op een dag">
</picture>

Documentatie: [Items](../../docs/entries.md)

## CalDAV
Verbind een CalDAV-server, kies welke agenda's je ervan wilt zien, en Mitra houdt ze in twee richtingen gelijk. Wijzigingen die je elders maakt, verschijnen meteen.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="caldav-dark.webp">
	<img src="caldav-light.webp" alt="Een CalDAV-server verbinden">
</picture>

Documentatie: [CalDAV](../../docs/integrations/caldav.md)

## Markdown-notities
De beschrijving van een item is Markdown: koppen, lijsten en links zien er ook zo uit, en voor elke andere app blijft het gewone tekst.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="markdown-dark.webp">
	<img src="markdown-light.webp" alt="Agendapunten voor een vergadering in de beschrijving van een item, in Markdown geschreven">
</picture>

## Bijdragers
- [@a11delavar](https://github.com/a11delavar)
