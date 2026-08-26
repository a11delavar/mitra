---
title: Calendars & task lists
description: Choose which calendars and task lists Mitra imports, then rename, recolor, reorder and hide them in the sidebar — and pick where new entries land.
---

Every calendar and task list Mitra imports from a connected account is a **source**, and the sidebar groups them under the account they came from. Everything on this page works the same whichever provider the account is — [CalDAV](../integrations/caldav.md), [Google Calendar](../integrations/google-calendar.md), [Apple Calendar](../integrations/apple-calendar.md) or [Notion](../integrations/notion.md).

**One calendar is one row.** Most calendar servers let a single calendar hold both events and tasks, and Mitra shows it once either way — what a source can hold is a property of it, not a second row beside it. Which of the two a given entry *is* belongs to the entry (see [where new entries land](#where-new-entries-land)).

## Choose what gets imported

When you connect an account, Mitra discovers its calendars and lists but leaves them **off**. You pick the ones you want in the source picker — the account's **⋯ → Edit**; each one notes what it holds ("Events · Tasks"). Enabling a source is what makes Mitra sync it and keep a local copy, events and tasks alike; nothing heavy happens for the ones you leave alone.

## Hide without unsyncing

The **eye** on a source row hides it from the calendar. That's a view preference only: the source keeps syncing, and its entries come straight back when you show it again.

> [!NOTE]
> Hiding a calendar doesn't mute it — its [reminders](notifications.md) still fire. To stop a source entirely, turn it off in the source picker instead.

## Focus on one calendar

To clear everything else out of the way, use a source's **⋯ → Only show this calendar** — or **Alt+click its eye**. Every other calendar hides, and Mitra remembers what you had showing.

The same item then reads **Show previously visible calendars**, and brings them back. Anything that was already hidden before you focused stays hidden; a calendar you connected in the meantime comes back visible, since it wasn't part of what you put away.

The offer waits until you use it, so showing a calendar by hand in the meantime doesn't cost you the way back to the rest. Both are in the [command palette](keyboard-shortcuts.md) too — search a calendar's name to focus it.

## Rename

Double-click a source's name, or use its **⋯ → Rename**. The name is yours: background syncs won't overwrite it. Mitra only adopts the provider's name again if it actually changes at the provider — so a rename on the server side still reaches you, while your own wording survives every sync in between.

## Recolor

**⋯ → the color swatches.** Until you pick one, a source wears the color the provider gives it, or — for providers that don't send one — a stable color Mitra derives from its address, so it looks the same on every device. Entries inherit their source's color unless an entry carries a color of its own.

## Reorder

Sources sit in the order they were discovered, and accounts in the order you connected them. To arrange them yourself:

- **Drag** a source row to move it within its account. On a touchscreen, press and hold briefly first — a plain swipe keeps scrolling the list.
- **Drag an account** by its heading to move the whole block among the other accounts.
- Or use **⋯ → Move up / Move down** on either a source or an account, which does the same thing without a drag.

A source only ever moves **within its own account** — dragging one at another account's rows leaves both alone. Newly enabled calendars join at the end of their account rather than pushing into the middle of an order you arranged, and the same goes for one that disappears at the provider and later comes back.

## Where new entries land

The source with the **filled icon** is where a new entry goes when you create one without saying otherwise. Click any source's icon to make it the default; click the current default's icon to clear it.

With no default set, Mitra uses **the first source shown** — so moving a source to the top of the list is itself a way to choose it.

New entries are **events**, unless the target can only hold tasks (a Notion view), in which case they're tasks. Where the calendar holds both, a brand-new entry's editor offers an **Event / Task** switch, so a task you meant to jot down is one click away. The switch is only there while the entry is still new. A saved entry stays what it is: to change it, either make the other one and delete this one, or move it (the editor's source row) to a calendar that holds only events or only tasks — moving converts it.

## Re-import a source

**⋯ → Re-import entries**, on a single source or on a whole account, throws away Mitra's local copy of the entries and fetches everything from the provider again. Your data at the provider is never touched — this only rebuilds Mitra's cache, so reach for it when a calendar looks wrong or stale after an update. Day to day you never need it: syncing runs on its own (see [how syncing works](../integrations/README.md#how-syncing-works)).
