---
title: Backups
description: Everything Mitra stores is in one folder. Back it up with whatever tool you already use.
---

Mitra keeps everything in one folder: `/app/data` inside the container, which is `~/mitra` on the host if you followed [Getting started](README.md#install-mitra). Back up that folder and you've backed up the whole instance. There's no database server to dump and no config files to pick out.

> [!CAUTION]
> For some of what you keep in Mitra, this folder is the only copy. Every entry in a [Mitra calendar](integrations/mitra.md) lives here and nowhere else. So do your accounts and sign-in sessions, the credentials of connected accounts, your settings, your calendars' colors, order and names, your [availability](availability.md), your task order, some links between entries, and the key your devices' [reminders](reminders.md) depend on. If you lose the folder, a provider can give you back its events and tasks, but nothing else.

## Back up

Point whatever you already use at the folder: [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, a filesystem or VM snapshot, or a plain archive.

The safest copy is one taken while Mitra is stopped:

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

If you can't stop it, copying the folder while Mitra runs is usually fine, as SQLite copes well with it. A filesystem or VM snapshot gives you a consistent copy without stopping anything.

## Restore

Stop Mitra, put the folder back, and start it again:

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

Restore the folder as a whole. Its files belong together, and mixing files from different days can break the instance. A backup from an older version restores fine onto a newer image, since Mitra updates its database when it starts.

## What a backup doesn't cover

Events and tasks in connected accounts, such as a [CalDAV](integrations/caldav.md) server, [Google Calendar](integrations/google.md) or [Notion](integrations/notion.md), live with those providers. A backup includes Mitra's copy of them, and after a restore Mitra syncs them again.

Your environment variables live in your `compose.yaml` or `.env` file, not in the data folder. Keep those safe as well, in version control or your secret store.
