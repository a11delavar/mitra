---
title: IA, pièces jointes, régions et langues
---
Mitra 0.7 vous permet de joindre des fichiers à vos entrées, écrit les dates au format de votre région, garde le fuseau horaire de votre domicile avec vous en voyage et montre ce qui a changé directement dans l'application. Il glisse, zoome et charge aussi plus vite, et apporte de nombreuses petites améliorations et corrections depuis la 0.6.

## IA
Nous explorons comment l'IA peut vous aider à planifier votre temps, dans Mitra même et depuis les assistants que vous utilisez déjà.

## Régions & langues
Choisissez votre pays en même temps que votre langue. Mitra écrit alors les dates, les heures et les nombres comme on le fait là-bas. Votre semaine commence le jour où elle y commence, et le week-end tombe sur vos jours de repos. Un aperçu vous montre le résultat avant que vous ne décidiez. Les raccourcis clavier fonctionnent désormais aussi lorsque votre clavier tape dans une autre écriture, comme le persan.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="locales-dark.webp">
	<img src="locales-light.webp" alt="Le paramètre Langue, ouvert sur ses langues, l'italien déplié sur les pays où il s'écrit">
</picture>

Documentation : [Paramètres](../../docs/settings.md)

## Fuseau horaire du domicile
Mitra connaît désormais le fuseau horaire de votre domicile et le garde avec votre compte. Quand vous voyagez, le calendrier suit votre appareil, et votre domicile reste dans la colonne voisine. Votre liste de fuseaux reste telle qu'elle était, si bien qu'au retour vous ne voyez de nouveau qu'une seule colonne. Les fuseaux que vous ajoutez et les noms que vous leur donnez sont les mêmes sur tous vos appareils. Chaque colonne porte le nom court qu'on utilise vraiment pour ce fuseau.

Le sélecteur de fuseaux horaires a lui aussi été repensé. Les fuseaux qui partagent un nom et une heure sont regroupés sur une seule ligne, et ceux de votre propre pays viennent en premier. Une maison marque votre domicile, et une épingle marque le fuseau où vous êtes pendant un voyage.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="time-zones-dark.webp">
	<img src="time-zones-light.webp" alt="Le sélecteur de fuseaux horaires, ouvert sur le domicile parmi les fuseaux regroupés autour">
</picture>

> [!NOTE]
> Si vous avez donné un nom personnel au fuseau horaire où vous êtes, donnez-lui ce nom une nouvelle fois, s'il vous plaît. Jusqu'ici, ces noms restaient sur l'appareil où vous les aviez donnés. Désormais, un nom vous suit sur tous vos appareils.

Documentation : [Fuseaux horaires](../../docs/time-zones.md)

## Pièces jointes
Vous pouvez maintenant joindre des fichiers à une entrée, par exemple un billet, un ordre du jour ou une photo d'un tableau blanc. Ajoutez-les avec le trombone dans l'éditeur de l'entrée, ou faites-les glisser sur l'entrée ouverte. Cliquez sur un fichier pour l'ouvrir. Vous pouvez aussi ajouter un fichier à la description, où une image s'affiche comme image et tout autre fichier comme lien. Si vous retirez le fichier plus tard, Mitra le retire aussi de la description.

Les pièces jointes se synchronisent avec votre calendrier. Dans un calendrier CalDAV, les autres applications qui utilisent le même calendrier voient les fichiers que vous joignez, et Mitra affiche ceux qu'elles ont joints. Dans Google Agenda, Mitra affiche les fichiers Google Drive joints à un événement, mais ne peut ni en ajouter ni en retirer, car Google ne conserve que les fichiers Drive. Les images d'une page Notion apparaissent maintenant dans la description de la tâche.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="attachments-dark.webp">
	<img src="attachments-light.webp" alt="Une tâche ouverte à côté de son entrée dans la semaine, dont le trombone montre qu'elle porte des fichiers : l'éditeur liste un PDF, un croquis et un tableur au-dessus de la description, qui montre le croquis">
</picture>

> [!NOTE]
> Mitra enregistre les fichiers que vous joignez dans son dossier de données : sauvegarder ce dossier sauvegarde donc aussi vos fichiers. Vous pouvez limiter la taille d'un fichier avec `MITRA_FILE_MAX_SIZE`, et ce que chaque personne peut stocker au total avec `MITRA_FILE_QUOTA`.

Documentation : [Pièces jointes](../../docs/attachments.md)

## Notes de version dans l'application
Vous pouvez désormais voir ce qui a changé sans quitter Mitra. La fenêtre À propos montre chaque version comme le fait le site. Elle contient les notes et les images de la version que vous utilisez, ainsi que les correctifs venus ensuite. Chaque commit y figure aussi, replié jusqu'à ce que vous en ayez besoin.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="about-dark.webp">
	<img src="about-light.webp" alt="La boîte de dialogue À propos, ouverte sur les notes et les images d'une version">
</picture>

## Chinois
Mitra apprend le chinois, en caractères simplifiés : l’application, son agenda d’exemple, la documentation et le site, avec une police conçue pour lui.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="chinese-detail-dark.webp">
	<img src="chinese-detail-light.webp" alt="L'éditeur d'entrée en chinois, son sélecteur de date ouvert sur le mois">
</picture>

Documentation : [Paramètres](../../docs/settings.md)
