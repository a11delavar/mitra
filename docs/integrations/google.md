---
title: Google Calendar
description: Set up Google sign-in once for your Mitra server, then connect Google accounts from the app and sync their calendars both ways.
---

Mitra connects to Google Calendar over CalDAV, as it does to any calendar server. The difference is signing in: Google doesn't take a password, it asks you to grant access on its own page. For that, Google needs to know your Mitra server, so whoever runs the server registers it with Google once and gives Mitra the client ID and secret Google hands out.

After that, anyone using Mitra connects their Google account from the app, each with their own grant. The setup takes three steps:

1. [Register Mitra with Google](#register-mitra-with-google).
2. [Give Mitra the client ID and secret](#give-mitra-the-client-id-and-secret).
3. [Connect an account](#connect-an-account).

You do the first two once per Mitra server.

## Register Mitra with Google

1. Create a project in the [Google Cloud console](https://console.cloud.google.com), and under **APIs & Services**, enable the **CalDAV API**.
2. Configure the **OAuth consent screen**. Either add yourself and everyone else who will connect an account as a **test user**, or publish the app.
3. Create an **OAuth client** of the type **Web application**. As its **authorized redirect URI**, enter the address of your Mitra server followed by `/api/integrations/google/callback`:

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Copy the **client ID** and **client secret** Google shows you.

> [!CAUTION]
> While the consent screen is in testing, Google ends each grant after 7 days, and everyone has to connect their account again every week. Publish the app to keep grants for good.

## Give Mitra the client ID and secret

Set them as environment variables, together with `MITRA_URL`, the address of your server:

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

Then restart Mitra:

```bash
docker compose up -d
```

Set both variables or neither. Mitra refuses to start with a client ID and no secret, so a half-finished setup never goes unnoticed.

`MITRA_URL` has to match the address in your redirect URI. Without it, Mitra uses the address you opened it at, which is enough to try it out on `localhost`. Google only accepts `https://` redirect addresses for anything other than `localhost`, so a real server needs [HTTPS](../configuration.md#put-it-behind-https) and `MITRA_URL`. All variables are listed in [Configuration](../configuration.md#all-variables).

## Connect an account

1. Choose **Add Integration** at the foot of the sidebar, then **Google Calendar**.
2. Press **Continue with Google**. Google asks you to choose an account and to let Mitra see and change your calendars.
3. Back in Mitra, the account's calendars are listed, all turned on. Turn off the ones you don't want, then press **Save**.

Connecting the same Google account again renews its grant instead of adding it a second time.

Google limits how often apps may call it, so Mitra syncs Google accounts about once a minute (see [how syncing works](README.md#how-syncing-works)).

## Calendars shared with you

Calendars you own show up as soon as you connect. Calendars other people shared with you, such as a team or a colleague's calendar, only reach other apps once you allow it in your Google settings:

1. Signed in to Google, open [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect).
2. Under **Shared Calendars**, tick each calendar you want in Mitra, and press **Save**.
3. In Mitra, open the account's **⋯** menu in the sidebar, choose **Edit**, and press **Refresh**.
4. Turn on the calendars that appear, then press **Save**.

A calendar shared with you as **See all event details** is read-only in Mitra: you see everything in it, but can't add, change or delete events. If the owner later gives you **Make changes to events**, editing turns on with the next sync. See [Read-only calendars](../calendars.md#read-only-calendars).

## What syncs

Everything syncs as it does for [CalDAV](caldav.md#what-syncs), except relationships between entries. Google drops them from its copy of an event, so Mitra doesn't offer them on Google calendars.

[Availability](../availability.md) you mark as busy in a Google calendar is added to that calendar as busy events, so others see the time as taken. It works as described for [CalDAV](caldav.md#busy-availability).

## Your Google token

The token Google issues never leaves the server. Your browser only passes through Google's page to grant access. Mitra keeps the token with the account and uses it to get short-lived access whenever it syncs.

## Disconnect an account

Choose **Delete** in the account's **⋯** menu to remove it, and its token, from Mitra. To take away Mitra's access on Google's side as well, remove Mitra from your [Google account's third-party connections](https://myaccount.google.com/permissions). Doing only that also stops syncing: the account stays in Mitra, but every sync fails until you connect it again.

## Troubleshooting

- If choosing **Google Calendar** shows a note that it isn't configured on this server instead of the **Continue with Google** button, `MITRA_GOOGLE_CLIENT_ID` and `MITRA_GOOGLE_CLIENT_SECRET` aren't set, or Mitra hasn't restarted since you set them.
- If Google answers `redirect_uri_mismatch`, the redirect URI in the Google Cloud console doesn't match `MITRA_URL` followed by `/api/integrations/google/callback`. It has to match exactly, including `https://` and without a trailing slash.
- If accounts stop syncing after 7 days, your consent screen is still in testing. Publish the app, then connect the accounts again.
