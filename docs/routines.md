---
title: Routines
description: "How Mitra keeps count of what you do often, such as a daily medication or the gym, and shows it as small marks in the month and year views."
---

Some things happen so often that a bar for each would fill a month with copies: a daily workout, your medication, a weekday standup. In the month and year views, Mitra draws them as a **routine** instead: a thin line under the days, with a mark on each day the routine happens. The **Routines** tab in the sidebar keeps count of how each routine went.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/month-detail-dark.webp">
  <img src="../assets/screenshots/month-detail-light.webp" alt="The month view, with routines shown as small marks under each day" />
</picture>

In the year view, where every day is small, routines are what you see most: each colored line is a routine running through the months.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/year-detail-dark.webp">
  <img src="../assets/screenshots/year-detail-light.webp" alt="The year view, with routines as thin colored lines under the days of every month" />
</picture>

## What becomes a routine

Entries form a routine when they're in the same calendar and have the same title. Mitra recognizes a routine as entries are saved or synced, and keeps it.

- A repeating entry is a routine from the start, however often it repeats, as long as it has at least four dates.
- Entries that don't repeat become one once there are at least four of them, and they come about every five weeks or more often, or keep a regular rhythm, such as once a year. So separate entries called "Run" make a routine just as a daily series does.

Calendars you can only read, such as subscriptions, form no routines.

Once an entry belongs to a routine, it stays there: when you rename it, tick it off, move one of its occurrences or move it to another calendar. Later entries with the same title join it, however far apart they come. A copy in another calendar becomes part of that calendar's routine with its title. An entry without a title never joins others; a repeating one is a routine by itself.

How often a routine comes decides how the views draw it:

- In the month view, a routine that comes more often than once a week shows as marks. Something weekly stays a bar.
- In the year view, a routine that comes about every five weeks or more often shows as marks, so weekly and monthly ones do too. A rarer one, such as a birthday, stays a bar.

## The Routines tab

Open **Routines** in the sidebar, beside Calendars and Planning, or type its name in the command palette. **Today** lists the routines that come today, in the order of their time of day, and **Later** the rest, by their next date. Each row shows the routine's name, when it comes, and a strip of its last 14 occurrences, with how many of them you kept.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/routines-detail-dark.webp">
  <img src="../assets/screenshots/routines-detail-light.webp" alt="The Routines tab in the sidebar, each routine with its last occurrences and how many were kept" />
</picture>

Each cell of the strip is one occurrence:

- A solid cell was kept: an event that took place, or a task you ticked off.
- A hollow cell was missed: a task left open after its day.
- A dash was cancelled, which counts as not kept, as a missed one does.
- A ringed cell is today's, still open.
- A faint cell is a day it doesn't come on.

Mitra counts only what is on your calendar. An occurrence you delete is gone and isn't counted, so to keep a skipped session on the record, cancel it instead of deleting it; see [Event status](entries.md#event-status). Events have nothing to tick: an event took place unless it was cancelled.

Today's status sits at the end of a routine's row: a task's checkbox, which ticks it off as the one on the calendar does, and an event's once you cancel it, so you can change it back. The badge on the tab counts the routine tasks still open today. A calendar you hide takes its routines out of the tab.

## A routine's detail

Click a row to see more: since when the routine runs, its recent weeks as a grid of days, how many of the last ones and of the past year you kept, and the weekday it slips on most. Its **⋯** menu has **Done today** for a task, **Cancelled** for today's occurrence, and **Show in calendar** to open the next one.

## Correct a routine

Mitra finds routines by itself, and the detail's **⋯** menu corrects it where it got one wrong. **Rename…** gives the routine a name of your own; you can also click its name and type. The button beside a name of your own, or typing its entries' title back, names it after its entries again. **Merge into** opens the other routines of the same calendar; picking one joins the two, for one habit that goes by two titles, such as "Morning pills" and "Evening pills". **Not a routine** takes it out of the tab for good: entries with its title are no longer gathered into a routine, and they stay on your calendar.

## Use a routine

Point at a routine to see its title and, if it's a repeating entry, how often it repeats. Click it to open its first entry in that row: the week in the month view, or the month in the year view.

The week view always shows each entry in full, with its times.
