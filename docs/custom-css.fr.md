---
title: CSS personnalisé
description: "Modifiez l'apparence de Mitra avec votre propre CSS : une feuille de style à vous qui suit votre compte, et une pour tout le monde sur le serveur."
---

L'apparence de Mitra est du CSS ordinaire, et vous pouvez ajouter le vôtre par-dessus. Masquez ce que vous n'utilisez jamais, entourez aujourd'hui d'un cadre ou donnez vos couleurs à tout le serveur. Il y a deux endroits pour cela : **Paramètres → Général → CSS personnalisé** pour vous-même, et, là où l'on se connecte, **Paramètres → Administration → CSS personnalisé pour tous** pour tout le monde sur le serveur.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/custom-css-dark.webp">
  <img src="../assets/screenshots/custom-css-light.webp" alt="Mitra dans l'or de son logo, avec la règle de CSS personnalisé qui le fait ouverte dans les paramètres" />
</picture>

> [!WARNING]
> Jusqu'à Mitra 1.0, chaque mise à jour peut changer les éléments, attributs et variables que vos règles ciblent. Une règle qui fonctionne aujourd'hui peut cesser de fonctionner après une mise à jour, ou se mettre à masquer quelque chose. Gardez votre feuille de style courte et regardez Mitra après chaque mise à jour.

## Votre propre feuille de style

Ouvrez **Paramètres → Général** et tapez du CSS dans le champ sous **CSS personnalisé**. Mitra l'applique pendant que vous tapez, l'enregistre un instant après que vous vous êtes arrêté, et elle suit votre compte sur chaque appareil et chaque navigateur depuis lesquels vous vous connectez.

L'interrupteur à côté de **CSS personnalisé** désactive votre feuille de style sans la perdre, et la [palette de commandes](shortcuts.md) propose **CSS personnalisé : Désactivé** et **CSS personnalisé : Activé**.

`@import` est retiré à l'enregistrement : collez une feuille de style entière plutôt que d'en lier une.

## La feuille de style du serveur

Là où l'on se connecte, un administrateur peut modifier l'apparence de Mitra pour tout le monde sur le serveur : ouvrez **Paramètres → Administration** et saisissez du CSS dans la zone sous **CSS personnalisé pour tous**. Vous le voyez pendant la saisie, et les autres dès leur prochain chargement de Mitra. Son interrupteur le désactive pour tout le monde sans le perdre. La première personne à se connecter à un serveur en est l'administrateur. Sans connexion, votre propre feuille de style atteint déjà tous ceux qui utilisent Mitra : c'est la seule.

Elle convient à ce qui rend un serveur le vôtre, comme ses couleurs, sa police ou le [nom](configuration.md#name-your-instance) qu'il porte déjà. La feuille de style de chaque personne vient après, donc la sienne l'emporte là où les deux règlent la même chose.

## Votre règle l'emporte

Les règles propres à Mitra se trouvent dans une couche de cascade nommée `mitra`, les vôtres non, donc une règle à vous l'emporte sur celle de Mitra quel que soit son sélecteur. Vous n'avez pas besoin de `!important`. Les quelques déclarations `!important` de Mitra restent au-dessus, car les couches les classent dans l'autre sens : elles tiennent la mise en page.

Pour retirer quelque chose que Mitra définit, plutôt que de peindre par-dessus, donnez à la propriété la valeur `revert`. Ceci retire le fond des jours dans la vue mois :

```css
mitra-weeks mitra-day {
	background: revert;
}
```

## Exemples

### Masquer les jours hors du mois

```css
mitra-weeks [data-outside] {
	visibility: hidden;
}
```

Dans la [vue mois](views/month.md), ceci masque les jours avant et après le mois affiché, leur date et leur fond. Les entrées qui s'y trouvent restent. `visibility` garde la grille en place, là où `display: none` la déferait. Zoomez pour donner plus de place aux jours du mois.

### Un cadre autour d'aujourd'hui

```css
mitra-weeks mitra-day[today] {
	outline: 2px solid var(--color-accent);
	outline-offset: -2px;
}
```

`outline` plutôt que `border` : une bordure agrandirait le jour et décalerait la grille.

### Vos propres couleurs

```css
:root {
	--color-accent: light-dark(#2e7d32, #81c784);
	--border-radius: 8px;
}
```

`light-dark()` prend la couleur du thème clair, puis celle du thème sombre. Tout ce que Mitra colore avec ces variables suit, y compris la barre de titre de l'[application installée](install-app.md) :

| Variable | Ce qu'elle colore |
| --- | --- |
| `--color-accent` | Aujourd'hui, la sélection, les anneaux de focus et les boutons principaux |
| `--color-background-seed` | Le fond derrière tout ; les dialogues en tirent le leur |
| `--color-surface` | Les jours dans les vues, et ce qui repose sur le fond, comme la palette de commandes |
| `--color-text` | Le texte |
| `--color-text-muted` | Le texte secondaire, comme les indications et les heures |
| `--color-error` | Les erreurs et les avertissements |
| `--border-radius` | Les coins des boutons, des entrées et de la plupart des contrôles |
| `--font-family` | La police du texte |

## Trouver quoi cibler

Les outils de développement de votre navigateur montrent ce qui est sur la page : faites un clic droit sur un élément et choisissez **Inspecter**. Les éléments propres à Mitra s'appellent `mitra-…`, comme les vues `mitra-days` (semaine), `mitra-weeks` (mois), `mitra-months` (année), `mitra-timeline` et `mitra-table`, un jour `mitra-day`, une entrée `mitra-entry-segment` et la barre latérale `mitra-sidebar`. Les attributs énoncent des faits, comme `today`, `data-outside` et `data-date`.

Les boutons, champs, interrupteurs, menus et autres contrôles gardent leur intérieur pour eux. Atteignez-les par leurs parties, comme `mitra-switch::part(switch)`, et par les variables `--mitra-…` qu'ils lisent. S'il vous faut aller plus loin, demandez une partie dans une [issue](https://github.com/a11delavar/mitra/issues).

## Ce qu'il vaut mieux laisser

Quelques éléments tiennent Mitra ensemble, et les modifier le casse :

- `display` ou `position` sur `mitra-day`, ou sur les `.entries` d'une vue : ils reposent sur une grille que toute la vue partage, et sans elle la vue semaine devient très lente.
- Les variables qui commencent par `--_` : elles changent à chaque image d'un zoom, et les définir le contrarie.
- La taille d'une entrée : son titre choisit sa mise en page selon sa largeur, donc la dimensionner de l'extérieur peut la faire basculer.
- `all: unset` annule aussi le masquage, alors ajoutez `[hidden] { display: none }` à côté.

## Quand une règle cache le chemin du retour

Ajoutez `?css=off` à l'adresse, par exemple `https://mitra.example.com/?css=off`. Mitra se charge alors une fois sans aucune des deux feuilles de style, pour que vous puissiez ouvrir **Paramètres** et corriger la vôtre. Un administrateur corrige celle de tout le monde de la même façon.

## Avant de coller

Une feuille de style n'exécute aucun code, mais elle peut charger des adresses, et une feuille écrite pour cela peut leur envoyer ce qui est à l'écran. Ne collez que du CSS que vous comprenez. Votre feuille de style n'atteint que vous ; celle du serveur atteint tout le monde sur celui-ci.

## Partagez la vôtre

Sous la zone, **Partager sur GitHub** ouvre une nouvelle discussion dans la catégorie [Custom CSS](https://github.com/a11delavar/mitra/discussions/categories/custom-css), votre feuille de style déjà dedans. Dites ce qu'elle fait, ajoutez une capture d'écran si elle montre quelque chose, et publiez-la. Une feuille de style trop longue pour le lien est copiée dans votre presse-papiers, pour que vous la colliez dans la discussion. La catégorie rassemble aussi les feuilles de style que d'autres ont partagées : lisez-les avant de les coller.
