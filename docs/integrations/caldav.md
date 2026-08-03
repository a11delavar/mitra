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
3. Save. Mitra discovers the calendars on the account and lists them, **disabled**, in a source picker — each with a note of what it holds ("Events · Tasks"), since a CalDAV calendar may accept both.
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

- **Events and tasks.** A collection is **one** source in Mitra, holding whichever component types the server says it accepts — most accept both `VEVENT` and `VTODO`, and both sync two-way. A collection restricted to one of them offers only that one when you create an entry.
- **Recurring events.** Full RFC 5545 recurrence — a repeating series is one entry, expanded across the views. Editing an occurrence edits the series (per-occurrence editing where the server supports it).
- **All-day and multi-day** entries, locations, descriptions, colors, and reminders, subject to what your server stores.

While you have the app open, enabled sources are polled about every 10 seconds, so changes made elsewhere show up almost immediately. While nobody's looking, polling relaxes to every few minutes to keep your server's logs quiet — and opening or reloading the app syncs right away, so you never wait on a poll.

## Editing

- Edits, moves, resizes, and deletes you make in Mitra are written back to the server.
- Renaming, recoloring, reordering and hiding a calendar are Mitra's own view of it and work the same for every provider — see **[Calendars & task lists](../guides/calendars.md)**. Your rename survives background syncs; only a genuine rename on the server side is adopted.

## Troubleshooting

- **Nothing appears after connecting.** Discovered sources start **disabled** by design — open the source picker and enable the ones you want.
- **A calendar shows up twice after an update.** Mitra used to list a calendar that holds both events and tasks as two rows, and accounts connected before the change keep those old rows. Delete the integration and add it again: one row per calendar, holding both.
- **A calendar looks out of date after a code update.** Use [**Re-import entries**](../guides/calendars.md#re-import-a-source) on the source: it drops Mitra's local copy and fetches everything again (a normal sync only pulls deltas, so unchanged entries are never re-read).
- **Connection fails.** Double-check the Server URL includes the scheme (`https://`) and points at the CalDAV endpoint, not the web UI. Watch the [logs](../guides/logging.md) at `debug` level to see the CalDAV round-trips.
