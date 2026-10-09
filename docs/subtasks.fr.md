---
title: Sous-tâches
description: "Découpez une tâche en sous-tâches ou en liste de contrôle, suivez sa progression, et terminez, déplacez ou supprimez d'un coup toute une arborescence de tâches."
---

Une tâche peut avoir des **sous-tâches** : des tâches plus petites qui la composent ensemble. Une sous-tâche peut vivre dans un autre calendrier, même dans un autre compte, avoir ses propres sous-tâches et être [non planifiée](planning.md#the-planning-tab).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/hierarchy-detail-dark.webp">
  <img src="../assets/screenshots/hierarchy-detail-light.webp" alt="Une tâche avec une liste de contrôle dans sa description et une sous-tâche terminée, comptée 1/1" />
</picture>

## Ajouter une sous-tâche

Ouvrez la plus petite tâche, appuyez sur **＋** à côté de **Sous-tâche de** et saisissez une partie du titre de la plus grande. La recherche couvre tous vos calendriers. La plus grande tâche la liste alors sous **Sous-tâches**, avec le nombre de celles qui sont terminées, par exemple 1/3. Vous ajoutez toujours le lien depuis la sous-tâche : la ligne **Sous-tâches** de la plus grande tâche ne fait que les lister.

Chaque sous-tâche de la liste affiche sa case à cocher à la [couleur de son calendrier](calendars.md#recolor), ce qui vous permet de la cocher sans quitter la plus grande tâche. Les sous-tâches terminées et annulées sont barrées. Cliquez sur un titre pour ouvrir cette tâche, ou sur le **✕** à côté pour supprimer le lien, depuis l'un ou l'autre côté. Dans le calendrier, une ligne relie une tâche à ses sous-tâches quand les deux sont visibles.

Mitra refuse un lien qui ferait une boucle, comme une tâche qui deviendrait sa propre sous-tâche.

## Listes de contrôle

La description d'une tâche peut aussi contenir une liste de contrôle, écrite en Markdown :

```markdown
- [ ] Book the venue
- [x] Send the invitations
```

Cochez une case directement dans la description pour la valider. Mitra change `[ ]` en `[x]` dans le texte, si bien que les autres applications qui utilisent le calendrier le voient aussi. Cocher des cases ne modifie jamais le statut de la tâche de lui-même. Seules les tâches comptent leurs listes de contrôle : les cases d'un événement peuvent être cochées, mais elles ne comptent pour rien.

## Progression

Une tâche avec des sous-tâches ou une liste de contrôle affiche sa progression. Chaque sous-tâche et chaque case compte pour une étape, toutes avec le même poids : une tâche avec trois cases et deux sous-tâches a donc cinq étapes.

Une sous-tâche en partie terminée compte en partie, qu'elle ait une progression propre ou ses propres sous-tâches. Si une tâche a trois sous-tâches, deux terminées et la troisième à 80 %, la tâche est à 93 %. Les sous-tâches annulées ne comptent pas, si bien qu'un travail abandonné ne retient jamais la tâche. Les événements liés comme sous-tâches ne comptent pas non plus.

Dans le calendrier, le contour de la case à cocher d'une tâche se remplit à mesure qu'elle avance. Pointez la case pour voir le décompte, par exemple « 2 sur 3 sous-tâches terminées », ou « 2 sur 4 étapes terminées » quand cases et sous-tâches comptent ensemble. Faites un clic droit dessus, ou un clic avec <kbd>Alt</kbd>, pour ouvrir le menu de statut avec le pourcentage exact.

## Régler la progression à la main

Une tâche sans sous-tâches ni liste de contrôle peut porter une progression que vous réglez vous-même. Faites un clic droit sur sa case à cocher, ou un clic avec <kbd>Alt</kbd>, et faites glisser **Progression** par pas de 5 %. À 100 %, la tâche passe à **Terminé**. Sous 100 %, une tâche terminée repasse à **En cours**, ou à **À faire** à 0 %. Le **✕** à côté de la valeur l'efface.

Le calendrier doit pouvoir stocker la progression : c'est le cas des [serveurs de calendrier](integrations/caldav.md), de [Apple Calendar](integrations/apple.md) et des [calendriers Mitra](integrations/mitra.md). Google Calendar, Notion et Tempo ne le peuvent pas, leurs tâches n'ont donc pas de curseur **Progression**.

## Terminer une arborescence de tâches

Quand vous cochez la dernière sous-tâche ouverte, Mitra demande s'il faut aussi marquer la plus grande tâche comme terminée. Si cela termine d'autres tâches plus haut, il propose de toutes les marquer comme terminées. Il ne demande qu'une fois la liste de contrôle de la plus grande tâche entièrement cochée, elle aussi.

Quand vous marquez une tâche comme terminée ou annulée alors que certaines de ses sous-tâches sont encore ouvertes, Mitra demande quoi en faire : **Marquer comme terminée** ou **Marquer comme annulée**. Fermez la question pour les laisser ouvertes. Vous pouvez y revenir plus tard : dans le menu de statut de la tâche, le nombre de sous-tâches mène à la même question.

## Déplacer ou supprimer une tâche avec des sous-tâches

Quand vous faites glisser une tâche avec des sous-tâches vers un autre moment, Mitra demande **Déplacer aussi les sous-tâches ?**. Choisissez **Cette entrée uniquement**, ou déplacez la tâche avec toutes ses sous-tâches du même écart de temps. Supprimer une telle tâche demande **Supprimer aussi les sous-tâches ?** de la même façon.

> [!TIP]
> Maintenez <kbd>Ctrl</kbd> (<kbd>⌘</kbd> sur un Mac) pendant que vous déposez ou supprimez pour passer la question et ne modifier que cette tâche. Voir les [raccourcis clavier](shortcuts.md).

## Quels calendriers le prennent en charge

Un lien est enregistré avec la sous-tâche, dans le calendrier propre à cette entrée. Les [serveurs de calendrier](integrations/caldav.md), [Apple Calendar](integrations/apple.md) et les [calendriers Mitra](integrations/mitra.md) conservent n'importe quel lien, et sur un serveur de calendrier il est écrit dans le format de calendrier standard, que les autres applications utilisant le même calendrier peuvent donc lire.

- Dans [Notion](integrations/notion.md), un lien vers une tâche de la même base de données va dans la propriété de relation correspondante, comme « Parent task ». Mitra conserve lui-même les liens vers tout le reste.
- [Google Calendar](integrations/google.md) abandonne les liens : une entrée d'un calendrier Google ne peut donc pas recevoir de parent. Les entrées d'autres calendriers peuvent toujours s'y lier.
- Les [abonnements à un calendrier](integrations/subscriptions.md) sont en lecture seule, et [Tempo](integrations/tempo.md) n'a pas de liens.
