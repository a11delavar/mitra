---
title: Settings
description: Customize Mitra's theme, language, default views, and entry defaults. Search finds any setting instantly, and most can be changed straight from the command palette.
---

Mitra's settings live in one unified dialog. Open it from the gear icon on your account card at the bottom of the sidebar (or the **Settings** row in single-user mode), from the [command palette](keyboard-shortcuts.md) (<kbd>/</kbd>, <kbd>Ctrl</kbd>+<kbd>K</kbd>, or <kbd>Ctrl</kbd>+<kbd>P</kbd>), or with <kbd>Ctrl</kbd>+<kbd>,</kbd> from anywhere.

All settings are optional. An untouched setting follows Mitra's built-in default — so when a default improves in a later release, your experience updates automatically. Selecting a value that matches the current default leaves no override stored in the database.

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

- **Theme** — *Match the system*, *Light*, or *Dark*. *Match the system* adapts dynamically to your operating system's dark/light mode preference.
- **Language** — Select from any of the built-in languages (English, German, French, Spanish, Portuguese, Italian). Interface updates apply instantly without reloading.

### Calendar

- **Default view** — Which calendar view Mitra opens on initial load: *Week*, *Month*, *Year*, or *Timeline*.
- **Connector lines** — Toggles visual lines between linked and dependent tasks separately for the *Week view*, *Month view*, and *Timeline*.

### Entries

- **Default calendar** — The target calendar for newly created events and tasks (syncs with the [primary calendar marker in the sidebar](calendars.md#where-new-entries-land)). When unset, entries default to the first visible calendar.
- **Default duration** — Default time span for new entries created without an explicit duration (e.g., clicking on the grid, dragging an unscheduled task, or disabling all-day).
- **Snap to** — Time step granularity that dragging, resizing, and creation gestures snap to (5, 10, 15, or 30 minutes).

### Notifications

- **Reminder notifications** — Whether the current browser can display Web Push reminders. Reminders you configure are always stored on the server; this only determines whether your active browser alerts you.
- **Default reminder** — Pre-set reminder interval for newly created timed entries, or *None*. All-day entries do not receive timed reminders.

Mitra can request permission when undecided. If notifications are blocked, you can re-enable them in your browser's site permissions settings. See [Reminders & notifications](notifications.md) for background daemon setup.

> [!NOTE]
> In multi-user mode, signing out is located under the **⋯** menu beside the gear icon on the account card.

> [!NOTE]
> Direct-manipulation controls (such as zoom level, sidebar tab/collapse state, and time-zone lane folding) are saved automatically in your browser as you use them. Background synchronization intervals pace themselves automatically based on user presence and active connections.
