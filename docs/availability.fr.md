---
title: Disponibilité
description: Marquez le temps que vous réservez au travail, aux études ou à autre chose dans son calendrier, et affichez-le comme occupé pour les autres quand vous le souhaitez.
---

Une **disponibilité** est un temps que vous réservez régulièrement, comme le travail du lundi au mercredi, les études le jeudi et le vendredi, ou la maison le samedi. Mitra la grise dans la vue **Semaine**, à la couleur de son calendrier.

Une disponibilité appartient à un calendrier, à côté des événements et des tâches de ce calendrier. Vos heures de travail vont dans votre calendrier professionnel, et votre temps d'étude dans celui de votre université. Ce n'est pas un rendez-vous : Mitra la conserve donc lui-même au lieu de l'ajouter à votre compte. [Une disponibilité occupée](#busy-or-free) est la seule exception.

C'est la forme habituelle de votre semaine, pas une barrière. Un rendez-vous chez le dentiste en plein milieu de vos heures de travail ne pose aucun problème.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/availability-detail-dark.webp">
  <img src="../assets/screenshots/availability-detail-light.webp" alt="Trois jours de la vue semaine : heures de travail et temps d'étude grisés aux couleurs de leurs calendriers, avec le travail de mercredi après-midi intitulé Télétravail" />
</picture>

## Avec ou sans nom

Sans nom, un créneau n'est que sa teinte. Cela convient à la plupart des disponibilités, puisque la couleur du calendrier dit déjà à quoi sert ce temps. Donnez-lui un nom ou un lieu, et ce texte court le long du bord de la journée, comme Temps de concentration dans vos heures de travail, ou Bureau et Télétravail selon les jours.

Quand des créneaux se chevauchent, leurs teintes se mêlent en plus sombre et leurs étiquettes s'écartent : la première vers son début, la dernière vers sa fin.

## Ajouter une disponibilité

Ouvrez la palette de commandes avec <kbd>/</kbd> ou <kbd>Ctrl</kbd> + <kbd>K</kbd> et lancez **Ajouter une disponibilité**. Elle va dans votre agenda par défaut :

- Si ce calendrier n'a encore aucune disponibilité, vous obtenez des heures de travail du lundi au vendredi, de 9 h à 17 h.
- Sinon, vous obtenez un créneau sur le jour de la semaine d'aujourd'hui.

L'éditeur s'ouvre, et vous pouvez changer les horaires, les jours, le nom, le lieu ou le calendrier. Une entrée qui ne se répète pas peut aussi devenir une disponibilité via son **Type**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/availability-editor-detail-dark.webp">
  <img src="../assets/screenshots/availability-editor-detail-light.webp" alt="L'éditeur du travail de mercredi : son horaire, sa répétition hebdomadaire, Télétravail comme lieu, et Disponible" />
</picture>

## Modifier et déplacer

- Cliquez dans un créneau pour l'ouvrir. Faire glisser à travers lui crée toujours une entrée normale, comme sur une partie vide de la grille.
- Une disponibilité se répète comme n'importe quelle autre entrée. Elle a un fuseau horaire et une règle de répétition, et quand vous modifiez ou supprimez un de ses jours, Mitra demande si vous parlez de ce jour ou de tous.
- Le champ **Agenda** de l'éditeur la déplace vers un autre calendrier. Déplacer les entrées d'un calendrier avec **Déplacer les entrées vers…** emmène aussi ses disponibilités.
- Une disponibilité n'apparaît que dans la vue Semaine. Elle n'apparaît ni dans Mois, Année, Chronologie ou Tableau, ni dans les résultats de recherche, ni dans les relations.

## Afficher et masquer

L'œil d'un calendrier dans la barre latérale masque ses disponibilités avec ses événements et ses tâches. Pour masquer toutes les disponibilités sans rien d'autre, activez **Masquer les disponibilités** sous **Paramètres → Agenda**, ou trouvez-le dans la palette de commandes.

## Où une disponibilité peut vivre

Tout calendrier auquel vous pouvez ajouter des entrées peut contenir des disponibilités, y compris les calendriers [Mitra](integrations/mitra.md). Ceux-ci ne le peuvent pas :

- Les calendriers [Notion](integrations/notion.md) et [Tempo](integrations/tempo.md), puisque leurs entrées ne peuvent pas se répéter.
- Les calendriers en lecture seule, comme les [abonnements à un calendrier](integrations/subscriptions.md).

Une disponibilité reste avec son calendrier. Supprimer le calendrier, ou déconnecter le compte auquel il appartient, supprime aussi ses disponibilités.

## Occupé ou disponible

Une disponibilité a le même choix **Afficher comme occupé ou disponible** qu'un événement. Elle commence à **Disponible**, ce qui convient aux heures de travail : on peut vous réserver à ce moment. Choisissez **Occupé** pour le temps que les autres ne doivent pas prendre, comme le temps de concentration.

Dans Mitra, les deux se ressemblent. La différence, c'est ce que voient les autres. Une disponibilité libre n'est jamais écrite dans aucun de vos comptes. Une disponibilité occupée dans un [calendrier CalDAV, Google ou Apple](integrations/caldav.md#busy-availability) est ajoutée à ce calendrier sous forme d'événements occupés, avec son nom et son lieu, si bien qu'elle apparaît sur votre téléphone et que les personnes qui vous invitent voient ce temps comme pris.
