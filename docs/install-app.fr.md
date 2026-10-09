---
title: Installer l'application
description: "Installez Mitra en tant qu'application sur un ordinateur, un téléphone Android, un iPhone ou un iPad, pour qu'il s'ouvre dans sa propre fenêtre."
---

Mitra fonctionne dans votre navigateur, et vous pouvez aussi l'installer en tant qu'application. Rien ne vient d'une boutique d'applications : votre navigateur donne à Mitra sa propre fenêtre et son icône, et vous l'ouvrez depuis votre dock, votre barre des tâches, votre menu démarrer ou votre écran d'accueil comme n'importe quelle autre application.

L'installer vaut le coup pour trois raisons :

- Mitra s'ouvre dans sa propre fenêtre, à l'écart des onglets de votre navigateur, et ses notifications s'affichent sous son propre nom et son icône.
- Sur un iPhone ou un iPad, c'est le seul moyen d'obtenir des [rappels](reminders.md).
- Sur un ordinateur, Mitra peut ouvrir pour vous les fichiers `.ics` et les liens `webcal://`. Voir [Fichiers de calendrier](calendar-files.md).

L'application installée s'appelle toujours Mitra et a l'icône de Mitra, même quand votre serveur donne à l'instance [un nom à elle](configuration.md#name-your-instance).

## Sur un ordinateur

Dans Chrome, Edge et les autres navigateurs fondés sur Chromium, ouvrez Mitra et cliquez sur l'icône d'installation à l'extrémité de la barre d'adresse. Quand le navigateur propose d'installer Mitra, la barre latérale affiche aussi un bouton **Installer en tant qu'application** en bas. Vous pouvez aussi passer par le menu du navigateur : dans Chrome, **Caster, enregistrer et partager → Installer la page en tant qu'application**, et dans Edge, **Applications → Installer ce site en tant qu'application**.

Dans Safari sur un Mac, choisissez **Fichier → Ajouter au Dock**.

Une fois installé, Mitra s'ouvre dans sa propre fenêtre. Si cette fenêtre est déjà ouverte quand vous ouvrez un fichier ou un lien de calendrier, Mitra la met au premier plan au lieu d'en ouvrir une seconde.

## Sur Android

Ouvrez Mitra dans Chrome, ouvrez le menu du navigateur (**⋮**) et choisissez **Installer l'application** ou **Ajouter à l'écran d'accueil**. Mitra apparaît alors avec vos autres applications.

Les rappels fonctionnent aussi dans le navigateur sur Android : installer est donc facultatif.

## Sur iPhone et iPad

Ouvrez Mitra dans Safari, touchez le bouton Partager, puis **Sur l'écran d'accueil**. Dès lors, ouvrez Mitra depuis son icône sur votre écran d'accueil.

Sur iPhone et iPad, les notifications ne fonctionnent que dans l'application installée, à partir d'iOS et d'iPadOS 16.4. Autorisez-les depuis l'application installée : Safari et l'application sont distincts, et seule l'application peut recevoir des rappels.

> [!NOTE]
> Si votre serveur se trouve derrière un proxy inverse qui vous connecte avec un cookie, l'installation fonctionne quand même. Mitra demande la description de son application (le manifeste d'application web) avec vos cookies, si bien que le proxy laisse passer la requête.
