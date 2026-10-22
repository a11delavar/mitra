---
title: Mitra-agenda's
description: Agenda's die in Mitra zelf staan, op je server, zonder account erachter.
---

Een Mitra-agenda staat in de eigen database van Mitra in plaats van bij een aanbieder. Je hoeft geen account te verbinden en er valt niets te synchroniseren: je maakt een agenda aan en begint items toe te voegen. Het is de eenvoudigste manier om met Mitra te beginnen, en een goede plek voor alles wat niet thuishoort in een van je bestaande accounts.

Mitra-agenda's staan op je server, niet op je apparaat, dus ze zijn er overal waar je Mitra opent. Ze kunnen alles bevatten wat Mitra kent: afspraken en taken, herhalingen, herinneringen, [beschikbaarheid](../availability.md), [subtaken](../subtasks.md), [afhankelijkheden](../dependencies.md), vervaldatums en geschatte duur.

## Mitra-agenda's toevoegen

1. Kies **Integratie toevoegen** onderaan de zijbalk en daarna **Mitra**.
2. Geef je eerste agenda een naam.
3. Klik op **Opslaan**.

De agenda is meteen klaar voor gebruik. De integratie voeg je maar één keer toe: ze bevat zoveel agenda's als je wilt, dus daarna verdwijnt de tegel uit **Integratie toevoegen**.

Wil je nog een agenda toevoegen, open dan het **⋯**-menu bij de kop Mitra in de zijbalk en kies **Nieuwe agenda**. Wil je er een verwijderen, kies dan **Agenda verwijderen** in het **⋯**-menu van die agenda. Een andere naam of kleur geven, de volgorde wijzigen en verbergen werkt net als bij elke andere agenda. Zie [Agenda's](../calendars.md).

> [!CAUTION]
> Als je een Mitra-agenda verwijdert, worden al haar items definitief verwijderd, want er is geen aanbieder waar ze vandaan kunnen worden teruggehaald. Mitra vraagt het eerst, en biedt aan om [de items te verplaatsen](../calendars.md#move-or-copy-every-entry-to-another-calendar) naar een andere agenda voordat er iets wordt verwijderd.

## Items erin en eruit verplaatsen

Items verhuizen vrij tussen een Mitra-agenda en elke andere agenda. Wil je er één verplaatsen, kies dan een andere agenda in de editor. Wil je een hele agenda verplaatsen, gebruik dan **⋯ → Items verplaatsen naar…**. Daar zie je eerst wat de bestemming niet kan opslaan.

Het werkt ook andersom: je kunt in Mitra beginnen en alles later naar een CalDAV- of Google-agenda verplaatsen.

## Back-ups maken

Een verbonden account houdt zijn eigen kopie van je items bij. Een Mitra-agenda niet: haar items bestaan alleen in de database van Mitra. Zorg dat de datamap van Mitra in je [back-ups](../backups.md) zit.

Ben je van plan om later [inloggen](../sso.md) in te schakelen, houd er dan rekening mee dat iedereen dan met een nieuw, leeg account begint. Mitra-agenda's die je daarvoor hebt gemaakt, blijven bij het oude account voor één gebruiker.

## Wat ze niet kunnen

- Deelnemers worden bijgehouden als overzicht van wie erbij betrokken is, maar niemand krijgt een uitnodiging en er komen geen antwoorden binnen, omdat er geen agendaserver is die ze kan versturen. Verplaats je een vergadering hierheen vanuit een CalDAV-agenda, dan wordt het origineel daar verwijderd, en sommige servers laten de deelnemers dan weten dat de vergadering is geannuleerd. Kopieer de vergadering in plaats daarvan als de deelnemers daar niets van mogen merken.
- Andere apps kunnen ze niet zien. Mitra publiceert zijn agenda's niet via CalDAV, dus gebruik een [CalDAV](caldav.md)-server voor agenda's die je ook in de agenda-app op je telefoon wilt hebben.
- Er valt niets opnieuw te importeren, dus **Items opnieuw importeren** wordt niet aangeboden.
