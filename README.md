<div align="center">

<img src="assets/mitra.svg" alt="Mitra" width="128" />

# Mitra

**One calendar to plan your events and tasks.**

[![CI](https://github.com/a11delavar/mitra/actions/workflows/qa.yml/badge.svg)](https://github.com/a11delavar/mitra/actions/workflows/qa.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-white.svg)](./LICENSE)
[![Image: ghcr.io](https://img.shields.io/badge/image-ghcr.io%2Fa11delavar%2Fmitra-2496ED?logo=docker&logoColor=white)](https://github.com/a11delavar/mitra/pkgs/container/mitra)
[![Docs](https://img.shields.io/badge/docs-online-f97316?logo=markdown&logoColor=white)](https://a11delavar.github.io/mitra/)

</div>

> [!WARNING]
>
> Mitra is early and moving fast. Expect rough edges and breaking changes before `1.0`.

## Why Mitra

Most tools make you choose: a *calendar* for your time, or a *to-do app* for your tasks. Mitra treats them as one — your tasks sit on the same timeline as your events, so planning a day is a single, coherent act. It's built to be **yours**: self-hosted, private, and plugged into the accounts you already have instead of replacing them.

## Features

- 🗓️ **Events and tasks together** — one timeline, week and month views, create anything by dragging (timed, multi-day, or all-day).
- 🔗 **Brings in calendars you already use** — your CalDAV accounts (events *and* tasks), Google Calendar, Apple Calendar and Notion task databases sync in the background, with more integrations on the way.
- 🔔 **Reminders that reach you** — per-entry reminders delivered as push notifications, even with no tab open.
- 🎨 **Yours to look at** — per-calendar colours, light and dark themes, and full right-to-left support.
- 🏠 **Self-hosted & private** — everything lives in one small container with a database you own and can back up in seconds.

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

Out of the box Mitra runs single-user with no login. Everything you create lives in the `~/mitra` directory — back that up and you've backed up everything.

From here, the **[documentation](https://a11delavar.github.io/mitra/)** covers configuration, connecting your calendars (CalDAV, Google, Apple, Notion), multi-user sign-in, and everything else — or browse it as Markdown in [`docs/`](./docs).

## Contributing

Issues and pull requests are welcome — Mitra is built in the open.
