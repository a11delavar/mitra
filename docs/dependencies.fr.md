---
title: Dépendances
description: "Faites attendre une entrée une autre, voyez l'ordre sous forme de lignes dans le calendrier, et déplacez toute une chaîne ensemble."
---

Une **dépendance** dit qu'une entrée ne peut pas commencer avant qu'une autre soit terminée : le brouillon avant la relecture, la relecture avant la publication. L'entrée qui attend est bloquée par l'autre.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/week-detail-dark.webp">
  <img src="../assets/screenshots/week-detail-light.webp" alt="Une semaine avec trois tâches d'étude reliées par des lignes, chacune menant à la suivante puis à l'examen" />
</picture>

## Ajouter une dépendance

Ouvrez l'entrée qui attend, appuyez sur **＋** à côté de **Bloqué par** et saisissez une partie du titre de l'entrée qui doit se terminer d'abord. La recherche couvre tous vos calendriers : une entrée peut donc en attendre une autre située dans un autre calendrier ou un autre compte. L'autre entrée liste alors celle-ci sous **Bloque**, qui ne fait que lister les liens : vous en ajoutez toujours un depuis l'entrée qui attend.

Dans l'éditeur, cliquez sur le titre d'une entrée liée pour l'ouvrir, ou sur le **✕** à côté pour supprimer le lien, depuis l'un ou l'autre côté. Mitra refuse un lien qui ferait une boucle, comme deux entrées qui s'attendent mutuellement.

À la souris, vous pouvez aussi tracer une dépendance dans la vue semaine ou mois. Pointez l'entrée qui vient en premier, saisissez le court trait à son extrémité et déposez-le sur l'entrée qui doit l'attendre. Pendant le glissement, la ligne devient rouge au-dessus d'une entrée qui commence déjà trop tôt.

## Lignes dans le calendrier

La vue semaine, la vue mois et la chronologie tracent une ligne de la fin de chaque entrée jusqu'au début de l'entrée qui l'attend. Pointez une entrée pour mettre ses lignes au premier plan. Les lignes de chaque vue peuvent être désactivées sous **Paramètres → Agenda**, avec **Lignes de connexion dans la vue semaine**, **Lignes de connexion dans la vue mois** et **Lignes de connexion dans la chronologie**.

## Dépendances rompues

Quand une entrée commence avant la fin de celle qu'elle attend, la dépendance est rompue. Sa ligne dans le calendrier devient rouge et, dans les lignes **Bloqué par** et **Bloque** de l'éditeur, l'entrée de l'autre côté est nommée en rouge. Remettez l'une des deux entrées dans l'ordre, et l'avertissement disparaît.

## Déplacer une chaîne

Quand vous faites glisser une entrée, ou l'un de ses bords, et que d'autres entrées en dépendent, Mitra demande **Déplacer aussi les entrées dépendantes ?**. Les choix qui déplacent d'autres entrées indiquent combien :

- **Cette entrée uniquement** déplace celle-ci et laisse les autres où elles sont.
- **Garder la chaîne intacte** ne déplace les autres que du strict nécessaire pour qu'elles restent dans l'ordre. Les entrées après celle-ci se décalent plus tard et, si vous avez avancé celle-ci, les entrées avant elle s'avancent aussi. Une entrée qui a assez de marge reste où elle est.
- **Toutes les déplacer du même écart** déplace toute la chaîne, avant et après cette entrée, du même écart de temps, si bien que les intervalles entre elles restent identiques.

Mitra ne demande que lorsque les choix donneraient des résultats différents. Modifier les horaires dans l'éditeur ne déplace jamais d'autres entrées.

Quand une entrée se déplace avec sa chaîne, ses sous-tâches la suivent. Les entrées récurrentes et les tâches non planifiées d'une chaîne ne sont jamais déplacées.

> [!TIP]
> Maintenez <kbd>Ctrl</kbd> (<kbd>⌘</kbd> sur un Mac) pendant que vous déposez pour passer la question et ne déplacer que cette entrée. Voir les [raccourcis clavier](shortcuts.md).

## Quels calendriers le prennent en charge

Un lien est enregistré avec l'entrée qui attend, dans le calendrier propre à cette entrée. Les [serveurs de calendrier](integrations/caldav.md), [Apple Calendar](integrations/apple.md) et les [calendriers Mitra](integrations/mitra.md) conservent n'importe quel lien, et sur un serveur de calendrier il est écrit dans le format de calendrier standard, que les autres applications utilisant le même calendrier peuvent donc lire.

- Dans [Notion](integrations/notion.md), un lien vers une tâche de la même base de données va dans la propriété de relation correspondante, comme « Blocked by ». Mitra conserve lui-même les liens vers tout le reste.
- [Google Calendar](integrations/google.md) abandonne les liens : une entrée d'un calendrier Google ne peut donc pas recevoir d'entrée à attendre. Les entrées d'autres calendriers peuvent toujours s'y lier.
- Les [abonnements à un calendrier](integrations/subscriptions.md) sont en lecture seule, et [Tempo](integrations/tempo.md) n'a pas de liens.
