---
title: Getting started
description: Install Mitra with Docker Compose, get your first calendar, and a few things to try.
sidebar:
  label: Getting started
---

Mitra is a self-hosted calendar for your events and tasks. To look around first, [try the demo](https://demo.mitracal.com).

## Install Mitra

With [Docker](https://docs.docker.com/get-docker/) and its Compose plugin, create a `compose.yaml`:

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

Run `docker compose up -d` and open [http://localhost:3000](http://localhost:3000).

Before you rely on it, [back up](backups.md) `~/mitra` and [put it behind HTTPS](configuration.md#put-it-behind-https). If others will use it, turn on [sign-in](sso.md) first, since turning it on later starts everyone over with an empty account.

## Get a calendar

Mitra offers to add one when you first open it: a [Mitra calendar](integrations/mitra.md) kept on your server, or an account you already have, such as [CalDAV](integrations/caldav.md) or [Google Calendar](integrations/google.md).

## Things to try

- Drag across an empty hour in the [week view](views/week.md) to create an event.
- Press **Add Task** in the sidebar's [Planning](planning.md) tab, and drag the task into your week later.
- Press <kbd>/</kbd> and run **Add Availability** to shade your [working hours](availability.md).
- [Install Mitra on your phone](install-app.md) to get [reminders](reminders.md).
- Press <kbd>?</kbd> for every [keyboard shortcut](shortcuts.md).
