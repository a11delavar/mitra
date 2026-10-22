---
title: Kontrola stanu
description: Punkt końcowy, który informuje orkiestratory, load balancery i monitory dostępności, czy Mitra działa, oraz oparty na nim health check Dockera.
---

Mitra odpowiada na jedno pytanie każdemu, kto ją monitoruje: czy ta instancja działa? Zadaj je pod tym adresem, który nie wymaga logowania:

```text
GET /api/health
```

Sprawdzana jest jedyna rzecz, bez której Mitra nie może działać, czyli baza danych:

| Odpowiedź | Znaczenie |
| --- | --- |
| `200` `{"status":"ok"}` | Działa. Baza danych odpowiada. |
| `503` `{"status":"error"}` | Nie działa. Baza danych nie odpowiedziała albo odpowiadała zbyt długo. |

Odpowiedź jest celowo skąpa. Nie zawiera wersji ani szczegółów kompilacji, które zdradziłyby obcym, czego używasz, i nigdy nie trafia do pamięci podręcznej, więc każde sprawdzenie widzi bieżący stan.

Połączone usługi, takie jak serwer CalDAV, Notion, Google, dostawca logowania czy geokoder, nie są brane pod uwagę. Krótka awaria jednej z nich nie powinna oznaczać samej aplikacji Mitra jako niesprawnej.

## Docker

Obraz ma już wbudowany health check Dockera, który korzysta z tego punktu końcowego, więc `docker ps` i `docker inspect` pokazują rzeczywisty stan aplikacji Mitra bez żadnej konfiguracji. Nowy kontener ma najpierw stan `starting`, a gdy baza danych zacznie działać, stan `healthy`. Jeśli zmienisz [`MITRA_PORT`](configuration.md), health check to uwzględni.

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

Skieruj na ten punkt końcowy zarówno sondę liveness, jak i sondę readiness:

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

## Monitory dostępności

Dowolny monitor HTTP, na przykład Uptime Kuma, Healthchecks.io albo wbudowane sprawdzanie load balancera, może odpytywać `/api/health` i traktować każdą odpowiedź inną niż `200` jako awarię. Działa to tak samo z [logowaniem](sso.md) i bez niego.
