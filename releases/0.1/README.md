---
title: Mitra, a calendar of your own
date: 2026-06-07
---
Mitra's first release: a calendar that puts your tasks on the same timeline as your events, synced both ways with the calendars you already keep.

## Why Mitra
There are good calendar apps, and there are calendars you can host yourself, and for a long time they were not the same ones.

The polished apps live on someone else's servers and read everything you put in them. The ones you can run at home are mostly servers: they keep your calendars faithfully and leave you to look at them through whatever app you can find. Mitra started from wanting both at once: a calendar that is pleasant to spend the day in, running on a machine of your own and answering to no one else.

It does not ask you to move. Mitra is a layer over the calendars you already keep, not another place to keep them. Each source of your time is an integration that plugs in beside the others, a CalDAV server first and many more since, and they all meet on one timeline while each keeps its data where it lives. Your events and your tasks share that timeline too, so the work of fitting one into the other no longer happens in your head.

It is also a bet on the web as it is now, not as it was ten years ago. Mitra is written for current browsers and leans on what they can do natively: layouts that adapt to their own space, popovers anchored in place, transitions between views, a real model of dates and time zones. Carrying no compatibility layers and no heavy framework is what keeps it small and quick, lets it install as an app, and lets it feel at home on a phone as on a desktop. The price is that it asks for a recent browser, and it will keep asking.

Underneath is a simple belief: your time is the most personal record you keep. Where it lives, who can read it, and how calm it feels to look at should be yours to decide. Mitra is an attempt to make that easy.

[@a11delavar](https://github.com/a11delavar)

## Week view
A day is a column of 24 hours with a line at the current time, and a week is seven of them side by side. Come back to today with one button.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="week-dark.webp">
	<img src="week-light.webp" alt="The week view, with the line at the current time">
</picture>

Docs: [Week view](../../docs/views/week.md)

## Month view
The month scrolls on without end, a row for every week and a bar for every entry across its days. Switch between it and the week from the header.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="month-dark.webp">
	<img src="month-light.webp" alt="The month view, a row for every week">
</picture>

Docs: [Month view](../../docs/views/month.md)

## Events and tasks
A task sits in the day like an event, with a box to tick when it's done. Drag in the grid to make an entry, drag it to move it, and give each calendar its colour.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="entries-dark.webp">
	<img src="entries-light.webp" alt="Events and tasks side by side in a day">
</picture>

Docs: [Entries](../../docs/entries.md)

## CalDAV
Connect a CalDAV server, choose which of its calendars to show, and Mitra keeps them in step both ways, with changes from elsewhere appearing as they happen.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="caldav-dark.webp">
	<img src="caldav-light.webp" alt="Connecting a CalDAV server">
</picture>

Docs: [CalDAV](../../docs/integrations/caldav.md)

## Markdown notes
An entry's description is Markdown: headings, lists and links read as such, and stay plain text for every other app.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="markdown-dark.webp">
	<img src="markdown-light.webp" alt="An agenda in an entry's description, written in Markdown">
</picture>

## Contributors
- [@a11delavar](https://github.com/a11delavar)
