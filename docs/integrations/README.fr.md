---
title: Intégrations
description: Gardez des calendriers dans Mitra même, ou connectez CalDAV, Google Calendar, Apple Calendar, des abonnements à des calendriers, Notion et Tempo, et découvrez comment fonctionne la synchronisation.
sidebar:
  label: Aperçu
---

Il y a deux façons d'avoir un calendrier dans Mitra. Vous pouvez le stocker dans Mitra même, sur votre serveur, sans aucun compte derrière. Ou vous pouvez connecter un compte que vous avez déjà, et Mitra garde ses calendriers synchronisés dans les deux sens. La plupart des gens finissent par mélanger les deux, et les entrées passent librement de l'un à l'autre.

Pour ajouter l'un ou l'autre, choisissez **Ajouter une intégration** au bas de la barre latérale.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/integrations-detail-dark.webp">
  <img src="../../assets/screenshots/integrations-detail-light.webp" alt="La boîte de dialogue Ajouter une intégration, qui propose Mitra, CalDAV, Google Calendar, Apple Calendar, les abonnements à des calendriers, Notion et Tempo" />
</picture>

## Ce que chacune contient

| Intégration | Ce qu'elle contient | Configuration sur le serveur |
| --- | --- | --- |
| [Mitra](mitra.md) | Des événements et des tâches, stockés dans Mitra | Aucune |
| [CalDAV](caldav.md) | Des événements et des tâches de n'importe quel serveur CalDAV | Aucune |
| [Google Calendar](google.md) | Les calendriers d'un compte Google | Une configuration OAuth, une seule fois |
| [Apple Calendar](apple.md) | Les calendriers d'un compte iCloud | Aucune |
| [Abonnements à des calendriers](subscriptions.md) | Un flux `webcal://` ou `.ics` publié, en lecture seule | Aucune |
| [Notion](notion.md) | Des tâches issues de vues de bases de données Notion | Aucune |
| [Tempo](tempo.md) | Les heures que vous imputez sur les tickets Jira | Aucune |

Chaque fournisseur stocke des choses différentes. Les tâches Notion ne peuvent pas se répéter, par exemple, et un worklog Tempo n'a pas de lieu. Mitra masque les champs qu'un calendrier ne peut pas stocker, si bien que rien de ce que vous saisissez ne disparaît à la prochaine synchronisation.

## Comment fonctionne la synchronisation

Quand vous connectez un compte, Mitra trouve ses calendriers et les liste, tous cochés. Décochez ceux dont vous ne voulez pas avant d'enregistrer, et Mitra importe les autres. Les calendriers qui apparaissent plus tard dans le compte arrivent décochés : rien de nouveau n'atterrit donc dans votre agenda sans que vous l'ayez choisi. Mitra ne télécharge jamais un calendrier désactivé.

Ensuite, le serveur synchronise tout seul en arrière-plan. Il vérifie plus souvent tant que quelqu'un a Mitra ouvert, et espace ses passages quand personne ne l'a ouvert :

| | Pendant que Mitra est ouvert | Pendant que personne ne l'a ouvert |
| --- | --- | --- |
| CalDAV et Apple Calendar | toutes les 10 secondes | toutes les 5 minutes |
| Google Calendar, Notion et Tempo | environ une fois par minute | toutes les 5 minutes |
| Abonnements à des calendriers | toutes les 15 minutes | toutes les 15 minutes |
| Calendriers Mitra | rien à synchroniser | rien à synchroniser |

Google, Notion et Tempo limitent la fréquence à laquelle les applications peuvent les appeler, c'est pourquoi ils sont plus lents. Quand vous ouvrez Mitra, tous les comptes dont c'est le tour se synchronisent aussitôt : il n'y a donc pas de bouton d'actualisation à presser.

Les changements circulent dans les deux sens. Quand vous créez, modifiez, déplacez ou supprimez une entrée, Mitra l'écrit dans le calendrier auquel elle appartient. Un compte en échec ne retarde pas les autres : Mitra le réessaie une minute plus tard.

Certains calendriers ne peuvent pas être modifiés depuis Mitra, comme les abonnements et les calendriers partagés avec vous en lecture seule. Vous pouvez quand même les renommer, les recolorer et les masquer ; voir [Calendriers en lecture seule](../calendars.md#read-only-calendars).

> [!NOTE]
> La synchronisation ne récupère que ce qui a changé. Si un calendrier vous semble faux, **Réimporter les entrées** dans son menu **⋯** supprime la copie de Mitra et la réimporte depuis le fournisseur ; voir [Réimporter un calendrier](../calendars.md#re-import-a-calendar). Rien ne change chez le fournisseur dans les deux cas.

## Modifier un compte

Chaque compte ne peut être connecté qu'une fois. Pour changer son mot de passe, ou les calendriers qu'il montre dans Mitra, choisissez **Modifier** dans son menu **⋯** au lieu de le rajouter. Google Calendar fait exception : reconnecter le même compte Google renouvelle l'accès de Mitra à celui-ci.
