---
title: Sauvegardes
description: Tout ce que Mitra stocke se trouve dans un seul dossier. Sauvegardez-le avec l'outil que vous utilisez déjà.
---

Mitra garde tout dans un seul dossier : `/app/data` dans le conteneur, soit `~/mitra` sur l'hôte si vous avez suivi les [Premiers pas](README.md#install-mitra). Sauvegardez ce dossier et vous avez sauvegardé toute l'instance. Il n'y a ni serveur de base de données à exporter, ni fichiers de configuration à repérer.

> [!CAUTION]
> Pour une partie de ce que vous conservez dans Mitra, ce dossier est la seule copie. Chaque entrée d'un [calendrier Mitra](integrations/mitra.md) y vit, et nulle part ailleurs. Il en va de même pour vos comptes et vos sessions de connexion, les identifiants des comptes connectés, vos paramètres, les couleurs, l'ordre et les noms de vos calendriers, vos [disponibilités](availability.md), l'ordre de vos tâches, certains liens entre entrées et la clé dont dépendent les [rappels](reminders.md) de vos appareils. Si vous perdez ce dossier, un fournisseur peut vous rendre ses événements et ses tâches, mais rien d'autre.

## Sauvegarder

Pointez l'outil que vous utilisez déjà vers ce dossier : [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, un instantané du système de fichiers ou de la machine virtuelle, ou une simple archive.

La copie la plus sûre est celle faite pendant que Mitra est arrêté :

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

Si vous ne pouvez pas l'arrêter, copier le dossier pendant que Mitra tourne fonctionne en général très bien, car SQLite s'en accommode. Un instantané du système de fichiers ou de la machine virtuelle donne une copie cohérente sans rien arrêter.

## Restaurer

Arrêtez Mitra, remettez le dossier en place, puis redémarrez-le :

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

Restaurez le dossier dans son ensemble. Ses fichiers vont ensemble, et mélanger des fichiers de jours différents peut abîmer l'instance. Une sauvegarde d'une version plus ancienne se restaure sans problème sur une image plus récente, car Mitra met à jour sa base de données au démarrage.

## Ce qu'une sauvegarde ne couvre pas

Les événements et les tâches des comptes connectés, comme un serveur [CalDAV](integrations/caldav.md), [Google Calendar](integrations/google.md) ou [Notion](integrations/notion.md), restent chez ces fournisseurs. Une sauvegarde inclut la copie qu'en garde Mitra, et après une restauration Mitra les synchronise de nouveau.

Vos variables d'environnement se trouvent dans votre fichier `compose.yaml` ou `.env`, pas dans le dossier de données. Gardez-les aussi en lieu sûr, dans un gestionnaire de versions ou dans votre coffre à secrets.
