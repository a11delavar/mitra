---
title: CalDAV
description: Connectez n'importe quel serveur CalDAV, comme Nextcloud, Radicale, Fastmail ou mailbox.org, et synchronisez ses événements et ses tâches dans les deux sens.
---

CalDAV est le standard ouvert que parlent la plupart des serveurs de calendrier. Vous connectez un compte CalDAV depuis l'application, sans rien configurer sur le serveur, et Mitra synchronise ses événements et ses tâches dans les deux sens.

Vos calendriers restent sur votre serveur : toutes les autres applications CalDAV que vous utilisez, comme le calendrier de votre téléphone, voient donc les mêmes entrées. C'est la différence avec les [calendriers Mitra](mitra.md), que seul Mitra peut ouvrir.

## Connecter un compte

1. Choisissez **Ajouter une intégration** au bas de la barre latérale, puis **CalDAV**.
2. Remplissez le formulaire :
   - **URL du serveur** est l'adresse CalDAV de votre serveur, par exemple `https://caldav.example.com`. Le [tableau ci-dessous](#server-urls-for-common-providers) la donne pour les fournisseurs courants.
   - **Nom d'utilisateur** est en général le nom de votre compte ou votre adresse e-mail.
   - **Mot de passe** est le mot de passe de votre compte, ou un mot de passe d'application si votre fournisseur vous en donne un.
3. Appuyez sur **Connecter**. Mitra liste les calendriers du compte, tous activés, et indique ce que chacun contient, par exemple « Événements · Tâches ».
4. Désactivez ceux dont vous ne voulez pas, puis appuyez sur **Enregistrer**.

Mitra importe les calendriers que vous avez gardés, puis les synchronise toutes les 10 secondes tant que vous l'avez ouvert (voir [comment fonctionne la synchronisation](README.md#how-syncing-works)).

Pour changer le mot de passe plus tard, ouvrez le menu **⋯** du compte dans la barre latérale, choisissez **Modifier**, saisissez le nouveau mot de passe et appuyez sur **Enregistrer**. L'URL du serveur et le nom d'utilisateur restent inchangés ; pour un autre compte, connectez-le séparément.

## URL de serveur des fournisseurs courants

Donnez à Mitra l'adresse CalDAV du fournisseur, et il trouve les calendriers à partir de là.

| Fournisseur | URL du serveur |
| --- | --- |
| Nextcloud | `https://<your-nextcloud>/remote.php/dav` |
| Radicale | `https://<your-radicale>/` (ou `.../<user>/`) |
| Fastmail | `https://caldav.fastmail.com/` |
| mailbox.org | `https://dav.mailbox.org/` |
| Baïkal | `https://<your-baikal>/dav.php` |

Google Calendar et iCloud parlent aussi CalDAV, mais n'acceptent pas votre mot de passe habituel : Google vous connecte sur sa propre page, et Apple exige un mot de passe spécifique à l'application. Utilisez plutôt leurs vignettes dédiées, comme décrit dans [Google Calendar](google.md) et [Apple Calendar](apple.md).

## Ce qui est synchronisé

Chaque calendrier du serveur devient un calendrier dans Mitra. Il contient des événements, des tâches ou les deux, selon ce que permet le serveur. La plupart des serveurs permettent les deux ; dans un calendrier qui n'accepte qu'un seul type, les nouvelles entrées sont toujours de ce type.

Tout ce que Mitra stocke sur une entrée est synchronisé, dans la mesure où votre serveur le conserve :

- Les entrées sur toute la journée ou sur plusieurs jours, les lieux, les descriptions, les couleurs et les rappels.
- Le fait qu'une entrée s'affiche comme occupé ou disponible, et sa visibilité.
- Le statut et l'avancement d'une tâche.
- Les [participants](../participants.md). Votre serveur envoie les invitations et collecte les réponses.
- Les [sous-tâches](../subtasks.md) et les [dépendances](../dependencies.md).

Une entrée répétée reste une seule série sur le serveur. Quand vous modifiez une seule occurrence, Mitra demande si vous visez **Cette entrée**, **Cette entrée et les suivantes** ou **Toutes les entrées**, et adapte la série en conséquence.

Une tâche conserve son horaire, sa [date d'échéance et son estimation](../planning.md#schedule-constraints-and-planning). Si vous êtes curieux du comment : le début est enregistré dans `DTSTART`, la durée de l'horaire (ou l'estimation, tant que la tâche n'est pas planifiée) dans `ESTIMATED-DURATION`, et la date d'échéance dans `DUE`, de sorte que les autres applications voient le début et la date d'échéance. Une tâche qu'une autre application, ou une ancienne version de Mitra, a enregistrée avec un début et un `DUE` mais sans durée est lue comme planifiée de l'un à l'autre, sans date d'échéance.

Les calendriers partagés avec vous en lecture seule sont marqués comme tels. Vous pouvez quand même les renommer, les recolorer, les réordonner et les masquer ; voir [Calendriers en lecture seule](../calendars.md#read-only-calendars).

## Disponibilité occupée

La [disponibilité](../availability.md) que vous marquez **Occupé** est ajoutée à son calendrier sous forme d'événements occupés : le créneau apparaît donc comme pris sur votre téléphone et pour quiconque vous invite. Il n'y a rien à configurer.

- Chaque disponibilité occupée devient un événement répété, avec les mêmes horaires et la même règle de répétition, marqué occupé. Il prend le nom de la disponibilité, ou « Busy » si elle n'en a pas, ainsi que son lieu et sa visibilité, par exemple **Privé**.
- Dans Mitra, vous voyez la disponibilité elle-même plutôt que ces événements, pour que le créneau n'apparaisse pas deux fois.
- Mitra garde les événements alignés sur votre disponibilité. Si l'un d'eux est modifié, déplacé ou supprimé dans une autre application, Mitra le remet en place à la prochaine synchronisation.
- Remettre la disponibilité sur **Disponible**, la supprimer, désactiver son calendrier ou supprimer le compte retire les événements. Déplacer la disponibilité vers un autre calendrier déplace ses événements avec elle.
- Un calendrier qui ne contient que des tâches, ou dans lequel vous ne pouvez pas écrire, ne reçoit aucun événement.

> [!NOTE]
> Les modifications portant sur un seul jour d'une disponibilité occupée ne sont pas reportées. L'événement continue de suivre la règle de répétition : un jour que vous avez déplacé ou raccourci affiche donc encore son horaire habituel aux autres.

Cela fonctionne de la même façon pour [Google Calendar](google.md) et [Apple Calendar](apple.md), que Mitra connecte aussi via CalDAV.

## Dépannage

- Si un calendrier manque, c'est qu'il est désactivé. Cela arrive aux calendriers que vous avez désactivés à la connexion, et à ceux créés plus tard sur le serveur, que Mitra ajoute désactivés. Activez-le sous **⋯ → Modifier** du compte et appuyez sur **Enregistrer**. **Actualiser** y liste les calendriers créés sur le serveur depuis la dernière synchronisation.
- Si Mitra affiche « This account is already connected », le compte figure déjà dans votre barre latérale. Modifiez-le plutôt depuis son menu **⋯ → Modifier**, par exemple pour saisir un nouveau mot de passe.
- Si la connexion échoue, vérifiez que l'URL du serveur commence par `https://` et pointe vers l'adresse CalDAV, pas vers la page web sur laquelle vous vous connectez. Pour voir chaque requête que Mitra envoie au serveur, réglez le [niveau de journalisation](../logging.md) sur `debug`.
- Si un calendrier semble faux après une mise à jour de Mitra, utilisez **Réimporter les entrées** dans son menu **⋯**. La synchronisation ne récupère que ce qui a changé sur le serveur : les entrées inchangées ne sont donc jamais relues ; une réimportation les relit toutes. Voir [Réimporter un calendrier](../calendars.md#re-import-a-calendar).
