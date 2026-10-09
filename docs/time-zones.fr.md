---
title: Fuseaux horaires
description: Comment Mitra affiche le fuseau horaire propre à une entrée, et comment ajouter les heures d'autres fuseaux horaires à la vue semaine.
---

Mitra affiche les heures dans votre fuseau horaire, celui de votre appareil. Quand vous voyagez et que votre appareil change de fuseau, Mitra suit. Dans l'éditeur, ce fuseau s'appelle le fuseau horaire **principal**.

Une entrée peut aussi avoir son propre fuseau horaire, comme un vol qui part à 9 h 00 à New York. Et la vue semaine peut afficher les heures d'autres fuseaux horaires à côté des vôtres.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zone-detail-dark.webp">
  <img src="../assets/screenshots/time-zone-detail-light.webp" alt="L'éditeur d'une nouvelle entrée dont le fuseau horaire est GMT+4 Dubaï, affichant 11:00 à Dubaï, tandis que l'entrée se trouve à 9:00 sur la semaine de Berlin derrière lui" />
</picture>

## Le fuseau horaire d'une entrée

Chaque entrée avec des heures a un fuseau horaire. Les entrées que vous créez prennent le vôtre, et les entrées venant d'autres applications gardent le fuseau dans lequel elles ont été créées.

Ouvrez une entrée pour voir son fuseau dans la ligne avec le globe, sous ses dates, écrit comme un décalage et une ville, par exemple « GMT-4 New York ». Les entrées de toute la journée n'ont pas de fuseau horaire ni de telle ligne, car elles couvrent les mêmes jours pour tout le monde.

### Changer le fuseau horaire d'une entrée

Cliquez sur le fuseau et choisissez-en un autre. Saisissez une ville, le nom d'un fuseau ou un décalage pour le trouver. Votre propre fuseau est en tête de liste, marqué **Principal**.

L'entrée conserve ses heures d'horloge dans le nouveau fuseau : une réunion à 9 h 00 à Berlin devient une réunion à 9 h 00 à New York. Si seul le fuseau était faux et que la réunion elle-même n'a pas bougé, changez ensuite ses heures.

### Votre heure ou celle de l'entrée

Quand le fuseau d'une entrée diffère du vôtre, l'éditeur affiche ses heures dans votre fuseau, donc une réunion à 9 h 00 à New York s'affiche 15 h 00 si vous êtes à Berlin. Un bouton à côté du fuseau bascule vers l'heure propre de l'entrée et inversement. Il affiche une maison quand vous voyez votre heure et un globe quand vous voyez celle de l'entrée, et le pointer vous indique laquelle vous regardez.

Vous pouvez modifier les heures dans les deux cas. Pour changer le fuseau lui-même, passez d'abord à l'heure de l'entrée.

### Heures d'horloge murale

Certaines entrées viennent d'autres applications sans aucun fuseau horaire, et affichent **Horloge murale (pas de fuseau horaire)**. Leurs heures n'appartiennent à aucun lieu : une alarme à 7 h 00 est prévue à 7 h 00 où que vous soyez, et l'éditeur l'affiche à 7 h 00 dans chaque fuseau horaire. Ses rappels se déclenchent à cette heure d'horloge sur chaque appareil.

Choisir un fuseau pour une telle entrée lui donne ce fuseau et conserve ses heures d'horloge. Elle ne peut pas redevenir une entrée à horloge murale.

### Quels agendas le prennent en charge

- Les **calendriers stockés dans Mitra**, les [serveurs de calendrier](integrations/caldav.md) et [Google Calendar](integrations/google.md) conservent le fuseau horaire de chaque entrée, et les autres applications le voient.
- **[Notion](integrations/notion.md)** n'a pas de fuseaux horaires. Ses heures s'affichent dans le vôtre, et l'éditeur n'a pas de ligne de fuseau horaire.
- **[Tempo](integrations/tempo.md)** lit les journaux de travail dans le fuseau horaire de votre profil Jira, et l'éditeur n'a pas non plus de ligne de fuseau horaire.
- Les **[Abonnements](integrations/subscriptions.md)** sont en lecture seule : vous pouvez voir le fuseau d'une entrée et basculer entre les deux heures, mais pas le modifier.

## Fuseaux horaires dans la vue semaine

La [vue semaine](views/week.md) peut afficher les heures d'autres fuseaux horaires dans des colonnes à côté des vôtres, de sorte que vous voyez quelle heure il est là-bas à chaque heure de votre journée.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zones-detail-dark.webp">
  <img src="../assets/screenshots/time-zones-detail-light.webp" alt="La vue semaine avec une colonne EDT des heures de New York à côté de la colonne GMT+2, de sorte que 07:00 à Berlin s'affiche 01:00 à New York" />
</picture>

### Ajouter un fuseau horaire à la semaine

Pointez le haut de la colonne des heures et appuyez sur **＋** (**Ajouter un fuseau horaire**), puis choisissez un fuseau. Sa colonne apparaît à côté de la vôtre, et votre propre fuseau reste la colonne contiguë aux jours.

Chaque colonne a pour en-tête un nom court, comme « PDT » ou « GMT+2 ». Pointez-le pour voir le nom complet.

### Renommer ou supprimer un fuseau horaire

Cliquez sur le nom d'un fuseau et choisissez **Renommer** pour lui donner un libellé de votre choix, comme « NYC », ou **Supprimer** pour retirer sa colonne. Pour revenir au nom automatique, renommez-le avec un nom vide.

Votre propre fuseau peut être renommé, mais pas supprimé.

### Replier les colonnes supplémentaires

Les colonnes supplémentaires prennent de la place aux jours. Pour les masquer, pointez le haut de la colonne des heures et appuyez sur la flèche sous le **＋**. Appuyez à nouveau pour les afficher. Vous pouvez aussi faire glisser la colonne des heures vers les jours pour les ouvrir, et en sens inverse pour les fermer, ce qui est la méthode sur un écran tactile.

Sur un écran étroit, les colonnes démarrent repliées jusqu'à ce que vous les ouvriez ou les fermiez vous-même. Ajouter un fuseau les fait toujours apparaître.

### Sur tous vos appareils

Les fuseaux que vous ajoutez, et leurs noms, appartiennent à votre compte, donc ils s'affichent sur chaque appareil que vous utilisez. Le nom que vous donnez à votre propre fuseau, et le fait que les colonnes soient repliées ou non, restent propres à chaque appareil, puisque chaque appareil peut se trouver dans un fuseau différent.
