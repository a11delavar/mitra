---
title: Liens
description: "Comment Mitra affiche les liens d'une entrée : la réunion à rejoindre, la note à ouvrir, la page à lire."
---

Les liens d'une entrée montrent ce vers quoi ils mènent plutôt que leur adresse brute. Un lien de réunion s'affiche **Rejoindre Google Meet**, un lien vers une note Obsidian affiche le nom de la note, et une page web affiche son site et son chemin, comme `example.atlassian.net/browse/DEV-9177`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/links-detail-dark.webp">
  <img src="../assets/screenshots/links-detail-light.webp" alt="L'éditeur d'une entrée avec une ligne Liens au-dessus de sa description, contenant un lien vers une note dans Obsidian" />
</picture>

## Dans l'éditeur

Quand la description d'une entrée contient des liens, l'éditeur les rassemble dans une ligne **Liens** juste au-dessus de la description, pour que vous puissiez les ouvrir sans lire le texte. Cliquez sur l'un d'eux pour l'ouvrir : une page web s'ouvre dans un nouvel onglet, tout autre lien ouvre son application. Au-delà de deux lignes, la ligne défile.

La ligne n'a pas de stockage propre : elle montre ce que contient la description. Pour ajouter ou retirer un lien, modifiez la description, et la ligne suit. Toutes les autres applications de calendrier que vous utilisez voient les mêmes liens dans la description.

## Dans la description

Les liens de la description sont précédés d'une petite icône indiquant ce qu'ils ouvrent. Une adresse nue, comme celle collée depuis un navigateur, est raccourcie à son site et son chemin. Un lien que vous avez écrit avec vos propres mots garde vos mots.

Mitra reconnaît aussi les liens d'applications, comme `obsidian://open?vault=…`, que la plupart des applications de calendrier laissent en texte brut. Les liens qui exécuteraient du code, comme `javascript:`, s'affichent en texte brut et jamais comme des liens.

## Liens de réunion et d'application dans le lieu

Un lieu qui est un seul lien est traité comme ce lien plutôt que comme un endroit. Un lien Zoom, Google Meet, Microsoft Teams, Webex, Jitsi, Whereby, FaceTime ou Skype s'affiche comme **Rejoindre** suivi du nom du service, dans l'éditeur, dans le calendrier et dans le tableau. Il n'a pas de bouton de carte. Cliquez à côté du lien pour le modifier.

## Liens vers des applications

Mitra nomme l'application à laquelle un lien appartient d'après son adresse. Il connaît Obsidian, Notion, Slack, Linear, Figma, Things, OmniFocus, Bear, Craft, Drafts, DEVONthink, Evernote, OneNote, Visual Studio Code, Cursor et Spotify. Chaque lien d'application, connue ou non, affiche la même icône d'ouverture dans une autre application.

> [!NOTE]
> Une page web ne peut pas savoir si une application est installée. La première fois que vous ouvrez un lien d'application, votre navigateur demande s'il doit ouvrir l'application. Si l'application est absente, rien ne se passe.
