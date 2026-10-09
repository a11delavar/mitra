---
title: Controlli di stato
description: L'endpoint che dice a orchestratori, bilanciatori di carico e monitor di uptime se Mitra sta rispondendo, e il controllo di stato di Docker costruito su di esso.
---

Mitra risponde a una sola domanda per tutto ciò che lo controlla: questa istanza sta rispondendo? Chiedilo a questo indirizzo, che non richiede l'accesso:

```text
GET /api/health
```

Controlla l'unica cosa senza cui Mitra non può funzionare, il suo database:

| Risposta | Significato |
| --- | --- |
| `200` `{"status":"ok"}` | In servizio. Il database risponde. |
| `503` `{"status":"error"}` | Non in servizio. Il database non ha risposto, o ci ha messo troppo. |

La risposta è volutamente scarna. Non porta dettagli su versione o build che direbbero a un estraneo cosa stai usando, e non viene mai messa in cache, così ogni controllo vede lo stato attuale.

I servizi collegati, come un server CalDAV, Notion, Google, il tuo provider di accesso o il geocoder, non fanno parte del controllo. Un breve disservizio di uno di loro non deve far risultare Mitra stesso come non in salute.

## Docker

L'immagine ha già un controllo di stato Docker che usa questo endpoint, quindi `docker ps` e `docker inspect` mostrano lo stato reale di Mitra senza nulla da configurare. Un nuovo container mostra `starting`, poi `healthy` quando il database è attivo. Segue [`MITRA_PORT`](configuration.md) se l'hai cambiata.

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

Punta sia la probe di liveness sia quella di readiness all'endpoint:

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

## Monitor di uptime

Qualsiasi monitor HTTP, come Uptime Kuma, Healthchecks.io o il controllo di un bilanciatore di carico, può interrogare `/api/health` e considerare non attivo qualsiasi cosa diversa da `200`. Funziona allo stesso modo con e senza [accesso](sso.md).
