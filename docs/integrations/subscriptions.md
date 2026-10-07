---
title: Calendar subscriptions
description: Subscribe to a published calendar link, such as a webcal:// address or an .ics feed, and see its entries in Mitra, read-only.
---

Many calendars are published rather than shared: public holidays, sports fixtures, school terms, a feed from a tool at work, or the private address of your own Google or Outlook calendar. You don't sign in to these. You subscribe to them with a link.

A **calendar subscription** brings one such link into Mitra as a calendar of its own, with its events, and its tasks if it has any.

Subscriptions are read-only. The feed lives on another server, which doesn't take changes, so Mitra shows what it publishes and never writes back. You can still rename, recolor, reorder and hide the calendar; see [Read-only calendars](../calendars.md#read-only-calendars). To keep a copy of its entries that you can edit, use **Copy entries to…** in its **⋯** menu.

## Subscribe to a calendar

1. Choose **Add Integration** at the foot of the sidebar, then **Calendar Subscription**.
2. Paste the link into **Calendar URL**. It's either a `webcal://` address, as "Subscribe" buttons often give you, or an `https://` address, usually ending in `.ics`.
3. Leave **Username (optional)** and **Password (optional)** empty, unless the feed asks for them (see [feeds with a password](#feeds-with-a-password)).
4. Press **Connect**. Mitra reads the feed and lists its calendar.
5. Leave it turned on and press **Save**.

One link is one calendar. To subscribe to several, add a subscription for each.

The calendar takes its name from the feed, and its color too, if the feed has one. You can rename it in the sidebar, and your name stays until the feed itself renames the calendar.

If you've [made Mitra your default calendar app](../calendar-files.md), clicking a `webcal://` link on a web page opens this form with the link filled in.

### Where to find a calendar link

| Provider | Where to look |
| --- | --- |
| Google Calendar | In the calendar's settings, **Integrate calendar** → **Secret address in iCal format** |
| Outlook and Microsoft 365 | **Share** → **Publish a calendar**, then copy the ICS link |
| iCloud | Right-click the calendar → **Share Calendar** → **Public Calendar** |
| Nextcloud | The calendar's **⋯** menu → **Copy subscription link** |
| Public calendars | Most holiday, sports and school websites offer a `.ics` link |

> [!CAUTION]
> A secret address is a password in the form of a link: anyone who has it can read the calendar. Keep it to yourself, and reset it in your provider's settings if it ever gets out.

### Feeds with a password

Most published feeds carry their access key in the link itself and need nothing else. If a feed, such as one on a company or self-hosted server, asks for a username and password (HTTP Basic authentication), enter them when you subscribe. Mitra keeps the password on the server and never sends it back to your browser.

## How it stays up to date

Mitra syncs each subscription every 15 minutes, whether or not anyone has Mitra open, so opening Mitra doesn't fetch a feed any sooner (see [how syncing works](README.md#how-syncing-works)). A sync costs little: Mitra asks the feed's server whether anything changed, and only downloads the calendar when it did.

The calendar mirrors the feed. Entries added to the feed appear in Mitra, and entries removed from it disappear.

If the calendar ever looks wrong, **Re-import entries** in its **⋯** menu reads the feed again from the start. The feed itself is never touched. See [Re-import a calendar](../calendars.md#re-import-a-calendar).

## Troubleshooting

- If Mitra says "The calendar requires a username and password", the feed is protected. Enter the username and password it needs.
- If Mitra says "No calendar was found at that address", check the link for typos. A secret address also stops working when its owner resets it.
- If Mitra says "The address did not return a calendar", the link leads to a web page rather than to the feed. Look for a link labeled iCal, ICS or Subscribe.
- If Mitra says "The calendar is too large to subscribe to", the feed is bigger than 20 MB, which Mitra doesn't read.
