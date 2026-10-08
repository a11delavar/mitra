<div align="center">

<img src="assets/mitra.svg" alt="Mitra" width="128" />

# Mitra

**One calendar to plan your events and tasks**

[![CI](https://github.com/a11delavar/mitra/actions/workflows/qa.yml/badge.svg)](https://github.com/a11delavar/mitra/actions/workflows/qa.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-white.svg)](LICENSE)
[![Image: ghcr.io](https://img.shields.io/badge/image-ghcr.io%2Fa11delavar%2Fmitra-2496ED?logo=docker&logoColor=white)](https://github.com/a11delavar/mitra/pkgs/container/mitra)
[![Docs](https://img.shields.io/badge/docs-mitracal.com-f97316?logo=markdown&logoColor=white)](https://mitracal.com/docs/)
[![Demo](https://img.shields.io/badge/demo-demo.mitracal.com-22c55e)](https://demo.mitracal.com)

<br />
<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/screenshots/week-dark.webp">
  <img src="assets/screenshots/week-light.webp" alt="Mitra's week view, with events and tasks side by side" />
</picture>

</div>

> [!WARNING]
>
> Mitra is early and moving fast. Expect rough edges and breaking changes before `1.0`.

## Why Mitra

Most tools make you choose between a calendar for your time and a to-do app for your tasks. Mitra puts both on one timeline, so you can see when there's actually room to get things done. It runs on your own server, keeps calendars itself if you like, and connects to the ones you already have.

Want to look around first? **[Try the demo](https://demo.mitracal.com)**: you get a calendar of your own with sample entries, and nothing to install.

## Features

- Events and tasks on one timeline, in week, month, year, timeline and table views. Drag to create, move and resize anything.
- Calendars stored in Mitra itself, with no account behind them, or synced both ways with CalDAV, Google Calendar, Apple Calendar, Notion and Tempo. Published calendar feeds come in as read-only subscriptions.
- Planning: tasks without a date wait in the Planning tab with a due date and an estimate, until you drag them into your week.
- Availability, subtasks and dependencies, reminders as push notifications, guest lists with replies, and a command palette for the keyboard.
- Seven languages, right to left included, light and dark themes, and a color for every calendar.
- One small container with a database you own, no telemetry, and sign-in for several people when you need it.

## Get started

```yaml
# compose.yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
    # environment:
    #   MITRA_URL: 'https://mitra.example.com' # once Mitra has a public address
```

```sh
docker compose up -d   # → http://localhost:3000
```

Out of the box, Mitra is for one person and has no sign-in. Everything it stores is in the `~/mitra` folder, so backing that up backs up everything.

From here, the **[documentation](https://mitracal.com/docs/)** covers your first calendar, connecting accounts, sign-in for several people and everything else. You can also read it as Markdown in [`docs/`](docs).

## Contributing

Issues and pull requests are welcome.
