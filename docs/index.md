---
title: Documentation
description: Self-hosted documentation for Mitra — the open calendar and task planner that unifies your events, to-dos, and the calendars you already use.
sidebar:
  order: 0
  label: Overview
---

**Mitra puts your calendar and your tasks in one place.** It's a self-hosted, private planner where your to-dos sit on the same timeline as your events — and it plugs into the accounts you already have (CalDAV, Google Calendar, Apple Calendar, Notion) instead of replacing them.

> [!NOTE]
> Mitra is early and moving fast. Expect rough edges and breaking changes before `1.0`.

## Start here

- **[Installation](getting-started/installation.md)** — get a container running in a couple of minutes with Docker Compose.
- **[Configuration](getting-started/configuration.md)** — name your instance, set its public URL, and learn how Mitra is configured.
- **[Environment variables](reference/environment-variables.md)** — the complete reference for every setting.

## Connect calendars & tasks

Mitra brings in the calendars and task databases you already use and syncs them in the background.

- **[CalDAV](integrations/caldav.md)** — connect any CalDAV server (Nextcloud, Radicale, Fastmail, mailbox.org, …). Connects straight from the app, no deployment setup.
- **[Google Calendar](integrations/google-calendar.md)** — needs a one-time OAuth setup of your deployment.
- **[Apple Calendar (iCloud)](integrations/apple-calendar.md)** — connect with an app-specific password.
- **[Notion](integrations/notion.md)** — turn Notion database views into two-way task sources.

## Administer your instance

- **[Multi-user & sign-in (OIDC)](guides/multi-user.md)** — share one deployment with family or a team.
- **[Reminders & notifications](guides/notifications.md)** — how push reminders work and what they need.
- **[Location autocomplete](guides/location-autocomplete.md)** — the geocoder behind the location field.
- **[Updates](guides/updates.md)** — the update indicator and how to disable it.
- **[Logging](guides/logging.md)** — verbosity levels for diagnosing problems.
- **[Health checks](guides/health-checks.md)** — the endpoint for orchestrators and uptime monitors.
- **[Backups](guides/backups.md)** — everything lives in one directory; back that up.
