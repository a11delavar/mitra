---
title: Vérifications de santé
description: Le point d'accès qui indique aux orchestrateurs, aux répartiteurs de charge et aux moniteurs de disponibilité si Mitra répond, et la vérification de santé Docker qui s'appuie dessus.
---

Mitra répond à une seule question pour tout ce qui le surveille : cette instance est-elle en service ? Posez-la à cette adresse, qui ne demande aucune connexion :

```text
GET /api/health
```

Il vérifie la seule chose sans laquelle Mitra ne peut pas fonctionner, sa base de données :

| Réponse | Signification |
| --- | --- |
| `200` `{"status":"ok"}` | En service. La base de données répond. |
| `503` `{"status":"error"}` | Hors service. La base de données n'a pas répondu, ou a mis trop de temps. |

La réponse est volontairement minimale. Elle ne contient ni version ni détail de build qui renseigneraient un inconnu sur ce que vous faites tourner, et elle n'est jamais mise en cache, de sorte que chaque vérification voit l'état actuel.

Les services connectés, comme un serveur CalDAV, Notion, Google, votre fournisseur de connexion ou le géocodeur, ne font pas partie de la vérification. Une brève panne chez l'un d'eux ne doit pas faire passer Mitra lui-même pour défaillant.

## Docker

L'image contient déjà une vérification de santé Docker qui utilise ce point d'accès : `docker ps` et `docker inspect` affichent donc la vraie santé de Mitra sans rien configurer. Un nouveau conteneur affiche `starting`, puis `healthy` dès que la base de données est prête. Elle suit [`MITRA_PORT`](configuration.md) si vous l'avez modifié.

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

Dirigez les deux sondes, de vivacité et de disponibilité, vers ce point d'accès :

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

## Moniteurs de disponibilité

N'importe quel moniteur HTTP, comme Uptime Kuma, Healthchecks.io ou la vérification propre à un répartiteur de charge, peut interroger `/api/health` et considérer toute réponse autre que `200` comme une panne. Cela fonctionne de la même façon avec et sans [connexion](sso.md).
