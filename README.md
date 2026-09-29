<div align="center">

<img src="assets/mitra.svg" alt="Mitra" width="128" />

# Mitra

**One calendar to plan your events and tasks**

[![CI](https://github.com/a11delavar/mitra/actions/workflows/qa.yml/badge.svg)](https://github.com/a11delavar/mitra/actions/workflows/qa.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-white.svg)](./LICENSE)
[![Image: ghcr.io](https://img.shields.io/badge/image-ghcr.io%2Fa11delavar%2Fmitra-2496ED?logo=docker&logoColor=white)](https://github.com/a11delavar/mitra/pkgs/container/mitra)
[![Docs](https://img.shields.io/badge/docs-mitracal.com-f97316?logo=markdown&logoColor=white)](https://mitracal.com/docs/)

<br />
<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/screenshots/week-dark.png">
  <img src="assets/screenshots/week-light.png" alt="Mitra's week view, with events and tasks side by side" />
</picture>

</div>

> [!WARNING]
>
> Mitra is early and moving fast. Expect rough edges and breaking changes before `1.0`.

## Why Mitra

Most tools make you choose: a *calendar* for your time, or a *to-do app* for your tasks. Mitra puts both on one timeline, so you plan your day in one place. It's built to be **yours**: self-hosted, private, and connected to the accounts you already have instead of replacing them.

## Features

- **Events and tasks together**: on one timeline, in week, month, year, timeline and table views. Create anything by dragging, whether timed, multi-day or all-day.
- **Works with the calendars you already use**: CalDAV accounts (events *and* tasks), Google Calendar, Apple Calendar and Notion task databases sync in the background, and more integrations are coming.
- **Reminders**: sent as push notifications, even when no tab is open.
- **Invitations**: add a guest list to any entry and see the replies come in. Your calendar account sends the invitations.
- **Your look**: per-calendar colours, light and dark themes, and full right-to-left support.
- **Self-hosted and private**: one small container with a database you own and can back up in seconds.

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
    environment:
      MITRA_URL: 'https://mitra.example.com' # the public URL users reach Mitra at
```

```sh
docker compose up -d   # → http://localhost:3000
```

Out of the box Mitra runs single-user with no login. Everything you create is stored in the `~/mitra` directory, so backing that up backs up everything.

From here, the **[documentation](https://mitracal.com/docs/)** covers configuration, connecting your calendars (CalDAV, Google, Apple, Notion), multi-user sign-in and everything else. You can also read it as Markdown in [`docs/`](./docs).

## Contributing

Issues and pull requests are welcome.
