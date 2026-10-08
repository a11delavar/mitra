---
title: Health-Checks
description: Der Endpunkt, der Orchestratoren, Load Balancern und Uptime-Monitoren sagt, ob Mitra läuft, und der darauf aufbauende Docker-Health-Check.
---

Mitra beantwortet für alles, was es überwacht, eine Frage: Läuft diese Instanz? Frag sie unter dieser Adresse, die keine Anmeldung braucht:

```text
GET /api/health
```

Er prüft das Eine, ohne das Mitra nicht laufen kann, seine Datenbank:

| Antwort | Bedeutung |
| --- | --- |
| `200` `{"status":"ok"}` | Läuft. Die Datenbank antwortet. |
| `503` `{"status":"error"}` | Läuft nicht. Die Datenbank hat nicht geantwortet oder zu lange gebraucht. |

Die Antwort ist bewusst karg. Sie enthält keine Versions- oder Build-Angaben, die einem Fremden verraten würden, was du betreibst, und wird nie zwischengespeichert, sodass jede Prüfung den aktuellen Zustand sieht.

Verbundene Dienste wie ein CalDAV-Server, Notion, Google, dein Anmeldeanbieter oder der Geocoder gehören nicht zur Prüfung. Ein kurzer Ausfall bei einem davon soll Mitra selbst nicht als fehlerhaft markieren.

## Docker

Das Image hat bereits einen Docker-Health-Check, der diesen Endpunkt nutzt, sodass `docker ps` und `docker inspect` Mitras tatsächlichen Zustand zeigen, ohne dass du etwas einrichten musst. Ein neuer Container zeigt `starting` und dann `healthy`, sobald die Datenbank bereit ist. Er folgt [`MITRA_PORT`](configuration.md), falls du ihn geändert hast.

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

Richte sowohl die Liveness- als auch die Readiness-Probe auf den Endpunkt:

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

## Uptime-Monitore

Jeder HTTP-Monitor, etwa Uptime Kuma, Healthchecks.io oder die Prüfung eines Load Balancers, kann `/api/health` abfragen und alles außer `200` als ausgefallen werten. Es funktioniert mit und ohne [Anmeldung](sso.md) gleich.
