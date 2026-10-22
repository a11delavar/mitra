---
title: Statuscontroles
description: Het endpoint dat orchestrators, load balancers en uptimemonitors vertelt of Mitra bereikbaar is, en de Docker-healthcheck die daarop is gebouwd.
---

Mitra beantwoordt één vraag voor alles wat het in de gaten houdt: werkt deze instantie? Stel die vraag op dit adres, waarvoor je niet hoeft in te loggen:

```text
GET /api/health
```

Het controleert het enige waar Mitra niet zonder kan: de database.

| Antwoord | Betekenis |
| --- | --- |
| `200` `{"status":"ok"}` | Werkt. De database antwoordt. |
| `503` `{"status":"error"}` | Werkt niet. De database antwoordde niet, of deed er te lang over. |

Het antwoord is bewust kaal. Er staat geen versie of buildinformatie in die een buitenstaander zou vertellen wat je draait, en het wordt nooit in de cache bewaard, dus elke controle ziet de actuele toestand.

Verbonden diensten, zoals een CalDAV-server, Notion, Google, je inlogprovider of de geocoder, tellen niet mee in de controle. Een korte storing bij een van hen mag Mitra zelf niet als ongezond markeren.

## Docker

De image heeft al een Docker-healthcheck die dit endpoint gebruikt, dus `docker ps` en `docker inspect` tonen zonder verdere instellingen de echte status van Mitra. Een nieuwe container staat eerst op `starting` en daarna op `healthy` zodra de database beschikbaar is. De healthcheck volgt [`MITRA_PORT`](configuration.md) als je die hebt gewijzigd.

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

Richt zowel de liveness- als de readinessprobe op het endpoint:

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

## Uptimemonitors

Elke HTTP-monitor, zoals Uptime Kuma, Healthchecks.io of de eigen controle van een load balancer, kan `/api/health` opvragen en alles behalve `200` als storing behandelen. Dat werkt hetzelfde met en zonder [inloggen](sso.md).
