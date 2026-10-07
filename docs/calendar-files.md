---
title: Calendar files
description: "Open .ics files and webcal:// links with Mitra, and make it the calendar app your computer uses for them."
---

Calendar files (`.ics`) and subscription links (`webcal://`) are how the web hands out events: an invitation attached to an email, an "Add to calendar" button on a booking page, a "Subscribe" link for a team's fixtures. Once Mitra is installed, it can open both, and you can make it the app your computer uses for them.

> [!NOTE]
> Opening files and links needs Mitra [installed as an app](install-app.md) from a Chromium-based browser on a computer, such as Chrome, Edge, Brave or Opera. In any browser, you can still drag an `.ics` file onto Mitra.

## Make Mitra the default

Install Mitra first. The first time a calendar file or link opens it, your browser may ask whether Mitra may handle it: choose **Allow**. Then tell your system to open `.ics` files with Mitra.

On Windows, right-click an `.ics` file in File Explorer and choose **Open with → Choose another app**. Pick **Mitra**, then **Always**. You can also change it later under **Settings → Apps → Default apps**.

On macOS, Control-click an `.ics` file in Finder and choose **Get Info**. Under **Open with**, pick **Mitra**, then click **Change All…** and confirm.

On Linux, right-click an `.ics` file in your file manager and open **Properties → Open With**. Pick **Mitra** and set it as the default.

If Mitra is already open, a file or link you open goes to that window instead of opening a second one.

## Add a calendar file

Open an `.ics` file with Mitra, or drag it onto Mitra from your desktop or file manager. Dragging works in a regular browser tab too, without installing anything. Several files open one after another.

Mitra asks which calendar to add the entries to. Before it adds anything, it shows what that calendar can't store: the entries it would leave out, and the details some entries would lose, such as reminders in a calendar that has none. To go ahead, press the button that names how many entries are added, such as **Add 12 entries**. To pick another calendar, go back with the arrow. The file itself never changes.

Each entry is added as a new copy, so adding the same file twice gives you every entry twice. Nothing already in your calendar is overwritten.

Subtasks and dependencies between entries of the same file stay linked after the import. A repeating series keeps its deleted occurrences deleted. A series with edited occurrences, such as one meeting moved to another day, is left out, because Mitra can't add a series together with its edits.

If adding fails partway, Mitra removes the entries it had already added, so nothing from the file stays half imported. If it can't remove some of them, it tells you how many to delete by hand.

## Subscribe from a webcal link

Sites that let you subscribe to a calendar, such as sports fixtures, school terms or public holidays, usually link to a `webcal://` address. Click one, and Mitra opens the **Calendar Subscription** form with the address filled in. Check it, fill in **Username (optional)** and **Password (optional)** if the feed needs them, and press **Connect**. Then turn on the calendar and press **Save**.

Clicking the link never subscribes on its own: Mitra only fetches the feed once you press **Connect**.

A subscription is one read-only calendar that Mitra keeps up to date from the feed. See [Calendar subscriptions](integrations/subscriptions.md) for how that works.
