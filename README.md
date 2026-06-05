<div align="center">

# Mitra

**Your calendar and your tasks, in one place.**

[![CI](https://github.com/a11delavar/mitra/actions/workflows/qa.yml/badge.svg)](https://github.com/a11delavar/mitra/actions/workflows/qa.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-blue.svg)](./LICENSE)
[![Image: ghcr.io](https://img.shields.io/badge/image-ghcr.io%2Fa11delavar%2Fmitra-2496ED?logo=docker&logoColor=white)](https://github.com/a11delavar/mitra/pkgs/container/mitra)

</div>

> [!WARNING]
>
> Mitra is early and moving fast. Expect rough edges and breaking changes before `1.0`.

## Why Mitra

Most tools make you choose: a *calendar* for your time, or a *to-do app* for your tasks. Mitra treats them as one — your tasks sit on the same timeline as your events, so planning a day is a single, coherent act. It's built to be **yours**: self-hosted, private, and plugged into the accounts you already have instead of replacing them.

## Features

- 🗓️ **Events and tasks together** — one timeline, week and month views, create anything by dragging (timed, multi-day, or all-day).
- 🔗 **Brings in calendars you already use** — your CalDAV accounts (events *and* tasks) sync in the background, with more integrations on the way.
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
      - mitra-data:/app/data
volumes:
  mitra-data:
```

```sh
docker compose up -d   # → http://localhost:3000
```

Everything you create lives in the `mitra-data` volume — back that up and you've backed up everything. To pin or track a specific version instead of `latest`, see the [available tags](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Contributing

Issues and pull requests are welcome — Mitra is built in the open.
