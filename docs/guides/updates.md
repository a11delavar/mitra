---
title: Updates
description: How Mitra's update indicator works, what it sends to GitHub, and how to disable the check entirely.
sidebar:
  order: 5
---

Mitra tells you when a newer build than the one you're running exists — but it only **indicates**. Pulling the new image stays your deployment's job (see [Updating](../getting-started/installation.md#updating)).

## The update indicator

When something newer exists, a small dot appears on the logo mark, and the **About** dialog links to it:

- On a tagged **release** (`:latest`, `:1`, `:1.4`, …) it points to the newest release.
- On the rolling **`:dev`** image it points to main's newest commits and shows how far ahead they are.

Clicking the instance name anywhere opens the About dialog, where the running version, its commit, and any available update are shown.

## What it sends

The **server** — never the browser — asks github.com a few times a day whether something newer exists. The request carries **nothing about your instance** beyond the request itself: your IP and the running version in the user agent. No telemetry, no identifiers, no counts.

Air-gapped instances that simply can't reach GitHub stay quiet on their own — one log line notes it can't reach GitHub, then it retries silently.

## Disabling the check

Set `MITRA_UPDATE_CHECK` to turn it off entirely:

```yaml
environment:
  MITRA_UPDATE_CHECK: 'off'
```

Accepted "off" values are `off`, `false`, `0`, and `no`. Anything else (or leaving it unset) keeps checks enabled.

## Keeping up to date

The indicator doesn't update Mitra for you — that's intentional. To actually update:

```bash
docker compose pull
docker compose up -d
```

Or automate it with a tool like [Watchtower](https://containrrr.dev/watchtower/). Choose an [image tag](../getting-started/installation.md#choosing-an-image-tag) that matches how eagerly you want to move.
