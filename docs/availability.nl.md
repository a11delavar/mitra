---
title: Beschikbaarheid
description: Markeer de tijd die je vrijhoudt voor werk, studie of iets anders in de bijbehorende agenda, en toon die aan anderen als bezet wanneer je dat wilt.
---

**Beschikbaarheid** is tijd die je vast reserveert, zoals werk van maandag tot en met woensdag, studietijd op donderdag en vrijdag, of het huishouden op zaterdag. Mitra kleurt die in de weergave **Week** in, in de kleur van de bijbehorende agenda.

Beschikbaarheid hoort bij een agenda, naast de afspraken en taken van die agenda. Je werktijden horen in je werkagenda, je studietijd in je universiteitsagenda. Omdat het geen afspraak is, bewaart Mitra de beschikbaarheid zelf en voegt het die niet aan je account toe. [Bezette beschikbaarheid](#busy-or-free) is de enige uitzondering.

Ze laat zien hoe je week er meestal uitziet, maar zet er geen hek omheen. Een tandartsafspraak midden in je werktijd is prima.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/availability-detail-dark.webp">
  <img src="../assets/screenshots/availability-detail-light.webp" alt="Drie dagen van de weekweergave: werktijden en studietijd ingekleurd in de kleuren van hun agenda's, met het werk op woensdagmiddag gelabeld als Thuiswerken" />
</picture>

## Met of zonder naam

Zonder naam is een tijdvenster alleen een gekleurd vlak. Dat past bij de meeste beschikbaarheid, omdat de kleur van de agenda al zegt waar de tijd voor is. Geef je het een naam of een plaats, dan loopt die tekst langs de rand van de dag, zoals Focustijd binnen je werktijden, of Kantoor en Thuiswerken op verschillende dagen.

Waar vensters elkaar overlappen, mengen hun kleuren tot een donkerder tint en schuiven hun labels uit elkaar: het eerste naar het begin, het laatste naar het einde.

## Beschikbaarheid toevoegen

Open het opdrachtenpalet met <kbd>/</kbd> of <kbd>Ctrl</kbd> + <kbd>K</kbd> en voer **Beschikbaarheid toevoegen** uit. De beschikbaarheid komt in je standaardagenda:

- Heeft die agenda nog geen beschikbaarheid, dan krijg je werktijden van maandag tot en met vrijdag, van 9:00 tot 17:00.
- Anders krijg je een venster op de weekdag van vandaag.

De editor gaat open, zodat je de tijden, de dagen, de naam, de plaats of de agenda kunt wijzigen. Een item dat niet wordt herhaald, kan via zijn **Type** ook beschikbaarheid worden.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/availability-editor-detail-dark.webp">
  <img src="../assets/screenshots/availability-editor-detail-light.webp" alt="De editor van het werk op woensdag: de tijd, de wekelijkse herhaling, Thuiswerken als plaats, en Vrij" />
</picture>

## Bewerken en verplaatsen

- Klik in een venster om het te openen. Sleep je eroverheen, dan maak je nog steeds een gewoon item, net als op een leeg deel van het raster.
- Beschikbaarheid wordt herhaald zoals elk ander item. Ze heeft een tijdzone en een herhalingsregel, en als je één dag ervan wijzigt of verwijdert, vraagt Mitra of je die dag bedoelt of alle dagen.
- Met het veld **Agenda** in de editor verplaats je haar naar een andere agenda. Verplaats je de items van een agenda met **Items verplaatsen naar…**, dan gaat de beschikbaarheid mee.
- Beschikbaarheid verschijnt alleen in de weekweergave. Je ziet haar niet in Maand, Jaar, Tijdlijn of Tabel, niet in zoekresultaten en niet in relaties.

## Weergeven en verbergen

Het oog van een agenda in de zijbalk verbergt de beschikbaarheid samen met de afspraken en taken. Wil je alle beschikbaarheid verbergen en verder niets, zet dan **Beschikbaarheid verbergen** aan onder **Instellingen → Agenda**, of zoek het op in het opdrachtenpalet.

## Waar beschikbaarheid kan staan

Elke agenda waaraan je items kunt toevoegen, kan beschikbaarheid bevatten, ook [Mitra](integrations/mitra.md)-agenda's. Deze agenda's niet:

- Agenda's van [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) en [Tempo](integrations/tempo.md), omdat hun items niet kunnen worden herhaald.
- Agenda's die alleen-lezen zijn, zoals [agenda-abonnementen](integrations/subscriptions.md).

Beschikbaarheid blijft bij haar agenda. Verwijder je de agenda, of koppel je het account los waar die bij hoort, dan wordt de beschikbaarheid ook verwijderd.

## Bezet of vrij

Beschikbaarheid heeft dezelfde keuze **Weergeven als bezet of vrij** als een afspraak. Ze begint als **Vrij**, wat bij werktijden past: dan mag je best worden ingepland. Kies **Bezet** voor tijd die anderen niet mogen inpikken, zoals focustijd.

In Mitra zien ze er hetzelfde uit. Het verschil zit in wat anderen zien. Vrije beschikbaarheid wordt nooit naar een van je accounts geschreven. Bezette beschikbaarheid in een [CalDAV-, Google- of Apple-agenda](integrations/caldav.md#busy-availability) wordt als bezette afspraken aan die agenda toegevoegd, met naam en plaats, zodat ze op je telefoon verschijnt en mensen die je uitnodigen zien dat die tijd bezet is.
