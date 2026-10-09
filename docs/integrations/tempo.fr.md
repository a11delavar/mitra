---
title: Tempo
description: Voyez dans votre calendrier les heures que vous imputez dans Tempo, et saisissez-les, déplacez-les, redimensionnez-les et supprimez-les depuis Mitra.
---

[Tempo](https://www.tempo.io/) est une application de suivi du temps pour Jira. Mitra affiche vos **worklogs**, les heures que vous avez imputées sur des tickets Jira, sous forme d'entrées avec horaire dans votre calendrier, à côté des réunions et des tâches auxquelles ce temps a été consacré.

Les worklogs sont synchronisés dans les deux sens. Déplacez ou redimensionnez une entrée pour changer le moment et la durée de votre travail, modifiez sa description pour changer la note du worklog, supprimez-la pour supprimer le worklog, ou créez-en une pour imputer un nouveau temps.

Vous vous connectez depuis l'application avec deux jetons d'API. Il n'y a rien à configurer sur le serveur.

## Connecter votre feuille de temps

Mitra a besoin d'un jeton de Tempo et d'un jeton d'Atlassian : Tempo détient les heures, et Jira connaît les tickets et qui vous êtes.

1. Créez un jeton d'API Tempo. Dans Jira, ouvrez les **Settings** de Tempo (l'icône d'engrenage) → **Data Access** → **API integration**, choisissez **New Token**, nommez-le « Mitra » et copiez le jeton.
2. Créez un jeton d'API Atlassian sur [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) avec **Create API token**, et copiez-le. Créez les deux jetons avec le même utilisateur Jira.
3. Dans Mitra, choisissez **Ajouter une intégration** au bas de la barre latérale, puis **Tempo**, et remplissez :
   - **URL du site**, votre adresse Atlassian, par exemple `https://your-company.atlassian.net`.
   - **Jeton d'API Tempo**, le jeton de l'étape 1.
   - **E-mail du compte Atlassian**, l'adresse e-mail de votre compte Atlassian.
   - **Jeton d'API Atlassian**, le jeton de l'étape 2.
4. Appuyez sur **Connecter**. Mitra liste un calendrier, **My worklogs**.
5. Laissez-le activé et appuyez sur **Enregistrer**.

Tempo limite la fréquence à laquelle les applications peuvent l'appeler : Mitra le synchronise donc environ une fois par minute (voir [comment fonctionne la synchronisation](README.md#how-syncing-works)).

## À quoi ressemblent les worklogs

Le titre d'une entrée est le ticket Jira sur lequel le temps est imputé, sa clé et son résumé :

```text
ACME-1234 Code review for auth migration
```

La note du worklog est la description de l'entrée. L'application de Tempo les présente de la même façon, car le ticket dit à quoi le temps a servi, tandis que la note est souvent une étiquette d'activité comme « Review », ou un texte que Jira a rédigé pour vous, comme « Working on work item ACME-1234 ».

Le titre appartient au ticket : vous ne pouvez donc pas le modifier sur un worklog enregistré. Mitra ne renomme pas un ticket Jira parce que vous avez modifié une entrée de calendrier. Modifiez la description pour dire ce que vous avez fait. Si Jira ne peut pas nommer le ticket, parce qu'il a été supprimé ou que vous ne pouvez plus le voir, le titre affiche `#` et l'ID du ticket, et l'entrée continue de fonctionner.

Tempo stocke les worklogs comme de simples heures d'horloge, sans fuseau horaire. Mitra les lit dans le fuseau horaire de votre profil Jira, ils s'affichent donc aux mêmes heures que dans Tempo.

Certains sites Tempo désactivent les heures de début. Dans ce cas, tous les worklogs d'une journée commencent à la même heure et s'empilent, mais leurs durées sont justes.

## Imputer du temps depuis Mitra

Créez une entrée avec horaire dans **My worklogs**, et mettez la clé du ticket Jira n'importe où dans son titre :

| Vous saisissez | Imputé sur |
| --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` |
| `Investigating ACME-1234 regression` | `ACME-1234` |
| `ACME-1234` | `ACME-1234` |

Mitra vérifie la clé parmi les projets Jira que vous pouvez voir. Si le titre ne contient aucune clé de ce genre, ou si Jira n'a pas ce ticket, Mitra n'impute rien et vous dit pourquoi.

La note du worklog est ce que vous avez écrit dans la description ou, si vous l'avez laissée vide, le titre entier tel que vous l'avez saisi. Une fois le temps imputé, le titre devient la clé et le résumé du ticket. Cet échange a lieu une seule fois, au moment de l'imputation, c'est pourquoi vous pouvez modifier le titre pendant que vous l'écrivez, mais pas ensuite.

> [!TIP]
> Pour imputer du temps sur un ticket que vous avez déjà utilisé, dupliquez l'une de ses entrées : maintenez <kbd>Alt</kbd> (<kbd>⌥</kbd> sur un Mac) en la faisant glisser vers le nouvel horaire, ou choisissez **Dupliquer** dans le menu **⋯** de son éditeur.

## Modifier un worklog

Déplacer, redimensionner, supprimer et modifier la description passent directement par Tempo. Quelques points à savoir :

- Un worklog reste sur son ticket. Tempo ne peut pas déplacer un worklog vers un autre ticket : pour imputer le temps ailleurs, supprimez l'entrée et créez-en une nouvelle avec la bonne clé.
- Mitra conserve les détails propres à Tempo d'un worklog, comme son temps facturable et ses attributs de travail, quand il le modifie.
- Quand une période de feuille de temps est clôturée ou approuvée dans Tempo, Tempo refuse d'y ajouter, d'y modifier ou d'y supprimer des worklogs.

Pour ouvrir le ticket dans Jira, choisissez **Ouvrir dans Jira** dans le menu **⋯** de l'éditeur.

## Ce qu'un worklog ne peut pas contenir

Un worklog est une plage de temps sur une journée, imputée sur un ticket. Un calendrier Tempo ne contient donc que des entrées avec horaire : pas d'entrées sur toute la journée, de répétitions, de rappels, de lieu, de participants, de relations, d'état occupé ou disponible, de visibilité ni de [disponibilité](../availability.md). Mitra masque ces champs sur les worklogs.

## Dépannage

- Si Mitra affiche « Tempo rejected the API token », créez un nouveau jeton d'API Tempo et saisissez-le sous **⋯ → Modifier** du compte.
- Si Mitra affiche « Jira rejected the e-mail and API token », vérifiez que l'adresse e-mail appartient au compte Atlassian qui a créé le jeton d'API.
- Si des worklogs s'affichent à la mauvaise heure de la journée, vérifiez le fuseau horaire dans votre profil Jira (**Account settings** → **Time zone**). Après l'avoir changé, utilisez **Réimporter les entrées** dans le menu **⋯** de **My worklogs**, pour que les worklogs que vous avez déjà se déplacent aussi.
- Si des worklogs s'empilent à la même heure chaque jour, votre site Tempo a désactivé les heures de début. Les heures restent justes.
