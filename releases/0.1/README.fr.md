---
title: Mitra, un calendrier bien à vous
---
La première version de Mitra : un calendrier qui place vos tâches sur la même chronologie que vos événements, synchronisé dans les deux sens avec les calendriers que vous tenez déjà.

## Pourquoi Mitra
Il existe de bonnes applications de calendrier, et il existe des calendriers que l'on peut héberger soi-même, et pendant longtemps ce n'étaient pas les mêmes.

Les applications soignées vivent sur les serveurs de quelqu'un d'autre et lisent tout ce que vous y écrivez. Celles que l'on peut faire tourner chez soi sont surtout des serveurs : elles gardent fidèlement vos calendriers et vous laissent les regarder avec la première application que vous trouvez. Mitra est née du désir d'avoir les deux à la fois : un calendrier agréable pour y passer sa journée, qui tourne sur une machine à vous et ne rend de comptes à personne d'autre.

Il ne vous demande pas de déménager. Mitra est une couche posée sur les calendriers que vous tenez déjà, pas un lieu de plus où les tenir. Chaque source de votre temps est une intégration qui se branche à côté des autres, d'abord un serveur CalDAV et beaucoup d'autres depuis, et toutes se retrouvent sur une seule chronologie tout en gardant leurs données là où elles vivent. Vos événements et vos tâches partagent eux aussi cette chronologie, si bien que le travail d'ajuster les uns aux autres ne se fait plus dans votre tête.

C'est aussi un pari sur le web tel qu'il est aujourd'hui, pas tel qu'il était il y a dix ans. Mitra est écrite pour les navigateurs actuels et s'appuie sur ce qu'ils savent faire nativement : des mises en page qui s'adaptent à leur propre espace, des fenêtres flottantes ancrées à leur place, des transitions entre les vues, un vrai modèle des dates et des fuseaux horaires. Ne traîner ni couche de compatibilité ni lourd framework, c'est ce qui la garde petite et rapide, lui permet de s'installer comme une application et de se sentir aussi chez elle sur un téléphone que sur un ordinateur. Le prix à payer, c'est qu'elle demande un navigateur récent, et qu'elle continuera de le demander.

Au fond, il y a une conviction simple : votre temps est le registre le plus personnel que vous tenez. Où il vit, qui peut le lire et à quel point il est paisible à regarder, cela devrait être à vous d'en décider. Mitra est une tentative de rendre cela facile.

[@a11delavar](https://github.com/a11delavar)

## Vue semaine
Une journée est une colonne de 24 heures avec un trait à l'heure actuelle, et une semaine en compte sept côte à côte. Revenez à aujourd'hui d'un seul bouton.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="week-dark.webp">
	<img src="week-light.webp" alt="La vue semaine, avec le trait à l'heure actuelle">
</picture>

Documentation : [Vue semaine](../../docs/views/week.md)

## Vue mois
Le mois défile sans fin, une ligne par semaine et une barre pour chaque entrée sur ses jours. Passez de la vue mois à la vue semaine depuis l'en-tête.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="month-dark.webp">
	<img src="month-light.webp" alt="La vue mois, une ligne par semaine">
</picture>

Documentation : [Vue mois](../../docs/views/month.md)

## Événements et tâches
Une tâche prend place dans la journée comme un événement, avec une case à cocher quand elle est faite. Faites glisser dans la grille pour créer une entrée, glissez-la pour la déplacer, et donnez à chaque calendrier sa couleur.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="entries-dark.webp">
	<img src="entries-light.webp" alt="Des événements et des tâches côte à côte dans une journée">
</picture>

Documentation : [Entrées](../../docs/entries.md)

## CalDAV
Connectez un serveur CalDAV, choisissez ceux de ses calendriers à afficher, et Mitra les garde synchronisés dans les deux sens, les changements venus d'ailleurs apparaissant au moment où ils arrivent.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="caldav-dark.webp">
	<img src="caldav-light.webp" alt="Connexion d'un serveur CalDAV">
</picture>

Documentation : [CalDAV](../../docs/integrations/caldav.md)

## Notes en Markdown
La description d'une entrée est en Markdown : titres, listes et liens s'y lisent comme tels, et restent du texte brut pour toutes les autres applications.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="markdown-dark.webp">
	<img src="markdown-light.webp" alt="Un ordre du jour dans la description d'une entrée, écrit en Markdown">
</picture>

## Contributeurs
- [@a11delavar](https://github.com/a11delavar)
