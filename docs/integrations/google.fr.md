---
title: Google Calendar
description: Configurez une fois la connexion Google pour votre serveur Mitra, puis connectez des comptes Google depuis l'application et synchronisez leurs calendriers dans les deux sens.
---

Mitra se connecte à Google Calendar via CalDAV, comme à n'importe quel serveur de calendrier. La différence tient à la connexion : Google n'accepte pas de mot de passe, il vous demande d'accorder l'accès sur sa propre page. Pour cela, Google doit connaître votre serveur Mitra : la personne qui l'administre l'enregistre donc une fois auprès de Google, et donne à Mitra l'ID client et le secret que Google fournit.

Ensuite, chaque utilisateur de Mitra connecte son compte Google depuis l'application, avec sa propre autorisation. La configuration tient en trois étapes :

1. [Enregistrer Mitra auprès de Google](#register-mitra-with-google).
2. [Donner à Mitra l'ID client et le secret](#give-mitra-the-client-id-and-secret).
3. [Connecter un compte](#connect-an-account).

Les deux premières se font une seule fois par serveur Mitra.

## Enregistrer Mitra auprès de Google

1. Créez un projet dans la [console Google Cloud](https://console.cloud.google.com) et, sous **APIs & Services**, activez la **CalDAV API**.
2. Configurez l'**OAuth consent screen**. Ajoutez-vous, ainsi que toutes les personnes qui connecteront un compte, comme **test user**, ou publiez l'application.
3. Créez un **OAuth client** de type **Web application**. Comme **authorized redirect URI**, saisissez l'adresse de votre serveur Mitra suivie de `/api/integrations/google/callback` :

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Copiez l'**ID client** et le **secret client** que Google vous affiche.

> [!CAUTION]
> Tant que l'écran de consentement est en mode test, Google met fin à chaque autorisation au bout de 7 jours, et chacun doit reconnecter son compte toutes les semaines. Publiez l'application pour conserver les autorisations durablement.

## Donner à Mitra l'ID client et le secret

Définissez-les comme variables d'environnement, avec `MITRA_URL`, l'adresse de votre serveur :

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'
    # …
```

Puis redémarrez Mitra :

```bash
docker compose up -d
```

Définissez les deux variables ou aucune. Mitra refuse de démarrer avec un ID client sans secret, pour qu'une configuration à moitié faite ne passe jamais inaperçue.

`MITRA_URL` doit correspondre à l'adresse de votre URI de redirection. Sans elle, Mitra utilise l'adresse à laquelle vous l'avez ouvert, ce qui suffit pour essayer sur `localhost`. Google n'accepte que des adresses de redirection en `https://` en dehors de `localhost` : un vrai serveur a donc besoin de [HTTPS](../configuration.md#put-it-behind-https) et de `MITRA_URL`. Toutes les variables sont listées dans [Configuration](../configuration.md#all-variables).

## Connecter un compte

1. Choisissez **Ajouter une intégration** au bas de la barre latérale, puis **Google Agenda**.
2. Appuyez sur **Continuer avec Google**. Google vous demande de choisir un compte et de laisser Mitra voir et modifier vos calendriers.
3. De retour dans Mitra, les calendriers du compte sont listés, tous activés. Désactivez ceux dont vous ne voulez pas, puis appuyez sur **Enregistrer**.

Reconnecter le même compte Google renouvelle son autorisation au lieu de l'ajouter une seconde fois.

Google limite la fréquence à laquelle les applications peuvent l'appeler : Mitra synchronise donc les comptes Google environ une fois par minute (voir [comment fonctionne la synchronisation](README.md#how-syncing-works)).

## Calendriers partagés avec vous

Les calendriers dont vous êtes propriétaire apparaissent dès la connexion. Les calendriers que d'autres personnes ont partagés avec vous, comme celui d'une équipe ou d'un collègue, n'atteignent les autres applications qu'une fois que vous l'avez autorisé dans vos paramètres Google :

1. Connecté à Google, ouvrez [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect).
2. Sous **Shared Calendars**, cochez chaque calendrier que vous voulez dans Mitra, et appuyez sur **Save**.
3. Dans Mitra, ouvrez le menu **⋯** du compte dans la barre latérale, choisissez **Modifier**, puis appuyez sur **Actualiser**.
4. Activez les calendriers qui apparaissent, puis appuyez sur **Enregistrer**.

Un calendrier partagé avec vous avec **See all event details** est en lecture seule dans Mitra : vous voyez tout ce qu'il contient, mais vous ne pouvez ni ajouter, ni modifier, ni supprimer d'événements. Si le propriétaire vous accorde plus tard **Make changes to events**, la modification s'active à la synchronisation suivante. Voir [Calendriers en lecture seule](../calendars.md#read-only-calendars).

## Ce qui est synchronisé

Tout est synchronisé comme pour [CalDAV](caldav.md#what-syncs), sauf les relations entre entrées. Google les supprime de sa copie d'un événement : Mitra ne les propose donc pas sur les calendriers Google.

La [disponibilité](../availability.md) que vous marquez comme occupée dans un calendrier Google est ajoutée à ce calendrier sous forme d'événements occupés, pour que les autres voient le créneau comme pris. Cela fonctionne comme décrit pour [CalDAV](caldav.md#busy-availability).

## Votre jeton Google

Le jeton émis par Google ne quitte jamais le serveur. Votre navigateur ne fait que passer par la page de Google pour accorder l'accès. Mitra conserve le jeton avec le compte et s'en sert pour obtenir un accès de courte durée à chaque synchronisation.

## Déconnecter un compte

Choisissez **Supprimer** dans le menu **⋯** du compte pour le retirer de Mitra, ainsi que son jeton. Pour retirer aussi l'accès de Mitra côté Google, supprimez Mitra des [connexions tierces de votre compte Google](https://myaccount.google.com/permissions). Ne faire que cela interrompt aussi la synchronisation : le compte reste dans Mitra, mais chaque synchronisation échoue jusqu'à ce que vous le reconnectiez.

## Dépannage

- Si le choix de **Google Agenda** affiche une note disant que ce n'est pas configuré sur ce serveur au lieu du bouton **Continuer avec Google**, c'est que `MITRA_GOOGLE_CLIENT_ID` et `MITRA_GOOGLE_CLIENT_SECRET` ne sont pas définis, ou que Mitra n'a pas redémarré depuis que vous les avez définis.
- Si Google répond `redirect_uri_mismatch`, l'URI de redirection de la console Google Cloud ne correspond pas à `MITRA_URL` suivi de `/api/integrations/google/callback`. Elle doit correspondre exactement, `https://` compris et sans barre oblique finale.
- Si des comptes cessent de se synchroniser au bout de 7 jours, votre écran de consentement est encore en mode test. Publiez l'application, puis reconnectez les comptes.
