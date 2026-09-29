---
title: Installation
description: Run Mitra with Docker Compose, including image tags, the data volume, updates and running behind a reverse proxy.
---

Mitra ships as a single, small container image published to [GitHub Container Registry](https://github.com/a11delavar/mitra/pkgs/container/mitra). Everything it needs is in that one image: the web app, the API and an embedded SQLite database. There is no separate database server to run.

## Requirements

- **[Docker](https://docs.docker.com/get-docker/)** with the Compose plugin (recommended), or any container runtime.
- A **directory** to persist your data. That's it.

You can also run it from source, but you don't need to for self-hosting. See [Running without Docker](#running-without-docker).

## Quick start

Create a `compose.yaml`:

```yaml
# compose.yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
    environment:
      MITRA_URL: 'https://mitra.example.com' # the public URL users reach Mitra at
```

Start it:

```bash
docker compose up -d
```

Mitra is now serving on [http://localhost:3000](http://localhost:3000). By default it runs **single-user with no login**, which is fine when only you can reach it. To share it with other people, see [Multi-user & sign-in (OIDC)](../guides/multi-user.md).

> [!TIP]
> `MITRA_URL` is optional for a local single-user instance, but set it as soon as Mitra is reachable at a real address. [Google Calendar](../integrations/google-calendar.md) and [OIDC sign-in](../guides/multi-user.md) both use it for their redirect URIs and cookie security.

## The data directory

Everything you create lives under **`/app/data`** inside the container, in a single SQLite database:

| Path | What it holds |
| --- | --- |
| `/app/data/database.sqlite` | The whole instance: integrations, sources, entries, users, sessions, the push-notification keypair and the reminder scheduler's state. |

Mount a directory there and you've persisted the whole instance. **Back up that one directory and you've backed up everything.** See [Backups](../guides/backups.md).

## Choosing an image tag

The image is tagged so you can decide how eagerly you update:

| Tag | You get |
| --- | --- |
| `latest` | The newest **stable** release. *(Recommended.)* |
| `1` | Stay on major `1`; auto-update minor and patch releases. |
| `1.4` | Stay on `1.4.x`; auto-update patch releases only. |
| `1.4.2` | Pin an exact version. |
| `dev` | The latest commit on `main`. |

Browse the [available tags](https://github.com/a11delavar/mitra/pkgs/container/mitra) for the full list.

## Updating

Mitra only *tells you* that a newer build exists (see [Updates](../guides/updates.md)). Pulling it is up to your deployment:

```bash
docker compose pull
docker compose up -d
```

Your data lives in the directory, so pulling a new image and recreating the container keeps everything. Database schema upgrades are automatic: on boot, Mitra applies any pending migrations to your existing `database.sqlite`, so you never have to touch the database by hand. Tools like [Watchtower](https://containrrr.dev/watchtower/) can automate this if you like.

## Running behind a reverse proxy

For anything beyond a LAN, put Mitra behind a reverse proxy (such as Caddy, Traefik or nginx) that handles **HTTPS**. Several features only work over HTTPS:

- **[Reminders / web push](../guides/notifications.md)**: browsers only register service workers and allow push notifications on `https://` (or `http://localhost`).
- **[OIDC sign-in](../guides/multi-user.md)**: session cookies are marked `Secure` when `MITRA_URL` is `https://`, and most identity providers require an `https` redirect URI.
- **[Google Calendar](../integrations/google-calendar.md)**: Google requires an `https` OAuth redirect URI.

Mitra listens on plain HTTP inside the container; let the proxy handle TLS.

If you use **[Traefik](https://traefik.io/)**, you can route traffic directly via Docker labels in your `compose.yaml`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    volumes:
      - ~/mitra:/app/data
    # Attach to your Traefik network if needed:
    # networks: [web]
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mitra.rule=Host(`mitra.example.com`)"
      - "traefik.http.services.mitra.loadbalancer.server.port=3000"
    environment:
      MITRA_URL: 'https://mitra.example.com'
```

If you prefer **[Caddy](https://caddyserver.com/)**, a minimal configuration looks like this:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

Whatever proxy you use, make sure `MITRA_URL` matches the **public** address (`https://mitra.example.com`), not the container's internal one.

## Changing the port

The container listens on `3000` internally. On Docker you normally remap on the host side (`- '8080:3000'`) and leave the internal port alone. If you need to change the port the process itself listens on, for example on a bare-metal setup where `3000` is taken, set [`MITRA_PORT`](../reference/environment-variables.md). The built-in Docker health check honors it automatically.

## Running without Docker

If you'd rather run from source, you need **Node.js 26 or later**. Earlier versions are not supported. Clone the repository, then:

```bash
npm ci
npm run build
node out/server/server.mjs
```

The server creates its SQLite database under `./data` on first boot. Configure it with the same [environment variables](../reference/environment-variables.md) as the container.

> [!NOTE]
> The container image is the supported, tested deployment path. Bare-metal runs work but you're responsible for the Node runtime, the `data/` directory, and process supervision.
