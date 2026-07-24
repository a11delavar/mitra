---
title: Google Calendar
description: Enable Google Calendar for your deployment with a one-time OAuth setup, then let users connect their Google accounts from the app.
sidebar:
  order: 2
---

Google Calendar speaks CalDAV too, but Google requires **OAuth** instead of a password. That means a **one-time setup of your deployment**: you register an OAuth client with Google and give Mitra its credentials. After that, users connect their Google accounts from within the app like any other source.

## Overview

1. [Create a Google Cloud project and OAuth client.](#step-1-google-cloud-setup)
2. [Give Mitra the client ID and secret.](#step-2-configure-mitra)
3. [Connect an account from the app.](#step-3-connect-an-account)

You only do steps 1–2 once per deployment. Every user who connects Google gets their own per-account grant.

## Step 1 — Google Cloud setup

1. Create a project in the [Google Cloud console](https://console.cloud.google.com) and enable the **CalDAV API** under *APIs & Services*.
2. Configure the **OAuth consent screen**. Add yourself — and anyone else who'll connect an account — as a **test user**, or publish the app.
   > [!CAUTION]
   > While the consent screen stays in **Testing**, Google expires each grant after **7 days**, so users have to reconnect weekly. **Published** apps keep grants indefinitely.
3. Create an **OAuth client** of type *Web application*. Set the **authorized redirect URI** to your `MITRA_URL` plus `/api/integrations/google/callback`:

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

   Copy the generated **client ID** and **client secret** for the next step.

## Step 2 — Configure Mitra

Provide the credentials via environment variables:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'
    # …
```

Restart the instance:

```bash
docker compose up -d
```

Notes:

- **Both variables are required together.** Setting only `MITRA_GOOGLE_CLIENT_ID` without the secret fails the boot loudly — that's deliberate, to avoid a half-configured provider.
- In the *Add Integration* dialog, **Google Calendar** is always listed as a provider. However, if not configured, the connect button is replaced with a hint instructing the admin to configure these environment variables.
- `MITRA_URL` should match the address in your redirect URI. On a localhost/LAN single-user trial you can omit it and Mitra derives the redirect from the request origin, but a real deployment should set it explicitly.

## Step 3 — Connect an account

In Mitra, choose **Add Integration → Google Calendar → Continue with Google**. Mitra walks the user through Google's consent screen, then returns to the app with the account's source picker open and every calendar pre-ticked. Enable the calendars you want and they sync like any other CalDAV source.

## Revoking access

A user can disconnect at any time:

- Delete the integration in Mitra, **or**
- Revoke the grant from their [Google account's security settings](https://myaccount.google.com/permissions).

## How it works

The refresh token Google issues **never leaves the server** — the browser only ever runs the consent redirect. Mitra stores the token next to the account and uses it to mint short-lived access tokens for CalDAV requests. Reconnecting the same Google account renews the grant in place rather than creating a duplicate.

Because Google's CalDAV shares the Google Calendar API quotas, Mitra paces Google syncs to about once a minute — comfortably within the limits even with many connected accounts.

## Troubleshooting

- **"Google Calendar" isn't offered in Add Integration.** `MITRA_GOOGLE_CLIENT_ID`/`SECRET` aren't set, or the instance hasn't restarted since you set them.
- **`redirect_uri_mismatch` from Google.** The redirect URI registered in the Google Cloud console must exactly match `MITRA_URL` + `/api/integrations/google/callback`, including `https://` and no trailing slash.
- **Accounts stop syncing after 7 days.** Your consent screen is still in *Testing*. Publish the app to keep grants indefinitely.
