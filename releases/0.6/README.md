---
title: Calendars in Mitra, table view, due dates
date: 2026-10-05
---
This release gives Mitra calendars of its own, lays your entries out as a table, and gives tasks the constraints they were missing: a due date, an estimate, and the hours you keep free. It also speaks Persian, calendar included.

## Mitra calendars
A calendar can live in Mitra itself, with no account behind it and nothing to sign in to. Install Mitra, add a calendar, and start planning. It shows up on every device you use, and its entries can move to a connected account whenever you connect one.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="calendars-detail-dark.webp">
	<img src="calendars-detail-light.webp" alt="Calendars in the sidebar">
</picture>

Docs: [Mitra calendars](../../docs/integrations/mitra.md)

## Table view
Every entry as a row. Pick the days to list, from the past month to everything you have, search across titles, places and descriptions, sort by several columns at once, and filter by status, calendar, type or repetition. Select rows to change many at once. The title is the same chip the calendar draws, so an entry opens right there.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="table-detail-dark.webp">
	<img src="table-detail-light.webp" alt="The table view, with a column each for when, calendar, status and participants">
</picture>

Docs: [Table view](../../docs/views/table.md)

## Due dates and estimates
A task can carry a due date and an estimate before it has a time. Unscheduled tasks line up in Planning by what is due first, and when you drag one onto the week, the estimate becomes its length. Tasks that slipped past their day gather in an Overdue section above them.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="plan-task-dark.webp">
	<img src="plan-task-light.webp" alt="A task dragged from Planning into the week, where its estimate becomes its length">
</picture>

Docs: [Planning](../../docs/planning.md)

## Checklists in descriptions
A task's description can hold a checklist, written in Markdown, and the boxes are real: tick one in the editor and Mitra writes it back into the text, so every other app on that calendar sees it too. Boxes and subtasks count together, each one step: a task with three boxes and one subtask has four, and with a box ticked and the subtask done its status menu reads 2 of 4 steps done, while the ring on its chip fills to half.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="checklist-dark.webp">
	<img src="checklist-light.webp" alt="A task's checklist and its subtask, counted together as 2 of 4 steps in its status menu">
</picture>

Docs: [Subtasks](../../docs/subtasks.md)

## Availability
Draw the hours you work, train or keep free, in any calendar. They shade the week view so that the open hours stand out. Busy ones show as busy to the people you share a calendar with, and free ones stay yours.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="availability-detail-dark.webp">
	<img src="availability-detail-light.webp" alt="Availability windows shading a week">
</picture>

Docs: [Availability](../../docs/availability.md)

## Persian calendar
Mitra speaks Persian, and with the language comes its calendar: Persian months and weeks in the headers and the pickers, and dates typed the way Persian writes them. Your entries stay where they are. Only the way they read changes.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="persian-calendar-detail-dark.webp">
	<img src="persian-calendar-detail-light.webp" alt="The entry editor in Persian, its date picker open on a Persian month">
</picture>

Docs: [Settings](../../docs/settings.md)

## Links in one row
Every link in an entry's description or location gathers in a Links row of the editor, named by where it goes: a page by its site, a meeting by its service, a note by its app. A location that is a link shows as that link.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="links-detail-dark.webp">
	<img src="links-detail-light.webp" alt="The Links row of an entry">
</picture>

Docs: [Links](../../docs/links.md)

## Contributors
- [@a11delavar](https://github.com/a11delavar)
