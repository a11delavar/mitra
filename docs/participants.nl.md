---
title: Deelnemers
description: "Voeg de mensen toe die bij een item betrokken zijn en volg hun antwoorden. Of ze een uitnodiging krijgen, hangt af van de agenda."
---

Een item kan **deelnemers** hebben: de mensen die erbij betrokken zijn. Mitra slaat ze bij het item op in het standaardformaat voor agenda's. Elke andere app die dezelfde agenda gebruikt, ziet dus dezelfde lijst, en antwoorden die in Apple Agenda, Thunderbird of een webmail worden gegeven, verschijnen ook in Mitra.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/participants-detail-dark.webp">
  <img src="../assets/screenshots/participants-detail-light.webp" alt="Een item met drie deelnemers, met hun antwoorden als badges op hun avatars" />
</picture>

## Wie de uitnodigingen verstuurt

Mitra verstuurt zelf nooit e-mail. Wat er gebeurt als je iemand toevoegt, hangt af van de agenda waarin het item staat.

Staat het item in een agenda van een [agendaserver](integrations/caldav.md), [Google Agenda](integrations/google.md) of [Apple Agenda](integrations/apple.md), dan verstuurt die server alles: de uitnodiging, een update als het item verandert, en een annulering als je iemand verwijdert of het item verwijdert. De server verzamelt ook de antwoorden, en zo komen ze in Mitra terecht. De meeste servers doen dit, waaronder Google, iCloud, Nextcloud, Fastmail, mailbox.org en Zimbra. Een server die alleen agenda's opslaat, verstuurt niets. Dan hoort niemand van het item en blijft elk antwoord uit.

In een [Mitra-agenda](integrations/mitra.md) zit geen server achter de agenda, dus de lijst houdt alleen bij wie erbij betrokken is. Niemand wordt uitgenodigd en er komen geen antwoorden binnen.

Agenda's van [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) en [Tempo](integrations/tempo.md) kunnen geen deelnemers bevatten, dus hun items hebben geen rij voor deelnemers. In een [agenda-abonnement](integrations/subscriptions.md) kun je de deelnemers wel zien, maar niet wijzigen, omdat de agenda alleen-lezen is.

## Mensen toevoegen

Open het item, typ een e-mailadres in **Deelnemers toevoegen** en druk op Enter. Je kunt er meerdere tegelijk toevoegen, gescheiden door komma's, puntkomma's of spaties. Wil je later meer mensen toevoegen, klik dan op **＋** naast het aantal deelnemers.

In een agenda met een account erachter word je bij de eerste persoon die je toevoegt de **organisator**: je eigen adres komt in de lijst, gemarkeerd als **Organisator** en als geaccepteerd. Een Mitra-agenda heeft geen adres van jou dat hij kan gebruiken, dus de lijsten daar hebben geen organisator.

Elke persoon verschijnt met een initiaal, een e-mailadres, een naam als de agenda die kent, en **Organisator** of **Optioneel** als dat van toepassing is. E-mailadressen zijn selecteerbaar, zodat je één adres uit de rij kunt kopiëren. Staan er meer dan vijf mensen in de lijst, dan toont die de eerste vier en klapt de rest in achter een rij die zegt hoeveel er nog zijn.

Wijs een persoon aan om iets aan te passen. Met de ene knop markeer je iemand als optioneel, of weer als vereist, en met het **✕** verwijder je iemand. Op een touchscreen zijn deze knoppen altijd zichtbaar.

## Antwoorden

Een badge op de initiaal van elke persoon toont het antwoord: een groen vinkje voor geaccepteerd, een rood kruisje voor afgewezen en een geel streepje voor onder voorbehoud. Geen badge betekent nog geen antwoord. Een regel onder het aantal vat ze samen, zoals ‘2 ja, 1 nee en 3 in afwachting’.

Antwoorden komen via de agendaserver bij Mitra binnen, dus een nieuw antwoord verschijnt bij de volgende synchronisatie, niet meteen.

Mitra toont ieders antwoord, maar verstuurt dat van jou niet. Wil je een uitnodiging van iemand anders accepteren of afwijzen, antwoord dan in je mailapp of in een andere agenda-app. Je antwoord synchroniseert daarna terug naar Mitra.

## Iedereen tegelijk

Het **⋯**-menu naast het aantal werkt op de hele lijst:

- **Deelnemers e-mailen** opent je mailapp met een e-mail aan alle anderen.
- **E-mailadressen van deelnemers kopiëren** kopieert alle adressen.
- **Iedereen als vereist markeren** en **Iedereen als optioneel markeren** wijzigen ieders rol in één keer.
- **Iedereen verwijderen** maakt de lijst leeg.

## Alleen de organisator wijzigt de lijst

Bij een item dat iemand anders organiseert, kun je geen mensen toevoegen, verwijderen of wijzigen: de **＋** is verborgen, en het menu kan alleen e-mailen en kopiëren. Zo werkt de planningsstandaard die agenda-apps volgen, en ook de server van Mitra weigert zo'n wijziging. De rest van het item, zoals de titel, de tijd en de beschrijving, kun je nog wel bewerken.

> [!CAUTION]
> Verplaats je een item met deelnemers naar een andere agenda, dan wordt het uit de eerste agenda verwijderd, en sommige servers laten de deelnemers dan weten dat het is geannuleerd. [Kopieer het](calendars.md#move-or-copy-every-entry-to-another-calendar) liever als ze daar niets van mogen merken.

## Probleemoplossing

- Blijft iedereen in afwachting en is er geen uitnodiging aangekomen, dan staat het item in een Mitra-agenda, of verstuurt de agendaserver geen uitnodigingen. Controleer de server door dezelfde mensen uit te nodigen vanuit de eigen app van de aanbieder.
- Is er een antwoord binnengekomen maar is de badge niet veranderd, wacht dan op de volgende synchronisatie van Mitra, want antwoorden komen via de agendaserver binnen.
- Kun je nergens mensen toevoegen, dan organiseert iemand anders het item, of is de agenda alleen-lezen.
- Heeft het item geen rij voor deelnemers, dan kan de agenda geen deelnemers bevatten, zoals bij Notion, Todoist en Tempo.
- Ontbreekt een vergaderruimte in de lijst, dan is dat bewust: ruimtes en apparatuur zijn geen mensen, dus Mitra laat ze weg.
