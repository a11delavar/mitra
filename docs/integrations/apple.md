---
title: Apple Calendar
description: Connect your iCloud calendars to Mitra with an app-specific password, with nothing to set up on the server.
---

Mitra connects to your iCloud calendars over CalDAV and syncs their events both ways. Apple doesn't let other apps sign in with your Apple password, so you first create an app-specific password for Mitra. It takes a minute, and there's nothing to set up on the server.

## Create an app-specific password

1. Sign in at [appleid.apple.com](https://appleid.apple.com/).
2. Under **Sign-In and Security**, choose **App-Specific Passwords**.
3. Create a new password, name it "Mitra" so you recognize it later, and copy it.

Apple only offers app-specific passwords once two-factor authentication is turned on for your account.

## Connect your account

1. Choose **Add Integration** at the foot of the sidebar, then **Apple Calendar**.
2. Enter your **Apple ID**, the email address you sign in to Apple with, and the **App-Specific Password** you created for Mitra.
3. Press **Connect**. Mitra lists your iCloud calendars, all turned on.
4. Turn off the ones you don't want, then press **Save**.

Mitra imports the calendars you kept and syncs them every 10 seconds while you have it open (see [how syncing works](README.md#how-syncing-works)).

## What syncs

Events sync both ways, with everything [CalDAV](caldav.md#what-syncs) carries.

> [!NOTE]
> Tasks are different. Tasks Mitra saves to an iCloud calendar are stored in iCloud, and other CalDAV apps can read them, but Apple's Reminders app doesn't show them. Reminders stopped using CalDAV with iOS 13, and Apple offers apps like Mitra no other way in.

[Availability](../availability.md) you mark as busy in an iCloud calendar is added to that calendar as busy events, so the time shows as taken on your iPhone and to anyone who invites you. It works as described for [CalDAV](caldav.md#busy-availability).

## Disconnect your account

Choose **Delete** in the account's **⋯** menu in the sidebar to remove it from Mitra. To take away Mitra's access on Apple's side, delete the "Mitra" password on the **Sign-In and Security** page where you created it. Your Apple password and your other apps aren't affected.

## Troubleshooting

- If connecting fails because of the password, check that you entered the app-specific password, not your Apple password.
- If a calendar is missing, it's turned off. Turn it on under the account's **⋯ → Edit** and press **Save**.
