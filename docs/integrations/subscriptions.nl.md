---
title: Agenda-abonnementen
description: Abonneer je op een gepubliceerde agendalink, zoals een webcal://-adres of een .ics-feed, en zie de items ervan in Mitra, alleen-lezen.
---

Veel agenda's worden gepubliceerd in plaats van gedeeld: feestdagen, wedstrijdschema's, schoolvakanties, een feed van een tool op je werk, of het privéadres van je eigen Google- of Outlook-agenda. Daarvoor log je niet in. Je abonneert je erop met een link.

Een **agenda-abonnement** haalt zo'n link naar Mitra als een eigen agenda, met de afspraken erin, en de taken als die er zijn.

Abonnementen zijn alleen-lezen. De feed staat op een andere server, die geen wijzigingen aanneemt, dus Mitra toont wat er wordt gepubliceerd en schrijft nooit iets terug. Je kunt de agenda wel een andere naam of kleur geven, verplaatsen in de lijst en verbergen; zie [Alleen-lezen agenda's](../calendars.md#read-only-calendars). Wil je een kopie van de items die je wel kunt bewerken, gebruik dan **Items kopiëren naar…** in het **⋯**-menu van de agenda.

## Op een agenda abonneren

1. Kies onder in de zijbalk **Integratie toevoegen** en daarna **Agenda-abonnement**.
2. Plak de link in **Agenda-URL**. Dat is een `webcal://`-adres, zoals knoppen met ‘Abonneren’ vaak geven, of een `https://`-adres, meestal eindigend op `.ics`.
3. Laat **Gebruikersnaam (optioneel)** en **Wachtwoord (optioneel)** leeg, tenzij de feed erom vraagt (zie [feeds met een wachtwoord](#feeds-with-a-password)).
4. Klik op **Verbinden**. Mitra leest de feed en toont de agenda ervan.
5. Laat die aanstaan en klik op **Opslaan**.

Eén link is één agenda. Wil je je op meerdere agenda's abonneren, voeg dan voor elke agenda een abonnement toe.

De agenda krijgt zijn naam van de feed, en ook zijn kleur, als de feed er een heeft. Je kunt de naam in de zijbalk wijzigen, en jouw naam blijft staan tot de feed zelf de agenda een andere naam geeft.

Heb je [Mitra je standaardagenda-app gemaakt](../calendar-files.md), dan opent een klik op een `webcal://`-link op een webpagina dit formulier met de link al ingevuld.

### Waar je een agendalink vindt

| Aanbieder | Waar je moet kijken |
| --- | --- |
| Google Agenda | In de instellingen van de agenda, **Integrate calendar** → **Secret address in iCal format** |
| Outlook en Microsoft 365 | **Share** → **Publish a calendar**, kopieer daarna de ICS-link |
| iCloud | Klik met de rechtermuisknop op de agenda → **Share Calendar** → **Public Calendar** |
| Nextcloud | Het **⋯**-menu van de agenda → **Copy subscription link** |
| Openbare agenda's | De meeste websites met feestdagen, sport of schooltijden bieden een `.ics`-link aan |

> [!CAUTION]
> Een geheim adres is een wachtwoord in de vorm van een link: iedereen die het heeft, kan de agenda lezen. Houd het voor jezelf, en stel het opnieuw in via de instellingen van je aanbieder als het ooit uitlekt.

### Feeds met een wachtwoord

De meeste gepubliceerde feeds hebben hun toegangssleutel in de link zelf en hebben verder niets nodig. Vraagt een feed om een gebruikersnaam en wachtwoord (HTTP Basic-authenticatie), bijvoorbeeld een feed op een bedrijfsserver of een eigen server, vul die dan in als je je abonneert. Mitra bewaart het wachtwoord op de server en stuurt het nooit terug naar je browser.

## Hoe het bijgewerkt blijft

Mitra synchroniseert elk abonnement elke 15 minuten, of iemand Mitra nu open heeft of niet. Mitra openen haalt een feed dus niet eerder op (zie [hoe synchroniseren werkt](README.md#how-syncing-works)). Een synchronisatie kost weinig: Mitra vraagt de server van de feed of er iets is veranderd, en downloadt de agenda alleen als dat zo is.

De agenda volgt de feed precies. Items die aan de feed worden toegevoegd, verschijnen in Mitra, en items die eruit worden verwijderd, verdwijnen.

Ziet de agenda er ooit verkeerd uit, dan leest **Items opnieuw importeren** in het **⋯**-menu de feed opnieuw vanaf het begin in. Aan de feed zelf verandert niets. Zie [Een agenda opnieuw importeren](../calendars.md#re-import-a-calendar).

## Probleemoplossing

- Meldt Mitra ‘The calendar requires a username and password’, dan is de feed beveiligd. Vul de gebruikersnaam en het wachtwoord in die nodig zijn.
- Meldt Mitra ‘No calendar was found at that address’, controleer de link dan op typefouten. Een geheim adres werkt ook niet meer als de eigenaar het opnieuw heeft ingesteld.
- Meldt Mitra ‘The address did not return a calendar’, dan leidt de link naar een webpagina in plaats van naar de feed. Zoek naar een link met iCal, ICS of Abonneren.
- Meldt Mitra ‘The calendar is too large to subscribe to’, dan is de feed groter dan 20 MB, en die leest Mitra niet.
