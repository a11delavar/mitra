---
title: Subtaken
description: "Splits een taak op in subtaken of een checklist, volg de voortgang, en rond een hele takenboom in één keer af, verplaats hem of verwijder hem."
---

Een taak kan **subtaken** hebben: kleinere taken die samen de taak vormen. Een subtaak kan in een andere agenda staan, zelfs in een ander account, kan zelf subtaken hebben en kan [niet ingepland](planning.md#the-planning-tab) zijn.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/hierarchy-detail-dark.webp">
  <img src="../assets/screenshots/hierarchy-detail-light.webp" alt="Een taak met een checklist in de beschrijving en één afgeronde subtaak, geteld als 1/1" />
</picture>

## Een subtaak toevoegen

Open de kleinere taak, klik op **＋** bij **Subtaak van** en typ een deel van de titel van de grotere taak. Je zoekt in al je agenda's, en items uit verborgen agenda's zie je gedimd. De grotere taak toont de kleinere daarna onder **Subtaken**, met een telling van hoeveel er klaar zijn, zoals 1/3. De koppeling leg je altijd vanuit de subtaak: de rij **Subtaken** van de grotere taak somt ze alleen op.

Elke subtaak in de lijst toont zijn selectievakje in de [kleur van zijn agenda](calendars.md#recolor), zodat je hem kunt afvinken zonder de grotere taak te verlaten. Subtaken die klaar of geannuleerd zijn, worden doorgestreept. Klik op een titel om die taak te openen, of klik op het **✕** ernaast om de koppeling te verwijderen. Dat kan vanaf beide kanten. In de agenda verbindt een lijn een taak met zijn subtaken als ze allebei in beeld zijn.

Mitra weigert een koppeling die in een kringetje zou lopen, zoals een taak die uiteindelijk een subtaak van zichzelf wordt.

## Checklists

De beschrijving van een taak kan ook een checklist bevatten, geschreven in Markdown:

```markdown
- [ ] Book the venue
- [x] Send the invitations
```

Je kunt een vakje direct in de beschrijving afvinken. Mitra verandert `[ ]` in de tekst in `[x]`, zodat andere apps die de agenda gebruiken het ook zien. Vakjes aanvinken verandert nooit uit zichzelf de status van de taak. Alleen taken tellen hun checklist mee: de vakjes van een afspraak kun je aanvinken, maar ze tellen nergens voor.

## Voortgang

Een taak met subtaken of een checklist toont zijn voortgang. Elke subtaak en elk vakje telt als één stap, allemaal even zwaar, dus een taak met drie vakjes en twee subtaken heeft vijf stappen.

Een subtaak die deels klaar is, telt deels mee, of hij nu een eigen voortgang heeft of zelf subtaken. Heeft een taak drie subtaken, waarvan er twee klaar zijn en de derde op 80% staat, dan staat de taak op 93%. Geannuleerde subtaken tellen niet mee, zodat werk dat is geschrapt de taak nooit ophoudt. Afspraken die als subtaak zijn gekoppeld, tellen ook niet mee.

In de agenda vult de rand van het selectievakje van een taak zich naarmate de taak vordert. Wijs het selectievakje aan om de telling te zien, zoals ‘2 van 3 subtaken klaar’, of ‘2 van 4 stappen klaar’ als vakjes en subtaken samen tellen. Klik er met de rechtermuisknop op, of <kbd>Alt</kbd>-klik erop, om het statusmenu met het precieze percentage te openen.

## Voortgang zelf instellen

Een taak zonder subtaken en zonder checklist kan een voortgang hebben die je zelf instelt. Klik met de rechtermuisknop op het selectievakje, of <kbd>Alt</kbd>-klik erop, en sleep **Voortgang** in stappen van 5%. Bij 100% wordt de taak **Klaar**. Onder de 100% gaat een taak die klaar is terug naar **Bezig**, of naar **Te doen** bij 0%. Met het **✕** naast de waarde wis je die.

De agenda moet voortgang kunnen opslaan: [agendaservers](integrations/caldav.md), [Apple Agenda](integrations/apple.md) en [Mitra-agenda's](integrations/mitra.md) kunnen dat. Google Agenda, Notion, Todoist en Tempo kunnen dat niet, dus hun taken hebben geen schuifregelaar **Voortgang**.

## Een boom van taken afronden

Vink je de laatste openstaande subtaak af, dan vraagt Mitra of de grotere taak ook als klaar gemarkeerd moet worden. Rondt dat nog meer taken hogerop af, dan biedt Mitra aan ze allemaal als klaar te markeren. Mitra vraagt dit pas als ook de checklist van de grotere taak helemaal is afgevinkt.

Markeer je een taak als klaar of geannuleerd terwijl sommige subtaken nog openstaan, dan vraagt Mitra wat het daarmee moet doen: **Markeren als klaar** of **Markeren als geannuleerd**. Sluit de vraag om ze open te laten. Je kunt er later op terugkomen: in het statusmenu van de taak leidt de telling van de subtaken naar dezelfde vraag.

## Een taak met subtaken verplaatsen of verwijderen

Sleep je een taak met subtaken naar een ander tijdstip, dan vraagt Mitra **Subtaken ook verplaatsen?**. Kies **Alleen dit item**, of verplaats de taak met al zijn subtaken over dezelfde tijd. Verwijder je zo'n taak, dan vraagt Mitra op dezelfde manier **Subtaken ook verwijderen?**.

> [!TIP]
> Houd <kbd>Ctrl</kbd> (<kbd>⌘</kbd> op een Mac) ingedrukt terwijl je loslaat of verwijdert om de vraag over te slaan en alleen die taak te wijzigen. Zie [sneltoetsen](shortcuts.md).

## Welke agenda's dit ondersteunen

Een koppeling wordt bij de subtaak opgeslagen, in de agenda van dat item zelf. [Agendaservers](integrations/caldav.md), [Apple Agenda](integrations/apple.md) en [Mitra-agenda's](integrations/mitra.md) kunnen elke koppeling bevatten, en op een agendaserver wordt die in het standaardformaat voor agenda's geschreven, zodat andere apps die dezelfde agenda gebruiken hem kunnen lezen.

- In [Notion](integrations/notion.md) komt een koppeling naar een taak in dezelfde database in de bijbehorende relatie-eigenschap terecht, zoals ‘Parent task’. Koppelingen naar al het andere bewaart Mitra zelf.
- In [Todoist](integrations/todoist.md) wordt een bovenliggende taak die een taak van hetzelfde Todoist-account is, ook in Todoist opgeslagen, en daarmee verhuist de subtaak naar het project van die bovenliggende taak. Koppelingen naar al het andere bewaart Mitra zelf.
- [Google Agenda](integrations/google.md) laat koppelingen weg, dus een item in een Google-agenda kan geen bovenliggende taak krijgen. Items in andere agenda's kunnen er wel naar koppelen.
- [Agenda-abonnementen](integrations/subscriptions.md) zijn alleen-lezen, en [Tempo](integrations/tempo.md) heeft geen koppelingen.
