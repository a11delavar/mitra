---
title: Configuration
description: How Mitra is configured — environment variables, naming your instance, setting the public URL, and what needs deployment setup versus what connects from the app.
sidebar:
  order: 2
---

Mitra is configured entirely through **environment variables**. There is no config file to mount and no settings database to edit — you set variables on the container, and the instance reads them at boot.

## How configuration works

With Docker Compose, put settings in the `environment:` block:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'My Calendar'
      MITRA_LOG_LEVEL: 'info'
    # …
```

Prefer to keep secrets out of the compose file? Use an `.env` file or Docker secrets and reference them — every variable below works with any of Docker's standard mechanisms.

Changing a variable takes effect on the next start:

```bash
docker compose up -d
```

The full list of settings is in the **[Environment variables reference](../reference/environment-variables.md)**. This page walks through the ones you'll reach for first.

## Two kinds of setup

It helps to know what needs *deployment* configuration and what your users simply connect from within the app:

- **Connects from the app, no deployment config** — [CalDAV](../integrations/caldav.md), [Apple Calendar](../integrations/apple-calendar.md), and [Notion](../integrations/notion.md). Users add these themselves under *Add Integration*.
- **Needs deployment config** — [Google Calendar](../integrations/google-calendar.md) (`MITRA_GOOGLE_*`) and [multi-user sign-in](../guides/multi-user.md) (`MITRA_OIDC_*`). Both are OAuth/OIDC flows that require credentials you register with the provider.

## Name your instance

Set `MITRA_NAME` and the sidebar's brand row and the browser tab call your instance that instead of "Mitra":

```yaml
environment:
  MITRA_NAME: 'My Calendar'
```

Wherever the name appears, clicking it opens the **About** dialog — the running version and its commit, so you always know exactly what's deployed.

> [!NOTE]
> The name and icons of the *installed* app (when Mitra is added to a home screen as a [PWA](../guides/notifications.md#installing-mitra-as-an-app)) are baked into the build and stay "Mitra". `MITRA_NAME` only changes what's rendered inside the running app.

## Set the public URL

`MITRA_URL` is the **external base URL** your instance is reached at — the address in the browser, not the container's internal one:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Several things derive from it:

- The **redirect URIs** for [Google Calendar](../integrations/google-calendar.md) and [OIDC sign-in](../guides/multi-user.md).
- Whether **session cookies** are marked `Secure` (they are when `MITRA_URL` is `https://`).

It's optional for a bare `http://localhost` trial, but required once you enable OIDC, and strongly recommended the moment you expose Mitra at a real address. See [Running behind a reverse proxy](installation.md#running-behind-a-reverse-proxy) for why HTTPS matters.

## Change the port

Inside the container Mitra listens on `3000`. With Docker you normally remap on the host and leave the internal port alone:

```yaml
ports:
  - '8080:3000' # reach Mitra on host port 8080
```

Set `MITRA_PORT` only when you need the process itself to bind a different port — typically a bare-metal setup where `3000` is taken. The built-in health check honors it automatically.

## What's next

- Turn to the **[Environment variables reference](../reference/environment-variables.md)** for the exhaustive list.
- Connect the calendars your users care about under **[Integrations](../integrations/index.md)**.
- Share the deployment with others via **[Multi-user & sign-in](../guides/multi-user.md)**.
