---
title: Notion
description: Use Notion database views as task lists that sync both ways. Connect a workspace, share your task databases, and each view becomes its own source on the calendar.
---

Mitra connects to Notion as a **task** provider. The unit it syncs is a database **view**: connect a workspace and each view of your shared task databases (*All tasks*, *My tasks*, a sprint board) can be enabled as its own source. Notion evaluates the view's filters; Mitra shows the result on the calendar. Tasks sync **both ways**: title, status, and date edits made in Mitra land in Notion and vice versa.

There is nothing to set up on the server. You paste an integration token in the app.

## Connect a workspace

1. Create an integration at [notion.so/profile/integrations](https://www.notion.so/profile/integrations). An **internal** integration is fine.
2. **Share your task databases with it.** Open each database in Notion, then *••• → Connections → Add connection* and pick your integration.
3. In Mitra, choose **Add Integration → Notion** and paste the integration's **secret** (it starts with `ntn_…`).
4. Enable the views you want from the source picker.

> [!NOTE]
> Mitra pre-selects only **one view per database** in the picker. Overlapping views of the same database would each show the task, so a task could appear more than once. Enabling a single view avoids that, but you can still enable more on purpose.

## Which databases qualify

A database becomes available as a task source when it has both:

- a **Status** property, and
- a **Date** property.

Notion's own task templates have both. Status options map to Mitra's task states **by their group**:

| Notion status group | Mitra task state |
| --- | --- |
| To-do | To do |
| In progress | Doing |
| Complete | Done |

## What Notion can and can't hold

Notion's data model shapes what syncs. Mitra **hides** the fields Notion can't store rather than letting your edits silently vanish:

| Feature | In a Notion source |
| --- | --- |
| Tasks | ✅ |
| Events | ❌ Notion databases hold tasks only |
| Two-way title / status / date | ✅ |
| Description | ✅ maps to the page **body** as Markdown |
| Recurrence | ❌ hidden |
| Reminders | ❌ hidden |
| Location | ❌ hidden |
| *Cancelled* status | ❌ there's no equivalent group in Notion |
| Per-task time zone | ❌ Notion dates store a fixed offset, not a named zone |
| Due date and estimate | ❌ the date property is the task's schedule |

Times still **display** correctly in your own time zone. The limitation only means you can't *set* a time zone per task. Tasks without a date sync too; they don't land on the calendar, but search finds them.

### Descriptions map to the page body

A task's description is the Notion **page body**, round-tripped as Markdown (including `> [!type]` callouts). Mitra is careful here: a description edit replaces exactly what the description shows, and it **never touches** images, embeds, sub-pages or synced blocks. Those stay in Notion, untouched, and Mitra doesn't show them. Your collaborative page content is safe.

## How views and filters behave

A Mitra source **mirrors its Notion view**: it shows exactly what the view shows.

- A task **created in Mitra** in a filtered view gets the view's own filter values pre-filled, so it actually appears in the view. A task added to a "University" view gets *Area = University*, just as if you had added the row in Notion.
- Mitra can pre-fill the filters a single value satisfies: a select, status, multi-select, checkbox, or a **relation** pointing at a specific page.
- Some views filter on things no single value can match, like a formula, a date range or an "or" of options. A task you create there won't match the filter, so (exactly as in Notion) it won't appear in that view. It still lives in the database and shows up in a less-filtered view like "All".

> [!TIP]
> If a view filters by a **relation** to another database (e.g. tasks whose *Area* relation points to a "University" page in an *Areas* database), share **that** database with your integration too. Otherwise Mitra can't set the relation on new tasks and they won't appear in the view.

## Deleting

Deleting a task in Mitra moves the Notion page to Notion's **trash**, where you can still restore it.

## Syncing and rate limits

Notion is polled at most about once a minute to stay within its API rate limits, and only every few minutes while nobody has the app open. Deletions are checked carefully, so a delay on Notion's side never makes a task you just created briefly disappear.

## Troubleshooting

- **A database isn't offered as a source.** It needs both a **Status** and a **Date** property, and it must be shared with your integration (*••• → Connections*).
- **New tasks don't show in a relation-filtered view.** Share the *related* database with the integration too. Mitra can only set a relation that Notion lets it see.
- **A task appears twice.** You've enabled overlapping views of the same database; each enabled view shows the task once.
