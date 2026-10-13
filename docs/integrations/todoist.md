---
title: Todoist
description: Connect your Todoist projects and keep task dates in sync.
---

Todoist projects become task calendars in Mitra. Titles, descriptions, dates, durations, deadlines and completion synchronize with Todoist.

## Connect

1. In Todoist, open **Settings → Integrations → Developer** and copy your API token.
2. In Mitra, choose **Add integration → Todoist**, paste the token and choose **Connect**.
3. Select the projects to import and choose **Save**.

Only selected projects import their tasks. Mitra stores the token on its server and keeps it out of ordinary API responses. Leaving the token field blank while editing preserves the stored token.

## Dates and times

Todoist's task date places the task on Mitra's calendar. A separate Todoist deadline becomes Mitra's due date. A date without a time is an all-day task, and a task without a date stays in the planning list.

Floating times follow your Todoist account's time zone. Fixed times retain their explicit time zone. A task at 18:30 in Madrid therefore stays at 18:30, including across the change between summer and winter time.

Moving a recurring task changes its next date while preserving Todoist's repeat rule and language. Edit the repeat rule in Todoist; Mitra does not offer its own repeat editor for these tasks. Completing a recurring task lets Todoist advance its next occurrence.

## Synchronization

Mitra reads active tasks and recent completed tasks with cursor pagination. Synchronization runs at most once a minute while the app is watched and less often when it is not. Changes to a task update its existing Todoist identifier.

Todoist calendars do not support Mitra availability, participants, reminders, free/busy state or cancellation. Reminder rules remain in Todoist. Links between tasks stored in Mitra are not written into Todoist.
