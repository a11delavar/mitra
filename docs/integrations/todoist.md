---
title: Todoist
description: Bring your Todoist projects into Mitra as calendars of tasks that sync both ways.
---

Mitra connects to Todoist for tasks. Each of your Todoist projects becomes a calendar in Mitra that holds its tasks. A task's title, description, dates and completion sync both ways.

You connect from the app with your API token. There's nothing to set up on the server.

## Connect an account

1. In Todoist, open **Settings** → **Integrations** → **Developer** and copy your API token.
2. In Mitra, choose **Add Integration** at the foot of the sidebar, then **Todoist**, and paste the token into **Todoist API Token**.
3. Press **Connect**. Mitra lists your projects, each in its color from Todoist. A project inside another is named after both, such as "Work · Launch".
4. Choose the projects you want, then press **Save**.

You can connect more than one Todoist account. Archived projects aren't listed.

## What syncs

The title, the description and completion sync both ways, and so do the dates:

| In Todoist | In Mitra |
| --- | --- |
| Date | The task's schedule: a day, or a time |
| Duration | How long the task is scheduled for, or its [estimate](../planning.md#set-an-estimate) while it has no date |
| Deadline | Its [due date](../planning.md#set-a-due-date) |
| Sub-task | A [subtask](../subtasks.md) |

A task without a date waits in the **Unscheduled** list of the [Planning tab](../planning.md#the-planning-tab). Tasks you completed in the last twelve weeks come along when you connect, and every completion after that.

Todoist keeps a time either floating, the same on every clock wherever you are, or fixed in a time zone. Mitra keeps both as they are: a floating time stays the [same time everywhere](../time-zones.md#same-time-everywhere), and a fixed one keeps its zone.

Deadlines and durations are part of Todoist's Pro and Business plans. On a free account, Todoist tasks have no due date, end or estimate in Mitra: a task with a time is a moment, and a task on a day takes that day alone. When your plan changes, as a trial begins or ends, Mitra reads every task again. A deadline is a day, so a due date you give a time in Mitra keeps only its day.

Mitra doesn't show a task's priority, labels, section, comments or reminders, and leaves them as they are in Todoist. Moving a task to another Todoist calendar moves it to that project, and keeps all of them.

To open a task in Todoist, choose **Open in Todoist** in the editor's **⋯** menu. Deleting a task in Mitra deletes it in Todoist.

Todoist limits how often apps may call it, so Mitra syncs it about once a minute (see [how syncing works](README.md#how-syncing-works)).

## Repeating tasks

A task that repeats in Todoist shows at its next date, as Todoist keeps it, without its rule. Completing it in Mitra completes it in Todoist, which moves it on to the date after, as Todoist always does. Moving it to another day changes only its next date, and its rule stays as it is. To change the rule itself, edit the task in Todoist.

## What stays in Mitra

Todoist has no dependencies, so the [dependencies](../dependencies.md) between Todoist tasks are kept in Mitra only. They're lost if you disconnect the account or [re-import a calendar](../calendars.md#re-import-a-calendar). A subtask's parent is kept in both, as long as the parent is a task of the same Todoist account. Todoist then moves the subtask into its parent's project.

## What Todoist can't hold

- It holds tasks only, so no events and no [availability](../availability.md).
- A task is open or done, so there's no **Doing** or **Cancelled** status. A task that's in progress elsewhere goes back to **To Do** when you move it into Todoist.
- You can't make a task repeat from Mitra.
- A task has no reminders, location, participants, attachments, progress, busy or free, or visibility in Mitra.

Mitra hides these fields on Todoist tasks, so nothing you type there disappears on the next sync. To move entries that use them into Todoist, see [Move or copy every entry to another calendar](../calendars.md#move-or-copy-every-entry-to-another-calendar), which shows first what wouldn't make it.

## Troubleshooting

- If Mitra says Todoist refused the API token, copy it again from **Settings** → **Integrations** → **Developer**. If you reset it in Todoist, open the account's **⋯ → Edit** in Mitra and paste the new one.
- If a project is missing, it may be archived. After unarchiving it in Todoist, open the account's **⋯ → Edit** in Mitra and press **Refresh**.
