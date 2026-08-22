---
title: Hierarchy
description: Break tasks into subtasks, track automatic progress rollups, and coordinate parent and child task completion.
sidebar:
  order: 1
---

Tasks in Mitra can be broken down into subtasks and linked across [calendars](../calendars.md) — including [unscheduled tasks](../unscheduled-tasks.md) that have no date yet. Mitra automatically rolls up subtask completion into the parent task, displays progress indicators on the calendar, and offers smart follow-up prompts when completing or moving related tasks.

## Subtasks & parent tasks

You can link any task as a subtask or parent of another in its editor under **Relations**:

1. Open a task's editor and select **＋ Relation**.
2. Pick **Subtask** (to add a child task) or **Parent** (to assign this task to a parent).
3. Search for the task you want to link.

Each subtask displays its status directly in the editor with its [calendar's color](../calendars.md#recolor). You can tick or toggle subtasks in place without leaving the parent task's editor.

## Progress rollups

Mitra automatically calculates the overall completion percentage of any task that has subtasks:

- **Weighted progress**: A parent's progress reflects both fully completed subtasks and in-progress subtasks with custom percentages. For example, if a parent has 3 subtasks where 2 are done (100%) and 1 is 80% complete, the parent calculates 93% overall progress.
- **Cancelled subtasks**: Cancelled subtasks are excluded from the total, so cancelled work never holds a parent's completion back.
- **Visual indicators**: Tasks with progress display an orbiting progress ring on the calendar matching their completion. Clicking the status mark opens the status menu with an exact percentage bar and subtask count (e.g. *2 of 3 subtasks done*).

## Custom task progress

On calendars that support task progress (such as [CalDAV](../../integrations/caldav.md) and [Notion](../../integrations/notion.md)), standalone tasks without subtasks can carry a custom percentage complete:

- Alt-click the task's checkbox or right-click to open the status menu.
- Drag the **Progress** slider to set the completion percentage (in 5% increments).
- Setting 100% automatically marks the task as **Done**; dropping below 100% returns it to **Doing**.

## Coordinated completion

When working with hierarchical tasks, Mitra offers follow-up actions:

- **Finishing the last subtask**: When you complete the last outstanding subtask of a parent task, Mitra asks if you would like to mark the parent task as **Done** too.
- **Closing a parent task**: If you mark a parent task as Done or Cancelled while some of its subtasks are still open, Mitra asks whether you'd like to mark the remaining subtasks as Done or Cancel them.
- **Moving or deleting**: Moving a parent task to a new day or time asks whether you want to move its subtasks by the same amount of time. Deleting a parent offers to delete its subtasks along with it.

> [!TIP]
> Hold **Ctrl** (or **⌘** on macOS — see [keyboard shortcuts](../keyboard-shortcuts.md)) when moving or deleting a parent task to bypass the prompt and apply the change only to the selected task.

## See also

- [Relationships Overview →](README.md)
- [Dependencies →](dependencies.md)
