---
title: Configuration
description: How to configure Mitra with environment variables, the ones most servers need, and every variable with its default.
---

Mitra is configured entirely through environment variables. There's no config file to mount: you set variables on the container, and Mitra reads them when it starts. Every variable is optional, and one you don't set uses the default listed [below](#all-variables).

With Docker Compose, they go in the `environment` block:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

An `.env` file or Docker secrets work just as well, if you'd rather keep secrets out of the compose file. A change takes effect the next time Mitra starts:

```bash
docker compose up -d
```

## What needs setting up on the server

Almost nothing. People add [Mitra calendars](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Apple Calendar](integrations/apple.md), [calendar subscriptions](integrations/subscriptions.md), [Notion](integrations/notion.md) and [Tempo](integrations/tempo.md) themselves, in the app.

Two things need credentials you register with someone else first: [Google Calendar](integrations/google.md) (`MITRA_GOOGLE_*`) and [sign-in](sso.md) (`MITRA_OIDC_*`).

## Put it behind HTTPS

Once Mitra is reachable from anywhere but your own machine, put it behind a reverse proxy such as Caddy, Traefik or nginx, and let the proxy handle HTTPS. Mitra itself speaks plain HTTP inside the container. Some features only work over HTTPS:

- Browsers only allow [reminders](reminders.md) and [installing the app](install-app.md) on `https://` addresses (and on `http://localhost`).
- [Sign-in](sso.md) cookies are only marked secure on `https://`, and most identity providers insist on an `https://` redirect address.
- [Google Calendar](integrations/google.md) requires an `https://` redirect address.

Then set [`MITRA_URL`](#set-the-public-url) to the public address.

With [Caddy](https://caddyserver.com/), this is all it takes:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

With [Traefik](https://traefik.io/), route to Mitra with labels on the service:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    volumes:
      - ~/mitra:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mitra.rule=Host(`mitra.example.com`)"
      - "traefik.http.services.mitra.loadbalancer.server.port=3000"
    environment:
      MITRA_URL: 'https://mitra.example.com'
```

## Set the public URL

`MITRA_URL` is the address people type in the browser to reach Mitra, not the container's internal one:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Mitra builds the return addresses for Google Calendar and sign-in from it, and marks its cookies secure when it starts with `https://`. You can leave it out while you try Mitra on `http://localhost`. Set it as soon as Mitra has a real address, and you must set it to turn on sign-in.

## Name your instance

`MITRA_NAME` replaces "Mitra" in the sidebar and the browser tab:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

Clicking the name opens the **About** dialog, which shows the version and commit you're running. The [installed app](install-app.md) keeps the name and icon "Mitra", because those are fixed when the app is built.

## All variables

### Core

| Variable | Default | Description |
| --- | --- | --- |
| `MITRA_URL` | *(unset)* | The [public address](#set-the-public-url) people reach Mitra at, such as `https://mitra.example.com`. Return addresses for sign-in and Google Calendar, and whether cookies are secure, come from it. Optional while you try Mitra on localhost, required for [sign-in](sso.md), and recommended for [Google Calendar](integrations/google.md) and any public server. |
| `MITRA_NAME` | *(Mitra, in each person's language)* | The [name](#name-your-instance) shown in the sidebar and the browser tab. The [installed app](install-app.md) stays "Mitra". |
| `MITRA_PORT` | `3000` | The port the server listens on. With Docker, change the host side of the port mapping instead; set this only when the process itself must listen elsewhere. The built-in health check follows it. |
| `MITRA_LOG_LEVEL` | `info` | [How much Mitra logs](logging.md): `error`, `warn`, `info`, `debug` or `trace`. Each level includes everything quieter than it. |
| `MITRA_UPDATE_CHECK` | *(on)* | Set to `off` (or `false`, `0`, `no`) to turn off the [update check](updates.md). |

### Reminders

| Variable | Default | Description |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | The contact push services see for your server's [reminders](reminders.md), usually a `mailto:` address. Nobody using Mitra sees it. The signing keys are generated automatically, so there's nothing else to set. |

### Location

| Variable | Default | Description |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | The [Photon geocoder](location.md) behind the location field. Point it at your own Photon instance instead of komoot's public one. |

### Google Calendar

Set both to let people connect [Google Calendar](integrations/google.md). Setting only the ID stops Mitra from starting.

| Variable | Default | Description |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(unset)* | The OAuth client ID from the Google Cloud console. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(unset)* | The OAuth client secret. Required whenever `MITRA_GOOGLE_CLIENT_ID` is set. |

### Single sign-on

Setting `MITRA_OIDC_ISSUER` turns on [sign-in](sso.md). If the variables it needs are missing, Mitra refuses to start.

| Variable | Default | Description |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(unset)* | Your OIDC provider's issuer URL. Requires `MITRA_OIDC_CLIENT_ID` and `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(unset)* | The client ID registered at your provider. |
| `MITRA_OIDC_CLIENT_SECRET` | *(unset)* | The client secret. Leave it out for a public client; Mitra always uses PKCE. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | The scopes Mitra asks for, separated by spaces. `openid` is required; `profile` and `email` give Mitra each person's name and email. |

### Set by the build

You don't set these on a server. The build or the image sets them, or they're for working on Mitra itself.

| Variable | Set by | Description |
| --- | --- | --- |
| `MITRA_VERSION` | Build | The version built into the image. |
| `MITRA_COMMIT` | Build | The commit built into the image. |
| `MITRA_DEV` | Development | Offers the **Demo** integration, a set of sample calendars, while working on Mitra. |
| `NODE_ENV` | Image | `production` in the container image. |

### Example

A server with sign-in, Google Calendar and its own geocoder:

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
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'

      # Sign-in
      MITRA_OIDC_ISSUER: 'https://auth.example.com'
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'

      # Google Calendar
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'

      # Your own geocoder
      MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```
