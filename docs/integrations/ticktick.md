---
title: TickTick
description: Bring your TickTick lists into Mitra as calendars of tasks that sync both ways.
---

Mitra connects to TickTick for tasks. Your inbox and each of your TickTick lists become a calendar in Mitra that holds its tasks. A task's title, description, date, reminders and status sync both ways.

You connect from the app with an API token. There's nothing to set up on the server.

## Connect an account

1. In TickTick's web app, open **Settings** → **Account** → **API Keys**, create a key and copy it.
2. In Mitra, choose **Add Integration** at the foot of the sidebar, then **TickTick**, and paste the key into **TickTick API Token**.
3. Press **Connect**. Mitra lists your inbox first, then your lists, each in its color from TickTick. A list in a folder is named after both, such as "Work · Launch".
4. Choose the lists you want, then press **Save**.

You can connect more than one TickTick account. Note lists and closed lists aren't listed, and a list shared with you to read or comment on is read-only.

## What syncs

The title, the description, the date, reminders and the status sync both ways:

| In TickTick | In Mitra |
| --- | --- |
| Date | The task's schedule: a day, or a time |
| Checklist items | Checkboxes in the description |
| Subtask | A [subtask](../subtasks.md) |
| Won't Do | **Cancelled** |

A task without a date waits in the **Unscheduled** list of the [Planning tab](../planning.md#the-planning-tab). Tasks you completed in the last twelve weeks come along when you connect, and every completion after that.

A TickTick task has one date, so it's a moment in Mitra, or a single day: it has no end, [estimate](../planning.md#set-an-estimate) or [due date](../planning.md#set-a-due-date). A time either stays the [same time everywhere](../time-zones.md#same-time-everywhere), if it's floating in TickTick, or keeps its time zone.

A checklist task's items show as checkboxes below its description, so ticking one in Mitra ticks it in TickTick. In any other task, checkboxes stay part of the text.

Mitra doesn't show a task's priority, tags, comments or attachments, and leaves them as they are in TickTick. Moving a task to another TickTick calendar moves it to that list, and keeps all of them.

To open a task in TickTick, choose **Open in TickTick** in the editor's **⋯** menu. Deleting a task in Mitra moves it to TickTick's trash.

TickTick doesn't tell apps what changed, so Mitra reads each list again about once a minute (see [how syncing works](README.md#how-syncing-works)).

## Repeating tasks

A task that repeats in TickTick shows at its next date, as TickTick keeps it, without its rule. Completing it in Mitra completes it in TickTick, which moves it on to the date after and keeps the completed one apart, as TickTick always does. Moving it to another day changes only its next date, and its rule stays as it is. To change the rule itself, edit the task in TickTick.

## What stays in Mitra

TickTick has no dependencies, so the [dependencies](../dependencies.md) between TickTick tasks are kept in Mitra only. They're lost if you disconnect the account or [re-import a calendar](../calendars.md#re-import-a-calendar). A subtask's parent is kept in both, as long as the parent is a task of the same TickTick account.

## What TickTick can't hold

- It holds tasks only, so no events and no [availability](../availability.md).
- A task is open, done or won't do, so there's no **Doing** status.
- You can't make a task repeat from Mitra.
- A task has no end, estimate, due date, location, participants, attachments, progress, busy or free, or visibility in Mitra.

Mitra hides these fields on TickTick tasks, so nothing you type there disappears on the next sync. To move entries that use them into TickTick, see [Move or copy every entry to another calendar](../calendars.md#move-or-copy-every-entry-to-another-calendar), which shows first what wouldn't make it.

## Troubleshooting

- If Mitra says TickTick refused the API token, create a new key under **Settings** → **Account** → **API Keys**, then open the account's **⋯ → Edit** in Mitra and paste it.
- If a list is missing, it may be closed or a note list. After opening it again in TickTick, open the account's **⋯ → Edit** in Mitra and press **Refresh**.
- A free TickTick account holds nine lists. TickTick refuses a tenth without saying why, so delete or close a list in TickTick before making a new one.
