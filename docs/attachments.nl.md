---
title: Bijlagen
description: "Voeg bestanden toe aan een afspraak of taak. Mitra bewaart ze op je server en slaat ze op bij het item, zodat andere agenda-apps ze ook zien."
---

Een item kan **bijlagen** hebben: bestanden zoals een ticket, een foto van een whiteboard of een recept. Mitra bewaart het bestand op je server en slaat het op bij het item, in het standaardformaat voor agenda's. Andere apps die dezelfde agenda gebruiken, zoals Nextcloud of Apple Agenda, tonen dus hetzelfde bestand bij dezelfde afspraak.

## Een bestand toevoegen

Open het item en druk op **＋** in de rij met de paperclip, of op het woord **Bijlagen** zolang die rij nog leeg is, en kies een of meer bestanden. Elke bijlage toont een pictogram voor het soort bestand, de naam en de grootte. Klik op een bijlage om haar in een nieuw tabblad te openen, en druk op haar **✕** om haar uit het item te verwijderen.

Een paperclip op het item in de agenda laat zien welke items bestanden hebben.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/attachments-detail-dark.webp">
  <img src="../assets/screenshots/attachments-detail-light.webp" alt="Een geopende taak naast haar item in de week, waarvan de paperclip laat zien dat er bestanden bij horen: de editor toont een pdf, een schets en een spreadsheet boven de beschrijving, waarin de schets staat" />
</picture>

Links zijn geen bijlagen. Wil je een link aan een item toevoegen, schrijf hem dan in de beschrijving, dan toont de rij [Links](links.md) hem.

## Waar de bestanden worden bewaard

Bestanden die je toevoegt, worden bewaard in de map `files` in de gegevensmap van Mitra, naast de database. Een [back-up](backups.md) van die map bevat ze dus ook. Elk bestand wordt opgeslagen onder een willekeurige naam in plaats van zijn eigen naam, en hetzelfde bestand dat je twee keer toevoegt, wordt maar één keer bewaard.

> [!IMPORTANT]
> Iedereen die het adres van een bestand heeft, kan het openen zonder in te loggen bij Mitra. Daardoor kunnen andere agenda-apps het bestand openen: Mitra schrijft het adres in je agenda, en die apps kunnen niet inloggen bij Mitra. Het adres bevat een willekeurig deel dat niet te raden is, maar behandel het als elke deellink. Wil je een nieuw adres, verwijder dan de bijlage en voeg het bestand opnieuw toe.

Afbeeldingen, video's, audio, pdf's en platte tekst worden in de browser geopend. Alle andere soorten bestanden worden gedownload, zodat een bestand nooit code kan uitvoeren binnen Mitra.

## Limieten

Eén bestand mag maximaal 25 MB groot zijn, en er is geen limiet op hoeveel iemand kan opslaan. Wie de server beheert, kan beide wijzigen of het toevoegen van bestanden uitschakelen; zie [Configuratie](configuration.md#attachments). In de [demo](https://demo.mitracal.com) staat het toevoegen van bestanden altijd uit.

Een bestand dat geen enkel item meer gebruikt, wordt ongeveer een dag nadat het is toegevoegd verwijderd. Tot dan kun je het nog toevoegen aan een item dat je nog niet hebt opgeslagen, of het terugzetten als je het per ongeluk hebt verwijderd.

## Welke agenda's dit ondersteunen

Agenda's van een [CalDAV-server](integrations/caldav.md) en van [Apple Agenda](integrations/apple.md) kunnen bijlagen bevatten, net als [Mitra-agenda's](integrations/mitra.md). In een [agenda-abonnement](integrations/subscriptions.md) zie je de bijlagen die de feed meestuurt, maar je kunt ze niet wijzigen.

Een bestand kan ook in de beschrijving verschijnen: de knop voor een afbeelding of link in de rij van het bestand voegt het toe aan het einde van de tekst, als afbeelding bij afbeeldingen en als link bij de rest. Verwijder je de bijlage, dan verdwijnt dat ook.

In een [Google-agenda](integrations/google.md) zijn de bijlagen de Google Drive-bestanden die in Google Agenda zijn toegevoegd: Mitra toont ze, maar kan er geen toevoegen of verwijderen. Agenda's van [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) en [Tempo](integrations/tempo.md) hebben geen rij voor bijlagen. Verplaats je een item met bijlagen naar een van deze agenda's, dan vervallen de bestanden, en Mitra laat je dat weten voordat er iets wordt verplaatst.

> [!NOTE]
> Bijlagen die andere apps hebben toegevoegd, verschijnen ook in Mitra, ook bestanden die je agendaserver zelf bewaart en die met het eigen adres van die server worden geopend. Bijlagen die Mitra niet herkent, laat het precies zoals ze zijn, zodat het bewerken van een item in Mitra nooit de bijlagen van een andere app wijzigt.
