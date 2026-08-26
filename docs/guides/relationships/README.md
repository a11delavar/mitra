---
title: Relationships
description: Connect tasks and events across calendars with subtasks, parent hierarchies, visual dependencies, and schedule violation warnings.
sidebar:
  label: Overview
---

Mitra lets you connect any entry to another — even across different calendars and accounts. Relationships give structure to complex plans by organizing subtasks under parent projects, drawing visual dependency lines on the calendar, and warning you if a task is scheduled before its prerequisites.

## Relationship types

Mitra organizes relationships into two concepts:

| Type | Purpose | Visual on the calendar | Guide |
| --- | --- | --- | --- |
| **[Hierarchy](hierarchy.md)** | Breaks goals into parent and child tasks with automatic progress calculation | Orbiting progress rings and subtask counts | [Hierarchy →](hierarchy.md) |
| **[Dependencies](dependencies.md)** | Declares execution order (prerequisites and follow-ups) | Curved connection arrows and conflict warnings | [Dependencies →](dependencies.md) |

## Adding a relationship

To link entries:

1. Open any event or task editor and scroll to **Relations**.
2. Select **＋ Relation** and choose the relation type:
   - **Subtask** / **Parent** — for hierarchy and progress rollups.
   - **Blocks** / **Depends on** — to declare that one task must finish before another starts.
3. Search for the target entry by title across any of your connected calendars.

> [!TIP]
> You can link entries from **different sources and accounts** — for example, linking a local CalDAV task as a subtask of a shared Notion milestone.

## Managing relations in place

In the task editor, each related entry shows:

- Its **calendar color** so you know where it lives.
- Its **status icon** (clickable to toggle status in place).
- A **strike-through** if the related task is completed or cancelled.
- Direct navigation: clicking a relation's title opens that entry's editor.
