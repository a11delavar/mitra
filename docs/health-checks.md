---
title: Health checks
description: The endpoint that tells orchestrators, load balancers and uptime monitors whether Mitra is serving, and the Docker health check built on it.
---

Mitra answers one question for anything that watches it: is this instance serving? Ask it at this address, which needs no sign-in:

```text
GET /api/health
```

It checks the one thing Mitra can't run without, its database:

| Response | Meaning |
| --- | --- |
| `200` `{"status":"ok"}` | Serving. The database answers. |
| `503` `{"status":"error"}` | Not serving. The database didn't answer, or took too long. |

The answer is deliberately bare. It carries no version or build details that would tell a stranger what you run, and it's never cached, so every check sees the current state.

Connected services, such as a CalDAV server, Notion, Google, your sign-in provider or the geocoder, aren't part of the check. A short outage at one of them shouldn't mark Mitra itself as unhealthy.

## Docker

The image already has a Docker health check that uses this endpoint, so `docker ps` and `docker inspect` show Mitra's real health with nothing to set up. A new container shows `starting`, then `healthy` once the database is up. It follows [`MITRA_PORT`](configuration.md) if you changed it.

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

Point both the liveness and the readiness probe at the endpoint:

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  periodSeconds: 10
```

## Uptime monitors

Any HTTP monitor, such as Uptime Kuma, Healthchecks.io or a load balancer's own check, can poll `/api/health` and treat anything but `200` as down. It works the same with and without [sign-in](sso.md).
