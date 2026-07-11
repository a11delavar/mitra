<div align="center">

<img src="assets/mitra.svg" alt="Mitra" width="128" />

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
- 🔗 **Brings in calendars you already use** — your CalDAV accounts (events *and* tasks) and Google Calendar sync in the background, with more integrations on the way.
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
    environment:
      MITRA_URL: 'https://mitra.example.com'
      # Google Calendar (optional)
	  MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'
volumes:
  mitra-data:
```

```sh
docker compose up -d   # → http://localhost:3000
```

Everything you create lives in the `mitra-data` volume — back that up and you've backed up everything. To pin or track a specific version instead of `latest`, see the [available tags](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Google Calendar

CalDAV accounts connect straight from the app — just add an integration and enter the server URL and credentials. Google Calendar speaks CalDAV too, but Google requires OAuth instead of a password, so it needs a one-time setup of your deployment:

1. Create a project in the [Google Cloud console](https://console.cloud.google.com) and enable the **CalDAV API** in *APIs & Services*.
2. Configure the OAuth consent screen and add yourself (and anyone else who'll connect an account) as a **test user** — or publish the app. While the consent screen stays in *Testing*, Google expires each grant after 7 days and you'll have to reconnect; published apps keep it indefinitely.
3. Create an OAuth client of type web application with the redirect URI `https://mitra.example.com/api/integrations/google/callback` — your `MITRA_URL` plus `/api/integrations/google/callback`.

That's it — *Add Integration → Google Calendar → Continue with Google* now walks through Google's consent screen, and the account's calendars sync like any other CalDAV source. The grant can be revoked anytime from your [Google account's security settings](https://myaccount.google.com/permissions), or by deleting the integration in mitra.

## Apple Calendar

Apple Calendar accounts (iCloud) can be connected natively. However, Apple requires you to use an **App-Specific Password** rather than your main Apple ID password.

1. Go to [appleid.apple.com](https://appleid.apple.com/) and sign in.
2. Under **Sign-In and Security**, select **App-Specific Passwords**.
3. Generate a new password (you can name it "Mitra").
4. In Mitra, select *Add Integration → Apple Calendar* and enter your Apple ID and the generated App-Specific Password.

> [!NOTE]
> Due to changes in iOS 13+, upgraded Apple Reminders are completely siloed by Apple and are no longer accessible via standard CalDAV. Tasks created in your Apple integration within Mitra will sync to other Mitra instances, but will not appear in the native Apple Reminders app. Your calendar events, however, will sync perfectly!

## Multi-user & sign-in (OIDC)

Out of the box mitra is single-user with no login — fine when only you can reach it. To share one deployment with family or a team, connect it to any OpenID Connect provider (Pocket ID, Authelia, Authentik, Keycloak, Google, …) and every person signs in with their existing account and gets their own calendars:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'                       # the URL users reach mitra at
      MITRA_OIDC_ISSUER: 'https://auth.example.com'                # your provider's issuer URL
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'                                # omit for a public client (PKCE is always on)
      # MITRA_OIDC_SCOPES: 'openid profile email'                  # the default
```

Register `https://mitra.example.com/auth/callback` as the redirect URI at your provider — that's all the provider needs to know.

A few things worth knowing:

- **Sign-in happens on the server** (Authorization Code flow with PKCE). Your browser only ever holds an opaque session cookie — no tokens in web storage.
- **Accounts create themselves**: anyone your provider authenticates gets a mitra account on first sign-in. Control who may in your provider (e.g. by group or app assignment).
- **Turning OIDC on is a fresh start.** Multi-user gives every identity — including the first — a brand-new empty account; the calendars you added while the deployment was single-user don't carry over. After your first sign-in, just re-add your integrations.


### Location Autocomplete
Location autocomplete works out of the box — it's powered by [Photon](https://photon.komoot.io), a free, open-source geocoder (no API key, no signup), queried through your own server so your searches never leave it from the browser. If you'd rather not rely on komoot's public instance, [host Photon yourself](https://github.com/komoot/photon) and point Mitra at it with the `MITRA_PHOTON_URL` environment variable.

### Logging
Mitra logs to stdout (so `docker logs` / `docker compose logs` shows everything). A healthy server is quiet by design — startup, sign-ins, connected integrations, remote changes it pulled, and reminders as they fire. Turn the verbosity up with `MITRA_LOG_LEVEL` when you need to diagnose something:

| `MITRA_LOG_LEVEL` | What you get |
| --- | --- |
| `error` | Failures only |
| `warn` | …plus handled degradations (an undelivered push, a geocoder timeout, a failed OIDC discovery) |
| `info` *(default)* | …plus lifecycle milestones — the healthy-server heartbeat |
| `debug` | …plus **every request** (`method /path → status (ms)`), each sync tick, session events, entry edits, and CalDAV round-trips |
| `trace` | …plus the firehose: SQL and raw `.ics` payloads |

Each level includes everything quieter than it. Set it in your compose `environment:` block (e.g. `MITRA_LOG_LEVEL: debug`). Secrets — passwords and tokens — are never logged, at any level.

## Contributing

Issues and pull requests are welcome — Mitra is built in the open.
