---
title: Premiers pas
description: Installez Mitra avec Docker Compose, obtenez votre premier calendrier et découvrez quelques idées à essayer.
sidebar:
  label: Premiers pas
---

Mitra est un calendrier auto-hébergé pour vos événements et vos tâches. Pour jeter un œil avant de vous lancer, [essayez la démo](https://demo.mitracal.com).

## Installer Mitra

Avec [Docker](https://docs.docker.com/get-docker/) et son plugin Compose, créez un fichier `compose.yaml` :

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
```

Lancez `docker compose up -d`, puis ouvrez [http://localhost:3000](http://localhost:3000).

Avant de vous y fier, [sauvegardez](backups.md) `~/mitra` et [placez Mitra derrière HTTPS](configuration.md#put-it-behind-https). Si d'autres personnes l'utiliseront, activez d'abord la [connexion](sso.md) : l'activer plus tard fait repartir tout le monde d'un compte vide.

## Obtenir un calendrier

Mitra propose d'en ajouter un dès la première ouverture : un [calendrier Mitra](integrations/mitra.md) conservé sur votre serveur, ou un compte que vous avez déjà, comme [CalDAV](integrations/caldav.md) ou [Google Calendar](integrations/google.md).

## À essayer

- Faites glisser le pointeur sur une heure vide de la [vue semaine](views/week.md) pour créer un événement.
- Appuyez sur **Ajouter une tâche** dans l'onglet [Planification](planning.md) de la barre latérale, puis glissez la tâche dans votre semaine plus tard.
- Appuyez sur <kbd>/</kbd> et lancez **Ajouter une disponibilité** pour griser vos [heures de travail](availability.md).
- [Installez Mitra sur votre téléphone](install-app.md) pour recevoir des [rappels](reminders.md).
- Appuyez sur <kbd>?</kbd> pour voir tous les [raccourcis clavier](shortcuts.md).
