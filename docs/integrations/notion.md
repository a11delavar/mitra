---
title: Notion
description: Bring the views of your Notion task databases into Mitra as calendars of tasks that sync both ways.
---

Mitra connects to Notion for tasks. Each view of a task database, such as "All tasks", "My tasks" or a sprint board, becomes a calendar in Mitra that holds exactly the tasks the view shows: Notion applies the view's filters, and Mitra places the result on your calendar. A task's title, status, dates and description sync both ways.

You connect from the app with an integration token. There's nothing to set up on the server.

## Connect a workspace

1. Create an integration at [notion.so/profile/integrations](https://www.notion.so/profile/integrations). An internal integration is enough.
2. Share your task databases with it. Open each database in Notion, choose **•••** → **Connections**, and add your integration.
3. In Mitra, choose **Add Integration** at the foot of the sidebar, then **Notion**, and paste the integration's secret, which starts with `ntn_`, into **Integration Token**.
4. Press **Connect**. Mitra lists the views of the databases you shared, named after the database and the view.
5. Choose the views you want, then press **Save**.

Mitra turns on one view per database to start with. A task belongs to every view whose filters it matches, so with two views of the same database turned on, it would show up twice. You can still turn on more on purpose.

Mitra offers table, board, list, calendar, timeline and gallery views. Other kinds of view aren't listed.

## Which databases work

A database shows up when it has a property of the type Status and one of the type Date. Notion's own task templates have both.

Mitra reads a task's status from the group its Notion status belongs to:

| Notion status group | Status in Mitra |
| --- | --- |
| To-do | To Do |
| In progress | Doing |
| Complete | Done |

When you change a status in Mitra, Notion gets the first option of the matching group.

The Date property is where Mitra places the task, so it's the task's schedule. If a database has several Date properties, Mitra prefers one whose name starts with "Due", then one called "Date", "When", "Deadline", "Scheduled" or "Do date", and otherwise takes the first.

## What syncs

The title, the status and the date sync both ways, as all-day dates or with times. Times show in your own time zone. A task without a date waits in the **Unscheduled** list of the [Planning tab](../planning.md#the-planning-tab).

A task's description is the body of its Notion page, written as Markdown, including to-do lists and callouts. When you edit the description in Mitra, Mitra replaces only what the description shows. Images, embeds, sub-pages and synced blocks stay in Notion as they are, and Mitra doesn't show them.

Relation properties that link tasks within the same database become links in Mitra, both ways. A property called "Parent task" or "Sub-tasks" makes [subtasks](../subtasks.md), one called "Blocked by" or "Depends on" makes [dependencies](../dependencies.md), and other relations appear under their own name. Relations to other databases aren't shown.

To open a task in Notion, choose **Open in Notion** in the editor's **⋯** menu. Deleting a task in Mitra moves its page to Notion's trash, where you can still restore it.

Notion limits how often apps may call it, so Mitra syncs it about once a minute (see [how syncing works](README.md#how-syncing-works)). A new task never briefly disappears while Notion catches up.

## What Notion can't hold

A Notion database holds tasks with one date each, and that shapes what a Notion calendar can hold:

- It holds tasks only, so no events and no [availability](../availability.md).
- A task's one date is its schedule, so there's no due date or estimate.
- Tasks can't repeat, and have no reminders, location or participants.
- There's no **Cancelled** status, since Notion has no group for it.
- A task can't have a time zone of its own, a progress percentage, busy or free, or a visibility.

Mitra hides these fields on Notion tasks, so nothing you type there disappears on the next sync. To move entries that use them into Notion, see [Move or copy every entry to another calendar](../calendars.md#move-or-copy-every-entry-to-another-calendar), which shows first what wouldn't make it.

## Views and filters

A calendar shows what its Notion view shows, and a task you create in it gets the view's filter values, so it lands in the view. A task added to a "University" view gets "Area = University", as if you had added the row in Notion.

Mitra fills in the filters that one value can satisfy: a select, a status, a multi-select, a checkbox, or a relation to a specific page. Some filters no single value can match, such as a formula, a date range, or one of several options. A task you create in such a view doesn't match it, so, as in Notion, it doesn't show up there. It's still in the database, and a view with fewer filters, such as "All tasks", shows it.

> [!TIP]
> If a view filters on a relation to another database, for example tasks whose "Area" points to a "University" page in an "Areas" database, share that database with your integration too. Otherwise Mitra can't set the relation on new tasks, and they don't appear in the view.

## Troubleshooting

- If a database isn't listed, it's missing a Status or a Date property, or it isn't shared with your integration (**•••** → **Connections** in Notion). After sharing it, open the account's **⋯ → Edit** in Mitra and press **Refresh**.
- If a task appears twice, you've turned on two views of the same database that both include it. Turn one of them off under the account's **⋯ → Edit**.
