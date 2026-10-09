---
title: Journalisation
description: Choisissez la quantité de journaux de Mitra avec MITRA_LOG_LEVEL, et quel niveau aide pour quel problème.
---

Mitra écrit ses journaux sur la sortie standard : `docker compose logs` montre donc tout :

```bash
docker compose logs -f mitra
```

Un serveur en bonne santé est silencieux à dessein : par défaut, il ne journalise que ce qui compte. Montez le niveau pendant que vous cherchez la cause d'un problème, puis redescendez-le une fois terminé.

## Définir le niveau

```yaml
environment:
  MITRA_LOG_LEVEL: 'debug'
```

Chaque niveau inclut tout ce qui est plus silencieux que lui :

| `MITRA_LOG_LEVEL` | Ce que vous obtenez |
| --- | --- |
| `error` | Uniquement les échecs. |
| `warn` | Aussi les problèmes que Mitra a contournés, comme un rappel qui n'a pas pu être remis, un géocodeur qui n'a pas répondu ou un fournisseur de connexion injoignable. |
| `info` *(par défaut)* | Aussi ce qui compte au quotidien : le démarrage, les connexions, les comptes connectés, les changements synchronisés depuis les fournisseurs et les rappels envoyés. |
| `debug` | Aussi chaque requête avec son statut et sa durée, chaque synchronisation, les moments où la synchronisation s'accélère ou ralentit selon que l'on ouvre ou ferme Mitra, les sessions, les modifications d'entrées et les échanges avec les serveurs CalDAV. |
| `trace` | Aussi chaque requête de base de données et les données brutes du calendrier. Il y en a beaucoup. |

Mitra journalise le niveau auquel il tourne lorsqu'il démarre.

> [!NOTE]
> Les mots de passe, les jetons et les autres secrets ne sont jamais journalisés, quel que soit le niveau. `debug` et `trace` peuvent toutefois afficher des titres d'entrées et des données de calendrier : relisez un journal avant de le partager.

## Quel niveau utiliser

- Quand un calendrier ne se synchronise pas, `debug` montre chaque synchronisation et les requêtes vers CalDAV et Notion.
- Quand les rappels n'arrivent pas, `info` journalise déjà chaque rappel au moment de son envoi, et `debug` ajoute chaque tentative de remise et les appareils qui ont été retirés.
- Quand vous voyez une page d'erreur, `error` la contient avec sa trace d'appels, et le niveau `info` par défaut l'inclut.
- Quand vous avez besoin de voir exactement ce qu'un fournisseur a envoyé, `trace` ajoute les données brutes et les requêtes de base de données. Ne le laissez activé que brièvement.
