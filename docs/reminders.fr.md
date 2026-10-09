---
title: Rappels
description: Ajoutez des rappels aux événements et aux tâches, choisissez ceux avec lesquels les nouvelles entrées démarrent et gérez les appareils qui les reçoivent.
---

Un rappel vous prévient d'un événement ou d'une tâche à l'avance, par une notification de votre système, même quand Mitra n'est pas ouvert. Il vient de votre propre serveur Mitra : aucun autre service n'est à créer. Sur un iPhone ou un iPad, les rappels demandent que Mitra soit [installé en tant qu'application](install-app.md) ; partout ailleurs, le navigateur suffit.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/notifications-detail-dark.webp">
  <img src="../assets/screenshots/notifications-detail-light.webp" alt="La page de paramètres Notifications, avec les rappels par défaut, l'autorisation du navigateur et la liste des appareils" />
</picture>

## Ajouter un rappel

Ouvrez une entrée et appuyez sur **＋** sur sa ligne de rappels, celle avec la cloche. Choisissez le moment où il doit se déclencher : **Au début de l'événement** (**À l'heure de la tâche** pour une tâche), 5 ou 10 minutes, une demi-heure, une heure ou un jour avant, ou **Personnalisé…** pour tout autre moment. Une entrée peut en avoir plusieurs, et le **✕** à côté de l'un d'eux le supprime.

Un rappel se compte à rebours depuis le début de l'entrée ou, pour une tâche sans début, depuis son échéance. La première fois que vous en ajoutez un, votre navigateur demande si Mitra peut afficher des notifications. Si vous refusez, le rappel est tout de même enregistré avec l'entrée.

Une entrée récurrente vous rappelle chaque occurrence. Les tâches que vous avez marquées comme terminées ou annulées restent silencieuses, mais un calendrier que vous masquez, non : pour en faire taire un, désactivez-le sous **⋯ → Modifier** de son compte. Les calendriers [Notion](integrations/notion.md) et [Tempo](integrations/tempo.md) ne peuvent pas contenir de rappels.

## Rappels par défaut

**Paramètres → Notifications** règle les rappels avec lesquels les nouvelles entrées démarrent : 30 minutes avant pour un événement, et à l'heure de la tâche pour une tâche, sauf si vous les changez ou choisissez **Aucun**. Les entrées sur toute la journée démarrent sans rappel.

## Quand un rappel se déclenche

La notification affiche le titre de l'entrée, son moment et son lieu, dans la langue et le fuseau horaire de l'appareil. Elle reste jusqu'à ce que vous la fermiez, et la toucher ouvre l'entrée. **Dans 10 min** la fait revenir plus tard, et sur une tâche, **Terminé** la marque comme terminée sans ouvrir Mitra. Safari et Firefox n'affichent pas ces boutons.

Un appareil qui était hors ligne quand un rappel est parti l'abandonne cinq minutes après le début de l'entrée, plutôt que de l'afficher en retard.

## Vos appareils

Chaque navigateur ou application installée où vous autorisez les notifications est un appareil, et chaque appareil reçoit tous vos rappels. **Paramètres → Notifications** les liste, celui que vous utilisez étant marqué **cet appareil**. Renommez-en un avec le crayon, retirez-en un avec le **✕**, et envoyez-vous un exemple avec **Événement test** ou **Tâche test**.

## Dépannage

- Si un rappel n'arrive pas, envoyez un **Événement test**. Si le test arrive, l'entrée est probablement dans un calendrier désactivé. L'autorisation est propre à chaque navigateur et à chaque adresse : autoriser Mitra à une adresse ne couvre pas une autre.
- S'il n'y a pas de ligne **Notifications de rappel** dans **Paramètres → Notifications**, ce navigateur ne peut pas recevoir de notifications de Mitra : sur un iPhone ou un iPad, ouvrez l'[application installée](install-app.md) au lieu de Safari, et partout ailleurs, Mitra doit être servi en HTTPS.
- Si la ligne indique **Bloquées**, autorisez les notifications pour Mitra dans les paramètres de site du navigateur.
- Si rien n'arrive sous Windows alors que Chrome est fermé, activez **Continue running background apps when Google Chrome is closed** dans les paramètres de Chrome, ou installez Mitra depuis Edge.

## Sur le serveur

Les rappels ne demandent aucune configuration, seulement le [HTTPS](configuration.md#put-it-behind-https). Mitra signe ses notifications avec une clé qu'il crée au premier démarrage et conserve dans sa base de données : restaurez donc le dossier de données en entier depuis vos [sauvegardes](backups.md), car sur une base neuve, Mitra crée une nouvelle clé et les appareils enregistrés avec l'ancienne cessent de recevoir des rappels. Les [journaux](logging.md) consignent chaque rappel au moment où il part.
