---
title: CalDAV
description: Connect any CalDAV server — Nextcloud, Radicale, Fastmail, mailbox.org and more — for two-way sync of both events and tasks.
sidebar:
  order: 1
---

CalDAV is the open standard most calendar servers speak, and it's Mitra's most direct integration. It connects **straight from the app** — no deployment configuration — and syncs both **events** and **tasks** (VTODO) two-way.

## Connect an account

1. In Mitra, open the sidebar and choose **Add Integration → CalDAV**.
2. Enter the connection details:
   - **Server URL** — your CalDAV endpoint, e.g. `https://caldav.example.com`.
   - **Username** — usually your account name or email.
   - **Password** — your account password (or an app password, if your provider issues them).
3. Save. Mitra discovers the calendars and task lists on the account and lists them, **disabled**, in a source picker.
4. Enable the sources you want on your timeline.

That's it — enabled sources sync in the background from then on.

## Server URLs for common providers

Point Mitra at the provider's CalDAV base URL; it discovers the individual calendars from there.

| Provider | Server URL |
| --- | --- |
| **Nextcloud** | `https://<your-nextcloud>/remote.php/dav` |
| **Radicale** | `https://<your-radicale>/` (or `.../<user>/`) |
| **Fastmail** | `https://caldav.fastmail.com/` |
| **mailbox.org** | `https://dav.mailbox.org/` |
| **Baïkal** | `https://<your-baikal>/dav.php` |

> [!NOTE]
> [Google Calendar](google-calendar.md) and [Apple Calendar](apple-calendar.md) also speak CalDAV, but they don't accept a plain password — Google needs OAuth and Apple needs an app-specific password. Use their dedicated pages rather than the generic CalDAV form.

## What syncs

- **Events and tasks.** Calendar collections become event sources; task collections (VTODO) become task lists. Both sync two-way.
- **Recurring events.** Full RFC 5545 recurrence — a repeating series is one entry, expanded across the views. Editing an occurrence edits the series (per-occurrence editing where the server supports it).
- **All-day and multi-day** entries, locations, descriptions, colors, and reminders, subject to what your server stores.

Enabled sources are polled about every 10 seconds, so changes made elsewhere show up almost immediately.

## Editing and renaming

- Edits, moves, resizes, and deletes you make in Mitra are written back to the server.
- You can **rename a source** locally in Mitra (right-click it in the sidebar). Background syncs won't overwrite your custom name — only a genuine rename on the server side is adopted.
- You can also recolor a source; the color is yours to keep once set.

## Troubleshooting

- **Nothing appears after connecting.** Discovered sources start **disabled** by design — open the source picker and enable the ones you want.
- **A calendar looks out of date after a code update.** Use **Re-import entries** on the source to force a full re-sync (Mitra normally only fetches deltas).
- **Connection fails.** Double-check the Server URL includes the scheme (`https://`) and points at the CalDAV endpoint, not the web UI. Watch the [logs](../guides/logging.md) at `debug` level to see the CalDAV round-trips.
