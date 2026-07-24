---
title: Health checks
description: Mitra's unauthenticated health endpoint for orchestrators, load balancers, and uptime monitors — plus the built-in Docker health check.
sidebar:
  order: 6
---

Mitra exposes a single, unauthenticated health endpoint for orchestrators, load balancers, and uptime monitors to ask "is this instance serving?".

## The endpoint

```text
GET /api/health
```

It checks the one thing the app can't run without — the **database** — and answers:

| Response | Meaning |
| --- | --- |
| `200` `{"status":"ok"}` | Serving — the database is reachable. |
| `503` `{"status":"error"}` | Not serving — the database is unreachable (or the check timed out). |

The reply is deliberately **bare**: no version, build, or dependency details that would help an unauthorized caller fingerprint your deployment. It sends `Cache-Control: no-store`, so probes always hit live state. Per-user integrations (CalDAV, Notion, Google, the OIDC provider, Photon) are intentionally **not** part of the check — a transient outage there must not flap the container's health.

## Built-in Docker health check

The image already ships a Docker `HEALTHCHECK` pointed at this endpoint, so `docker ps` and `docker inspect` report real health with **nothing to configure**. A fresh container shows `starting`, then `healthy` once the database is up. It honors [`MITRA_PORT`](../reference/environment-variables.md) automatically.

Watch it directly:

```bash
curl -f http://localhost:3000/api/health   # exits non-zero unless the instance is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

Point **both** a liveness and a readiness probe at the endpoint:

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

Any HTTP monitor (Uptime Kuma, Healthchecks.io, a load balancer's health check, …) can poll `GET /api/health` and treat a non-`200` as down. Because the endpoint is unauthenticated and cache-free, it works the same in single-user and multi-user deployments.
