---
title: Tempo
description: See the hours you book in Tempo on your calendar, and book, move, resize and delete them from Mitra.
---

[Tempo](https://www.tempo.io/) is a time-tracking app for Jira. Mitra shows your **worklogs**, the hours you booked on Jira issues, as timed entries on your calendar, next to the meetings and tasks the time went into.

Worklogs sync both ways. Move or resize an entry to change when and how long you worked, edit its description to change the worklog's note, delete it to delete the worklog, or create one to book new time.

You connect from the app with two API tokens. There's nothing to set up on the server.

## Connect your timesheet

Mitra needs a token from Tempo and one from Atlassian: Tempo holds the hours, and Jira knows the issues and who you are.

1. Create a Tempo API token. In Jira, open Tempo's **Settings** (the gear icon) → **Data Access** → **API integration**, choose **New Token**, name it "Mitra", and copy the token.
2. Create an Atlassian API token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) with **Create API token**, and copy it. Create both tokens as the same Jira user.
3. In Mitra, choose **Add Integration** at the foot of the sidebar, then **Tempo**, and fill in:
   - **Site URL**, your Atlassian address, such as `https://your-company.atlassian.net`.
   - **Tempo API Token**, the token from step 1.
   - **Atlassian Account E-mail**, the email address of your Atlassian account.
   - **Atlassian API Token**, the token from step 2.
4. Press **Connect**. Mitra lists one calendar, **My worklogs**.
5. Leave it turned on and press **Save**.

Tempo limits how often apps may call it, so Mitra syncs it about once a minute (see [how syncing works](README.md#how-syncing-works)).

## How worklogs look

An entry's title is the Jira issue the time is booked on, its key and summary:

```text
ACME-1234 Code review for auth migration
```

The worklog's note is the entry's description. Tempo's own app shows them the same way, because the issue says what the time was about, while the note is often an activity label such as "Review", or text Jira wrote for you, such as "Working on work item ACME-1234".

The title belongs to the issue, so you can't edit it on a saved worklog: Mitra doesn't rename a Jira issue because you edited a calendar entry. Edit the description to say what you did. If Jira can't name the issue, because it was deleted or you can no longer see it, the title shows `#` and the issue's ID, and the entry keeps working.

Tempo stores worklogs as plain clock times, without a time zone. Mitra reads them in the time zone of your Jira profile, so they show at the same times as in Tempo.

Some Tempo sites turn off start times. There, every worklog of a day starts at the same time, so they stack up, but their lengths are right.

## Book time from Mitra

Create a timed entry in **My worklogs**, and put the Jira issue key anywhere in its title:

| You type | Booked on |
| --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` |
| `Investigating ACME-1234 regression` | `ACME-1234` |
| `ACME-1234` | `ACME-1234` |

Mitra checks the key against the Jira projects you can see. If the title has no such key, or Jira has no such issue, Mitra doesn't book anything and tells you why.

The worklog's note is what you wrote in the description, or, if you left that empty, the whole title as you typed it. Once the time is booked, the title becomes the issue's key and summary. That swap happens once, when you book, which is why you can edit the title while you write it and not afterwards.

> [!TIP]
> To book time on an issue you've booked before, duplicate one of its entries: hold <kbd>Alt</kbd> (<kbd>⌥</kbd> on a Mac) while you drag it to the new time, or choose **Duplicate** in its editor's **⋯** menu.

## Change a worklog

Moving, resizing, deleting and editing the description go straight to Tempo. A few things to know:

- A worklog stays on its issue. Tempo can't move a worklog to another issue, so to book the time elsewhere, delete the entry and create a new one with the right key.
- Mitra keeps Tempo's own details of a worklog, such as its billable time and work attributes, when it changes it.
- When a timesheet period is closed or approved in Tempo, Tempo refuses to add, change or delete worklogs in it.

To open the issue in Jira, choose **Open in Jira** in the editor's **⋯** menu.

## What a worklog can't hold

A worklog is a stretch of time on one day, booked on one issue. So a Tempo calendar holds only timed entries: no all-day entries, repeats, reminders, location, participants, relationships, busy or free, visibility or [availability](../availability.md). Mitra hides these fields on worklogs.

## Troubleshooting

- If Mitra says "Tempo rejected the API token", create a new Tempo API token and enter it under the account's **⋯ → Edit**.
- If Mitra says "Jira rejected the e-mail and API token", check that the email address belongs to the Atlassian account that created the API token.
- If worklogs show at the wrong time of day, check the time zone in your Jira profile (**Account settings** → **Time zone**). After changing it, use **Re-import entries** in the **⋯** menu of **My worklogs**, so the worklogs you already have move too.
- If worklogs stack up at the same time each day, your Tempo site has turned off start times. The hours are still right.
