---
title: Entrées
description: "Ouvrez l'éditeur d'entrée et découvrez tout ce qu'un événement ou une tâche peut contenir : son agenda, son type, sa couleur, son statut, sa description et plus encore."
---

Tout ce qui figure sur votre calendrier est une **entrée**. La plupart des entrées sont des **événements**, qui ont lieu à un moment donné, ou des **tâches**, que vous accomplissez et cochez. Un troisième type, la [disponibilité](availability.md), ombre le temps que vous réservez à quelque chose, derrière vos événements et vos tâches.

Cette page présente l'éditeur d'entrée : son en-tête, les lignes qui le suivent et la description.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/due-detail-dark.webp">
  <img src="../assets/screenshots/due-detail-light.webp" alt="L'éditeur d'une tâche de l'agenda Travail, avec sa case de statut et son titre, son début, sa fin et son échéance, un lien et une description, sa visibilité, ses rappels et ses relations" />
</picture>

## Ouvrir l'éditeur

Cliquez sur une entrée pour ouvrir son éditeur à côté. Pour en créer une, appuyez sur <kbd>C</kbd> ou sur **Créer** en haut de la page. La nouvelle entrée commence à l'heure pleine suivante, dure une heure et va dans votre [agenda par défaut](calendars.md#where-new-entries-land). Dans la [vue semaine](views/week.md), vous pouvez aussi faire glisser sur un créneau vide.

Chaque modification est enregistrée au fur et à mesure. Fermez l'éditeur avec son **✕**, ou en cliquant en dehors. Sur un écran étroit, comme celui d'un téléphone, l'éditeur remonte depuis le bas sous forme de feuille.

## L'en-tête

La ligne du haut de l'éditeur contient la couleur de l'entrée, son agenda, son type et le menu **⋯**.

### Donner à une entrée sa propre couleur

Une entrée prend la couleur de son agenda. Pour donner à une entrée une couleur qui lui est propre, cliquez sur le point au début de l'en-tête et choisissez-en une. **Réinitialiser à la couleur du calendrier**, dans le même sélecteur, lui rend la couleur de l'agenda.

### Déplacer une entrée vers un autre agenda

À côté du point se trouve le nom de l'agenda de l'entrée. Cliquez dessus et choisissez un autre agenda pour y déplacer l'entrée. La liste exclut les agendas qui ne pourraient pas conserver quelque chose que l'entrée possède, comme une répétition ou le statut **Annulé**. Voir [Déplacer une seule entrée](calendars.md#move-a-single-entry).

### Changer le type d'une entrée

Plus loin, l'en-tête indique le type de l'entrée : **Événement**, **Tâche** ou **Disponibilité**. Cliquez dessus et choisissez-en un autre. Les serveurs de calendrier séparent les événements des tâches, donc Mitra enregistre l'entrée à neuf sous l'autre type et supprime l'ancienne. L'éditeur reste ouvert sur le résultat.

Tout ce que le nouveau type ne peut pas contenir est abandonné. Une tâche qui devient un événement perd son statut, sa progression, son échéance et son estimation. Un événement qui devient une tâche perd son état occupé ou disponible. Une disponibilité n'a ni participants ni rappels.

Le type ne peut pas changer pour une entrée récurrente, ni dans un agenda qui ne contient qu'un seul type, comme un agenda Notion. **Disponibilité** n'est proposée que là où l'agenda peut la contenir.

### Le menu ⋯

**Dupliquer** fait une copie dans le même agenda et l'ouvre. Maintenir <kbd>Alt</kbd> en faisant glisser une entrée en crée une copie là où vous la déposez.

**Supprimer** retire l'entrée. Tant que l'éditeur est ouvert, <kbd>Delete</kbd> ou <kbd>Backspace</kbd> fait de même, tant que vous ne saisissez pas de texte dans un champ. Si l'entrée est récurrente ou a des sous-tâches, Mitra demande lesquelles vous visez.

Une entrée venant de Notion ou de Tempo propose aussi **Ouvrir dans Notion** ou **Ouvrir dans Jira**, qui l'ouvre là où elle a été créée.

## Titre et heure

Le titre est la grande ligne sous l'en-tête. Les lignes en dessous indiquent quand l'entrée a lieu : son début, sa fin, son fuseau horaire et si elle se répète. Pour passer des jours aux heures, appuyez sur **Toute la journée** à la fin d'une date, qui s'affiche tant que vous êtes sur cette ligne.

Une tâche a aussi une date d'échéance et, tant qu'elle n'est pas planifiée, une estimation. Voir [Planification](planning.md). Pour les fuseaux horaires, voir [Fuseaux horaires](time-zones.md), et pour les répétitions, [Répétitions](repeats.md).

## Statut d'une tâche

Une tâche a une case à cocher avant son titre, et l'un de quatre statuts : **À faire**, **En cours**, **Terminé** ou **Annulé**. Cliquez sur la case pour marquer la tâche comme terminée, et cliquez à nouveau pour la rouvrir. Pour choisir n'importe quel statut, faites un clic droit sur la case ou un <kbd>Alt</kbd>-clic. Cela fonctionne aussi sur le calendrier.

Les tâches terminées et annulées sont barrées. Un agenda sans statut annulé, comme Notion, retire **Annulé** du menu. Une tâche avec des sous-tâches ou une liste de contrôle affiche sa progression dans la case ; voir [Sous-tâches](subtasks.md#progress).

## Occupé ou disponible et visibilité

La ligne avec l'œil indique ce que les autres personnes apprennent de l'entrée quand elles regardent votre calendrier.

Les événements choisissent entre **Occupé** et **Disponible**. Occupé, la valeur par défaut, marque le temps comme pris, donc quelqu'un qui vérifie quand vous êtes libre pour une rencontre le voit comme bloqué. Disponible affiche l'entrée sans bloquer le temps, ce qui convient à un rappel pour vous-même ou à un jour férié que vous ne prenez pas en congé. Les tâches n'ont ni occupé ni disponible. La disponibilité en a un, et commence comme disponible ; voir [Disponibilité](availability.md#busy-or-free).

Chaque entrée a une visibilité. **Visibilité par défaut** la laisse à l'agenda. **Public** permet à toute personne qui voit votre calendrier de lire l'entrée. **Privé** demande aux autres applications de montrer aux personnes avec qui vous partagez le calendrier seulement que le temps est pris, pas ce que c'est. **Confidentiel** est le plus strict, pour les entrées qui doivent rester entre vous et les personnes invitées. Mitra enregistre votre choix avec l'entrée, et le serveur et les applications qui la lisent décident quoi masquer.

## Lieu, personnes et plus

- [Lieu](location.md) contient un endroit, avec une carte, ou un lien de réunion.
- [Participants](participants.md) liste les personnes concernées et leurs réponses.
- [Rappels](reminders.md) vous notifient avant le début de l'entrée, ou avant l'échéance d'une tâche.
- [Liens](links.md) rassemble les liens de la description au-dessus.
- **Sous-tâche de** et **Sous-tâches** construisent une arborescence de tâches ; voir [Sous-tâches](subtasks.md).
- **Bloqué par** et **Bloque** indiquent ce qui doit se terminer d'abord ; voir [Dépendances](dependencies.md).

## La description

Cliquez sur la description pour la modifier, et cliquez ailleurs pour la voir à nouveau mise en forme. Elle s'écrit en Markdown, donc les titres, les listes à puces et numérotées, le texte en gras et en italique, le code, les tableaux et les liens s'affichent tous. Une citation qui commence par `> [!NOTE]`, `> [!TIP]` ou `> [!WARNING]` devient un encadré coloré. Cliquer sur un lien l'ouvre au lieu de passer en modification.

Les lignes qui commencent par `- [ ]` deviennent une liste de contrôle, que vous pouvez cocher sans ouvrir le texte. Voir [Listes de contrôle](subtasks.md#checklists).

## Relations venant d'autres applications

D'autres applications de calendrier peuvent lier des entrées d'une façon que Mitra ne crée pas lui-même. Mitra affiche ces liens dans une section à part : **Lié à** pour les entrées qui vont ensemble, et une section nommée d'après le type du lien pour les genres qu'il ne connaît pas. Vous pouvez retirer un tel lien avec son **✕**, mais pas en ajouter.

## Quels agendas le prennent en charge

Chaque agenda stocke des choses différentes, et Mitra masque les lignes qu'un agenda ne peut pas stocker, donc rien de ce que vous saisissez ne disparaît à la prochaine synchronisation. Un agenda Notion ne contient que des tâches, par exemple, et un agenda Google n'a pas de relations. Voir [Intégrations](integrations/README.md#what-each-one-holds) pour ce que chacun contient.
