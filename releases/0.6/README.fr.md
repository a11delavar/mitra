---
title: Des calendriers dans Mitra, vue tableau, échéances
---
Cette version donne à Mitra ses propres calendriers, présente vos entrées sous forme de tableau, et apporte aux tâches les contraintes qui leur manquaient : une date d'échéance, une estimation, et les heures que vous gardez libres. Elle parle aussi persan, calendrier compris.

## Calendriers Mitra
Un calendrier peut vivre dans Mitra même, sans compte derrière lui et sans rien où se connecter. Installez Mitra, ajoutez un calendrier, et commencez à planifier. Il apparaît sur tous vos appareils, et ses entrées peuvent passer vers un compte connecté dès que vous en connectez un.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="calendars-detail-dark.webp">
	<img src="calendars-detail-light.webp" alt="Des calendriers dans la barre latérale">
</picture>

Documentation : [Calendriers Mitra](../../docs/integrations/mitra.md)

## Vue tableau
Chaque entrée sur une ligne. Choisissez les jours à lister, du mois passé à tout ce que vous avez, cherchez dans les titres, les lieux et les descriptions, triez sur plusieurs colonnes à la fois, et filtrez par statut, calendrier, type ou répétition. Sélectionnez des lignes pour en modifier beaucoup d'un coup. Le titre est la même pastille que celle du calendrier, de sorte qu'une entrée s'ouvre sur place.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="table-detail-dark.webp">
	<img src="table-detail-light.webp" alt="La vue tableau, avec une colonne pour la date, le calendrier, le statut et les participants">
</picture>

Documentation : [Vue tableau](../../docs/views/table.md)

## Échéances et estimations
Une tâche peut porter une date d'échéance et une estimation avant d'avoir un horaire. Les tâches non planifiées s'alignent dans Planification selon ce qui est dû en premier, et quand vous en glissez une sur la semaine, l'estimation devient sa durée. Les tâches qui ont dépassé leur jour se rassemblent au-dessus, dans une section En retard.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="plan-task-dark.webp">
	<img src="plan-task-light.webp" alt="Une tâche glissée de Planification vers la semaine, où son estimation devient sa durée">
</picture>

Documentation : [Planification](../../docs/planning.md)

## Listes de contrôle dans les descriptions
La description d'une tâche peut contenir une liste de contrôle, écrite en Markdown, et les cases sont réelles : cochez-en une dans l'éditeur et Mitra la réécrit dans le texte, de sorte que toutes les autres applications de ce calendrier la voient aussi. Cases et sous-tâches comptent ensemble, chacune pour une étape : une tâche avec trois cases et une sous-tâche en a quatre, et avec une case cochée et la sous-tâche terminée, son menu de statut indique 2 étapes sur 4 terminées, tandis que l'anneau de sa pastille se remplit à moitié.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="checklist-dark.webp">
	<img src="checklist-light.webp" alt="La liste de contrôle d'une tâche et sa sous-tâche, comptées ensemble comme 2 étapes sur 4 dans son menu de statut">
</picture>

Documentation : [Sous-tâches](../../docs/subtasks.md)

## Disponibilité
Dessinez les heures où vous travaillez, vous entraînez ou restez libre, dans n'importe quel calendrier. Elles grisent la vue semaine pour que les heures libres ressortent. Les heures occupées apparaissent comme occupées aux personnes avec qui vous partagez un calendrier, et les libres restent les vôtres.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="availability-detail-dark.webp">
	<img src="availability-detail-light.webp" alt="Des plages de disponibilité qui grisent une semaine">
</picture>

Documentation : [Disponibilité](../../docs/availability.md)

## Calendrier persan
Mitra parle persan, et avec la langue vient son calendrier : mois et semaines persans dans les en-têtes et les sélecteurs, et dates saisies comme le persan les écrit. Vos entrées restent où elles sont. Seule la façon de les lire change.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="persian-calendar-detail-dark.webp">
	<img src="persian-calendar-detail-light.webp" alt="L'éditeur d'entrée en persan, son sélecteur de date ouvert sur un mois persan">
</picture>

Documentation : [Paramètres](../../docs/settings.md)

## Les liens sur une seule ligne
Chaque lien de la description ou du lieu d'une entrée se rassemble dans une ligne Liens de l'éditeur, nommé d'après sa destination : une page par son site, une réunion par son service, une note par son application. Un lieu qui est un lien s'affiche comme ce lien.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="links-detail-dark.webp">
	<img src="links-detail-light.webp" alt="La ligne Liens d'une entrée">
</picture>

Documentation : [Liens](../../docs/links.md)

## Contributeurs
- [@a11delavar](https://github.com/a11delavar)
