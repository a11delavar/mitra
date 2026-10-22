---
title: Agenda's
description: "Kies welke agenda's Mitra importeert, geef ze een andere naam, kleur of volgorde, verberg ze, bepaal waar nieuwe items terechtkomen en verplaats items tussen agenda's."
---

Elke regel in het tabblad **Agenda's** van de zijbalk is een agenda. Sommige zijn [in Mitra opgeslagen](integrations/mitra.md), andere komen uit een account dat je hebt verbonden. Ze staan onder de kop van de integratie waar ze bij horen, en alles op deze pagina werkt voor al die agenda's hetzelfde, tenzij er iets anders staat.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/calendars-detail-dark.webp">
  <img src="../assets/screenshots/calendars-detail-light.webp" alt="De zijbalk met een account en zijn vijf agenda's, elk in een eigen kleur" />
</picture>

Een agenda is één regel, ook als hij zowel afspraken als taken bevat, zoals de meeste CalDAV-agenda's. Of een item een afspraak of een taak is, is een eigenschap van dat item.

## Kiezen wat er wordt geïmporteerd

Als je een account verbindt, zoekt Mitra de agenda's ervan op en zet ze in een lijst, allemaal aangevinkt en elk met wat erin staat, zoals ‘Afspraken · Taken’. Vink de agenda's die je niet wilt uit voordat je opslaat. Je kunt je later nog bedenken via **⋯ → Bewerken** bij het account, waar agenda's die er sindsdien bij zijn gekomen, uitgevinkt klaarstaan. Mitra synchroniseert en bewaart alleen de agenda's die zijn ingeschakeld, dus de andere kosten niets.

## Een agenda toevoegen of verwijderen

Een agenda uit een verbonden account maak en verwijder je bij de aanbieder, en Mitra merkt dat bij de volgende synchronisatie op. Mitra-agenda's zijn de uitzondering: voeg er een toe met **Nieuwe agenda** in het **⋯**-menu bij de kop Mitra, en verwijder er een met **Agenda verwijderen** in zijn eigen **⋯**-menu. Staan er nog items in, dan biedt Mitra **Eerst items verplaatsen…** aan, zodat je niet per ongeluk iets kwijtraakt.

## Een agenda verbergen

Met het oog aan het eind van een regel verberg je de items van die agenda. Verbergen gaat alleen over wat je ziet: de agenda blijft synchroniseren, en de items zijn meteen terug zodra je hem weer weergeeft. Zoeken vindt ze nog steeds, gedimd.

Verbergen zet een agenda niet op stil, dus de [herinneringen](reminders.md) ervan gaan gewoon af. Wil je een agenda helemaal stopzetten, schakel hem dan uit via **⋯ → Bewerken** bij zijn account.

### Alleen één agenda weergeven

Wil je al het andere uit beeld hebben, kies dan **Alleen deze agenda weergeven** in het **⋯**-menu van een agenda, of <kbd>Alt</kbd>-klik op het oog. Alle andere agenda's worden verborgen, en Mitra onthoudt welke je zichtbaar had. Hetzelfde menu-item heet daarna **Eerder zichtbare agenda's weergeven** en haalt ze terug.

Agenda's die al verborgen waren, blijven verborgen. Een agenda die je in de tussentijd hebt verbonden, is zichtbaar, want die hoorde niet bij wat je had weggezet. Ook als je tussendoor zelf een agenda weergeeft, kun je de rest nog steeds terughalen. Beide kun je ook vanuit het [opdrachtenpalet](shortcuts.md) doen, door op de naam van een agenda te zoeken.

## Naam wijzigen

Dubbelklik op de naam van een agenda, of kies **Naam wijzigen** in het **⋯**-menu. De naam is van jou: synchroniseren overschrijft hem nooit. Mitra neemt de naam van de aanbieder pas weer over als de agenda daar echt een andere naam krijgt.

## Kleur wijzigen

Kies een kleur in het **⋯**-menu van de agenda. Tot je dat doet, gebruikt een agenda de kleur die de aanbieder hem geeft. Geeft de aanbieder geen kleur, dan kiest Mitra er een op basis van het adres van de agenda, zodat hij er op elk apparaat hetzelfde uitziet. Items krijgen de kleur van hun agenda, tenzij ze een eigen kleur hebben.

## Volgorde wijzigen

Agenda's staan eerst in de volgorde waarin Mitra ze vond, en accounts in de volgorde waarin je ze hebt verbonden. Wil je ze zelf ordenen, sleep dan een agenda omhoog of omlaag binnen zijn account, of sleep een account aan zijn kop om het met al zijn agenda's te verplaatsen. Houd op een touchscreen even ingedrukt voordat je sleept, want gewoon vegen scrolt door de lijst. **Omhoog** en **Omlaag** in het **⋯**-menu doen hetzelfde zonder slepen.

Een agenda verschuift alleen binnen zijn eigen account. Een agenda die je later inschakelt, komt achteraan in zijn account, zodat de volgorde die je hebt ingesteld intact blijft.

## Waar nieuwe items terechtkomen

De agenda met het gevulde pictogram is je standaardagenda: nieuwe items komen daarin, tenzij je een andere kiest. Klik op het pictogram van een agenda om hem standaard te maken, en klik nog eens op het pictogram van de standaardagenda om dat weer op te heffen. Zonder standaardagenda, of zolang die verborgen is, komen nieuwe items in de eerste agenda die zichtbaar is, en het gevulde pictogram gaat mee, dus als je een agenda bovenaan zet, wordt hij ook de standaard. Dezelfde keuze vind je onder **Instellingen → Items**.

Nieuwe items zijn afspraken, tenzij de agenda alleen taken kan bevatten, zoals een Notion-weergave. Zolang een item nieuw is, heeft de editor een schakelaar **Afspraak** / **Taak**. Na het opslaan verander je het met **Type** in de editor, als de agenda ook het andere soort item kan bevatten. Een terugkerend item houdt zijn type.

## Alle items naar een andere agenda verplaatsen of kopiëren

Met **Items verplaatsen naar…** in het **⋯**-menu van een agenda, of **Items uit … verplaatsen…** in het opdrachtenpalet, verplaats je alles in die agenda in één keer naar een andere agenda. Kies waar de items naartoe moeten, en voordat er iets gebeurt, laat Mitra zien wat de verplaatsing kost:

```
19 of 21 entries move to Personal
✓ 15 arrive with everything they carry
! 4 lose their reminders
⨯ 2 repeat and stay here
```

Het overzicht hangt af van wat de bestemming kan bevatten, dus voor een CalDAV-agenda ziet het er anders uit dan voor een Notion-weergave. Items die de bestemming helemaal niet kan opnemen, zoals een terugkerend item dat naar Notion zou gaan, blijven waar ze zijn en worden bij naam genoemd.

**In plaats daarvan kopiëren** laat de originele items staan en zet van elk een kopie in de bestemming. Zo haal je ook items uit een alleen-lezen agenda, zoals een abonnement: daaruit kun je wel kopiëren, maar niets verplaatsen.

Koppelingen tussen de items die je verplaatst, gaan mee, zelfs naar Notion, dat elke pagina een nieuwe ID geeft. Koppelingen vanuit items die achterblijven, blijven wijzen naar de items die zijn verplaatst.

Kan de bestemming geen items herhalen, dan vraagt Mitra wat er met de terugkerende items moet gebeuren: hier laten, of opsplitsen in losse items die zich niet meer herhalen, één voor elke herhaling in het komende jaar. Mitra splitst nooit op zonder het te vragen.

> [!NOTE]
> Mitra kopieert eerst en verwijdert de originelen pas als de kopieën zijn aangekomen. Tussen twee aanbieders bestaat geen ongedaan maken, dus deze volgorde is het vangnet: als er iets misgaat, staat een item misschien in beide agenda's, maar het raakt nooit kwijt. Mislukt het kopiëren, dan stopt de hele verplaatsing en wordt er niets verwijderd.

### Eén item verplaatsen

Wil je één item verplaatsen, open het dan en kies in de editor een andere agenda. Bij een terugkerend item vraagt Mitra welke herhalingen je bedoelt. **Dit item** verplaatst alleen die ene herhaling, **Dit en volgende items** verplaatst de rest van de reeks en laat de eerdere herhalingen staan, en **Alle items** verplaatst de hele reeks, inclusief de herhalingsregel.

## Alleen-lezen agenda's

Sommige agenda's kun je niet vanuit Mitra wijzigen: [agenda-abonnementen](integrations/subscriptions.md), en agenda's die iemand alleen ter inzage met je heeft gedeeld. Mitra herkent dat zelf en markeert ze als alleen-lezen.

Je kunt de items openen en alles erin lezen, selecteren en kopiëren, maar je kunt er geen items maken, wijzigen, verplaatsen of verwijderen, en je kunt er ook geen item naartoe verplaatsen. Naam, kleur, volgorde en verbergen kun je wel aanpassen, want dat is je eigen kijk op de agenda. Geeft de eigenaar je later toch bewerkrechten, dan merkt Mitra dat bij de volgende synchronisatie.

## Een agenda opnieuw importeren

**Items opnieuw importeren**, in het **⋯**-menu van een agenda of van een heel account, gooit Mitra's kopie van de items weg en importeert ze opnieuw bij de aanbieder. Bij de aanbieder verandert er niets. Normaal heb je dit niet nodig, want [synchroniseren](integrations/README.md#how-syncing-works) gaat vanzelf; het is er voor als een agenda er na een update verkeerd of verouderd uitziet. Mitra-agenda's bieden het niet aan, omdat er geen aanbieder is om uit te importeren.
