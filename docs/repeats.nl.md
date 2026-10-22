---
title: Herhalen
description: "Laat een item herhalen, wijzig of verwijder één herhaling of de hele reeks, en zie welke agenda's herhalingen kunnen bevatten."
---

Een terugkerend item is één item met een herhalingsregel, zoals een teamoverleg elke maandag of huur die elke maand op de 1e betaald moet zijn. Op deze pagina heet het geheel een reeks, en elk van de datums daarin een herhaling. Elke herhaling toont in de weergaven een klein herhaalpictogram.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-detail-dark.webp">
  <img src="../assets/screenshots/repeat-detail-light.webp" alt="De editor van een wekelijks teamoverleg met de lijst Herhalen geopend: Wordt niet herhaald, Elke dag, Elke werkdag, Elke week op di, Elke 2 weken, Elke maand op de 1e, op de 1e di, Elk jaar en Aangepast" />
</picture>

## Een item laten herhalen

Open het item en kies een regel op de regel **Herhalen**. Die verschijnt zodra het item een datum heeft: een begin, of bij een niet-ingeplande taak een vervaldatum.

De lijst biedt regels aan die zijn gebaseerd op de datum waarop de reeks begint, ook als je een latere herhaling hebt geopend. Voor een item op dinsdag de 13e zijn dat **Elke dag**, **Elke werkdag** (maandag tot en met vrijdag), **Elke week** op dinsdag, **Elke 2 weken** op dinsdag, **Elke maand** op de 13e, **Elke maand** op de 2e dinsdag, en **Elk jaar** op die datum. Valt het begin in de laatste zeven dagen van de maand, dan is er ook **Elke maand** op de laatste dinsdag.

Wil je dat een item zich niet meer herhaalt, kies dan **Wordt niet herhaald**. Een wijziging van de regel geldt altijd voor de hele reeks, dus Mitra vraagt niet welke herhalingen je bedoelt.

### Aangepaste regels

Voor al het andere kies je **Aangepast…**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-custom-detail-dark.webp">
  <img src="../assets/screenshots/repeat-custom-detail-light.webp" alt="Het venster Herhalen: elke 1 week op dinsdag, met als einde nooit, op een datum of na een aantal keer" />
</picture>

Typ na **Elke** een getal en kies dagen, weken, maanden of jaren. Bij een wekelijkse regel verschijnen daarna de dagen van de week: zet elke dag aan waarop het item zich herhaalt; er blijft er altijd minstens één aan. Een maandelijkse regel valt op hetzelfde dagnummer als het begin, zoals de 13e, of op dezelfde weekdag van de maand, zoals de 2e dinsdag. Ligt het begin in de laatste zeven dagen van de maand, dan kan hij ook op de laatste dinsdag vallen.

Kies onder **Eindigt** voor **Nooit**, **Op** een datum of **Na** een aantal keer. Druk op **Klaar**, en de regel **Herhalen** toont de regel in woorden, zoals ‘Elke 2 weken op do tot 18 dec.’.

## Eén herhaling wijzigen of verwijderen

Als je een herhaling wijzigt, vraagt Mitra welke items je bedoelt. Die vraag komt als je de herhaling naar een ander tijdstip sleept, aan de rand ervan sleept, haar verwijdert of een veld in de editor wijzigt, zoals de titel.

- **Dit item** wijzigt alleen de herhaling die je hebt gekozen.
- **Dit en volgende items** wijzigt deze herhaling en alle latere. De reeks eindigt vlak ervoor, en op die plek begint een nieuwe reeks met jouw wijziging, zodat de eerdere herhalingen blijven zoals ze waren. De eerste herhaling biedt deze keuze niet, want daar zou het de hele reeks betekenen.
- **Alle items** wijzigt elke herhaling. Verschuif je er een een dag, dan verschuiven ze allemaal, dus een wekelijks overleg op maandag wordt een wekelijks overleg op dinsdag. Maak je er een langer of korter, dan krijgen ze allemaal die nieuwe lengte.

Verwijderen werkt net zo: **Dit item** verwijdert één datum, **Dit en volgende items** laat de reeks ervoor eindigen, en **Alle items** verwijdert de hele reeks.

Wil je de vraag overslaan en alleen deze herhaling wijzigen, houd dan <kbd>Ctrl</kbd> (<kbd>⌘</kbd> op een Mac) ingedrukt terwijl je haar neerzet, of druk op <kbd>Ctrl</kbd> + <kbd>Delete</kbd> terwijl ze open is.

Bij een paar wijzigingen komt de vraag nooit. Een herhaling van een taak als klaar markeren geldt alleen voor die herhaling, en dat geldt ook voor het inplannen van één herhaling van een taak die zich op zijn vervaldatum herhaalt.

## Gewijzigde en verwijderde herhalingen

Een herhaling die je met **Dit item** wijzigt, verlaat de reeks en wordt een zelfstandig item. De reeks slaat die datum over, zodat hij nooit dubbel verschijnt, en latere wijzigingen aan de hele reeks hebben er geen invloed meer op.

Een verwijderde herhaling blijft verwijderd. Ze komt niet terug als je later de hele reeks verplaatst of wijzigt, en andere apps die dezelfde agenda gebruiken, laten haar ook weg.

## Een reeks naar een andere agenda verplaatsen

Kies een andere agenda in de editor van een herhaling, en dezelfde vraag bepaalt of die herhaling, de rest van de reeks of de hele reeks wordt verplaatst, zoals beschreven in [Eén item verplaatsen](calendars.md#move-a-single-entry).

## Terugkerende taken

Elke herhaling van een terugkerende taak is een eigen taak die je als klaar markeert. Een taak kan zich ook alleen op zijn vervaldatum herhalen, zoals de huur, die je elke maand uiterlijk op de 1e betaalt: zie [terugkerende vervaldatums](planning.md#repeating-due-dates). Terugkerende taken zijn nooit achterstallig, en je kunt ze niet uit de agenda halen, omdat hun datums de reeks vormen.

## Hoe herhalingen worden weergegeven

Iets wat zich vaak herhaalt, zoals een dagelijkse workout, verschijnt in de maand- en jaarweergave als een [routine](routines.md): een rij kleine markeringen in plaats van een balk voor elke dag. De [tijdlijn](views/timeline.md) toont van een terugkerende taak alleen de herhalingen die vervallen, zodat een dagelijkse taak hem niet volledig vult.

## Welke agenda's herhalingen ondersteunen

[Agenda's die in Mitra zijn opgeslagen](integrations/mitra.md) en [agendaservers](integrations/caldav.md), waaronder Google en Apple, kunnen terugkerende items bevatten. Agenda's van [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) en [Tempo](integrations/tempo.md) kunnen dat niet, dus hun editor heeft geen regel **Herhalen**, en de editor van een reeks biedt ze niet aan als agenda. Een taak die in Todoist terugkeert, staat op zijn volgende datum: rond je hem af, dan schuift hij door naar de datum daarna, zoals Todoist dat doet, en de regel wijzig je alleen in Todoist.

Als je [alle items van een agenda verplaatst](calendars.md#move-or-copy-every-entry-to-another-calendar) naar een agenda die geen terugkerende items ondersteunt, vraagt Mitra wat er met de terugkerende items moet gebeuren. **Hier laten** laat ze staan waar ze zijn. **Opsplitsen in losse items** zet elke herhaling in het komende jaar om in een apart item dat zich niet meer herhaalt.

[Beschikbaarheid](availability.md) is ook een terugkerend item, en begint als wekelijks. Daarom kan het evenmin in agenda's van Notion, Todoist of Tempo staan.
