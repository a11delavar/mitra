---
title: Reminders & notifications
description: How Mitra delivers reminders through Web Push, configuration requirements, and device management.
---

Mitra notifies you before an event starts — even with no tab open — using standard **Web Push**. This provides self-hosted, OS-level notifications with no third-party accounts, push services, or external sign-ups required. Mitra generates its signing keypair automatically on first boot.

## Requirements

- **HTTPS**: Browsers only register service workers and grant notification permissions in a **secure context** (`https://` or `http://localhost`). A remote deployment behind a [reverse proxy with TLS](../getting-started/installation.md#running-behind-a-reverse-proxy) satisfies this.
- **iOS / iPadOS (16.4+)**: Web Push requires adding Mitra to the **Home Screen** first (see [Installing Mitra as an app](#installing-mitra-as-an-app)).
- **Database Persistence**: The generated VAPID keypair is stored directly inside `database.sqlite`.

> [!CAUTION]
> The signing keypair **must survive restarts**. Push subscriptions are cryptographically bound to it; restoring a database that lacks the keypair invalidates existing subscriptions. Always preserve the data directory during updates and [backups](backups.md).

## Adding reminders

Reminders are configured per entry in the editor. Mitra requests browser notification permission **contextually** the first time you add a reminder.

- **Timed events**: Default to one reminder, 30 minutes before. All-day events default to none.
- **Tasks**: Tasks with only a due date count back from the due time. Unscheduling a task clears its reminders.
- **Presets**: Offers *At start of event*, *5 minutes*, *10 minutes*, *30 minutes*, *1 hour*, and *1 day* before.
- **Custom offsets**: Specify custom durations in minutes, hours, days, or weeks.
- Multiple reminders can be attached to a single entry.

When a reminder fires, the notification stays until dismissed and provides **Snooze 10 min** and **Open** actions.

> [!NOTE]
> If a browser denies notification permission, the reminder still **persists** on the entry and syncs to connected CalDAV clients.

## Delivery mechanics

The Mitra **server** schedules and delivers reminders in the background:

- **Exact second timing**: The scheduler scans upcoming reminders once per minute and sleeps until the exact fire instant.
- **Automatic expiration (TTL)**: Messages carry an expiration (`anchor + 5 min` grace). Offline devices drop expired alerts on reconnect instead of delivering stale notifications late.
- **Dynamic text**: Notifications re-calculate elapsed time at delivery ("Starts in 12 min", "Starts now", "Started 5 min ago").
- **Series & overrides**: Recurring series fire per occurrence, respecting exclusions and exceptions.
- **Enabled vs. hidden**: Hidden sidebar calendars still deliver reminders; only *disabled* sources are muted.
- **Downtime recovery**: Reminders fire exactly once across restarts. Overdue reminders from prolonged downtime are discarded to avoid alert storms.

## Managing devices

**Settings → Notifications** displays active push registrations for your account, showing device time zones, last-seen timestamps, and your current browser badge.

- **Send test**: Sends an end-to-end push notification to verify delivery on the active device.
- **Remove device**: Revokes subscriptions for devices you no longer use.

> [!NOTE]
> Push services rotate subscriptions periodically. Mitra refreshes registrations on app start, and the service worker auto-renews subscriptions in the background when rotations occur while the app is closed.

## Configuration (optional)

Push services accept an abuse contact subject (defaulting to `mailto:mitra@localhost`). You can customize this via `MITRA_VAPID_SUBJECT`:

```yaml
environment:
  MITRA_VAPID_SUBJECT: 'mailto:admin@example.com'
```

## Installing Mitra as an app

Mitra installs as a Progressive Web App (PWA) on desktop and mobile:

- **Desktop**: Click "Install" in the browser address bar or menu.
- **iOS / iPadOS**: Tap *Share → Add to Home Screen* to enable Web Push.

> [!TIP]
> When running behind a cookie-authenticating reverse proxy, Mitra fetches the web app manifest with credentials so the install prompt functions properly.

## Troubleshooting

- **Test delivery first**: Use **Settings → Notifications → Send test**. If it succeeds, delivery is operational.
- **No reminders received**: Subscriptions are **per-instance** and **per-origin**. Ensure notification permission was granted on this specific deployment.
- **Closed desktop browsers**: Chrome on Windows requires background app processing enabled to deliver push while closed (*Continue running background apps when Google Chrome is closed*). Alternatively, install Mitra in Edge or use Safari on macOS.
- **Permission prompt missing**: Verify the instance is served over HTTPS. On iOS, install Mitra to the Home Screen first.
- **Server logs**: Standard [logging](logging.md) records reminders as they fire; `debug` logs show delivery attempts and subscription pruning.
