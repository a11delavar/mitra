---
title: Erste Schritte
description: Mitra mit Docker Compose installieren, den ersten Kalender anlegen und ein paar Dinge ausprobieren.
sidebar:
  label: Erste Schritte
---

Mitra ist ein selbst gehosteter Kalender für deine Termine und Aufgaben. Wenn du dich erst umsehen willst, [probier die Demo aus](https://demo.mitracal.com).

## Mitra installieren

Mit [Docker](https://docs.docker.com/get-docker/) und seinem Compose-Plugin legst du eine `compose.yaml` an:

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

Führe `docker compose up -d` aus und öffne [http://localhost:3000](http://localhost:3000).

Bevor du dich darauf verlässt, [sichere](backups.md) `~/mitra` und [stell es hinter HTTPS](configuration.md#put-it-behind-https). Wenn auch andere es nutzen, schalte zuerst die [Anmeldung](sso.md) ein, denn wer sie später einschaltet, fängt für alle mit einem leeren Konto neu an.

## Einen Kalender anlegen

Beim ersten Öffnen bietet Mitra an, einen hinzuzufügen: einen [Mitra-Kalender](integrations/mitra.md), der auf deinem Server liegt, oder ein Konto, das du schon hast, etwa [CalDAV](integrations/caldav.md) oder [Google Calendar](integrations/google.md).

## Zum Ausprobieren

- Zieh in der [Wochenansicht](views/week.md) über eine freie Stunde, um einen Termin anzulegen.
- Drück im Tab [Planung](planning.md) der Seitenleiste auf **Aufgabe hinzufügen** und zieh die Aufgabe später in deine Woche.
- Drück <kbd>/</kbd> und wähle **Verfügbarkeit hinzufügen**, um deine [Arbeitszeiten](availability.md) zu schattieren.
- [Installiere Mitra auf deinem Handy](install-app.md), um [Erinnerungen](reminders.md) zu bekommen.
- Drück <kbd>?</kbd> für alle [Tastenkürzel](shortcuts.md).
