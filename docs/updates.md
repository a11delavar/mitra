---
title: Updates
description: How Mitra tells you about new versions, what that check sends, how to turn it off, and how to update.
---

Mitra tells you when a newer version than the one you're running exists. It never updates itself: pulling the new version is up to you.

## The update indicator

When something newer exists, a small dot appears on the logo in the sidebar. Click your instance's name to open **About**, which shows the version and commit you're running and links to what's new. **Copy** there copies the version details, which is what a bug report needs.

**What's New**, in the [command palette](shortcuts.md#command-palette), lists the changes of every version. After your server is updated, Mitra asks you to **Reload to finish updating** in any tab that was open from before.

If you run a release (`latest`, `0.6` or an exact version), it points you to the newest release. If you run the `dev` image, it points to the newest commits on `main` and tells you how far ahead they are.

## What the check sends

The server, never your browser, asks GitHub a few times a day whether there's something newer. The request carries nothing about your instance beyond what any request does: your IP address, and the running version in its user agent. No telemetry, no identifiers, no counts.

If the server can't reach GitHub, it logs that once and keeps quiet afterwards.

To turn the check off entirely, set `MITRA_UPDATE_CHECK` to `off` (`false`, `0` and `no` work too):

```yaml
environment:
  MITRA_UPDATE_CHECK: 'off'
```

## Choose an image tag

The tag decides how eagerly you move to new versions.

| Tag | What you get |
| --- | --- |
| `latest` | The newest release. |
| `0.6` | The newest `0.6.x` release: fixes, but no new minor version. |
| `0.6.0` | Exactly that version. |
| `dev` | The latest commit on `main`, for trying things before they're released. |

Until 1.0, a new minor version (0.6 to 0.7) can change things you rely on. If you'd rather choose when that happens, use `0.6` and move on when you're ready. All tags are listed on [GitHub](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Update Mitra

Pull the new image and recreate the container:

```bash
docker compose pull
docker compose up -d
```

Your data is in the mounted folder, so it survives. If the new version changes the database, Mitra updates it when it starts, and you never have to touch it yourself. Tools like [Watchtower](https://containrrr.dev/watchtower/) can do this for you on a schedule.

Which version you get depends on your [image tag](#choose-an-image-tag). Before you move to a new minor version, it's worth reading the [release notes](https://github.com/a11delavar/mitra/releases).
