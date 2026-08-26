---
title: Calendar Subscriptions
description: Subscribe to any published calendar link — a webcal:// address or an .ics feed — and see it on your timeline, read-only.
---

Plenty of calendars are **published rather than shared**: holiday lists, sports fixtures, school schedules, availability feeds from a work tool, or the secret address from your personal Google or Outlook calendar. Instead of signing in to an account, you subscribe with a link.

A **calendar subscription** brings one of these feeds into Mitra. Mitra automatically fetches updates on a schedule and shows the events on your timeline alongside your other calendars.

> [!NOTE]
> Subscriptions are **read-only** — the feed is hosted on an external server and does not accept remote edits. Mitra shows all event details (locations, attendees, recurrence rules, and notes), but editing actions are disabled. See [What read-only means](#what-read-only-means) below.

## Subscribe to a calendar

1. In Mitra, open the sidebar and select **Add Integration → Calendar Subscription**.
2. Paste the **Calendar URL**. Supported formats include:
   - A `webcal://` link (commonly provided by "Subscribe" buttons)
   - A standard `https://…` link ending in `.ics`
3. Leave **Username** and **Password** blank unless the feed requires HTTP Basic authentication (see below).
4. Click **Connect**. Mitra discovers the calendar and displays it in the source picker.
5. Turn on the checkbox for the calendar and click **Save**.

The calendar adopts its title from the feed. You can rename it anytime in the sidebar — your custom name is preserved across syncs.

### Where to find a calendar link

| Provider | Steps |
| --- | --- |
| **Google Calendar** | Settings → *Integrate calendar* → **Secret address in iCal format** |
| **Outlook / Microsoft 365** | Calendar → *Share* → **Publish a calendar** → copy the ICS link |
| **Apple iCloud** | Right-click calendar → *Share Calendar* → **Public Calendar** |
| **Nextcloud** | Calendar → *…* → **Copy subscription link** |
| **Public feeds** | Most holiday, sports, and school websites provide a direct `.ics` download link |

> [!CAUTION]
> A "secret address" acts like a password in URL form. Anyone with the link can view the calendar. Keep it private, and reset it in your provider's settings if it is ever exposed.

### Password-protected feeds

Most published feeds include access tokens directly in the URL and do not require additional credentials. If you are subscribing to a corporate or self-hosted feed that requires **HTTP Basic authentication**, enter your **Username** and **Password** when connecting.

Credentials are securely stored on your Mitra server and never exposed to the client.

## Refresh schedule

Mitra automatically polls subscriptions for changes **every 15 minutes**. Opening or reloading the Mitra app also checks for updates immediately, ensuring your calendar stays fresh when you view it.

Subscriptions mirror the remote feed completely: any event added to the feed appears in Mitra, and events removed from the feed are removed from Mitra.

If you ever need to force a complete refresh, select **Re-import entries** from the calendar's **⋯** menu. This rebuilds the local calendar data from scratch without affecting the remote feed.

## What read-only means

To ensure data integrity, editing actions are disabled on subscribed calendars:

- Events cannot be created, moved, resized, or deleted
- The details panel displays entry properties as a readable summary (text remains selectable so you can copy links or notes)
- Task statuses cannot be toggled
- Events cannot be moved into or out of a subscribed calendar

Your personal customizations remain fully functional: you can rename, recolor, reorder, or hide the calendar in your sidebar at any time.

## Limitations

- **Read-only**: Feeds do not support two-way editing.
- **Fixed refresh interval**: Mitra polls feeds every 15 minutes.
- **One calendar per link**: Each subscription URL creates its own calendar in Mitra.

## See also

- [Calendars & sources](../guides/calendars.md) — managing, recoloring, and organizing calendars
- [Google Calendar](google-calendar.md) — connecting Google accounts and shared calendars
