---
title: Abonnements à des calendriers
description: Abonnez-vous à un lien de calendrier publié, comme une adresse webcal:// ou un flux .ics, et retrouvez ses entrées dans Mitra, en lecture seule.
---

Beaucoup de calendriers sont publiés plutôt que partagés : jours fériés, calendriers sportifs, vacances scolaires, flux d'un outil professionnel, ou adresse privée de votre propre calendrier Google ou Outlook. Vous ne vous connectez pas à ceux-là. Vous vous y abonnez avec un lien.

Un **abonnement à un calendrier** fait entrer un tel lien dans Mitra comme un calendrier à part entière, avec ses événements, et ses tâches s'il en a.

Les abonnements sont en lecture seule. Le flux vit sur un autre serveur, qui n'accepte pas de modifications : Mitra montre ce qu'il publie et n'écrit jamais en retour. Vous pouvez quand même renommer, recolorer, réordonner et masquer le calendrier ; voir [Calendriers en lecture seule](../calendars.md#read-only-calendars). Pour garder une copie modifiable de ses entrées, utilisez **Copier les entrées vers…** dans son menu **⋯**.

## S'abonner à un calendrier

1. Choisissez **Ajouter une intégration** au bas de la barre latérale, puis **Abonnement à un calendrier**.
2. Collez le lien dans **URL de l'agenda**. C'est soit une adresse `webcal://`, comme les boutons « S'abonner » en donnent souvent, soit une adresse `https://`, qui se termine généralement par `.ics`.
3. Laissez **Nom d'utilisateur (facultatif)** et **Mot de passe (facultatif)** vides, sauf si le flux les demande (voir [flux protégés par mot de passe](#feeds-with-a-password)).
4. Appuyez sur **Connecter**. Mitra lit le flux et liste son calendrier.
5. Laissez-le activé et appuyez sur **Enregistrer**.

Un lien, c'est un calendrier. Pour vous abonner à plusieurs, ajoutez un abonnement pour chacun.

Le calendrier prend son nom au flux, et sa couleur aussi si le flux en a une. Vous pouvez le renommer dans la barre latérale, et votre nom reste jusqu'à ce que le flux renomme lui-même le calendrier.

Si vous avez [fait de Mitra votre application de calendrier par défaut](../calendar-files.md), cliquer sur un lien `webcal://` dans une page web ouvre ce formulaire avec le lien déjà rempli.

### Où trouver le lien d'un calendrier

| Fournisseur | Où chercher |
| --- | --- |
| Google Calendar | Dans les paramètres du calendrier, **Integrate calendar** → **Secret address in iCal format** |
| Outlook et Microsoft 365 | **Share** → **Publish a calendar**, puis copiez le lien ICS |
| iCloud | Clic droit sur le calendrier → **Share Calendar** → **Public Calendar** |
| Nextcloud | Le menu **⋯** du calendrier → **Copy subscription link** |
| Calendriers publics | La plupart des sites de jours fériés, de sport et d'écoles proposent un lien `.ics` |

> [!CAUTION]
> Une adresse secrète est un mot de passe sous forme de lien : quiconque l'a peut lire le calendrier. Gardez-la pour vous, et réinitialisez-la dans les paramètres de votre fournisseur si elle venait à fuiter.

### Flux protégés par mot de passe

La plupart des flux publiés portent leur clé d'accès dans le lien lui-même et n'ont besoin de rien d'autre. Si un flux, par exemple sur un serveur d'entreprise ou auto-hébergé, demande un nom d'utilisateur et un mot de passe (authentification HTTP Basic), saisissez-les au moment de vous abonner. Mitra garde le mot de passe sur le serveur et ne le renvoie jamais à votre navigateur.

## Comment il reste à jour

Mitra synchronise chaque abonnement toutes les 15 minutes, que quelqu'un ait ou non Mitra ouvert : ouvrir Mitra ne récupère donc pas un flux plus tôt (voir [comment fonctionne la synchronisation](README.md#how-syncing-works)). Une synchronisation coûte peu : Mitra demande au serveur du flux si quelque chose a changé, et ne télécharge le calendrier que si c'est le cas.

Le calendrier reflète le flux. Les entrées ajoutées au flux apparaissent dans Mitra, et celles qui en sont retirées disparaissent.

Si le calendrier semble faux, **Réimporter les entrées** dans son menu **⋯** relit le flux depuis le début. Le flux lui-même n'est jamais touché. Voir [Réimporter un calendrier](../calendars.md#re-import-a-calendar).

## Dépannage

- Si Mitra affiche « The calendar requires a username and password », le flux est protégé. Saisissez le nom d'utilisateur et le mot de passe requis.
- Si Mitra affiche « No calendar was found at that address », vérifiez que le lien ne comporte pas de faute de frappe. Une adresse secrète cesse aussi de fonctionner quand son propriétaire la réinitialise.
- Si Mitra affiche « The address did not return a calendar », le lien mène à une page web plutôt qu'au flux. Cherchez un lien intitulé iCal, ICS ou S'abonner.
- Si Mitra affiche « The calendar is too large to subscribe to », le flux dépasse 20 Mo, ce que Mitra ne lit pas.
