---
title: Relationships
description: Connect tasks and events across calendars with subtasks, parent hierarchies, visual dependencies, and schedule violation warnings.
sidebar:
  label: Overview
---

In Mitra you can link any entry to another, even across different calendars and accounts. Use it to put subtasks under a parent project, draw dependency lines on the calendar, and get a warning when a task is scheduled before the ones it depends on.

## Relationship types

Mitra organizes relationships into two concepts:

| Type | Purpose | Visual on the calendar | Guide |
| --- | --- | --- | --- |
| **[Hierarchy](hierarchy.md)** | Breaks goals into parent and child tasks with automatic progress calculation | Orbiting progress rings and subtask counts | [Hierarchy](hierarchy.md) |
| **[Dependencies](dependencies.md)** | Declares execution order (prerequisites and follow-ups) | Curved connection arrows and conflict warnings | [Dependencies](dependencies.md) |

## Adding a relationship

To link entries:

1. Open any event or task editor.
2. Select **＋** on the row for the kind of link:
   - **Subtask of** / **Subtasks**: for grouping tasks and tracking their progress.
   - **Blocked by**: for when one entry has to finish before another starts.
3. Search for the target entry by title across any of your connected calendars.

> [!TIP]
> You can link entries from **different sources and accounts**, for example a CalDAV task as a subtask of a shared Notion milestone.

## Managing relations in place

In the task editor, each related entry shows:

- Its **calendar color** so you know where it lives.
- Its **status icon** (clickable to toggle status in place).
- A **strike-through** if the related task is completed or cancelled.
- Direct navigation: clicking a relation's title opens that entry's editor.
