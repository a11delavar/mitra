---
title: Todoist
description: Faites entrer vos projets Todoist dans Mitra sous forme de calendriers de tâches synchronisés dans les deux sens.
---

Mitra se connecte à Todoist pour les tâches. Chacun de vos projets Todoist devient dans Mitra un calendrier qui contient ses tâches. Le titre, la description, les dates et l'achèvement d'une tâche sont synchronisés dans les deux sens.

Vous vous connectez depuis l'application avec votre jeton d'API. Il n'y a rien à configurer sur le serveur.

## Connecter un compte

1. Dans Todoist, ouvrez **Paramètres** → **Intégrations** → **Développeur** et copiez votre jeton d'API.
2. Dans Mitra, choisissez **Ajouter une intégration** au bas de la barre latérale, puis **Todoist**, et collez le jeton dans **Jeton d'API Todoist**.
3. Appuyez sur **Connecter**. Mitra liste vos projets, chacun avec sa couleur de Todoist. Un projet placé dans un autre porte le nom des deux, comme « Travail · Lancement ».
4. Choisissez les projets que vous voulez, puis appuyez sur **Enregistrer**.

Vous pouvez connecter plusieurs comptes Todoist. Les projets archivés ne sont pas listés.

## Ce qui est synchronisé

Le titre, la description et l'achèvement sont synchronisés dans les deux sens, tout comme les dates :

| Dans Todoist | Dans Mitra |
| --- | --- |
| Date | La planification de la tâche : un jour ou une heure |
| Durée | Le temps pour lequel la tâche est planifiée, ou son [estimation](../planning.md#set-an-estimate) tant qu'elle n'a pas de date |
| Échéance | Sa [date d'échéance](../planning.md#set-a-due-date) |
| Sous-tâche | Une [sous-tâche](../subtasks.md) |

Une tâche sans date attend dans la liste **Non planifié** de l'[onglet Planification](../planning.md#the-planning-tab). Les tâches que vous avez terminées ces douze dernières semaines arrivent à la connexion, puis chaque achèvement par la suite.

Todoist garde une heure soit flottante, la même sur toutes les horloges où que vous soyez, soit fixée dans un fuseau horaire. Mitra garde les deux telles quelles : une heure flottante reste [la même partout](../time-zones.md#same-time-everywhere), et une heure fixe garde son fuseau.

Les échéances et les durées font partie des forfaits Pro et Business de Todoist. Avec un compte gratuit, les tâches Todoist n'ont ni date d'échéance, ni fin, ni estimation dans Mitra : une tâche avec une heure est un instant, et une tâche sur un jour n'occupe que ce jour. Quand votre forfait change, par exemple quand une période d'essai commence ou se termine, Mitra relit toutes les tâches. Une échéance est un jour : une date d'échéance à laquelle vous donnez une heure dans Mitra ne garde que son jour.

Mitra n'affiche pas la priorité, les étiquettes, la section, les commentaires ni les rappels d'une tâche, et les laisse tels quels dans Todoist. Déplacer une tâche vers un autre calendrier Todoist la déplace dans ce projet, en les gardant tous.

Pour ouvrir une tâche dans Todoist, choisissez **Ouvrir dans Todoist** dans le menu **⋯** de l'éditeur. Supprimer une tâche dans Mitra la supprime dans Todoist.

Todoist limite la fréquence à laquelle les applications peuvent l'appeler : Mitra le synchronise donc environ une fois par minute (voir [comment fonctionne la synchronisation](README.md#how-syncing-works)).

## Tâches récurrentes

Une tâche récurrente dans Todoist apparaît à sa prochaine date, comme Todoist la garde, sans sa règle. La terminer dans Mitra la termine dans Todoist, qui la fait passer à la date suivante, comme toujours. La déplacer à un autre jour ne change que sa prochaine date, et sa règle reste telle quelle. Pour changer la règle elle-même, modifiez la tâche dans Todoist.

## Ce qui reste dans Mitra

Todoist n'a pas de dépendances : les [dépendances](../dependencies.md) entre tâches Todoist ne sont gardées que dans Mitra. Elles sont perdues si vous déconnectez le compte ou [réimportez un calendrier](../calendars.md#re-import-a-calendar). La tâche parente d'une sous-tâche est gardée des deux côtés, tant qu'elle est une tâche du même compte Todoist. Todoist déplace alors la sous-tâche dans le projet de sa tâche parente.

## Ce que Todoist ne peut pas contenir

- Il ne contient que des tâches : pas d'événements, ni de [disponibilité](../availability.md).
- Une tâche est ouverte ou terminée, donc il n'y a pas de statut **En cours** ni **Annulé**. Une tâche en cours ailleurs redevient **À faire** quand vous la déplacez vers Todoist.
- Vous ne pouvez pas rendre une tâche récurrente depuis Mitra.
- Dans Mitra, une tâche n'a ni rappels, ni lieu, ni participants, ni pièces jointes, ni progression, ni occupé ou libre, ni visibilité.

Mitra masque ces champs sur les tâches Todoist, pour que rien de ce que vous y saisissez ne disparaisse à la synchronisation suivante. Pour déplacer vers Todoist des entrées qui les utilisent, voir [Déplacer ou copier toutes les entrées vers un autre calendrier](../calendars.md#move-or-copy-every-entry-to-another-calendar), qui montre d'abord ce qui ne suivrait pas.

## Dépannage

- Si Mitra indique que Todoist a refusé le jeton d'API, copiez-le à nouveau depuis **Paramètres** → **Intégrations** → **Développeur**. Si vous l'avez réinitialisé dans Todoist, ouvrez **⋯ → Modifier** du compte dans Mitra et collez le nouveau.
- Si un projet manque, il est peut-être archivé. Après l'avoir désarchivé dans Todoist, ouvrez **⋯ → Modifier** du compte dans Mitra et appuyez sur **Actualiser**.
