---
title: Calendriers Mitra
description: Des calendriers stockés dans Mitra même, sur votre serveur, sans aucun compte derrière.
---

Un calendrier Mitra est stocké dans la base de données de Mitra au lieu de l'être chez un fournisseur. Il n'y a pas de compte à connecter ni rien à synchroniser : vous créez un calendrier et vous y ajoutez des entrées. C'est la façon la plus simple de commencer avec Mitra, et un bon endroit pour tout ce qui n'a pas sa place dans l'un de vos comptes existants.

Les calendriers Mitra vivent sur votre serveur, pas sur votre appareil : ils sont donc là où que vous ouvriez Mitra. Ils peuvent tout contenir de ce que Mitra sait faire : événements et tâches, répétitions, rappels, [disponibilité](../availability.md), [sous-tâches](../subtasks.md), [dépendances](../dependencies.md), dates d'échéance et estimations.

## Ajouter des calendriers Mitra

1. Choisissez **Ajouter une intégration** au bas de la barre latérale, puis **Mitra**.
2. Donnez un nom à votre premier calendrier.
3. Appuyez sur **Enregistrer**.

Le calendrier est prêt tout de suite. Vous n'ajoutez l'intégration qu'une seule fois : elle contient autant de calendriers que vous voulez, et sa vignette disparaît donc ensuite de **Ajouter une intégration**.

Pour ajouter un autre calendrier, ouvrez le menu **⋯** sur le titre Mitra dans la barre latérale et choisissez **Nouveau calendrier**. Pour en supprimer un, choisissez **Supprimer le calendrier** dans le menu **⋯** de ce calendrier. Renommer, recolorer, réordonner et masquer fonctionnent comme pour n'importe quel calendrier ; voir [Calendriers](../calendars.md).

> [!CAUTION]
> Supprimer un calendrier Mitra supprime définitivement toutes ses entrées, puisqu'il n'y a pas de fournisseur où aller les rechercher. Mitra demande d'abord confirmation, et propose de [déplacer les entrées](../calendars.md#move-or-copy-every-entry-to-another-calendar) vers un autre calendrier avant de supprimer quoi que ce soit.

## Déplacer des entrées vers et depuis Mitra

Les entrées passent d'un calendrier Mitra à n'importe quel autre calendrier. Pour en déplacer une, choisissez un autre calendrier dans son éditeur. Pour déplacer un calendrier entier, utilisez **⋯ → Déplacer les entrées vers…**, qui montre d'abord ce que la destination ne peut pas stocker.

Cela marche aussi dans l'autre sens : vous pouvez commencer dans Mitra et tout déplacer plus tard vers un calendrier CalDAV ou Google.

## Les sauvegarder

Un compte connecté garde sa propre copie de vos entrées. Un calendrier Mitra, non : ses entrées n'existent que dans la base de données de Mitra. Veillez à ce que le dossier de données de Mitra fasse partie de vos [sauvegardes](../backups.md).

Si vous prévoyez d'activer plus tard la [connexion](../sso.md), sachez qu'elle fait repartir tout le monde avec un compte neuf et vide. Les calendriers Mitra créés avant restent attachés à l'ancien compte monoutilisateur.

## Ce qu'ils ne savent pas faire

- Les participants sont conservés comme simple trace des personnes concernées, mais personne ne reçoit d'invitation et aucune réponse n'arrive, faute de serveur de calendrier pour les envoyer. Si vous déplacez ici une réunion depuis un calendrier CalDAV, l'original y est supprimé, et certains serveurs préviennent alors ses participants qu'elle est annulée. Copiez-la plutôt si ces personnes ne doivent pas en être informées.
- Les autres applications ne les voient pas. Mitra ne publie pas ses calendriers via CalDAV : utilisez donc un serveur [CalDAV](caldav.md) pour les calendriers que vous voulez aussi dans l'application de calendrier de votre téléphone.
- Il n'y a rien à réimporter, donc **Réimporter les entrées** n'est pas proposé.
