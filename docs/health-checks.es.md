---
title: Comprobaciones de estado
description: El endpoint que indica a orquestadores, balanceadores de carga y monitores de disponibilidad si Mitra está sirviendo, y la comprobación de estado de Docker basada en él.
---

Mitra responde una sola pregunta a todo lo que lo vigila: ¿está esta instancia sirviendo? Pregúntalo en esta dirección, que no requiere iniciar sesión:

```text
GET /api/health
```

Comprueba lo único sin lo que Mitra no puede funcionar, su base de datos:

| Respuesta | Significado |
| --- | --- |
| `200` `{"status":"ok"}` | Sirviendo. La base de datos responde. |
| `503` `{"status":"error"}` | No está sirviendo. La base de datos no respondió o tardó demasiado. |

La respuesta es deliberadamente escueta. No lleva detalles de versión ni de compilación que le dirían a un extraño qué ejecutas, y nunca se guarda en caché, así que cada comprobación ve el estado actual.

Los servicios conectados, como un servidor CalDAV, Notion, Google, tu proveedor de inicio de sesión o el geocodificador, no forman parte de la comprobación. Una breve caída de uno de ellos no debería marcar a Mitra como no saludable.

## Docker

La imagen ya incluye una comprobación de estado de Docker que usa este endpoint, así que `docker ps` y `docker inspect` muestran el estado real de Mitra sin configurar nada. Un contenedor nuevo muestra `starting` y luego `healthy` cuando la base de datos está lista. Sigue a [`MITRA_PORT`](configuration.md) si lo cambiaste.

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

Apunta tanto la sonda de vida (liveness) como la de preparación (readiness) al endpoint:

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

## Monitores de disponibilidad

Cualquier monitor HTTP, como Uptime Kuma, Healthchecks.io o la comprobación propia de un balanceador de carga, puede consultar `/api/health` y considerar caído cualquier resultado que no sea `200`. Funciona igual con y sin [inicio de sesión](sso.md).
