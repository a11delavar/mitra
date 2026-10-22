---
title: Integraties
description: Bewaar agenda's in Mitra zelf, of verbind CalDAV, Google Agenda, Apple Agenda, agenda-abonnementen, Notion, Todoist en Tempo, en lees hoe synchroniseren werkt.
sidebar:
  label: Overzicht
---

Je kunt een agenda op twee manieren in Mitra bijhouden. Je kunt hem in Mitra zelf opslaan, op je server, zonder account erachter. Of je verbindt een account dat je al hebt, en Mitra houdt de agenda's daarvan in twee richtingen gesynchroniseerd. De meeste mensen gebruiken uiteindelijk een mix, en items verhuizen vrij tussen de twee.

Voor allebei kies je **Integratie toevoegen** onderaan de zijbalk.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/integrations-detail-dark.webp">
  <img src="../../assets/screenshots/integrations-detail-light.webp" alt="Het venster Integratie toevoegen, met de keuze uit Mitra, CalDAV, Google Agenda, Apple Agenda, agenda-abonnementen, Notion en Tempo" />
</picture>

## Wat elke integratie bevat

| Integratie | Wat ze bevat | Instellen op de server |
| --- | --- | --- |
| [Mitra](mitra.md) | Afspraken en taken, opgeslagen in Mitra | Niet nodig |
| [CalDAV](caldav.md) | Afspraken en taken van elke CalDAV-server | Niet nodig |
| [Google Agenda](google.md) | De agenda's van een Google-account | Eenmalig OAuth instellen |
| [Apple Agenda](apple.md) | De agenda's van een iCloud-account | Niet nodig |
| [Agenda-abonnementen](subscriptions.md) | Een gepubliceerde `webcal://`- of `.ics`-feed, alleen-lezen | Niet nodig |
| [Notion](notion.md) | Taken uit weergaven van Notion-databases | Niet nodig |
| [Todoist](todoist.md) | De taken van je Todoist-projecten | Niet nodig |
| [Tempo](tempo.md) | De uren die je op Jira-issues boekt | Niet nodig |

Elke aanbieder slaat andere dingen op. Taken in Notion kunnen bijvoorbeeld niet terugkeren, en een worklog in Tempo heeft geen locatie. Mitra verbergt de velden die een agenda niet kan opslaan, zodat niets wat je typt bij de volgende synchronisatie verdwijnt.

## Hoe synchroniseren werkt

Als je een account verbindt, zoekt Mitra de agenda's ervan op en zet ze in een lijst, allemaal aangevinkt. Vink vóór het opslaan de agenda's uit die je niet wilt, en Mitra importeert de rest. Agenda's die later in het account verschijnen, komen binnen zonder vinkje, zodat er niets nieuws in je agenda belandt zonder dat je ervoor kiest. Een agenda die is uitgeschakeld, downloadt Mitra nooit.

Daarna synchroniseert de server zelfstandig op de achtergrond. Zolang iemand Mitra open heeft, controleert hij vaker, en als niemand het open heeft, minder vaak:

| | Zolang Mitra open is | Zolang niemand het open heeft |
| --- | --- | --- |
| CalDAV en Apple Agenda | elke 10 seconden | elke 5 minuten |
| Google Agenda, Notion, Todoist en Tempo | ongeveer eens per minuut | elke 5 minuten |
| Agenda-abonnementen | elke 15 minuten | elke 15 minuten |
| Mitra-agenda's | niets te synchroniseren | niets te synchroniseren |

Google, Notion, Todoist en Tempo beperken hoe vaak apps ze mogen aanroepen, daarom zijn die trager. Open je Mitra, dan synchroniseert elk account dat aan de beurt is meteen, dus er is geen vernieuwknop om op te drukken.

Wijzigingen gaan beide kanten op. Als je een item maakt, bewerkt, verplaatst of verwijdert, schrijft Mitra dat terug naar de agenda waar het bij hoort. Als één account een fout geeft, houdt dat de andere niet op: Mitra probeert het een minuut later opnieuw.

Sommige agenda's kun je vanuit Mitra niet wijzigen, zoals abonnementen en agenda's die alleen ter inzage met je zijn gedeeld. Je kunt ze wel een andere naam of kleur geven en verbergen. Zie [Alleen-lezen agenda's](../calendars.md#read-only-calendars).

> [!NOTE]
> Bij het synchroniseren wordt alleen opgehaald wat is gewijzigd. Klopt er ooit iets niet aan een agenda, dan gooit **Items opnieuw importeren** in het **⋯**-menu van die agenda de kopie van Mitra weg en importeert de agenda opnieuw bij de aanbieder. Zie [Een agenda opnieuw importeren](../calendars.md#re-import-a-calendar). Bij de aanbieder verandert er in beide gevallen niets.

## Een account wijzigen

Elk account kan maar één keer worden verbonden. Wil je het wachtwoord wijzigen, of kiezen welke agenda's Mitra ervan toont, kies dan **Bewerken** in het **⋯**-menu van het account in plaats van het opnieuw toe te voegen. Google Agenda is de uitzondering: als je hetzelfde Google-account opnieuw verbindt, vernieuw je de toegang van Mitra.
