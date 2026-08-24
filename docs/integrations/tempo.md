---
title: Tempo
description: Sync your Jira worklogs two-way — view booked hours on your calendar, and log, move, resize, or retitle time directly from Mitra.
sidebar:
  order: 5
---

Mitra connects to [Tempo](https://www.tempo.io/), the time-tracking platform for Jira. The unit it syncs is the **worklog**: hours logged against Jira issues on a given day. Your worklogs appear as ordinary timed entries on the calendar, side-by-side with the meetings and tasks that produced them.

Worklogs sync **both ways**:
- **Move or resize** an entry in Mitra to adjust its start time or duration in Tempo.
- **Edit the title** in Mitra to update the worklog description in Tempo.
- **Delete** an entry in Mitra to delete the worklog in Tempo.
- **Create a new entry** in Mitra with a Jira issue key to book new time straight to Tempo.

No deployment configuration or server setup is required — you connect directly from the app using your Atlassian and Tempo API tokens.

## Connect your timesheet

Connecting requires both a **Tempo API token** and an **Atlassian API token**:

1. **Create a Tempo API token:**
   - In Jira / Tempo, go to **Settings (gear icon) → Data Access → API integration**.
   - Select **New Token**, enter a name (e.g. "Mitra"), and copy the generated token.
2. **Create an Atlassian API token:**
   - Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
   - Select **Create API token**, name it, and copy the token.
3. **Add the integration in Mitra:**
   - Open the sidebar, select **Add Integration → Tempo**, and fill in:
     - **Site URL** — your Atlassian URL (e.g. `https://your-company.atlassian.net`)
     - **Tempo API Token** — the token from Step 1
     - **Atlassian Account E-mail** — the email address of your Atlassian account
     - **Atlassian API Token** — the token from Step 2
4. Enable the **My worklogs** calendar source in the source picker.

> [!NOTE]
> **Why two tokens?** Tempo and Atlassian are separate APIs. Tempo stores the worklog duration and issue ID, while Jira resolves issue keys (like `PROJ-123`), issue summaries, and your user identity. Both tokens are required for two-way synchronization.

## How worklogs appear on the calendar

Each worklog renders as a timed calendar entry titled with the **Jira issue it books against** — its key and summary:

```text
ACME-1234 Code review for auth migration
```

- **The title is the issue; the note is yours.** The worklog's own description becomes the entry's description, shown under the title in the editor. That is the same pair Tempo's web app draws, and the same way round — the ticket says what the time was *about*, while the note is often a bare activity label ("Review"), or text Jira wrote for you ("Working on work item ACME-1234") that adds nothing.
- **Titles are read-only.** Mitra will not rename a Jira issue because you edited a calendar entry, so the title field is locked on a saved worklog and you edit the note instead. If the time is on the wrong ticket, delete the entry and book it again.
- **Unknown issues:** if Jira can't name the issue (deleted, or no longer visible to you), the title falls back to `#<issue id>` and the entry keeps working.
- **Time zones:** Tempo stores worklogs in bare wall-clock time without time zone offsets. Mitra translates worklog times using the **time zone configured in your Jira user profile**, ensuring times match what you see in the Tempo web app.
- **Instances without start times:** Some Jira/Tempo deployments disable explicit worklog start times. In those environments, all worklogs for a day share the same default start time and stack vertically on the grid, with exact durations preserved.

## Booking time from Mitra

To log new time directly to Jira from Mitra, create a new timed entry on your Tempo calendar source and include the **Jira issue key** anywhere in the title:

| You type | Jira issue booked | Logged description |
| --- | --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` | `ACME-1234 Team standup` |
| `Investigating ACME-1234 regression` | `ACME-1234` | `Investigating ACME-1234 regression` |
| `ACME-1234` | `ACME-1234` | `ACME-1234` |

Mitra verifies the issue key against your accessible Jira projects. If you create an entry without a valid issue key, Mitra prompts you to provide one before saving.

What you type is logged **whole**: the key is read out of the line, never cut out of it. Once the worklog is saved the title becomes the issue's own — key plus summary — and what you typed lives on as the note. That swap happens once, at booking, which is also why the title is editable while you are writing it and locked afterwards.

> [!TIP]
> **Fast time booking:** To log time for a recurring task or yesterday's ticket, duplicate an existing worklog entry (hold **Alt** and drag, or choose **⋯ → Duplicate**) and drag it to the new time slot.

### Constraints when editing worklogs

- **Issue keys cannot be changed:** The Tempo API does not support moving an existing worklog to a different Jira issue. To switch issues, delete the worklog and create a new entry with the correct key.
- **Preserved attributes:** Mitra preserves all custom Tempo attributes (such as billable hours, account categories, or custom work tags) when updating entries.
- **Approval periods:** If your timesheet period is closed, locked, or approved in Tempo, Tempo will reject attempts to add, edit, or delete worklogs for those dates.

## Open issue in Jira

Every Tempo worklog entry includes **Open in Jira** in its **⋯** menu, taking you directly to the issue in your browser.

## What Tempo can and can't hold

A Tempo worklog is a block of time with a description attached to a Jira issue. Mitra automatically hides unsupported calendar fields:

| Feature | In a Tempo source |
| --- | --- |
| Two-way booked time & duration | ✅ |
| Issue key & summary as the title | ✅ read-only — the issue's, not the entry's |
| Worklog note | ✅ the entry's description |
| Open ticket in Jira | ✅ via **⋯ → Open in Jira** |
| All-day entries | ❌ a worklog is timed hours on a specific day |
| Reminders & Recurrence | ❌ |
| Location & Participants | ❌ |
| Task relationships & dependencies | ❌ |

## Troubleshooting

- **401 Unauthorized error when connecting:** Verify that your Atlassian Account E-mail matches the account that generated the Atlassian API token, and ensure the Tempo API token was created under the same Jira user.
- **Worklogs show at the wrong time of day:** Check the time zone configured in your Jira account profile settings (*Account settings → Time zone*).
- **Cannot change ticket key:** Tempo does not allow reassigning existing worklogs to a different issue. Delete the entry in Mitra and create a new one with the desired ticket key.
- **Cannot edit the title:** a worklog's title is its Jira issue's summary, which Mitra never rewrites. Edit the description to record what you did.
- **Worklogs stack at the top of the day:** Your organization has disabled start times in Tempo Global Configuration. The hours and durations remain accurate.
