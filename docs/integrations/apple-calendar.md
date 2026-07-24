---
title: Apple Calendar
description: Connect an iCloud calendar to Mitra using an app-specific password — no deployment setup required.
sidebar:
  order: 3
---

Apple Calendar (iCloud) connects natively — **no deployment configuration**. Apple requires an **app-specific password** rather than your main Apple ID password, which you generate in a minute.

## Connect an account

1. Go to [appleid.apple.com](https://appleid.apple.com/) and sign in.
2. Under **Sign-In and Security**, select **App-Specific Passwords**.
3. Generate a new password and name it something memorable (e.g. "Mitra").
4. In Mitra, choose **Add Integration → Apple Calendar** and enter:
   - **Apple ID** — your iCloud email (e.g. `you@icloud.com`).
   - **App-Specific Password** — the password you just generated.
5. Save, then enable the calendars you want from the source picker.

> [!TIP]
> App-specific passwords are single-use secrets tied to your Apple ID. If you ever need to revoke Mitra's access, delete the "Mitra" password from your Apple ID's Sign-In and Security page — your main password and other apps are unaffected.

## What syncs — and one important caveat

Your **calendar events** sync perfectly, two-way.

**Reminders are different.** Since iOS 13+, upgraded Apple Reminders are siloed by Apple and are **no longer accessible over standard CalDAV**:

> [!CAUTION]
> Tasks you create in your Apple integration within Mitra will sync to *other Mitra instances*, but they **will not appear in the native Apple Reminders app**. Calendar events, however, sync both ways without issue.

If two-way task sync with Apple Reminders matters to you, that's a limitation on Apple's side, not Mitra's — there's no CalDAV surface for it to use.

## Troubleshooting

- **"Invalid password" when connecting.** You must use an **app-specific password**, not your normal Apple ID password. Two-factor authentication also needs to be enabled on your Apple ID to generate one.
- **Nothing appears after connecting.** Discovered calendars start disabled — open the source picker and enable them.
