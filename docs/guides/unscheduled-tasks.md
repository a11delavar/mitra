---
title: Unscheduled tasks
description: Find the tasks that have no date yet in the sidebar's Planning tab, and drag them onto the calendar to schedule them — or back off it to unschedule.
sidebar:
  order: 1
---

A task does not have to have a date. A Notion page whose date property is empty, or a task on a calendar server saved without a start or a due date, is a perfectly ordinary task — it just has no place on a calendar grid, which is organised by day.

Mitra keeps those in the sidebar's **Planning** tab, under **Unscheduled**. It is the calendar's complement: every entry the grid cannot show, and nothing else.

## Find them

Open the sidebar and switch to **Planning**. Alongside the tab buttons you can **swipe sideways** — a two-finger swipe on a trackpad, or a finger swipe on a touch screen — to move between Calendars and Planning.

Each task appears as the same chip the calendar draws: its calendar's colour, its status mark, and its title. Completed and cancelled ones sink to the bottom of the list. The number beside the heading is how many there are.

Clicking a task opens its editor, exactly as clicking it on the calendar would.

## Jot one down

**Add Task**, at the foot of the Planning tab, adds a task with no date — the list is what "no date" means, so a title is all it asks for. It lands on the calendar new entries go to, or on the first one that can hold tasks if that one can't.

The number on the **Planning** tab is how many are waiting, so you can see the backlog without leaving the Calendars tab.

## Schedule from the editor

Open the task and press **＋ Date**. Pick a day and the task is scheduled for it, all day — from there the all-day switch turns it into a timed task, and the fields beside it set the times.

This is the way that works everywhere, including on a phone.

## Schedule by dragging

Drag a task out of the list and drop it on the calendar:

- **onto the time grid** — it becomes a one-hour task starting where you dropped it;
- **onto the all-day strip, or onto a day in the month or year view** — it becomes an all-day task on that day.

Drag its edge afterwards to give it the length you want, like any other entry.

## Unschedule again

Two ways back, mirroring the two ways out:

- **Drag** the task off the calendar and drop it on the Unscheduled list.
- **Clear the date** in its editor — the **✕** beside the start date. The task loses its dates and returns to the backlog.

The end date has its own **✕**, which does the smaller thing: it drops just the end, so the task ends on the day it starts.

> [!NOTE]
> Only **tasks** can be unscheduled, so only they get the ✕ beside the start date. An event always has a date — the iCalendar format that calendar servers speak requires one — and a repeating task's dates are what identify its occurrences, so neither offers it.

Both directions write straight through to the account the task came from: the date lands in your Notion page's date property, or in the task's `DTSTART`/`DUE` on your calendar server, and unscheduling removes it there too.

## On a phone

At narrow widths the sidebar covers the calendar while it is open, so there is nothing to drag onto. Tap the task, press **＋ Date**, and pick a day — it is scheduled and leaves the list. The ✕ in the editor takes it back off the calendar the same way.
