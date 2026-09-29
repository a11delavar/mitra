---
title: Logging
description: Set how much Mitra logs with MITRA_LOG_LEVEL, and what each level shows.
---

Mitra logs to **stdout**, so `docker logs` / `docker compose logs` shows everything. A healthy server is **quiet on purpose**: at the default level it only logs important events. Turn the level up when you need to track something down.

```bash
docker compose logs -f mitra
```

## Setting the level

Set `MITRA_LOG_LEVEL` in your environment:

```yaml
environment:
  MITRA_LOG_LEVEL: 'debug'
```

Each level includes everything quieter than it:

| `MITRA_LOG_LEVEL` | What you get |
| --- | --- |
| `error` | Failures only. |
| `warn` | …plus handled degradations (an undelivered push, a geocoder timeout, a failed OIDC discovery). |
| `info` *(default)* | The above, plus important events: startup, sign-ins, connected integrations, changes pulled from providers and reminders sent. |
| `debug` | …plus **every request** (`method /path → status (ms)`), each sync tick, sync pace transitions (a client connecting or disconnecting switches that user's polling between fast and relaxed), session events, entry edits, and CalDAV round-trips. |
| `trace` | …plus the firehose: SQL and raw `.ics` payloads. |

At boot, Mitra prints the active level so you know what you're looking at.

> [!NOTE]
> **Secrets are never logged, at any level.** Passwords, tokens and PKCE verifiers are always kept out of the output. `debug` and `trace` are safe to share for troubleshooting in that respect, though they may reveal entry titles, paths, and calendar data.

## Which level to use

- **Something isn't syncing?** `debug` shows each sync tick, when polling switches between its fast (app open) and relaxed (nobody connected) pace, and the CalDAV/Notion round-trips.
- **Reminders not arriving?** `info` already logs each reminder as it fires; `debug` shows the delivery attempts and any pruned subscriptions.
- **A 500 error?** `error` logs it with a stack trace; the default `info` includes `error` already.
- **Debugging a protocol problem?** `trace` also logs the SQL and the raw `.ics` data. It is very verbose, so only use it briefly.

Go back to `info` (or unset the variable) when you're done, since `debug` and `trace` log a lot.
