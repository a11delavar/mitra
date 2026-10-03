---
title: Mitra Calendars
description: Create calendars that are stored in Mitra itself, with no account behind them.
---

Mitra calendars are stored in Mitra's own database instead of at a provider. There's no account to connect and nothing to sync: you create a calendar and start adding entries. Use them for anything that doesn't belong in one of your existing accounts, or to try Mitra before connecting one.

They live on your Mitra server, not on your device, so they're there wherever you sign in.

## Add Mitra calendars

1. In Mitra, open the sidebar and choose **Add Integration → Mitra**.
2. Name your first calendar.
3. Click **Save**.

There's nothing to connect, so the calendar is ready right away. You only add the integration once. It can hold as many calendars as you like, so its tile no longer shows up afterwards.

## Add and delete calendars

Calendars from a connected account are created and deleted at the provider. Mitra calendars are created and deleted in Mitra:

- **Add**: open the **⋯** menu on the Mitra heading in the sidebar, choose **New calendar**, then type a name.
- **Delete**: choose **Delete calendar** from the calendar's **⋯** menu.

Renaming, recoloring, reordering and hiding work the same as for any other calendar. See [Calendars & task lists](../guides/calendars.md).

> [!CAUTION]
> Deleting a Mitra calendar deletes **all of its entries** for good. There's no provider to fetch them back from. Mitra asks first and offers to [move the entries](../guides/calendars.md#move-or-copy-every-entry-to-another-calendar) to another calendar before deleting.

## Moving entries

Entries move in and out of a Mitra calendar like any other: pick another calendar in the entry's source row, or move a whole calendar with **⋯ → Move entries to…**. When you move a whole calendar, Mitra shows beforehand what the destination can't store.

## Back them up

A connected account keeps its own copy of your entries. A Mitra calendar doesn't: its entries exist only in Mitra's database. Make sure the data directory is part of your [backups](../guides/backups.md).

## Limitations

- **No invitations**: entries can have participants, but there's no calendar server to send them invitations or updates, or to collect their replies. The list only records who is involved. Moving a meeting in from a CalDAV calendar deletes it there, and some servers then tell its participants it was cancelled. Copy it instead if they shouldn't hear about it.
- **Not visible to other apps**: Mitra calendars aren't published over CalDAV. Use a [CalDAV](caldav.md) server for calendars you also want to open elsewhere.
- **Nothing to re-import**: there's no provider to fetch from, so **Re-import entries** isn't offered.

## See also

- [Calendars & task lists](../guides/calendars.md): managing, recoloring and organizing calendars
- [Availability](../guides/availability.md): working hours and focus time, shaded in their calendar
- [Backups](../guides/backups.md): protecting everything Mitra stores
