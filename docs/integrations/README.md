---
title: Integrations
description: Connect the calendars and task databases you already use — CalDAV, Google Calendar, Apple Calendar, and Notion — and sync them two-way in the background.
sidebar:
  order: 0
  label: Overview
---

Mitra doesn't replace the accounts you already have — it **brings them in**. Connect a source and Mitra syncs it in the background: events and tasks show up on your timeline, and edits you make in Mitra flow back to the origin.

## Supported integrations

| Integration | What it syncs | Deployment setup |
| --- | --- | --- |
| **[CalDAV](caldav.md)** | Events *and* tasks from any CalDAV server | None — connects from the app |
| **[Google Calendar](google-calendar.md)** | Google calendars (via CalDAV + OAuth) | One-time OAuth setup |
| **[Apple Calendar](apple-calendar.md)** | iCloud calendars (and Mitra-side tasks) | None — app-specific password |
| **[Notion](notion.md)** | Task database **views**, two-way | None — paste an integration token |

More integrations are on the way.

## How syncing works

- **Background daemon.** All syncing happens on the server, on a loop — the app never blocks on a live external fetch. While you have the app open, plain CalDAV servers are polled every ~10 seconds so remote edits feel live; rate-limited providers (Google, Notion) are polled about once a minute to stay within their quotas. While nobody has the app open, polling relaxes to every few minutes — no point flooding your home server all night.
- **Fresh when you look.** Opening or reloading the app triggers an immediate sync, so what you see is current — no need to wait out a poll. That's also why there's no refresh button: syncing is the server's job, and reloading the page is already the gesture that forces it.
- **Opt-in sources.** When you connect an account, Mitra discovers its calendars/lists but leaves them **disabled**. You pick which ones to actually sync from the source picker — nothing heavy happens until you enable a source.
- **Two-way where the provider allows it.** Creating, editing, moving, and deleting entries in Mitra writes back to the origin. What each provider can represent differs (Notion tasks can't recur, for example) — Mitra hides fields a source can't store rather than letting your edits vanish.
- **Resilient by design.** One broken account doesn't stall the others; a failed source rests briefly and retries. Renames you make to a source in Mitra survive background syncs.

> [!NOTE]
> **Sync and re-import are different things.** A *sync* is the automatic background pull — it fetches only what changed and runs on its own. A *re-import* is the manual recovery hatch in a source's or account's ⋯ menu: it deletes Mitra's local copy of the entries and fetches everything from the provider again. Your data at the provider is never touched either way; re-import just rebuilds Mitra's cache. Reach for it only when a calendar looks wrong or stale after an update — day to day, syncing handles itself.

## Adding an integration

In the app, open the sidebar and choose **Add Integration**, then pick the provider. Each provider's page below covers exactly what to enter:

- [Connect a CalDAV account →](caldav.md)
- [Connect Google Calendar →](google-calendar.md)
- [Connect Apple Calendar →](apple-calendar.md)
- [Connect Notion →](notion.md)

> [!TIP]
> Reconnecting the same account (same server/URL and username) is an **in-place** update — Mitra recognises it and refreshes the connection rather than creating a duplicate.
