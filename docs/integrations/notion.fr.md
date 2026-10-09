---
title: Notion
description: Faites entrer les vues de vos bases de données de tâches Notion dans Mitra sous forme de calendriers de tâches synchronisés dans les deux sens.
---

Mitra se connecte à Notion pour les tâches. Chaque vue d'une base de données de tâches, comme « All tasks », « My tasks » ou un tableau de sprint, devient un calendrier dans Mitra qui contient exactement les tâches que la vue affiche : Notion applique les filtres de la vue, et Mitra place le résultat dans votre calendrier. Le titre, le statut, les dates et la description d'une tâche sont synchronisés dans les deux sens.

Vous vous connectez depuis l'application avec un jeton d'intégration. Il n'y a rien à configurer sur le serveur.

## Connecter un espace de travail

1. Créez une intégration sur [notion.so/profile/integrations](https://www.notion.so/profile/integrations). Une intégration interne suffit.
2. Partagez-lui vos bases de données de tâches. Ouvrez chaque base dans Notion, choisissez **•••** → **Connections**, et ajoutez votre intégration.
3. Dans Mitra, choisissez **Ajouter une intégration** au bas de la barre latérale, puis **Notion**, et collez le secret de l'intégration, qui commence par `ntn_`, dans **Jeton d'intégration**.
4. Appuyez sur **Connecter**. Mitra liste les vues des bases de données que vous avez partagées, nommées d'après la base et la vue.
5. Choisissez les vues que vous voulez, puis appuyez sur **Enregistrer**.

Mitra active d'abord une vue par base de données. Une tâche appartient à toutes les vues dont elle remplit les filtres : avec deux vues de la même base activées, elle apparaîtrait donc deux fois. Vous pouvez quand même en activer davantage volontairement.

Mitra propose les vues de type tableau, board, liste, calendrier, chronologie et galerie. Les autres types de vues ne sont pas listés.

## Quelles bases de données fonctionnent

Une base de données apparaît quand elle a une propriété de type Status et une de type Date. Les modèles de tâches de Notion ont les deux.

Mitra lit le statut d'une tâche d'après le groupe auquel appartient son statut Notion :

| Groupe de statuts Notion | Statut dans Mitra |
| --- | --- |
| To-do | À faire |
| In progress | En cours |
| Complete | Terminé |

Quand vous changez un statut dans Mitra, Notion reçoit la première option du groupe correspondant.

La propriété Date est l'endroit où Mitra place la tâche : c'est donc l'horaire de la tâche. Si une base a plusieurs propriétés Date, Mitra préfère celle dont le nom commence par « Due », puis une qui s'appelle « Date », « When », « Deadline », « Scheduled » ou « Do date », et sinon prend la première.

## Ce qui est synchronisé

Le titre, le statut et la date sont synchronisés dans les deux sens, comme dates sur toute la journée ou avec des heures. Les heures s'affichent dans votre propre fuseau horaire. Une tâche sans date attend dans la liste **Non planifié** de l'[onglet Planification](../planning.md#the-planning-tab).

La description d'une tâche est le corps de sa page Notion, écrit en Markdown, listes de tâches et encadrés compris. Quand vous modifiez la description dans Mitra, Mitra ne remplace que ce que la description affiche. Les images, les intégrations, les sous-pages et les blocs synchronisés restent dans Notion tels quels, et Mitra ne les montre pas.

Les propriétés de relation qui relient des tâches au sein de la même base de données deviennent des liens dans Mitra, dans les deux sens. Une propriété nommée « Parent task » ou « Sub-tasks » crée des [sous-tâches](../subtasks.md), une nommée « Blocked by » ou « Depends on » crée des [dépendances](../dependencies.md), et les autres relations apparaissent sous leur propre nom. Les relations vers d'autres bases de données ne sont pas affichées.

Pour ouvrir une tâche dans Notion, choisissez **Ouvrir dans Notion** dans le menu **⋯** de l'éditeur. Supprimer une tâche dans Mitra place sa page dans la corbeille de Notion, d'où vous pouvez encore la restaurer.

Notion limite la fréquence à laquelle les applications peuvent l'appeler : Mitra le synchronise donc environ une fois par minute (voir [comment fonctionne la synchronisation](README.md#how-syncing-works)). Une nouvelle tâche ne disparaît jamais brièvement pendant que Notion rattrape son retard.

## Ce que Notion ne peut pas contenir

Une base de données Notion contient des tâches avec une seule date chacune, ce qui détermine ce qu'un calendrier Notion peut contenir :

- Elle ne contient que des tâches : donc pas d'événements et pas de [disponibilité](../availability.md).
- L'unique date d'une tâche est son horaire : il n'y a donc ni date d'échéance ni estimation.
- Les tâches ne peuvent pas se répéter, et n'ont ni rappels, ni lieu, ni participants.
- Il n'y a pas de statut **Annulé**, puisque Notion n'a pas de groupe pour cela.
- Une tâche ne peut avoir ni fuseau horaire propre, ni pourcentage d'avancement, ni état occupé ou disponible, ni visibilité.

Mitra masque ces champs sur les tâches Notion, si bien que rien de ce que vous y saisissez ne disparaît à la prochaine synchronisation. Pour déplacer vers Notion des entrées qui les utilisent, voir [Déplacer ou copier toutes les entrées vers un autre calendrier](../calendars.md#move-or-copy-every-entry-to-another-calendar), qui montre d'abord ce qui ne passerait pas.

## Vues et filtres

Un calendrier montre ce que montre sa vue Notion, et une tâche que vous y créez reçoit les valeurs de filtre de la vue, de sorte qu'elle atterrit dans la vue. Une tâche ajoutée à une vue « University » reçoit « Area = University », comme si vous aviez ajouté la ligne dans Notion.

Mitra renseigne les filtres qu'une seule valeur peut satisfaire : une sélection, un statut, une sélection multiple, une case à cocher, ou une relation vers une page précise. Certains filtres ne peuvent être satisfaits par aucune valeur unique, comme une formule, une plage de dates, ou l'une de plusieurs options. Une tâche créée dans une telle vue ne lui correspond pas : comme dans Notion, elle n'y apparaît donc pas. Elle est quand même dans la base de données, et une vue avec moins de filtres, comme « All tasks », l'affiche.

> [!TIP]
> Si une vue filtre sur une relation vers une autre base de données, par exemple des tâches dont « Area » pointe vers une page « University » d'une base « Areas », partagez aussi cette base avec votre intégration. Sinon Mitra ne peut pas renseigner la relation sur les nouvelles tâches, et elles n'apparaissent pas dans la vue.

## Dépannage

- Si une base de données n'est pas listée, il lui manque une propriété Status ou Date, ou elle n'est pas partagée avec votre intégration (**•••** → **Connections** dans Notion). Après l'avoir partagée, ouvrez **⋯ → Modifier** du compte dans Mitra et appuyez sur **Actualiser**.
- Si une tâche apparaît deux fois, vous avez activé deux vues de la même base de données qui l'incluent toutes les deux. Désactivez l'une d'elles sous **⋯ → Modifier** du compte.
