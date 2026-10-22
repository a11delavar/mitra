---
title: Notion
description: Haal de weergaven van je takendatabases in Notion naar Mitra, als agenda's met taken die in beide richtingen synchroniseren.
---

Mitra maakt verbinding met Notion voor taken. Elke weergave van een takendatabase, zoals ‘All tasks’, ‘My tasks’ of een sprintbord, wordt in Mitra een agenda met precies de taken die die weergave toont: Notion past de filters van de weergave toe, en Mitra zet het resultaat in je agenda. De titel, status, datums en beschrijving van een taak synchroniseren in beide richtingen.

Je verbindt Notion vanuit de app met een integratietoken. Op de server hoef je niets in te stellen.

## Een werkruimte verbinden

1. Maak een integratie aan op [notion.so/profile/integrations](https://www.notion.so/profile/integrations). Een interne integratie is genoeg.
2. Deel je takendatabases met die integratie. Open elke database in Notion, kies **•••** → **Connections** en voeg je integratie toe.
3. Kies in Mitra onder in de zijbalk **Integratie toevoegen** en daarna **Notion**, en plak het geheim van de integratie, dat met `ntn_` begint, in **Integratietoken**.
4. Klik op **Verbinden**. Mitra toont de weergaven van de databases die je hebt gedeeld, genoemd naar de database en de weergave.
5. Kies de weergaven die je wilt en klik op **Opslaan**.

Mitra zet om te beginnen één weergave per database aan. Een taak hoort bij elke weergave waarvan hij aan de filters voldoet. Staan er twee weergaven van dezelfde database aan, dan zie je die taak dus twee keer. Wil je bewust meer weergaven aanzetten, dan kan dat gewoon.

Mitra biedt tabel-, bord-, lijst-, kalender-, tijdlijn- en galerieweergaven aan. Andere soorten weergaven staan niet in de lijst.

## Welke databases werken

Een database verschijnt als hij een eigenschap van het type Status en een van het type Date heeft. De takensjablonen van Notion zelf hebben ze allebei.

Mitra leidt de status van een taak af uit de groep waartoe zijn Notion-status behoort:

| Statusgroep in Notion | Status in Mitra |
| --- | --- |
| To-do | Te doen |
| In progress | Bezig |
| Complete | Klaar |

Wijzig je in Mitra een status, dan krijgt Notion de eerste optie uit de bijbehorende groep.

De eigenschap Date bepaalt waar Mitra de taak plaatst: die datum is dus het tijdvak van de taak. Heeft een database meerdere Date-eigenschappen, dan kiest Mitra bij voorkeur een eigenschap waarvan de naam met ‘Due’ begint, daarna een met de naam ‘Date’, ‘When’, ‘Deadline’, ‘Scheduled’ of ‘Do date’, en anders de eerste.

## Wat er synchroniseert

De titel, de status en de datum synchroniseren in beide richtingen, als datums voor de hele dag of met tijden. Tijden zie je in je eigen tijdzone. Een taak zonder datum wacht in de lijst **Niet ingepland** op het [tabblad Planning](../planning.md#the-planning-tab).

De beschrijving van een taak is de inhoud van zijn Notion-pagina, geschreven in Markdown, met takenlijstjes, callouts en afbeeldingen. Bewerk je de beschrijving in Mitra, dan vervangt Mitra alleen wat de beschrijving toont. Embeds, subpagina's en gesynchroniseerde blokken blijven ongewijzigd in Notion staan, en Mitra toont ze niet. Een afbeelding die je in Notion hebt toegevoegd, toont Mitra wel, en ze blijft ongewijzigd in Notion staan. Na een bewerking vanuit Mitra komt ze wel boven de tekst te staan, omdat andere apps in Notion alleen tekst mogen toevoegen na wat Notion bewaart.

Relatie-eigenschappen die taken binnen dezelfde database met elkaar verbinden, worden in Mitra koppelingen, in beide richtingen. Een eigenschap met de naam ‘Parent task’ of ‘Sub-tasks’ levert [subtaken](../subtasks.md) op, een eigenschap met de naam ‘Blocked by’ of ‘Depends on’ levert [afhankelijkheden](../dependencies.md) op, en andere relaties verschijnen onder hun eigen naam. Relaties met andere databases zie je niet.

Wil je een taak in Notion openen, kies dan **Openen in Notion** in het **⋯**-menu van de editor. Verwijder je een taak in Mitra, dan gaat zijn pagina naar de prullenbak van Notion, waar je hem nog kunt terugzetten.

Notion beperkt hoe vaak apps het mogen aanroepen, daarom synchroniseert Mitra ongeveer één keer per minuut (zie [hoe synchroniseren werkt](README.md#how-syncing-works)). Een nieuwe taak verdwijnt nooit even terwijl Notion de wijziging nog verwerkt.

## Wat Notion niet kan bevatten

Een Notion-database bevat taken met elk één datum, en dat bepaalt wat een Notion-agenda kan bevatten:

- Alleen taken, dus geen afspraken en geen [beschikbaarheid](../availability.md).
- De enige datum van een taak is zijn tijdvak, dus er is geen vervaldatum of geschatte duur.
- Taken kunnen niet worden herhaald en hebben geen herinneringen, locatie of deelnemers.
- Er is geen status **Geannuleerd**, omdat Notion daar geen groep voor heeft.
- Een taak kan geen eigen tijdzone, voortgangspercentage, zichtbaarheid of keuze tussen bezet en vrij hebben.

Mitra verbergt deze velden bij Notion-taken, zodat niets wat je daar invult bij de volgende synchronisatie verdwijnt. Wil je items die deze velden gebruiken naar Notion verplaatsen, lees dan [Alle items naar een andere agenda verplaatsen of kopiëren](../calendars.md#move-or-copy-every-entry-to-another-calendar). Daar zie je eerst wat niet mee zou komen.

## Weergaven en filters

Een agenda toont wat de bijbehorende Notion-weergave toont. Een taak die je erin aanmaakt, krijgt de filterwaarden van de weergave en komt dus ook in die weergave terecht. Een taak die je toevoegt aan een weergave ‘University’ krijgt ‘Area = University’, alsof je de rij in Notion had toegevoegd.

Mitra vult de filters in waaraan één waarde kan voldoen: een select, een status, een multi-select, een selectievakje of een relatie met een bepaalde pagina. Aan sommige filters kan geen enkele waarde voldoen, zoals een formule, een datumbereik of een van meerdere opties. Een taak die je in zo'n weergave aanmaakt, voldoet daar niet aan en verschijnt er dus, net als in Notion, niet in. Hij staat wel in de database, en een weergave met minder filters, zoals ‘All tasks’, toont hem.

> [!TIP]
> Filtert een weergave op een relatie met een andere database, bijvoorbeeld taken waarvan ‘Area’ naar een pagina ‘University’ in een database ‘Areas’ verwijst, deel die database dan ook met je integratie. Anders kan Mitra de relatie bij nieuwe taken niet instellen, en verschijnen ze niet in de weergave.

## Probleemoplossing

- Staat een database niet in de lijst, dan mist hij een eigenschap Status of Date, of is hij niet gedeeld met je integratie (**•••** → **Connections** in Notion). Open na het delen in Mitra **⋯ → Bewerken** bij het account en klik op **Vernieuwen**.
- Zie je een taak twee keer, dan heb je twee weergaven van dezelfde database aangezet die hem allebei bevatten. Zet er een uit via **⋯ → Bewerken** bij het account.
