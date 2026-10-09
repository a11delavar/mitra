---
title: Paramètres
description: "Choisissez le thème, la langue et la vue par défaut de Mitra, ainsi que le point de départ des nouvelles entrées. La recherche trouve n'importe quel paramètre, et la palette de commandes en modifie la plupart directement."
---

Mitra range ses paramètres dans une seule boîte de dialogue. Ouvrez-la avec **Paramètres** en bas de la barre latérale, avec <kbd>Ctrl</kbd>+<kbd>,</kbd> (<kbd>⌘</kbd>+<kbd>,</kbd> sur un Mac) depuis n'importe où, ou depuis la [palette de commandes](shortcuts.md). Quand vous vous connectez avec un compte, **Paramètres** est l'engrenage de la carte de votre compte en bas de la barre latérale, et le **⋯** à côté contient **Se déconnecter**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/settings-detail-dark.webp">
  <img src="../assets/screenshots/settings-detail-light.webp" alt="La boîte de dialogue des paramètres, ouverte sur la page Général" />
</picture>

Vous n'avez jamais besoin de rien changer. Un paramètre que vous laissez tranquille suit la valeur par défaut de Mitra : quand une version ultérieure améliore une valeur par défaut, vous obtenez la nouvelle. Choisir vous-même la valeur par défaut revient à le laisser tranquille.

## Trouver un paramètre

Saisissez dans **Rechercher un paramètre…** en haut de la boîte de dialogue. Elle cherche à la fois dans les pages et dans les paramètres, et regroupe ce qu'elle trouve par page : « calendrier » fait apparaître toute la page **Agenda** ainsi que le paramètre **Agenda par défaut** de **Entrées**. Vous pouvez modifier un paramètre directement dans les résultats.

La palette de commandes connaît les mêmes mots et modifie la plupart des paramètres sans ouvrir la boîte de dialogue. Tapez « sombre » et choisissez **Thème : Sombre**, ou « aligner » et choisissez **Aligner sur : 30 min**. Elle ne propose que des valeurs que vous n'avez pas déjà choisies. Un paramètre qu'elle ne peut pas modifier en une seule étape, comme la vue par défaut, propose à la place **Modifier Vue par défaut…**, qui ouvre la boîte de dialogue sur ce paramètre.

## Votre compte ou cet appareil

La plupart des paramètres appartiennent à votre compte et vous suivent sur chaque appareil et chaque navigateur depuis lesquels vous vous connectez : la vue par défaut, **Masquer les tâches terminées**, **Masquer les disponibilités**, l'agenda par défaut, la durée par défaut, **Aligner sur** et les deux rappels par défaut.

Les autres appartiennent à l'appareil que vous utilisez, si bien que votre téléphone et votre ordinateur portable peuvent différer : le thème, la langue, les lignes de connexion, et le fait que ce navigateur affiche ou non des notifications.

Mitra retient aussi certaines choses sur chaque appareil au fil de votre utilisation : le niveau de zoom, l'ouverture de la barre latérale et son onglet, les fuseaux horaires que vous avez repliés, et la période que montre la vue tableau.

## Général

**Thème** vaut **Comme le système**, **Clair** ou **Sombre**. **Comme le système**, la valeur par défaut, suit le mode clair ou sombre de votre appareil.

**Langue** propose l'anglais, l'allemand, le français, l'espagnol, le portugais, l'italien et le persan, chacun nommé dans sa propre langue. Le changement s'applique immédiatement, sans rechargement, et le persan dispose Mitra de droite à gauche. Les dates, les heures et le premier jour de la semaine suivent la langue telle que la région de votre navigateur l'écrit : l'anglais aux États-Unis commence les semaines le dimanche et au Royaume-Uni le lundi, tandis que le persan les commence le samedi.

## Agenda

**Vue par défaut** est la vue sur laquelle Mitra s'ouvre : **Semaine**, sauf si vous choisissez **Mois**, **Année**, **Chronologie** ou **Tableau**.

**Masquer les tâches terminées** retire les tâches terminées et annulées des vues semaine, mois et année et de l'onglet Planification. La recherche les trouve toujours, elles comptent toujours dans la progression de leur parent, et la vue tableau les liste toujours. Une tâche que vous avez ouverte reste visible jusqu'à ce que vous la fermiez.

**Masquer les disponibilités** retire les [disponibilités](availability.md) de la vue semaine. Elles restent dans leurs calendriers, et une disponibilité occupée apparaît toujours comme occupée aux autres.

**Lignes de connexion dans la vue semaine**, **Lignes de connexion dans la vue mois** et **Lignes de connexion dans la chronologie** activent ou désactivent les lignes entre [sous-tâches](subtasks.md) et [dépendances](dependencies.md) dans chaque vue. Elles sont toutes activées au départ.

## Entrées

**Agenda par défaut** est l'endroit où vont les nouveaux événements et tâches. C'est le même choix que l'icône pleine dans la barre latérale : voir [où atterrissent les nouvelles entrées](calendars.md#where-new-entries-land). Sans agenda par défaut, les nouvelles entrées vont au premier calendrier affiché.

**Durée par défaut** est la durée d'une nouvelle entrée quand vous ne lui en donnez pas, par exemple quand vous cliquez sur la grille, y déposez une tâche non planifiée sans estimation, ou désactivez **Toute la journée**. Elle va de 15 minutes à 2 heures, et vaut une heure sauf si vous la changez.

**Aligner sur** est le pas sur lequel le glissement et le redimensionnement se calent : 5, 10, 15 ou 30 minutes, 15 sauf si vous le changez.

## Notifications

**Notifications de rappel** décide si ce navigateur peut vous alerter. Appuyez sur **Autoriser**, et votre navigateur demande l'autorisation ; la ligne indique ensuite **Autorisées** ou **Bloquées**. Pour annuler un blocage, autorisez les notifications pour Mitra dans les paramètres de site du navigateur. Les rappels que vous ajoutez sont enregistrés dans tous les cas. Dans un navigateur qui ne peut pas afficher de notifications de Mitra, cette ligne est absente ; voir le [dépannage](reminders.md#troubleshooting).

**Rappel par défaut des événements** et **Rappel par défaut des tâches** règlent les rappels avec lesquels les nouvelles entrées démarrent : 30 minutes avant pour un événement, et à l'heure de la tâche pour une tâche, ou **Aucun**. Ils ne s'appliquent qu'aux entrées avec un horaire.

Une fois que ce navigateur autorise les notifications, la page liste aussi vos **Appareils**, où vous pouvez les renommer, envoyer un rappel test ou en retirer un. Voir [Rappels](reminders.md#your-devices).
