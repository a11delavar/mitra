---
title: Afhankelijkheden
description: "Laat een item op een ander wachten, zie de volgorde als lijnen in de agenda, en verplaats een hele keten in één keer."
---

Een **afhankelijkheid** betekent dat een item pas kan beginnen als een ander item klaar is: eerst het concept, dan de review, dan de release. Het item dat wacht, wordt door het andere geblokkeerd.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/week-detail-dark.webp">
  <img src="../assets/screenshots/week-detail-light.webp" alt="Een week met drie studietaken die met lijnen zijn verbonden, elk naar de volgende en daarna naar het tentamen" />
</picture>

## Een afhankelijkheid toevoegen

Open het item dat wacht, klik op **＋** bij **Geblokkeerd door** en typ een deel van de titel van het item dat eerst klaar moet zijn. Je zoekt in al je agenda's, ook de verborgen, dus een item kan wachten op een item in een andere agenda of een ander account. Items uit verborgen agenda's zie je gedimd. Het andere item toont dit item daarna onder **Blokkeert**. Die rij somt de koppelingen alleen op: je voegt een koppeling altijd toe vanuit het item dat wacht.

Klik in de editor op de titel van een gekoppeld item om het te openen, of klik op het **✕** ernaast om de koppeling te verwijderen. Dat kan vanaf beide kanten. Mitra weigert een koppeling die in een kringetje zou lopen, zoals twee items die op elkaar wachten.

Met een muis kun je een afhankelijkheid ook tekenen in de week- of maandweergave. Wijs het item aan dat eerst komt, pak het korte lijntje aan het einde ervan en laat het los op het item dat erop moet wachten. Tijdens het slepen wordt de lijn rood boven een item dat al te vroeg begint.

## Lijnen in de agenda

De weekweergave, de maandweergave en de tijdlijn trekken een lijn van het einde van elk item naar het begin van het item dat erop wacht. Wijs een item aan om zijn lijnen naar voren te halen. De lijnen kun je per weergave uitzetten in **Instellingen → Agenda**, met **Verbindingslijnen in de weekweergave**, **Verbindingslijnen in de maandweergave** en **Verbindingslijnen in de tijdlijn**.

## Verbroken afhankelijkheden

Begint een item voordat het item waarop het wacht klaar is, dan is de afhankelijkheid verbroken. De lijn in de agenda wordt rood, en in de rijen **Geblokkeerd door** en **Blokkeert** van de editor staat het item aan de andere kant in het rood. Zet een van beide items weer in de juiste volgorde, en de waarschuwing verdwijnt.

## Een keten verplaatsen

Sleep je een item, of een van zijn randen, terwijl andere items ervan afhangen, dan vraagt Mitra **Afhankelijke items ook verplaatsen?**. Bij de keuzes die andere items verplaatsen, staat hoeveel het er zijn:

- **Alleen dit item** verplaatst dit item en laat de rest staan waar ze staan.
- **De keten intact houden** verplaatst de andere items alleen zo ver als nodig is om ze op volgorde te houden. Items na dit item schuiven naar later, en als je dit item naar eerder hebt verplaatst, schuiven de items ervoor ook naar eerder. Een item met genoeg speling blijft staan waar het staat.
- **Alles evenveel verschuiven** verplaatst de hele keten, voor en na dit item, over dezelfde tijd, zodat de tussenruimtes gelijk blijven.

Mitra vraagt het alleen als de keuzes tot verschillende resultaten zouden leiden. Tijden wijzigen in de editor verplaatst nooit andere items.

Verschuift een item als deel van een keten, dan gaan zijn subtaken mee. Terugkerende items en niet-ingeplande taken in een keten worden nooit verplaatst.

> [!TIP]
> Houd <kbd>Ctrl</kbd> (<kbd>⌘</kbd> op een Mac) ingedrukt terwijl je loslaat om de vraag over te slaan en alleen dat item te verplaatsen. Zie [sneltoetsen](shortcuts.md).

## Welke agenda's dit ondersteunen

Een koppeling wordt opgeslagen bij het item dat wacht, in de agenda van dat item zelf. [Agendaservers](integrations/caldav.md), [Apple Agenda](integrations/apple.md) en [Mitra-agenda's](integrations/mitra.md) kunnen elke koppeling bevatten, en op een agendaserver wordt die in het standaardformaat voor agenda's geschreven, zodat andere apps die dezelfde agenda gebruiken hem kunnen lezen.

- In [Notion](integrations/notion.md) komt een koppeling naar een taak in dezelfde database in de bijbehorende relatie-eigenschap terecht, zoals ‘Blocked by’. Koppelingen naar al het andere bewaart Mitra zelf.
- [Todoist](integrations/todoist.md) kent geen afhankelijkheden, dus die bewaart Mitra zelf. Ze gaan verloren als je de verbinding met het account verbreekt of de agenda opnieuw importeert.
- [Google Agenda](integrations/google.md) laat koppelingen weg, dus een item in een Google-agenda kan nergens op laten wachten. Items in andere agenda's kunnen er wel naar koppelen.
- [Agenda-abonnementen](integrations/subscriptions.md) zijn alleen-lezen, en [Tempo](integrations/tempo.md) heeft geen koppelingen.
