---
title: Aan de slag
description: Installeer Mitra met Docker Compose, voeg je eerste agenda toe en probeer een paar dingen uit.
sidebar:
  label: Aan de slag
---

Mitra is een agenda voor je afspraken en taken, die je op je eigen server draait. Wil je eerst rondkijken? [Probeer de demo](https://demo.mitracal.com).

## Mitra installeren

Heb je [Docker](https://docs.docker.com/get-docker/) met de Compose-plug-in, maak dan een `compose.yaml` aan:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
```

Voer `docker compose up -d` uit en open [http://localhost:3000](http://localhost:3000).

Voordat je erop gaat vertrouwen, [maak je een back-up](backups.md) van `~/mitra` en [zet je Mitra achter HTTPS](configuration.md#put-it-behind-https). Gaan anderen Mitra ook gebruiken, schakel dan eerst [inloggen](sso.md) in. Doe je dat later, dan begint iedereen opnieuw met een leeg account.

## Een agenda toevoegen

Als je Mitra voor het eerst opent, stelt het voor om een agenda toe te voegen: een [Mitra-agenda](integrations/mitra.md) die op je eigen server staat, of een account dat je al hebt, zoals [CalDAV](integrations/caldav.md) of [Google Agenda](integrations/google.md).

## Om uit te proberen

- Sleep in de [weekweergave](views/week.md) over een leeg uur om een afspraak te maken.
- Klik op **Taak toevoegen** op het tabblad [Planning](planning.md) in de zijbalk, en sleep de taak later naar je week.
- Druk op <kbd>/</kbd> en voer **Beschikbaarheid toevoegen** uit om je [werktijden](availability.md) te arceren.
- [Installeer Mitra op je telefoon](install-app.md) om [herinneringen](reminders.md) te krijgen.
- Druk op <kbd>?</kbd> voor een overzicht van alle [sneltoetsen](shortcuts.md).
