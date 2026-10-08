---
title: Vue semaine
description: Vos journées heure par heure, avec événements et tâches côte à côte, et comment créer, déplacer et redimensionner des entrées sur la grille.
sidebar:
  label: Semaine
---

La vue semaine affiche vos journées heure par heure, une colonne par jour. Les événements et les tâches se placent côte à côte dans les mêmes colonnes, de sorte que vous voyez le temps qu'il vous reste pour vos tâches. Ouvrez-la avec <kbd>W</kbd>.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/week-detail-dark.webp">
  <img src="../../assets/screenshots/week-detail-light.webp" alt="La vue semaine, avec des événements et des tâches côte à côte dans la colonne de chaque jour" />
</picture>

Les entrées de toute la journée se trouvent dans la ligne en haut. Lorsque des entrées se chevauchent, elles se partagent la colonne côte à côte.

## Créer, déplacer et redimensionner

Faites glisser sur un créneau vide pour créer une entrée, faites glisser une entrée pour la déplacer, ou son bord pour la redimensionner. Une entrée créée dans la ligne de toute la journée dure toute la journée, et une entrée créée en dessous a des heures. Pour basculer plus tard, ouvrez-la et appuyez sur **Toute la journée** à la fin d'une date, qui s'affiche tant que vous êtes sur cette ligne.

Le déplacement et le redimensionnement s'alignent sur un pas que vous choisissez avec **Aligner sur** dans les [Paramètres](../settings.md). Maintenez <kbd>Alt</kbd> en déposant pour dupliquer l'entrée au lieu de la déplacer.

## Ce qu'elle affiche d'autre

- Des lignes entre les [entrées dépendantes](../dependencies.md) et des tâches vers leurs [sous-tâches](../subtasks.md).
- Votre [disponibilité](../availability.md), ombrée dans la couleur de son agenda.
- Une ligne qui traverse aujourd'hui à l'heure actuelle.

## Autres fuseaux horaires

La vue semaine peut afficher les heures d'autres fuseaux horaires à côté des vôtres. Pointez le haut de la colonne des heures et appuyez sur **＋** (**Ajouter un fuseau horaire**) pour en ajouter un, et cliquez sur le nom d'un fuseau pour le renommer ou le supprimer. La page [Fuseaux horaires](../time-zones.md) explique comment replier les colonnes supplémentaires, et le fuseau horaire propre à chaque entrée.
