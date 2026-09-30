---
title: Settings
description: Customize Mitra's theme, language, default views, and entry defaults. Search finds any setting instantly, and most can be changed straight from the command palette.
---

Mitra's settings live in one unified dialog. Open it from the gear icon on your account card at the bottom of the sidebar (or the **Settings** row in single-user mode), from the [command palette](keyboard-shortcuts.md) (<kbd>/</kbd>, <kbd>Ctrl</kbd>+<kbd>K</kbd>, or <kbd>Ctrl</kbd>+<kbd>P</kbd>), or with <kbd>Ctrl</kbd>+<kbd>,</kbd> from anywhere.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/settings-detail-dark.png">
  <img src="../../assets/screenshots/settings-detail-light.png" alt="The settings dialog, open on the General page" />
</picture>

All settings are optional. A setting you haven't changed follows Mitra's built-in default, so when a default improves in a later release, you get the new one automatically. Selecting a value that matches the current default leaves no override stored in the database.

## Find a setting

The search box at the top of the settings rail searches **pages and settings simultaneously**. For example, typing `"calendar"` surfaces the whole **Calendar** page along with the *Default calendar* row from **Entries**, grouped by page. Each matching result is interactive right in the search view.

The same keywords work in the [command palette](keyboard-shortcuts.md):

- **Direct toggles & options**: Type `"dark"` to select **Theme: Dark**, or `"snap"` to select **Snap to: 30 min**. The palette only offers values you have not already selected.
- **Deep links**: Settings that cannot be toggled in one step (such as the default view picker or browser permission prompts) offer a **Change …** action that opens the settings dialog focused directly on that row.

## Account settings vs. device settings

Preferences in Mitra are partitioned based on their scope:

| Scope | Settings | Persistence |
| --- | --- | --- |
| **Account** | Default view, default calendar, default duration, grid snap, default reminder | Stored on the server in your user profile; syncs across all devices and browsers you sign in from. |
| **Device** | Theme, language, view connector lines, browser notifications | Stored locally in your current browser (`localStorage`); allows separate settings on phones, laptops, and workstations. |

## Setting categories

### General

- **Theme**: *Match the system*, *Light* or *Dark*. *Match the system* follows your operating system's light or dark mode.
- **Language**: English, German, French, Spanish, Portuguese or Italian. The change applies right away, without reloading.

### Calendar

- **Default view**: which view Mitra opens on (*Week*, *Month*, *Year*, *Timeline* or *Table*).
- **Connector lines**: turns the lines between linked and dependent tasks on or off, separately for the *Week view*, *Month view* and *Timeline*.

### Entries

- **Default calendar**: the calendar new events and tasks go to. It is the same as the [default calendar marker in the sidebar](calendars.md#where-new-entries-land). When unset, new entries go to the first visible calendar.
- **Default duration**: how long a new entry is when you don't give it a length, for example when you click on the grid, drag in an unscheduled task or turn off all-day.
- **Snap to**: the step that dragging, resizing and creating entries snaps to (5, 10, 15 or 30 minutes).

### Notifications

- **Reminder notifications**: whether this browser shows reminders as push notifications. Reminders you set are always stored on the server; this only decides whether this browser alerts you.
- **Default event reminder**: how long before a new timed event reminds you, or *None*. Defaults to 30 minutes.
- **Default task reminder**: when a new task reminds you, or *None*. Defaults to the task's own time.
- **Devices**: the devices that get your reminders. You can rename them, send a test reminder, or remove one.

All-day entries don't get timed reminders.

Mitra can request permission when undecided. If notifications are blocked, you can re-enable them in your browser's site permissions settings. See [Reminders & notifications](notifications.md) for background daemon setup.

> [!NOTE]
> In multi-user mode, signing out is located under the **⋯** menu beside the gear icon on the account card.

> [!NOTE]
> Direct-manipulation controls (such as zoom level, sidebar tab/collapse state, and time-zone lane folding) are saved automatically in your browser as you use them. Background synchronization intervals pace themselves automatically based on user presence and active connections.
