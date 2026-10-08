---
title: Mises à jour
description: Comment Mitra vous prévient des nouvelles versions, ce que cette vérification envoie, comment la désactiver et comment mettre à jour.
---

Mitra vous prévient lorsqu'une version plus récente que la vôtre existe. Il ne se met jamais à jour tout seul : récupérer la nouvelle version, c'est à vous de le faire.

## L'indicateur de mise à jour

Quand une version plus récente existe, un petit point apparaît sur le logo dans la barre latérale. Cliquez sur le nom de votre instance pour ouvrir **À propos**, qui indique la version et le commit que vous utilisez et renvoie vers les nouveautés. **Copier** y copie les détails de la version, ce dont un rapport de bug a besoin.

**Nouveautés**, dans la [palette de commandes](shortcuts.md#command-palette), liste les changements de chaque version. Une fois votre serveur mis à jour, Mitra vous demande de **Recharger pour terminer la mise à jour** dans tout onglet resté ouvert depuis avant.

Si vous utilisez une version publiée (`latest`, `0.6` ou une version exacte), l'indicateur vous oriente vers la dernière version. Si vous utilisez l'image `dev`, il vous oriente vers les derniers commits de `main` et vous indique de combien ils sont en avance.

## Ce que la vérification envoie

C'est le serveur, jamais votre navigateur, qui demande à GitHub quelques fois par jour s'il existe quelque chose de plus récent. La requête ne contient rien sur votre instance au-delà de ce que contient n'importe quelle requête : votre adresse IP, et la version en cours dans son user agent. Pas de télémétrie, pas d'identifiants, pas de comptages.

Si le serveur ne parvient pas à joindre GitHub, il le consigne une seule fois puis se tait.

Pour désactiver complètement la vérification, définissez `MITRA_UPDATE_CHECK` sur `off` (`false`, `0` et `no` fonctionnent aussi) :

```yaml
environment:
  MITRA_UPDATE_CHECK: 'off'
```

## Choisir une étiquette d'image

L'étiquette détermine avec quel empressement vous passez aux nouvelles versions.

| Étiquette | Ce que vous obtenez |
| --- | --- |
| `latest` | La dernière version publiée. |
| `0.6` | La dernière version `0.6.x` : des correctifs, mais pas de nouvelle version mineure. |
| `0.6.0` | Exactement cette version. |
| `dev` | Le dernier commit de `main`, pour essayer les choses avant leur publication. |

Jusqu'à la 1.0, une nouvelle version mineure (0.6 vers 0.7) peut changer des choses sur lesquelles vous comptez. Si vous préférez choisir le moment, utilisez `0.6` et passez à la suite quand vous êtes prêt. Toutes les étiquettes sont listées sur [GitHub](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Mettre à jour Mitra

Récupérez la nouvelle image et recréez le conteneur :

```bash
docker compose pull
docker compose up -d
```

Vos données se trouvent dans le dossier monté, elles survivent donc. Si la nouvelle version modifie la base de données, Mitra la met à jour au démarrage, et vous n'avez jamais à y toucher vous-même. Des outils comme [Watchtower](https://containrrr.dev/watchtower/) peuvent s'en charger pour vous à intervalles réguliers.

La version que vous obtenez dépend de votre [étiquette d'image](#choose-an-image-tag). Avant de passer à une nouvelle version mineure, mieux vaut lire les [notes de version](https://github.com/a11delavar/mitra/releases).
