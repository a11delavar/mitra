---
title: Logging
description: Tune Mitra's log verbosity with MITRA_LOG_LEVEL to diagnose problems — and understand what each level shows.
sidebar:
  order: 4
---

Mitra logs to **stdout**, so `docker logs` / `docker compose logs` shows everything. A healthy server is **quiet by design** — at the default level it prints only lifecycle milestones. Turn the verbosity up when you need to diagnose something.

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
| `info` *(default)* | …plus lifecycle milestones — the healthy-server heartbeat (boot, sign-ins, connected integrations, remote changes pulled, reminders firing). |
| `debug` | …plus **every request** (`method /path → status (ms)`), each sync tick, session events, entry edits, and CalDAV round-trips. |
| `trace` | …plus the firehose: SQL and raw `.ics` payloads. |

At boot, Mitra prints the active level so you know what you're looking at.

> [!NOTE]
> **Secrets are never logged, at any level** — passwords, tokens, and PKCE verifiers are always kept out of the output. `debug` and `trace` are safe to share for troubleshooting in that respect, though they may reveal entry titles, paths, and calendar data.

## Which level to use

- **Something isn't syncing?** `debug` shows each sync tick and the CalDAV/Notion round-trips.
- **Reminders not arriving?** `info` already logs each reminder as it fires; `debug` shows the delivery attempts and any pruned subscriptions.
- **A 500 error?** `error` logs it with a stack trace; the default `info` includes `error` already.
- **Deep protocol debugging?** `trace` dumps SQL and the raw `.ics` payloads — verbose, use briefly.

Return to `info` (or unset the variable) once you're done — `debug`/`trace` are chatty by design.
