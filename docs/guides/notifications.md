---
title: Reminders & notifications
description: How Mitra delivers reminders through Web Push, configuration requirements, and device management.
---

Mitra notifies you before an event starts, even with no tab open, using standard **Web Push**. You get system notifications from your own server, without any third-party accounts or sign-ups. Mitra generates its signing keypair automatically on first boot.

## Requirements

- **HTTPS**: Browsers only register service workers and grant notification permissions in a **secure context** (`https://` or `http://localhost`). A remote deployment behind a [reverse proxy with TLS](../getting-started/installation.md#running-behind-a-reverse-proxy) satisfies this.
- **iOS / iPadOS (16.4+)**: Web Push requires adding Mitra to the **Home Screen** first (see [Installing Mitra as an app](#installing-mitra-as-an-app)).
- **Database Persistence**: The generated VAPID keypair is stored directly inside `database.sqlite`.

> [!CAUTION]
> The signing keypair **must survive restarts**. Push subscriptions are cryptographically bound to it; restoring a database that lacks the keypair invalidates existing subscriptions. Always preserve the data directory during updates and [backups](backups.md).

## Adding reminders

Reminders are configured per entry in the editor. Mitra requests browser notification permission **contextually** the first time you add a reminder.

**Settings → Notifications** holds the rest: whether this browser may alert you, the reminders new entries start with, and your devices.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/notifications-detail-dark.png">
  <img src="../../assets/screenshots/notifications-detail-light.png" alt="The Notifications settings page, with the default reminders, the browser permission and the device list" />
</picture>

- **Timed events**: Default to one reminder, 30 minutes before. All-day events default to none.
- **Tasks**: Default to one reminder at the time of the task. A task with only a due date reminds you at its due time. Unscheduling a task clears its reminders.
- **Presets**: Offers *At start of event* (*At the time of the task* for tasks), *5 minutes*, *10 minutes*, *30 minutes*, *1 hour*, and *1 day* before.
- **Custom offsets**: Specify custom durations in minutes, hours, days, or weeks.
- Multiple reminders can be attached to a single entry.

When a reminder fires, the notification stays until you dismiss it. Tap it to open the entry. Tasks also have a **Done** button that marks the task done without opening Mitra, and both events and tasks have **Snooze**. Some browsers, like Safari and Firefox, don't show these buttons, but tapping the notification always works.

Reminders for tasks you have already marked done or cancelled don't fire.

> [!NOTE]
> If a browser denies notification permission, the reminder still **persists** on the entry and syncs to connected CalDAV clients.

## Delivery mechanics

The Mitra **server** schedules and delivers reminders in the background:

- **Exact second timing**: The scheduler scans upcoming reminders once per minute and sleeps until the exact fire instant.
- **Automatic expiration (TTL)**: Messages carry an expiration (`anchor + 5 min` grace). Offline devices drop expired alerts on reconnect instead of delivering stale notifications late.
- **What it says**: The notification shows when the entry is, such as "10:00–11:00" or "Due tomorrow 10:00", in the language Mitra is set to on that device and in its time zone. On Android it also counts down to the start.
- **Series & overrides**: Recurring series fire per occurrence, respecting exclusions and exceptions.
- **Enabled vs. hidden**: Hidden sidebar calendars still deliver reminders; only *disabled* sources are muted.
- **Downtime recovery**: Reminders fire exactly once across restarts. Overdue reminders from prolonged downtime are discarded to avoid alert storms.

## Managing devices

**Settings → Notifications** lists the devices that get your reminders. Each one shows its browser and system (for example "Chrome on Android"), its time zone, when it was last used, and which one you are on now.

- **Rename**: Give a device a name you'll recognize, like "Work laptop". Clear the name to go back to the one the browser reported.
- **Test event / Test task**: Sends a sample reminder to all your devices, so you can check that notifications arrive and see what they look like. **Done** on a test task only closes the notification.
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

- **Test delivery first**: Use **Settings → Notifications → Test event** or **Test task**. If it arrives, notifications work.
- **No reminders received**: Subscriptions are **per-instance** and **per-origin**. Ensure notification permission was granted on this specific deployment.
- **Closed desktop browsers**: Chrome on Windows requires background app processing enabled to deliver push while closed (*Continue running background apps when Google Chrome is closed*). Alternatively, install Mitra in Edge or use Safari on macOS.
- **Permission prompt missing**: Verify the instance is served over HTTPS. On iOS, install Mitra to the Home Screen first.
- **Server logs**: Standard [logging](logging.md) records reminders as they fire; `debug` logs show delivery attempts and subscription pruning.
