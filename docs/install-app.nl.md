---
title: De app installeren
description: "Installeer Mitra als app op een computer, een Android-telefoon, een iPhone of een iPad, zodat het in een eigen venster opent."
---

Mitra draait in je browser, maar je kunt het ook als app installeren. Er komt geen appstore aan te pas: je browser geeft Mitra een eigen venster en pictogram, en je opent het vanuit je Dock, taakbalk, startmenu of beginscherm, net als elke andere app.

Installeren loont om drie redenen:

- Mitra opent in een eigen venster, los van je browsertabbladen, en de meldingen verschijnen onder de eigen naam en het eigen pictogram van Mitra.
- Op een iPhone of iPad is het de enige manier om [herinneringen](reminders.md) te krijgen.
- Op een computer kan Mitra `.ics`-bestanden en `webcal://`-links voor je openen. Zie [Agendabestanden](calendar-files.md).

De geïnstalleerde app heet altijd Mitra en heeft altijd het pictogram van Mitra, ook als je server de instantie [een eigen naam](configuration.md#name-your-instance) geeft.

## Op een computer

Open Mitra in Chrome, Edge of een andere op Chromium gebaseerde browser en klik op het installatiepictogram aan het einde van de adresbalk. Zodra de browser aanbiedt Mitra te installeren, staat er onderaan de zijbalk ook een knop **Als app installeren**. Je kunt ook via het menu van de browser gaan: in Chrome **Casten, opslaan en delen → Pagina installeren als app**, en in Edge **Apps → Deze site als app installeren**.

Kies in Safari op een Mac **Archief → Voeg toe aan Dock**.

Na de installatie opent Mitra in een eigen venster. Is dat venster al open als je een agendabestand of -link opent, dan haalt Mitra het naar voren in plaats van een tweede venster te openen.

## Op Android

Open Mitra in Chrome, open het browsermenu (**⋮**) en kies **App installeren** of **Toevoegen aan startscherm**. Mitra staat daarna tussen je andere apps.

Op Android werken herinneringen ook in de browser, dus of je installeert, mag je zelf weten.

## Op iPhone en iPad

Open Mitra in Safari, tik op de deelknop en daarna op **Zet op beginscherm**. Open Mitra voortaan via het pictogram op je beginscherm.

Op iPhone en iPad werken meldingen alleen in de geïnstalleerde app, vanaf iOS en iPadOS 16.4. Sta ze toe vanuit de geïnstalleerde app zelf: Safari en de app staan los van elkaar, en alleen de app kan herinneringen ontvangen.

> [!NOTE]
> Staat je server achter een reverse proxy die je met een cookie laat inloggen, dan werkt installeren nog steeds. Mitra vraagt zijn appbeschrijving (het webapp-manifest) op met je cookies, dus de proxy laat dat verzoek door.
