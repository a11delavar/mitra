---
title: Mitra calendars
description: Calendars stored in Mitra itself, on your server, with no account behind them.
---

A Mitra calendar is stored in Mitra's own database instead of at a provider. There's no account to connect and nothing to sync: you create a calendar and start adding entries. It's the simplest way to start with Mitra, and a good home for anything that doesn't belong in one of your existing accounts.

Mitra calendars live on your server, not on your device, so they're there wherever you open Mitra. They can hold everything Mitra can: events and tasks, repeats, reminders, [availability](../availability.md), [subtasks](../subtasks.md), [dependencies](../dependencies.md), due dates and estimates.

## Add Mitra calendars

1. Choose **Add Integration** at the foot of the sidebar, then **Mitra**.
2. Name your first calendar.
3. Press **Save**.

The calendar is ready straight away. You only add the integration once: it holds as many calendars as you like, so its tile disappears from **Add Integration** afterwards.

To add another calendar, open the **⋯** menu on the Mitra heading in the sidebar and choose **New calendar**. To delete one, choose **Delete calendar** from that calendar's **⋯** menu. Renaming, recoloring, reordering and hiding work as they do for any calendar; see [Calendars](../calendars.md).

> [!CAUTION]
> Deleting a Mitra calendar deletes all of its entries for good, since there's no provider to fetch them back from. Mitra asks first, and offers to [move the entries](../calendars.md#move-or-copy-every-entry-to-another-calendar) to another calendar before it deletes anything.

## Move entries in and out

Entries move between a Mitra calendar and any other calendar. To move one, pick another calendar in its editor. To move a whole calendar, use **⋯ → Move entries to…**, which shows first what the destination can't store.

This also works the other way round: you can start in Mitra and move everything into a CalDAV or Google calendar later.

## Back them up

A connected account keeps its own copy of your entries. A Mitra calendar doesn't: its entries exist only in Mitra's database. Make sure Mitra's data folder is part of your [backups](../backups.md).

If you plan to turn on [sign-in](../sso.md) later, know that it starts everyone with a new, empty account. Mitra calendars you made before stay with the old single-user account.

## What they can't do

- Participants are kept as a record of who is involved, but nobody gets an invitation and no replies come in, because there's no calendar server to send them. If you move a meeting here from a CalDAV calendar, the original is deleted there, and some servers then tell its participants it was cancelled. Copy it instead if they shouldn't hear about it.
- Other apps can't see them. Mitra doesn't publish its calendars over CalDAV, so use a [CalDAV](caldav.md) server for calendars you also want on your phone's calendar app.
- There's nothing to re-import, so **Re-import entries** isn't offered.
