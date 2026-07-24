---
title: Backups
description: Everything a Mitra instance owns lives in one directory — back that up with whatever tool you already trust.
sidebar:
  order: 7
---

Mitra keeps its entire state in **one directory**: `/app/data` inside the container — the `~/mitra` folder on the host with the recommended compose file. Back up that directory and you've backed up the whole instance. There's no external database to dump, no separate config store, and no individual files to cherry-pick: **the data directory is the backup unit**, whole and opaque.

## Backing up

Use whatever backup tool you already trust — [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, a filesystem or VM snapshot, or a plain archive — and point it at the data directory. Mitra doesn't care how the copy is made.

For a guaranteed-consistent snapshot, stop the container around the copy:

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

If a brief stop is impractical, a hot copy is usually fine — the database is SQLite, which tolerates being copied in place well — but stopping the container is the safe default, and snapshot-based tools (filesystem or VM snapshots) give you consistency without downtime.

## Restoring

Stop the container, restore the directory from your backup, start it again:

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

Restore the directory **as a whole** — its contents belong together, and mixing files from different points in time can leave the instance in an inconsistent state. On boot, Mitra reconciles its database schema automatically, so a backup taken on an older version restores cleanly onto a newer image.

## What a backup does *not* cover

- **Provider-side data.** Events and tasks that live in [CalDAV](../integrations/caldav.md), [Google](../integrations/google-calendar.md), or [Notion](../integrations/notion.md) are held at their origins — reconnecting those integrations re-syncs them. A Mitra restore doesn't need to (and can't) recreate provider accounts.
- **Deployment configuration.** Your `MITRA_*` settings live in your `compose.yaml` / `.env`, not in the data directory. Keep those under version control or your own secret store alongside the data backup.
