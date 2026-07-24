---
title: Reminders & notifications
description: How Mitra delivers reminders through Web Push, what a self-hosted deployment needs for them to work, and installing Mitra as an app.
sidebar:
  order: 2
---

Mitra can notify you before an event starts — even with no tab open — using **Web Push**. This is the self-hosted way to get OS-level notifications: no third-party push accounts, no external services to sign up for, and **nothing to configure** in the common case. Mitra generates its own signing keys on first boot.

## What you need

- **HTTPS.** Browsers only register the service worker and grant notification permission in a **secure context** — that means the site is served over `https://` (or `http://localhost` for local testing). A remote instance behind a [reverse proxy with TLS](../getting-started/installation.md#running-behind-a-reverse-proxy) satisfies this; plain `http://` at a LAN IP does not.
- **On iPhone and iPad: install Mitra first.** iOS and iPadOS (16.4+) only deliver Web Push to web apps **added to the Home Screen** — see [Installing Mitra as an app](#installing-mitra-as-an-app). Once installed, reminders arrive like any other app's notifications.
- **Nothing else.** The signing keypair (VAPID) is generated automatically on first boot and lives in the data directory. Keep that directory ([you're backing it up anyway](backups.md)) and reminders keep working across restarts and updates.

> [!CAUTION]
> The generated keypair **must survive restarts** — push subscriptions are bound to it, so deleting or regenerating the data directory's `vapid.json` silently invalidates every browser's subscription. Treat the data directory as one indivisible unit and this never comes up.

## Adding reminders (for users)

Reminders live on each entry in the editor. Mitra asks for notification permission **contextually** — the first time you add a reminder, which is exactly when the ask makes sense — not on app load.

- **New timed events start with one reminder, 30 minutes before.** All-day entries start with none.
- The preset menu offers: **At start of event**, **5 minutes**, **10 minutes**, **30 minutes**, **1 hour**, and **1 day** before.
- **Custom…** lets you pick any amount in **minutes, hours, days, or weeks**.
- You can add several reminders to one entry.

When a reminder fires, the notification stays until you act on it and offers two actions: **Snooze 10 min** and **Open**.

> [!NOTE]
> If a browser denies or doesn't support notifications, the reminder still **persists** — Mitra just can't notify *that browser*. Other CalDAV clients connected to the same calendar will still alert as usual.

## How delivery works

The **server** is what wakes up to fire a reminder — the whole point of push is that no tab needs to be open. A reminder is stored as *minutes before the entry's start*; the server checks every minute and delivers to every browser you've subscribed on this instance. Payloads are **end-to-end encrypted**, so the push services relaying them can't read their contents.

A few behaviors worth knowing:

- **Recurring series fire per occurrence**, honoring exclusions and overrides exactly as they appear on the calendar.
- **Hiding a calendar doesn't mute it.** Hiding a source in the sidebar is a view preference — its reminders still fire.
- **Reminders fire exactly once**, even across server restarts. After longer downtime, reminders that are more than a few minutes overdue are dropped rather than replayed — a notification for a meeting that's long underway is noise, not a reminder.

## Setting a push contact (optional)

Push services (Google's FCM, Mozilla, Apple) like to know who's sending, as an abuse contact. Mitra defaults to `mailto:mitra@localhost`. To set your own — a `mailto:` address is customary — use `MITRA_VAPID_SUBJECT`:

```yaml
environment:
  MITRA_VAPID_SUBJECT: 'mailto:admin@example.com'
```

This is optional and only visible to the push services; it's not displayed anywhere in the app.

## Installing Mitra as an app

Mitra ships a **web app manifest** and installs as a Progressive Web App (PWA) — add it to your home screen or desktop and it runs in its own standalone window. Most browsers show an "Install" option in the address bar or menu when you visit an HTTPS instance; on iOS/iPadOS use *Share → Add to Home Screen* (which is also [what enables notifications there](#what-you-need)).

The installed app's name and icons are **baked into the build** and stay "Mitra" even if you set a custom [`MITRA_NAME`](../getting-started/configuration.md#name-your-instance) — that variable rebrands what's rendered inside the running app, not the installed-app identity.

> [!TIP]
> Behind a cookie-authenticating reverse proxy, the install prompt sometimes vanishes because the browser can't fetch the manifest. Mitra already loads the manifest with credentials to avoid this, so installation works even in front of an auth proxy.

## Troubleshooting

- **The logs say a reminder fired, but nothing arrived.** Subscriptions are **per-instance**: a browser must have granted permission and subscribed against *this* deployment's address — permission granted on some other instance (or origin) doesn't carry over. Add a reminder from the browser in question once so it subscribes here.
- **No permission prompt ever appears.** The instance isn't a secure context — check that you're on `https://` (or `http://localhost`). On iPhone/iPad, install Mitra to the Home Screen first.
- **Notifications stopped after moving/recreating the data directory.** The signing keypair changed, which invalidated existing subscriptions — re-grant by adding a reminder again in each browser.
- **Watching it happen.** At the default [log level](logging.md), each reminder logs as it fires; `debug` also shows the delivery attempts and any pruned (expired/revoked) subscriptions.
