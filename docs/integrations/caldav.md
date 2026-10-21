---
title: CalDAV
description: Connect any CalDAV server, such as Nextcloud, Radicale, Fastmail or mailbox.org, and sync its events and tasks both ways.
---

CalDAV is the open standard most calendar servers speak. You connect a CalDAV account from the app, with nothing to set up on the server, and Mitra syncs its events and tasks both ways.

Your calendars stay on your server, so every other CalDAV app you use, such as the calendar on your phone, sees the same entries. That's the difference from [Mitra calendars](mitra.md), which only Mitra can open.

## Connect an account

1. Choose **Add Integration** at the foot of the sidebar, then **CalDAV**.
2. Fill in the form:
   - **Server URL** is your server's CalDAV address, such as `https://caldav.example.com`. The [table below](#server-urls-for-common-providers) lists it for common providers.
   - **Username** is usually your account name or email address.
   - **Password** is your account password, or an app password if your provider gives you one.
3. Press **Connect**. Mitra lists the account's calendars, all turned on, and says what each one holds, such as "Events · Tasks".
4. Turn off the ones you don't want, then press **Save**.

Mitra imports the calendars you kept and then syncs them every 10 seconds while you have it open (see [how syncing works](README.md#how-syncing-works)).

To change the password later, open the account's **⋯** menu in the sidebar, choose **Edit**, type the new password and press **Save**. The server URL and username stay as they are; for a different account, connect it separately.

## Server URLs for common providers

Give Mitra the provider's CalDAV address, and it finds the calendars from there.

If the address names a user, such as `https://<your-radicale>/<user>/`, Mitra lists that user's calendars instead of your own, as far as the server shares them with you. Connect each address separately.

| Provider | Server URL |
| --- | --- |
| Nextcloud | `https://<your-nextcloud>/remote.php/dav` |
| Radicale | `https://<your-radicale>/` (or `.../<user>/`) |
| Fastmail | `https://caldav.fastmail.com/` |
| mailbox.org | `https://dav.mailbox.org/` |
| Baïkal | `https://<your-baikal>/dav.php` |

Google Calendar and iCloud speak CalDAV too, but they don't take your normal password: Google signs you in through its own page, and Apple needs an app-specific password. Use their own tiles instead, as described in [Google Calendar](google.md) and [Apple Calendar](apple.md).

## What syncs

Each calendar on the server is one calendar in Mitra. It holds events, tasks or both, as the server allows. Most servers allow both; in a calendar that only takes one kind, new entries are always that kind.

Everything Mitra stores about an entry syncs, as far as your server keeps it:

- All-day and multi-day entries, locations, descriptions, colors and reminders.
- Whether an entry shows as busy or free, and its visibility.
- A task's status and progress.
- [Participants](../participants.md). Your server sends the invitations and collects the replies.
- [Subtasks](../subtasks.md) and [dependencies](../dependencies.md).
- [Attachments](../attachments.md). Other apps on the same calendar see the files, and Mitra shows the ones they added.

A repeating entry stays one series on the server. When you change a single occurrence, Mitra asks whether you mean **This entry**, **This and following entries** or **All entries**, and changes the series to match.

A task keeps its schedule, its [due date and its estimate](../planning.md#schedule-constraints-and-planning). On the server they are saved as:

- The start as `DTSTART`.
- The length as `ESTIMATED-DURATION`: how long the task is scheduled for, or its estimate while it has no start.
- The due date as `DUE`.

A task with a start and no length is a moment.

Calendars shared with you to view only are marked read-only. You can still rename, recolor, reorder and hide them; see [Read-only calendars](../calendars.md#read-only-calendars).

## Busy availability

[Availability](../availability.md) you mark as **Busy** is added to its calendar as busy events, so the time shows as taken on your phone and to anyone who invites you. There's nothing to set up.

- Each busy availability becomes a repeating event with the same times and repeat rule, marked busy. It takes the availability's name, or "Busy" if it has none, and its place and visibility, such as **Private**.
- Inside Mitra you see the availability itself instead of these events, so the time doesn't show twice.
- Mitra keeps the events in step with your availability. If one is changed, moved or deleted in another app, Mitra puts it back on the next sync.
- Marking the availability **Free** again, deleting it, turning its calendar off, or deleting the account removes the events. Moving the availability to another calendar moves its events along.
- A calendar that only holds tasks, or one you can't write to, gets no events.

> [!NOTE]
> Changes to a single day of busy availability aren't carried over. The event keeps following the repeat rule, so a day you moved or shortened still shows its usual time to others.

This works the same for [Google Calendar](google.md) and [Apple Calendar](apple.md), which Mitra also connects to over CalDAV.

## Troubleshooting

- If a calendar is missing, it's turned off. That happens to calendars you turned off when you connected, and to calendars created on the server later, which Mitra adds turned off. Turn it on under the account's **⋯ → Edit** and press **Save**. **Refresh** there lists calendars created on the server since the last sync.
- If Mitra says "This account is already connected", the account is in your sidebar already. Change it from its **⋯ → Edit** instead, for example to enter a new password.
- If connecting fails, check that the server URL starts with `https://` and points at the CalDAV address, not the web page you sign in to. To see every request Mitra makes to the server, set the [log level](../logging.md) to `debug`.
- If a calendar looks wrong after you update Mitra, use **Re-import entries** in its **⋯** menu. Syncing only fetches what changed on the server, so entries that didn't change are never read again; a re-import reads them all. See [Re-import a calendar](../calendars.md#re-import-a-calendar).
