---
title: Tijdzones
description: Hoe Mitra de eigen tijdzone van een item toont, en hoe je de uren van andere tijdzones aan de weekweergave toevoegt.
---

Mitra toont tijden in jouw tijdzone, de tijdzone waarop je apparaat is ingesteld. Reis je en verandert je apparaat van tijdzone, dan gaat Mitra mee. In de editor heet deze tijdzone de **huidige** tijdzone. Je **thuis** is de tijdzone waar je thuishoort, en die blijft naast de huidige staan terwijl je op reis bent.

Een item kan ook een eigen tijdzone hebben, zoals een vlucht die om 9:00 vertrekt in New York. En de weekweergave kan de uren van andere tijdzones naast die van jou tonen.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zone-detail-dark.webp">
  <img src="../assets/screenshots/time-zone-detail-light.webp" alt="De editor van een nieuw item met als tijdzone GMT+1 Lissabon, die 11:00 in Lissabon toont, terwijl het item erachter in de Berlijnse week om 12:00 staat" />
</picture>

## De tijdzone van een item

Elk item met tijden heeft een tijdzone. Items die je zelf maakt, krijgen jouw tijdzone, en items uit andere apps houden de tijdzone waarin ze zijn gemaakt.

Open een item en je ziet de tijdzone op de regel met de wereldbol, onder de datums, geschreven als een verschil met GMT en een stad, zoals ‘GMT-4 New York’. Items voor de hele dag hebben geen tijdzone en dus ook die regel niet, want ze beslaan voor iedereen dezelfde dagen.

### De tijdzone van een item wijzigen

Klik op de tijdzone en kies een andere. De lijst begint met de tijdzones van het land waarvoor je [taal](settings.md#general) is ingesteld, daarna volgen alle tijdzones. Je thuis is gemarkeerd met een huisje, en je huidige tijdzone met een speld zolang je op reis bent. Tijdzones die het hele jaar dezelfde naam en kloktijd hebben, delen één regel. Die regel staat voor een van hun steden: de stad van je eigen tijdzone, of die van je land als dat er een heeft, zoals Midden-Europese tijd voor Amsterdam in Nederland. Met het pijltje aan het eind van de regel klap je de andere steden uit, zoals Parijs en Berlijn, en bij een zoekopdracht klappen de regels met een treffer vanzelf uit. Typ een stad, een land, de naam van een tijdzone of een verschil met GMT om er een te vinden.

Het item houdt zijn kloktijden in de nieuwe tijdzone: een vergadering om 9:00 in Berlijn wordt een vergadering om 9:00 in New York. Was alleen de tijdzone fout en is de vergadering zelf niet verschoven, pas dan daarna de tijden aan.

### Jouw tijd of die van het item

Als de tijdzone van een item verschilt van de jouwe, toont de editor de tijden in jouw tijdzone. Een vergadering om 9:00 in New York staat er dan als 15:00 als je in Berlijn bent. Met een knop naast de tijdzone schakel je over naar de eigen tijd van het item en weer terug. De knop toont een speld zolang je jouw tijd ziet en een wereldbol zolang je die van het item ziet, en als je hem aanwijst, zie je welke van de twee het is.

Je kunt de tijden op beide manieren bewerken. Wil je de tijdzone zelf wijzigen, schakel dan eerst over naar de tijd van het item.

### Overal dezelfde tijd

Sommige items komen uit andere apps zonder tijdzone en tonen **Overal dezelfde tijd**. Hun tijden horen bij geen enkele plek: een wekker om 7:00 is bedoeld voor 7:00 waar je ook bent, en de editor toont hem in elke tijdzone om 7:00. De herinneringen gaan op elk apparaat op die kloktijd af.

Kies je een tijdzone voor zo'n item, dan krijgt het die tijdzone en behoudt het zijn kloktijden. In een agenda die zulke tijden bewaart, kan elk item er een krijgen: kies **Overal dezelfde tijd** bovenaan de lijst, en ook dan blijven de kloktijden staan.

### Welke agenda's dit ondersteunen

- **Agenda's die in Mitra zijn opgeslagen**, [agendaservers](integrations/caldav.md) en [Google Agenda](integrations/google.md) bewaren de tijdzone van elk item, en andere apps zien die ook. Mitra en agendaservers bewaren ook tijden die overal hetzelfde zijn. Google Agenda kent die niet, dus verplaats je zo'n item daarheen, dan krijgt het een vaste tijdzone.
- **[Notion](integrations/notion.md)** kent geen tijdzones. De tijden worden in jouw tijdzone getoond, en de editor heeft geen tijdzoneregel.
- **[Todoist](integrations/todoist.md)** bewaart de tijdzone van elke taak, of [overal dezelfde tijd](#same-time-everywhere) voor wat Todoist een zwevende tijd noemt.
- **[Tempo](integrations/tempo.md)** leest worklogs in de tijdzone van je Jira-profiel, en ook hier heeft de editor geen tijdzoneregel.
- **[Abonnementen](integrations/subscriptions.md)** zijn alleen-lezen: je ziet de tijdzone van een item en kunt tussen de twee tijden wisselen, maar je kunt de tijdzone niet wijzigen.

## Tijdzones in de weekweergave

De [weekweergave](views/week.md) kan de uren van andere tijdzones tonen in kolommen naast die van jou, zodat je voor elk uur van je dag ziet hoe laat het daar is.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zones-detail-dark.webp">
  <img src="../assets/screenshots/time-zones-detail-light.webp" alt="De weekweergave met een EDT-kolom met de uren van New York naast de GMT+2-kolom, zodat 07:00 in Berlijn 01:00 in New York is" />
</picture>

### Een tijdzone aan de week toevoegen

Wijs de bovenkant van de tijdkolom aan en druk op **＋** (**Tijdzone toevoegen**). In de lijst staat een vinkje bij de tijdzones die je al hebt, een huisje bij je thuis en een speld bij je huidige tijdzone zolang je op reis bent. Kies een tijdzone om er een kolom voor toe te voegen, of een aangevinkte om die kolom weg te halen. De lijst blijft open, zodat je er meer kunt kiezen. Je huidige tijdzone blijft de kolom naast de dagen, en je thuis blijft ook staan.

Boven elke kolom staat een korte naam: de afkorting die mensen voor de tijdzone gebruiken, zoals ‘PDT’ of ‘BST’, of, als er geen gangbare afkorting is, de plaats, zoals ‘Iran’. De afkorting volgt je [taal](settings.md#general): Berlijn heet ‘CEST’ in het Engels en ‘MESZ’ in het Duits, en als jouw regio geen afkorting voor een tijdzone heeft, gebruikt Mitra de afkorting uit de regio van die tijdzone zelf. Wijs een naam aan om de volledige naam te zien.

### Een tijdzone hernoemen of verwijderen

Klik op de naam van een tijdzone en kies **Naam wijzigen** om hem een eigen label te geven, zoals ‘Mama’, **Als thuis instellen** om hem je thuis te maken, of **Verwijderen** om de kolom weg te halen. Wil je terug naar de automatische naam, maak de naam dan leeg.

Je huidige tijdzone en je thuis kun je een andere naam geven, maar niet verwijderen. Wil je een andere thuis, stel dan een andere tijdzone in als thuis.

### De extra kolommen inklappen

De extra kolommen nemen ruimte van de dagen af. Wil je ze verbergen, wijs dan de bovenkant van de tijdkolom aan en druk op het pijltje onder de **＋**. Druk er nog eens op om ze weer te tonen. Je kunt ook de tijdkolom naar de dagen toe slepen om ze uit te klappen, en terug om ze in te klappen. Op een touchscreen werkt het zo.

Op een smal scherm zijn de kolommen eerst ingeklapt, tot je ze zelf uit- of inklapt. Als je een tijdzone toevoegt, komen ze altijd tevoorschijn.

### Op al je apparaten

Je thuis, de tijdzones die je toevoegt en elke naam die je ze geeft, horen bij je account, dus je ziet ze op elk apparaat dat je gebruikt. Of de kolommen zijn ingeklapt, wordt per apparaat bewaard.

Je thuis is de tijdzone van het eerste apparaat waarop je Mitra opent. Op reis wordt de tijdzone waar je bent de kolom naast de dagen, en je thuis blijft ernaast staan, zonder dat er iets aan je lijst wordt toegevoegd. Eenmaal terug is het dus weer één kolom. Geef je de tijdzone waar je bent een naam, dan blijft hij in je lijst staan. Verhuis je, kies dan **Als thuis instellen** bij de tijdzone waar je nu woont. Je oude thuis blijft dan als kolom staan tot je hem verwijdert.
