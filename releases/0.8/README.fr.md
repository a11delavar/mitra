---
title: Suivi des routines, Todoist, sous-tâches et échéances en un coup d'œil
---
Mitra 0.8 vous aide à tenir les choses que vous faites encore et encore, et montre comment les plus grands travaux s'assemblent.

## Suivi des routines
Mitra regroupe déjà en routines ce que vous faites souvent, comme la salle de sport ou une coupe de cheveux toutes les cinq semaines. Elles ont désormais une place à elles, où vous voyez d'un coup d'œil les derniers jours de chaque routine : combien vous en avez tenu, et lesquels ont été annulés ou manqués. Vous pouvez renommer une routine, fusionner deux routines qui vont ensemble, ou indiquer à Mitra que quelque chose n'est pas une routine. Les routines restent aussi stables dans les vues mois et année, aussi loin que vous fassiez défiler, et votre connecteur IA peut vous dire où elles en sont.

## Même heure partout
Certaines choses ne dépendent pas de votre fuseau horaire : un médicament à 7 h 30 se prend à 7 h 30, chez vous comme en voyage. Choisissez **Même heure partout** en haut des fuseaux horaires d'une entrée, et elle reste à cette heure où que vous soyez, marquée d'un globe barré. Les entrées venues d'autres applications sans fuseau horaire l'affichent aussi. Avant que vous en déplaciez une vers un calendrier qui n'a pas de telles heures, comme Google Calendar, Mitra vous prévient qu'elle recevra un fuseau horaire fixe.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="same-time-dark.webp">
	<img src="same-time-light.webp" alt="L'éditeur d'une entrée sur le médicament du matin, ses fuseaux horaires ouverts sur Même heure partout">
</picture>

Documentation : [Même heure partout](../../docs/time-zones.md#same-time-everywhere)

## De meilleures sous-tâches
Les sous-tâches d'une entrée partagent une même ligne dans les vues mois et année, si bien qu'un projet se lit comme un seul trait, ses courtes sous-tâches repliées dedans. Le tableau range les sous-tâches sous leur parent, et la vue année peut les masquer. La progression d'une tâche pondère chaque sous-tâche selon sa taille, si bien qu'un long travail compte davantage qu'un travail rapide.

## Les échéances en un coup d'œil
Le jour d'échéance d'une tâche s'affiche sur son drapeau, et pointer la tâche marque ce jour dans le calendrier. La chronologie le marque aussi, et le tableau gagne une colonne pour lui. Une sous-tâche sans date d'échéance propre prend celle de son parent.

## Personnalisation
Donnez à chaque calendrier l'une de deux nouvelles couleurs, ou la couleur de votre choix. Renommez l'en-tête d'un compte d'un double-clic et masquez tous ses calendriers d'un coup. Pour tout le reste, modifiez l'apparence de Mitra avec votre propre CSS : pour vous dans les Paramètres, ou pour tout le monde sur votre serveur grâce à un fichier dans son dossier de données. Qui administre le serveur dispose d'une section à lui dans les Paramètres.

## Dupliquer sur d'autres jours
Certaines choses tombent des jours qu'aucune répétition ne sait décrire. Une ordonnance de huit séances de kinésithérapie se cale sur les créneaux libres du cabinet, et un client vous réserve le 3, le 9 et le 17. Ajoutez la première, choisissez **Dupliquer sur d'autres jours** dans son menu ⋯ et cochez les autres sur les deux mois affichés. Maintenez Maj pour choisir plusieurs jours d'affilée d'un coup. Chaque jour reçoit une copie à la même heure, une entrée à part entière que vous pouvez déplacer ou modifier comme n'importe quelle autre.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="duplicate-days-dark.webp">
	<img src="duplicate-days-light.webp" alt="La boîte de dialogue Dupliquer sur d'autres jours d'une séance de kinésithérapie, sept autres séances choisies en octobre et novembre">
</picture>

Documentation : [Dupliquer sur d'autres jours](../../docs/entries.md#the--menu)

## Todoist
Connectez vos projets Todoist, et leurs tâches prennent place sur la même chronologie que vos événements, synchronisées dans les deux sens. Chaque projet devient un calendrier avec sa couleur de Todoist. La date, la durée et l'échéance d'une tâche deviennent sa planification, sa durée et sa date d'échéance. Une tâche récurrente dans Todoist apparaît à sa prochaine date, et la terminer dans Mitra la fait passer à la date suivante, comme le fait Todoist. La priorité, les étiquettes et les sections restent telles quelles.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="todoist-dark.webp">
	<img src="todoist-light.webp" alt="La boîte de dialogue Ajouter une intégration, le pointeur sur Todoist parmi les autres fournisseurs">
</picture>

Documentation : [Todoist](../../docs/integrations/todoist.md)

## Plus de langues
Mitra apprend l'arabe, le russe, le polonais et le néerlandais. À chaque version, Mitra fonctionne mieux dans d'autres langues, écritures et calendriers. Chaque nouvelle langue arrive entièrement traduite, documentation et site web compris.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="arabic-week-dark.webp">
	<img src="arabic-week-light.webp" alt="La vue semaine en arabe, disposée de droite à gauche, avec un événement ouvert dans l'éditeur">
</picture>

## Contributeurs
- [@jkngale](https://github.com/jkngale) : les bases pour Todoist
