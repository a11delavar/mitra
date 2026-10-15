# Branch progress
## Languages (unstaged, 2026-10-15)
- **Chinese (Simplified)** in this worktree: app, sample calendar, 38 docs pages, 7 release notes, website words, Noto Sans SC under `body:lang(zh)`, the 0.7 capture `chinese-detail`. Fixes it found: month's 月 in the week header, bare day numbers in the date picker and timeline, the rule join (`${frequency} ${on}`), the palette's setting colon (`${setting}: ${value}`), the participant reply summary (was English everywhere).
- **Polish** and **Dutch** in `.claude/worktrees/polish-translation` and `dutch-translation`, complete. Land after Chinese: rebase onto it, resolve the language lists, and add the keys Chinese introduced (`${frequency} ${on}`, `${setting}: ${value}`, the four reply counts); their participants pages quote the English summary until then.
- Brief, glossaries and checker: scratchpad `translation/` (`check.py <lang> <worktree>`).

## Next
2. **Validation, the rest** (fits with 1)
   - `MigrationVerdict.assess` on the same errors, losses as a second kind
   - The editor marks the fields `entry.validate(calendar)` names
   - Still apart: the relations check (needs the database) and the organizer rule (403)
4. **Domain model, the rest** (improves the tools, doesn't block them)
   - Provider statuses wrapped (step 7): a Notion 401 still reaches the client through `httpStatusOf` and logs the user out
   - Persisted collections (step 5): `Participants` off `extends Array` with a `Mapper`; `Reminders`, `Exdates`
   - `Entries` and `Sources` on the client (step 6): the duplicated "closed" checks, color fallbacks and entry factories
   - The delete warning over `ownedBy('mitra')`
5. **Cleanups**
   - Clearable controls emit `undefined` for none, so handlers drop `?? undefined` (23 left)
   - Imports: 252 lines climb three or more levels; find a calmer shape (path aliases, a feature entry point)

## Bugs
- A floating entry shows as an instant: a floating 19:00 (stored as 19:00 UTC) reads 21:00 in Berlin in summer and 20:00 in winter.
- The editor's zone row is labelled with today's DST name, not the entry's (a 28 October date says GMT+2); the week axis does the same, which may be a choice.
- Reported, unconfirmed: Google via CalDAV failing with "cannot find principalUrl"; you're asking the reporter which integration it was.

## Later
- One value object for the recurrence set (rule, exclusions, later RDATE) on the entry; overrides stay entries owned by it.
- Plan A: a "this" edit writes a `RECURRENCE-ID` override instead of detaching (the store already edits through overrides), then routines pool by recurring entry instead of heading.
- RDATE is neither read nor expanded; an override living only inside a resource's .ics is not applied.
- An MCP `list_entries` returns occurrences as entries (key, `recurringEntryId`, `recurrenceId`), as Google's `singleEvents` does.
- **Mixed ownership**: let Mitra own a field a provider can't hold (reminders on Notion) by declaring it `'mitra'`; sync engines and editor follow; warn before deleting an integration that owns some. Retires the "Authority" rule in AGENTS.md.
- **Recurring entries in wider windows**: filter them in SQL by start and `UNTIL` if loading them whole grows.
- **The hosted demo** seeds in the server's zone (UTC in a container), so a visitor elsewhere sees its hours shifted: floating entries, or the visitor's zone sent with the language.
