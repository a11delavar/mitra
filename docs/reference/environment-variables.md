---
title: Environment variables
description: The complete reference for every environment variable Mitra reads at runtime — defaults, meaning, and links to the relevant guide.
sidebar:
  order: 1
---

Mitra is configured entirely through environment variables (see [Configuration](../getting-started/configuration.md) for how to set them). This page is the complete reference. Every variable is **optional** — an unset variable falls back to the default shown.

## Core

| Variable | Default | Description |
| --- | --- | --- |
| `MITRA_URL` | *(unset)* | The instance's **external base URL** (e.g. `https://mitra.example.com`). Redirect URIs and cookie security derive from it. Optional for a local single-user trial; **required** for [OIDC](../guides/multi-user.md), and recommended for [Google](../integrations/google-calendar.md) and any public deployment. |
| `MITRA_NAME` | `Mitra` | The instance's [display name](../getting-started/configuration.md#name-your-instance) — shown in the sidebar and browser tab. The installed-app (PWA) identity stays "Mitra". |
| `MITRA_PORT` | `3000` | The port the server process binds. With Docker you normally remap on the host instead; set this only for bare-metal or when `3000` is taken. The built-in health check honors it. |
| `MITRA_LOG_LEVEL` | `info` | [Log verbosity](../guides/logging.md): `error`, `warn`, `info`, `debug`, or `trace`. Each level includes everything quieter than it. |
| `MITRA_UPDATE_CHECK` | *(enabled)* | Set to `off` (or `false`/`0`/`no`) to disable the [update check](../guides/updates.md) entirely. |

## Notifications

| Variable | Default | Description |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | The sender contact push services see for [Web Push](../guides/notifications.md) (an abuse contact; a `mailto:` is customary). Optional and never shown to end users. The signing keypair itself is generated automatically — nothing to set. |

## Location autocomplete

| Variable | Default | Description |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | The [Photon geocoder](../guides/location-autocomplete.md) endpoint powering the location field. Point it at a self-hosted Photon instance to avoid komoot's public one. |

## Google Calendar

Set both together to enable [Google Calendar](../integrations/google-calendar.md); setting only the ID fails the boot.

| Variable | Default | Description |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(unset)* | The OAuth **client ID** from the Google Cloud console. Setting it enables Google Calendar in the *Add Integration* dialog. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(unset)* | The OAuth **client secret**. Required whenever `MITRA_GOOGLE_CLIENT_ID` is set. |

## Multi-user sign-in (OIDC)

Setting `MITRA_OIDC_ISSUER` switches on [multi-user mode](../guides/multi-user.md). A half-configured issuer fails the boot loudly.

| Variable | Default | Description |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(unset)* | Your OIDC provider's **issuer URL**. Setting it enables multi-user mode. Requires `MITRA_OIDC_CLIENT_ID` and `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(unset)* | The OIDC **client ID** registered with your provider. Required when `MITRA_OIDC_ISSUER` is set. |
| `MITRA_OIDC_CLIENT_SECRET` | *(unset)* | The OIDC **client secret**. Omit for a **public client** — PKCE is always on. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Space-separated OIDC scopes. `openid` is required; `profile`/`email` populate the account's name and email. |

## Build-time & internal

These are **not** meant for runtime configuration of a deployment — they're set by the build or used only in development. Listed for completeness.

| Variable | Set by | Description |
| --- | --- | --- |
| `MITRA_VERSION` | Build | The version string baked into the image. Do not set at runtime. |
| `MITRA_COMMIT` | Build | The commit hash baked into the image. Do not set at runtime. |
| `MITRA_DEV` | Dev only | Seeds a sample calendar for local development. Do not set on a real deployment. |
| `NODE_ENV` | Image | Set to `production` by the container image. |

## Example

A fully-configured multi-user deployment with Google Calendar and a self-hosted geocoder:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
    environment:
      # Core
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'My Calendar'
      MITRA_LOG_LEVEL: 'info'

      # Multi-user sign-in
      MITRA_OIDC_ISSUER: 'https://auth.example.com'
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'

      # Google Calendar
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'

      # Self-hosted location geocoder
      MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```
