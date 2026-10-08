---
title: Répétitions
description: "Faites répéter une entrée, modifiez ou supprimez une occurrence ou toute la série, et voyez quels agendas peuvent contenir des répétitions."
---

Une entrée récurrente est une seule entrée avec une règle de répétition, comme une réunion d'équipe chaque lundi ou un loyer dû le 1er de chaque mois. Cette page appelle l'ensemble une série, et chacune de ses dates une occurrence. Chaque occurrence affiche une petite icône de répétition dans les vues.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-detail-dark.webp">
  <img src="../assets/screenshots/repeat-detail-light.webp" alt="L'éditeur d'une réunion d'équipe hebdomadaire avec sa liste Répétition ouverte : Ne se répète pas, Tous les jours, Tous les jours ouvrés, Toutes les semaines le mar., Toutes les 2 semaines, Tous les mois le 1er, le 1er mar., Tous les ans et Personnalisé" />
</picture>

## Faire répéter une entrée

Ouvrez l'entrée et choisissez une règle dans sa ligne **Répétition**. La ligne s'affiche dès que l'entrée a une date : un début, ou une échéance pour une tâche non planifiée.

La liste propose des règles construites à partir de la date de début de la série, même si vous avez ouvert une occurrence ultérieure. Pour une entrée le mardi 13, elle propose **Tous les jours**, **Tous les jours ouvrés** (du lundi au vendredi), **Toutes les semaines** le mardi, **Toutes les 2 semaines** le mardi, **Tous les mois** le 13, **Tous les mois** le 2e mardi, et **Tous les ans** à cette date. Quand le début tombe dans les sept derniers jours de son mois, il y a aussi **Tous les mois** le dernier mardi.

Pour qu'une entrée cesse de se répéter, choisissez **Ne se répète pas**. Un changement de règle s'applique toujours à toute la série, donc Mitra ne demande pas quelles occurrences vous visez.

### Règles personnalisées

Pour tout le reste, choisissez **Personnalisé…**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-custom-detail-dark.webp">
  <img src="../assets/screenshots/repeat-custom-detail-light.webp" alt="La boîte de dialogue Répétition : chaque semaine le mardi, se termine jamais, à une date, ou après un nombre de fois" />
</picture>

Après **Chaque**, saisissez un nombre et choisissez jours, semaines, mois ou années. Une règle hebdomadaire affiche alors les jours de la semaine : activez chaque jour où l'entrée se répète, et au moins un reste activé. Une règle mensuelle se répète le même numéro de jour que le début, comme le 13, ou le même jour de la semaine du mois, comme le 2e mardi. Quand le début tombe dans les sept derniers jours de son mois, elle peut aussi se répéter le dernier mardi.

Sous **Se termine**, choisissez **Jamais**, **Le** une date, ou **Après** un nombre de fois. Appuyez sur **Terminé**, et la ligne **Répétition** relit la règle, par exemple « Toutes les 2 semaines le jeu. jusqu'au 18 déc. ».

## Modifier ou supprimer une occurrence

Quand vous modifiez une occurrence, Mitra demande quelles entrées vous visez. Il le demande quand vous faites glisser l'occurrence vers un autre moment, faites glisser son bord, la supprimez, ou changez un champ dans son éditeur, comme son titre.

- **Cette entrée** ne change que l'occurrence choisie.
- **Cette entrée et les suivantes** la change ainsi que toutes les suivantes. La série se termine juste avant elle, et une nouvelle série démarre là avec votre modification, donc les occurrences précédentes restent telles quelles. La première occurrence ne la propose pas, puisqu'elle y signifierait toute la série.
- **Toutes les entrées** change chaque occurrence. En déplacer une d'un jour les déplace toutes, donc une réunion hebdomadaire le lundi devient une réunion hebdomadaire le mardi. Redimensionner l'une donne à toutes la nouvelle durée.

La suppression fonctionne de la même façon : **Cette entrée** retire une date, **Cette entrée et les suivantes** termine la série avant elle, et **Toutes les entrées** supprime la série.

Pour éviter la question et ne changer que cette occurrence, maintenez <kbd>Ctrl</kbd> (<kbd>⌘</kbd> sur un Mac) en la déposant, ou appuyez sur <kbd>Ctrl</kbd> + <kbd>Delete</kbd> pendant qu'elle est ouverte.

Quelques changements ne demandent jamais rien. Marquer une occurrence de tâche comme terminée s'applique à cette seule occurrence, et planifier une occurrence d'une tâche qui se répète selon son échéance aussi.

## Occurrences modifiées et supprimées

Une occurrence que vous modifiez avec **Cette entrée** quitte la série et devient une entrée à part entière. La série saute sa date, donc elle ne s'affiche jamais deux fois, et les modifications ultérieures de toute la série ne l'atteignent pas.

Une occurrence supprimée reste supprimée. Elle ne revient pas quand vous déplacez ou modifiez plus tard toute la série, et les autres applications qui utilisent le même agenda l'omettent aussi.

## Déplacer une série vers un autre agenda

Choisissez un autre agenda dans l'éditeur d'une occurrence, et la même question décide si cette occurrence, le reste de la série ou toute la série est déplacé, comme décrit dans [Déplacer une seule entrée](calendars.md#move-a-single-entry).

## Tâches récurrentes

Chaque occurrence d'une tâche récurrente est une tâche à part entière à marquer comme terminée. Une tâche peut aussi se répéter selon son échéance seule, comme payer le loyer avant le 1er de chaque mois : voir [échéances récurrentes](planning.md#repeating-due-dates). Les tâches récurrentes ne sont jamais en retard, et elles ne peuvent pas être déplanifiées, puisque leurs dates constituent la série.

## Comment s'affichent les répétitions

Ce qui se répète souvent, comme un entraînement quotidien, s'affiche comme une [routine](routines.md) dans les vues mois et année : une ligne de petites marques au lieu d'une barre par jour. La [chronologie](views/timeline.md) n'affiche que les occurrences d'une tâche récurrente qui sont à échéance, donc une tâche quotidienne ne la remplit pas.

## Quels agendas peuvent se répéter

Les [calendriers stockés dans Mitra](integrations/mitra.md) et les [serveurs de calendrier](integrations/caldav.md), Google et Apple compris, contiennent des entrées récurrentes. Les agendas [Notion](integrations/notion.md) et [Tempo](integrations/tempo.md) ne le peuvent pas, donc leur éditeur n'a pas de ligne **Répétition**, et l'éditeur d'une série ne les propose pas comme agenda.

Quand vous [déplacez toutes les entrées d'un agenda](calendars.md#move-or-copy-every-entry-to-another-calendar) vers un agenda qui ne peut pas se répéter, Mitra demande quoi faire des entrées récurrentes. **Les laisser ici** les garde où elles sont. **Convertir en entrées uniques** écrit chaque occurrence de l'année à venir comme une entrée distincte qui ne se répète plus.

La [disponibilité](availability.md) est aussi une entrée récurrente, et commence hebdomadaire. Pour la même raison, elle ne peut pas vivre dans les agendas Notion ou Tempo.
