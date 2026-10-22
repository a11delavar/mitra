---
title: Pièces jointes
description: "Ajoutez des fichiers à un événement ou à une tâche. Mitra les conserve sur votre serveur et les enregistre avec l'entrée, si bien que les autres applications d'agenda les voient aussi."
---

Une entrée peut avoir des **pièces jointes** : des fichiers comme un billet, la photo d'un tableau blanc ou une recette. Mitra conserve le fichier sur votre serveur et l'enregistre avec l'entrée dans le format d'agenda standard, si bien que les autres applications qui utilisent le même calendrier, comme Nextcloud ou Apple Calendar, affichent le même fichier sur le même événement.

## Ajouter un fichier

Ouvrez l'entrée et appuyez sur **＋** dans la ligne au trombone, ou sur le mot **Pièces jointes** tant que la ligne est encore vide, puis choisissez un ou plusieurs fichiers. Chaque pièce jointe affiche une icône pour son type, son nom et sa taille. Cliquez sur l'une d'elles pour l'ouvrir dans un nouvel onglet, et appuyez sur son **✕** pour la retirer de l'entrée.

Un trombone sur l'entrée dans le calendrier indique quelles entrées ont des fichiers.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/attachments-detail-dark.webp">
  <img src="../assets/screenshots/attachments-detail-light.webp" alt="Une tâche ouverte à côté de son entrée dans la semaine, dont le trombone montre qu'elle porte des fichiers : l'éditeur liste un PDF, un croquis et un tableur au-dessus de la description, qui montre le croquis" />
</picture>

Les liens ne sont pas des pièces jointes. Pour ajouter un lien à une entrée, écrivez-le dans la description, et la ligne [Liens](links.md) l'affiche.

## Où les fichiers sont conservés

Les fichiers que vous ajoutez sont conservés dans le dossier `files` du dossier de données de Mitra, à côté de sa base de données : une [sauvegarde](backups.md) de ce dossier les inclut donc. Chaque fichier est enregistré sous un nom aléatoire plutôt que sous le sien, et le même fichier ajouté deux fois n'est conservé qu'une fois.

> [!IMPORTANT]
> Quiconque a l'adresse d'un fichier peut l'ouvrir sans se connecter à Mitra. C'est ce qui permet aux autres applications d'agenda d'ouvrir le fichier : Mitra écrit l'adresse dans votre calendrier, et ces applications ne peuvent pas se connecter à Mitra. L'adresse contient une partie aléatoire impossible à deviner, mais traitez-la comme n'importe quel lien de partage. Pour obtenir une nouvelle adresse, retirez la pièce jointe et ajoutez à nouveau le fichier.

Les images, vidéos, fichiers audio, PDF et textes bruts s'ouvrent dans le navigateur. Tout autre type de fichier est téléchargé, si bien qu'un fichier ne peut jamais exécuter de code dans Mitra.

## Limites

Un fichier peut faire jusqu'à 25 Mo, et la quantité qu'une personne peut stocker n'est pas limitée. La personne qui gère le serveur peut changer les deux, ou désactiver l'ajout de fichiers ; voir [Configuration](configuration.md#attachments). Dans la [démo](https://demo.mitracal.com), l'ajout de fichiers est toujours désactivé.

Un fichier qu'aucune entrée n'utilise plus est supprimé environ un jour après avoir été ajouté. D'ici là, vous pouvez encore l'ajouter à une entrée pas encore enregistrée, ou le remettre après l'avoir retiré par erreur.

## Quels agendas le prennent en charge

Les calendriers d'un [serveur CalDAV](integrations/caldav.md) et d'[Apple Calendar](integrations/apple.md) acceptent les pièces jointes, tout comme les [calendriers Mitra](integrations/mitra.md). Dans un [abonnement à un calendrier](integrations/subscriptions.md), vous voyez les pièces jointes du flux, sans pouvoir les modifier.

Un fichier peut aussi apparaître dans la description : le bouton image ou lien de sa ligne l'ajoute à la fin du texte, en image pour les images et en lien pour le reste. Retirer la pièce jointe retire cela aussi.

Dans un [calendrier Google](integrations/google.md), les pièces jointes sont les fichiers Google Drive joints dans Google Agenda : Mitra les affiche, mais ne peut ni en ajouter ni en retirer. Les calendriers [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) et [Tempo](integrations/tempo.md) n'ont pas de ligne de pièces jointes. Déplacer une entrée avec des pièces jointes vers l'un d'eux en perd les fichiers, et Mitra vous le dit avant que quoi que ce soit ne bouge.

> [!NOTE]
> Les pièces jointes ajoutées par d'autres applications apparaissent aussi dans Mitra, y compris les fichiers que votre serveur d'agenda stocke lui-même, qui s'ouvrent avec l'adresse propre à ce serveur. Mitra laisse telles quelles les pièces jointes qu'il ne reconnaît pas : modifier une entrée dans Mitra ne change donc jamais les pièces jointes d'une autre application.
