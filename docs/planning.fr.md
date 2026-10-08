---
title: Planification
description: "Donnez aux tâches une date d'échéance et une estimation, gardez celles qui ne sont pas planifiées dans l'onglet Planification, et planifiez-les quand vous savez quand vous les ferez."
---

La planification concerne les tâches qui n'ont pas encore leur place dans votre semaine : des idées que vous voulez garder, du travail avec une échéance mais sans plan, et des choses auxquelles vous ne vous êtes simplement pas encore attelé. Elles attendent dans l'onglet **Planification** de la barre latérale avec une échéance et une estimation, jusqu'à ce que vous les fassiez glisser dans votre semaine.

Cette page présente l'onglet Planification, les échéances, les estimations, la planification et la déplanification des tâches, et les tâches en retard.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/planning-detail-dark.webp">
  <img src="../assets/screenshots/planning-detail-light.webp" alt="L'onglet Planification de la barre latérale, listant les tâches en retard au-dessus de celles qui ne sont pas planifiées" />
</picture>

## Planification, contraintes et planifier

Mitra distingue deux sortes d'informations sur le temps d'une tâche.

- La **planification** est le moment où vous travaillerez sur la tâche : son début et sa fin. C'est ce que les vues affichent. Une tâche qui a une planification est **planifiée**, et une tâche sans planification est **non planifiée**.
- Les **contraintes** sont ce que la planification doit respecter. Une tâche en a deux : son **échéance**, quand elle doit être terminée, et son **estimation**, le temps qu'elle prendra.

**Planifier** consiste à planifier vos tâches non planifiées de sorte que chaque planification respecte ses contraintes : elle se termine avant l'échéance, et elle dure autant que l'estimation. Mitra prend l'estimation en compte pour vous, donc une tâche que vous planifiez a déjà la bonne durée.

Ni la planification ni les contraintes ne sont obligatoires. Une tâche peut avoir une échéance et pas de planification, une planification et pas d'échéance, les deux, ou aucune.

Par exemple, une présentation est due vendredi à midi, et vous planifiez mardi matin pour la préparer. Les vues affichent la tâche le mardi, et un petit drapeau à côté montre qu'elle a une échéance.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/due-detail-dark.webp">
  <img src="../assets/screenshots/due-detail-light.webp" alt="Une tâche planifiée mardi de 9:00 à 12:00, avec une échéance vendredi à midi" />
</picture>

## L'onglet Planification

L'onglet **Planification** de la barre latérale est l'endroit où vous planifiez : vos tâches non planifiées y attendent que vous les planifiiez. Ouvrez la barre latérale et passez à **Planification**. Vous pouvez aussi balayer latéralement depuis **Agendas**, avec deux doigts sur un pavé tactile ou un doigt sur un écran tactile.

L'onglet a deux listes :

- **Non planifié** contient chaque tâche non planifiée. Tant que vous ne les [mettez pas en ordre](#put-tasks-in-order), les tâches avec une échéance viennent en premier, la plus proche en haut. Les autres suivent par ordre alphabétique, et les tâches terminées passent en bas.
- **En retard** contient les tâches sur lesquelles vous avez pris du retard. Voir [tâches en retard](#overdue-tasks).

Le nombre sur l'onglet compte les deux listes, donc vous voyez aussi combien de tâches attendent depuis l'onglet **Agendas**. Cliquez sur une tâche pour l'ouvrir, comme dans les vues.

Pour noter une tâche pour plus tard, appuyez sur **Ajouter une tâche** en bas de l'onglet. Elle ne demande qu'un titre. La tâche va dans votre [agenda par défaut](calendars.md#where-new-entries-land), ou dans le premier agenda qui peut contenir des tâches si votre agenda par défaut ne le peut pas.

## Mettre les tâches en ordre

Faites glisser une tâche vers le haut ou le bas de la liste **Non planifié** pour la réorganiser. L'ordre est enregistré, et une tâche garde sa place quand elle passe dans un autre agenda.

Votre ordre prime sur les échéances. Les nouvelles tâches apparaissent sous celles que vous avez placées, et les tâches terminées restent en bas.

Mitra conserve l'ordre lui-même, donc les autres applications ne le voient pas.

## Définir une échéance

Ouvrez la tâche, appuyez sur **Date d'échéance** et choisissez un jour. Pour retirer l'échéance, appuyez sur le **✕** à côté.

Une tâche avec une échéance affiche un petit drapeau, dans les vues et dans l'onglet Planification. Planifier, déplanifier ou déplacer la tâche ne change jamais son échéance.

Une tâche de toute la journée est due un jour donné. Pour lui donner une heure, désactivez **Toute la journée** à la fin de l'échéance, qui s'affiche tant que vous êtes dessus. Cela donne des heures à toute la tâche, donc son échéance devient 17 h 00 le même jour, ce que vous pouvez modifier.

## Définir une estimation

Une tâche non planifiée a un champ **Estimation**, avec un sablier, là où une tâche planifiée a sa fin. Cliquez dessus et saisissez les heures et les minutes, ou choisissez une durée dans la liste.

Seules les tâches non planifiées ont une estimation. Quand vous planifiez une tâche, son estimation devient la durée de sa planification. Quand vous la déplanifiez, la durée de sa planification redevient son estimation, donc rien n'est perdu dans les deux sens.

## Planifier une tâche

Planifier donne à une tâche un début et une fin. Il y a deux façons de le faire.

### La faire glisser dans une vue

Faites glisser la tâche hors de l'onglet Planification et déposez-la dans une vue.

- **Sur une heure de la journée dans la vue semaine**, la tâche commence là où vous la déposez et dure autant que son estimation. Sans estimation, elle dure votre [durée par défaut](settings.md#entries).
- **Dans la ligne de toute la journée de la vue semaine, ou sur un jour dans la vue mois ou année**, la tâche devient une tâche de toute la journée. Elle couvre autant de jours que son estimation, et au moins un.

Ensuite, faites glisser son bord pour l'allonger ou la raccourcir, comme n'importe quelle autre entrée.

### Définir une date de début

Ouvrez la tâche, appuyez sur **Date de début** et choisissez un jour.

- Si son estimation est inférieure à une journée, la tâche commence à 9 h 00 et dure autant que son estimation.
- Sinon, la tâche devient une tâche de toute la journée, couvrant autant de jours que son estimation, et au moins un.

La vue se déplace vers ce jour, et la tâche reste ouverte, donc vous pouvez ajuster ses heures tout de suite. Cela fonctionne partout, y compris sur un téléphone, où la barre latérale ouverte recouvre la vue et où il n'y a nulle part où faire glisser.

## Déplanifier une tâche

Déplanifier retire la planification d'une tâche et la renvoie dans l'onglet Planification. Il y a deux façons de le faire :

- **Faites glisser** la tâche hors de la vue et déposez-la sur la liste **Non planifié**.
- **Ouvrez la tâche et appuyez sur le ✕** à côté de sa date de début. L'onglet Planification s'ouvre, avec la tâche toujours ouverte.

La tâche conserve son échéance, et la durée de sa planification devient son estimation. Ses rappels restent si elle a une échéance à laquelle ils peuvent se rapporter, et sont supprimés sinon.

Le **✕** à côté de la date de fin fait autre chose. Il ne déplanifie pas la tâche, il la transforme en [instant](#moments).

> [!NOTE]
> Seules les tâches peuvent être déplanifiées. Un événement a toujours une date. Une tâche qui se répète selon une planification, comme une revue hebdomadaire, ne peut pas non plus être déplanifiée.

## Tâches en retard

Une tâche est **en retard** quand elle n'est pas terminée et que son jour est passé. Son jour est son échéance, ou, sans échéance, le dernier jour de sa planification. La liste **En retard** affiche ces tâches, les plus en retard en premier.

Mitra compte des jours entiers, donc une tâche due ce matin ne devient en retard que demain.

Une tâche quitte la liste quand vous la marquez comme terminée. Vous pouvez aussi lui donner une échéance plus tardive ou, si elle n'a pas d'échéance, la planifier un jour plus tardif.

## Échéances récurrentes

Certaines tâches sont dues encore et encore, comme payer le loyer avant le 1er de chaque mois. Donnez une échéance à la tâche et faites-la répéter.

La liste **Non planifié** n'affiche que la prochaine, pour ne pas se remplir de tous les mois à la fois. Quand vous la planifiez, seule la tâche de ce mois est planifiée, et celle du mois prochain prend sa place dans la liste.

Les tâches récurrentes ne sont jamais en retard.

## Instants

Un **instant** est une tâche planifiée avec un début et sans fin, pour quelque chose que vous faites à un moment précis plutôt que sur une durée, comme prendre votre médicament du matin à 7 h 30. Dans la vue semaine, il s'affiche comme une entrée fine d'une seule ligne à son heure de début.

Pour transformer une tâche en instant, ouvrez-la et appuyez sur le **✕** à côté de sa date de fin. Pour lui redonner une fin, appuyez sur **Date de fin**.

## Quels agendas le prennent en charge

Chaque modification est enregistrée directement dans l'agenda auquel la tâche appartient.

- Les **calendriers stockés dans Mitra** prennent en charge tout ce qui figure sur cette page.
- Les **[serveurs de calendrier](integrations/caldav.md)** prennent tout en charge aussi. Les autres applications qui utilisent le même agenda voient le début et l'échéance de la tâche.
- **[Notion](integrations/notion.md)** prend en charge les planifications, mais pas les contraintes, car une base de données Notion ne contient qu'une seule date par tâche.
