---
title: Default Calendar App
description: Set up Mitra as your default calendar application to open .ics files, event invites, and webcal:// subscription links.
---

When installed as a desktop application, Mitra registers with your operating system as a native **calendar app**. This lets you:

- Double-click downloaded `.ics` calendar files and email invitations to import them directly into Mitra.
- Click `webcal://` links on the web to quickly subscribe to external calendar feeds.
- Set Mitra as your computer's default calendar handler across Windows, macOS, or Linux.
- Drag and drop `.ics` files straight into your calendar view, even without installing the app.

> [!NOTE]
> OS-level file and protocol associations are supported on desktop by Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, and Opera). If you use Mitra in a browser tab or an unsupported browser, you can still import `.ics` files anytime using drag-and-drop.

## Install Mitra as an app

To enable OS integration, install Mitra as a Progressive Web App (PWA):

1. Open your Mitra instance in a supported desktop browser.
2. Click the **Install** button in the address bar (or go to your browser's menu → *Cast, save, and share* → *Install page as app*).
3. The first time you open a calendar file or webcal link, your browser may ask for permission to handle that file type. Click **Allow**.

If Mitra is already open when you launch a calendar file or click a link, it brings your existing window to the front rather than opening a duplicate instance.

## Set Mitra as your default calendar

To have your operating system automatically open calendar files with Mitra:

### Windows
1. Right-click any `.ics` file in File Explorer.
2. Select **Open with → Choose another app**.
3. Select **Mitra**, choose **Always**, and click **OK**.
*(You can also configure this under **Windows Settings → Apps → Default apps**).*

### macOS
1. Right-click (or Control-click) any `.ics` file in Finder and select **Get Info**.
2. Expand the **Open with:** section.
3. Select **Mitra** from the dropdown.
4. Click **Change All…** and confirm to apply the change to all `.ics` files.

### Linux
1. Right-click any `.ics` file in your desktop file manager (GNOME Files, Dolphin, etc.).
2. Open **Properties → Open With**.
3. Select **Mitra** and set it as the default application.

---

## Opening and importing .ics files

Opening a calendar file with Mitra launches the **import wizard**:

1. **Choose a calendar**: Select which calendar or task list you want to add the entries to.
2. **Review fidelity checks**: Mitra compares the file's features against what your destination calendar supports (such as recurrence rules, reminders, or categories). If any details cannot be stored by the destination calendar, Mitra highlights them before proceeding.
3. **Confirm import**: Click to import the entries. Your local file on disk is never modified.

> [!TIP]
> **No installation needed for drag-and-drop**: You can drag an `.ics` file from your desktop or file manager and drop it anywhere onto Mitra to start the import right away, even in a regular browser tab.

### Important details about file imports

- **Safe copies, not overwrites**: Imported entries are created with new, distinct IDs. Re-importing the same file creates duplicate entries rather than overwriting existing data, protecting your current calendar entries from accidental data loss.
- **Internal links stay intact**: Subtask hierarchies and task dependencies defined between entries within the same file are preserved after import.
- **Series with edited occurrences**: If a repeating event in the file includes customized individual instances (such as a moved or rescheduled occurrence), Mitra excludes that series from import because remote calendar providers cannot faithfully reconstruct occurrence overrides without original sync state.

---

## Subscribing to webcal:// links

Websites often provide "Subscribe to Calendar" buttons with `webcal://` links (for instance, sports fixtures, university schedules, or holiday feeds).

When you click a `webcal://` link:

1. Mitra opens the **Add Integration** dialog automatically.
2. The calendar URL is pre-filled and normalized to a secure feed address.
3. Review the address, adjust any credentials if the feed requires authentication, and click **Connect**.
4. Choose which calendar sources from the feed you wish to display, then click **Save**.

Mitra never connects to the remote feed automatically upon clicking a link; you always have a chance to review and confirm the subscription first.

---

## See also

- [Calendar Subscriptions](../integrations/calendar-subscriptions.md): how subscribed feeds sync and update
- [Calendars & Task Lists](calendars.md): managing calendars and where new entries go
