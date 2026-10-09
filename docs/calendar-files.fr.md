---
title: Fichiers de calendrier
description: "Ouvrez des fichiers .ics et des liens webcal:// avec Mitra, et faites-en l'application de calendrier que votre ordinateur utilise pour eux."
---

Les fichiers de calendrier (`.ics`) et les liens d'abonnement (`webcal://`) sont la façon dont le web distribue des événements : une invitation jointe à un e-mail, un bouton « Ajouter au calendrier » sur une page de réservation, un lien « S'abonner » pour les matchs d'une équipe. Une fois Mitra installé, il peut ouvrir les deux, et vous pouvez en faire l'application que votre ordinateur utilise pour eux.

> [!NOTE]
> Ouvrir des fichiers et des liens demande que Mitra soit [installé en tant qu'application](install-app.md) depuis un navigateur fondé sur Chromium sur un ordinateur, comme Chrome, Edge, Brave ou Opera. Dans n'importe quel navigateur, vous pouvez toujours glisser un fichier `.ics` sur Mitra.

## Faire de Mitra l'application par défaut

Installez d'abord Mitra. La première fois qu'un fichier ou un lien de calendrier l'ouvre, votre navigateur peut demander si Mitra peut le gérer : choisissez **Autoriser**. Dites ensuite à votre système d'ouvrir les fichiers `.ics` avec Mitra.

Sous Windows, faites un clic droit sur un fichier `.ics` dans l'Explorateur de fichiers et choisissez **Ouvrir avec → Choisir une autre application**. Sélectionnez **Mitra**, puis **Toujours**. Vous pouvez aussi le modifier plus tard sous **Paramètres → Applications → Applications par défaut**.

Sous macOS, faites Contrôle-clic sur un fichier `.ics` dans le Finder et choisissez **Obtenir des informations**. Sous **Ouvrir avec**, sélectionnez **Mitra**, puis cliquez sur **Tout modifier…** et confirmez.

Sous Linux, faites un clic droit sur un fichier `.ics` dans votre gestionnaire de fichiers et ouvrez **Propriétés → Ouvrir avec**. Sélectionnez **Mitra** et définissez-le par défaut.

Si Mitra est déjà ouvert, un fichier ou un lien que vous ouvrez va dans cette fenêtre au lieu d'en ouvrir une seconde.

## Ajouter un fichier de calendrier

Ouvrez un fichier `.ics` avec Mitra, ou glissez-le sur Mitra depuis votre bureau ou votre gestionnaire de fichiers. Le glisser-déposer fonctionne aussi dans un onglet de navigateur ordinaire, sans rien installer. Plusieurs fichiers s'ouvrent l'un après l'autre.

Mitra demande à quel calendrier ajouter les entrées. Avant d'ajouter quoi que ce soit, il montre ce que ce calendrier ne peut pas stocker : les entrées qu'il laisserait de côté, et les détails que certaines entrées perdraient, comme les rappels dans un calendrier qui n'en a pas. Pour continuer, appuyez sur le bouton qui indique combien d'entrées sont ajoutées, par exemple **Ajouter 12 entrées**. Pour choisir un autre calendrier, revenez en arrière avec la flèche. Le fichier lui-même ne change jamais.

Chaque entrée est ajoutée comme une nouvelle copie : ajouter deux fois le même fichier vous donne donc chaque entrée en double. Rien de ce qui est déjà dans votre calendrier n'est écrasé.

Les sous-tâches et les dépendances entre entrées du même fichier restent liées après l'importation. Une série récurrente garde ses occurrences supprimées supprimées. Une série avec des occurrences modifiées, comme une réunion déplacée à un autre jour, est laissée de côté, car Mitra ne peut pas ajouter une série avec ses modifications.

Si l'ajout échoue en cours de route, Mitra retire les entrées qu'il avait déjà ajoutées, si bien que rien du fichier ne reste à moitié importé. S'il ne peut pas en retirer certaines, il vous indique combien supprimer à la main.

## S'abonner depuis un lien webcal

Les sites qui permettent de s'abonner à un calendrier, comme des matchs de sport, des vacances scolaires ou des jours fériés, renvoient généralement vers une adresse `webcal://`. Cliquez sur l'une d'elles, et Mitra ouvre le formulaire **Abonnement à un calendrier** avec l'adresse préremplie. Vérifiez-la, renseignez **Nom d'utilisateur (facultatif)** et **Mot de passe (facultatif)** si le flux en a besoin, puis appuyez sur **Connecter**. Activez ensuite le calendrier et appuyez sur **Enregistrer**.

Cliquer sur le lien ne vous abonne jamais de lui-même : Mitra ne récupère le flux qu'une fois que vous appuyez sur **Connecter**.

Un abonnement est un calendrier en lecture seule que Mitra tient à jour à partir du flux. Voir [Abonnements à un calendrier](integrations/subscriptions.md) pour son fonctionnement.
