---
title: Dependencies
description: Sequence tasks and events with dependency connections, visual calendar arrows, and schedule conflict warnings.
sidebar:
  order: 2
---

Dependencies declare execution order: one task or event must finish before the next one can begin. Mitra visualizes these connections directly on your calendar grid and alerts you whenever a schedule conflict arises.

## Creating a dependency

In any entry's editor under **Relations**:

1. Select **＋ Relation**.
2. Choose **Blocks** (if this entry must happen *before* the target) or **Depends on** (if this entry requires the target to finish *first*).
3. Search for the prerequisite or follow-up entry.

Mitra records the relationship from both sides — adding "A blocks B" automatically shows "B depends on A" on entry B.

## Visual connection arrows

On the calendar grid (Day and Week views), Mitra draws smooth connection arrows between dependent entries:

- The line starts at the end of the prerequisite entry and points to the start of the dependent entry.
- Clicking or hovering over an entry highlights its active dependency lines so you can trace complex workflows at a glance.

## Schedule conflict warnings

If an entry is moved or scheduled such that it starts **before** its prerequisite has finished, Mitra flags a **dependency violation**:

- The connecting arrow changes color to indicate a conflict.
- The entry displays a warning badge, making it easy to spot scheduling mistakes on your timeline.
- Moving the dependent task back after the prerequisite resolves the warning automatically.

## See also

- [Relationships Overview →](README.md)
- [Hierarchy →](hierarchy.md)
- [Keyboard Shortcuts →](../keyboard-shortcuts.md)
