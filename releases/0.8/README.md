---
title: Routine tracker, Todoist, subtasks and due dates at a glance
---
Mitra 0.8 helps you keep up the things you do again and again, and shows how bigger pieces of work come together.

## Routine tracker
Mitra already gathers the things you do often, such as the gym or a haircut every five weeks, into routines. Now they get a place of their own, where you see each routine's recent days at a glance: how many you kept, and which you cancelled or missed. You can rename a routine, merge two that belong together, or tell Mitra that something isn't a routine at all. Routines also stay steady in the month and year views however far you scroll, and your AI connector can tell you how they are going.

## Same time everywhere
Some things don't depend on your time zone: medication at 7:30 is at 7:30, at home or when you travel. Choose **Same time everywhere** at the top of an entry's time zones, and it stays at that hour wherever you are, marked with a crossed-out globe. Entries that come from other apps without a time zone show it too. Before you move one to a calendar that has no such times, such as Google Calendar, Mitra tells you it will get a fixed time zone.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="same-time-dark.webp">
	<img src="same-time-light.webp" alt="An entry's editor on the morning medication, its time zones open on Same time everywhere">
</picture>

Docs: [Same time everywhere](../../docs/time-zones.md#same-time-everywhere)

## Better subtasks
An entry's subtasks share a lane in the month and year views, so a project reads as one line, with its short subtasks folded into it. The table nests subtasks under their parent, and the year view can hide them. A task's progress weighs each subtask by its size, so a long piece of work counts for more than a quick one.

## Due dates at a glance
A task's due day shows on its flag, and pointing at the task marks that day in the calendar. The timeline marks it too, and the table gets a column for it. A subtask without a due date of its own takes its parent's.

## Custom CSS
Restyle Mitra with CSS of your own: for yourself in Settings, or for everyone on your server through a file in its data folder. Whoever runs the server gets a section of their own in Settings.

## Duplicate to other days
Some things happen on days no repeat can describe. A prescription for eight physiotherapy sessions lands wherever the practice has a free slot, and a client books you for the 3rd, the 9th and the 17th. Add the first one, choose **Duplicate to other days** in its ⋯ menu, and tick the rest on the two months it shows. Hold Shift to take a run of days at once. Each day gets a copy at the same time, an entry of its own that you can move or change like any other.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="duplicate-days-dark.webp">
	<img src="duplicate-days-light.webp" alt="The Duplicate to other days dialog on a physiotherapy session, seven more sessions chosen in October and November">
</picture>

Docs: [Duplicate to other days](../../docs/entries.md#the--menu)

## Todoist
Connect your Todoist projects, and their tasks sit on the same timeline as your events, synced both ways. Each project becomes a calendar in its Todoist color. A task's date, duration and deadline become its schedule, its length and its due date. A task that repeats in Todoist shows at its next date, and completing it in Mitra moves it on, as Todoist does. Priority, labels and sections stay as they are.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="todoist-dark.webp">
	<img src="todoist-light.webp" alt="The Add integration dialog, the pointer on Todoist among the other providers">
</picture>

Docs: [Todoist](../../docs/integrations/todoist.md)

## More languages
Mitra is learning Arabic, Russian, Polish and Dutch. Each release has made Mitra work better in other languages, scripts and calendars. Every new language comes fully translated, including the docs and the website.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="arabic-week-dark.webp">
	<img src="arabic-week-light.webp" alt="The week in Arabic, laid out from right to left, with an event open in its editor">
</picture>

## Contributors
- [@jkngale](https://github.com/jkngale): the groundwork for Todoist
