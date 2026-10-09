---
title: Authentification unique
description: Partagez un serveur Mitra avec votre famille ou une équipe. Chacun se connecte via un fournisseur OpenID Connect avec un compte qu'il possède déjà.
---

Par défaut, Mitra est conçu pour une seule personne et n'a pas de connexion, ce qui convient tant que vous seul pouvez l'atteindre. Pour partager un serveur avec votre famille ou une équipe, connectez-le à un fournisseur OpenID Connect (OIDC). Chacun se connecte alors avec un compte qu'il possède déjà, et obtient ses propres calendriers, que personne d'autre ne voit.

Mitra fonctionne avec tout fournisseur OIDC standard. On l'utilise notamment avec Pocket ID, Authelia, Authentik, Keycloak et Google.

> [!CAUTION]
> Activer la connexion donne à chaque personne un nouveau compte vide, vous compris. Tout ce que vous avez configuré quand Mitra était pour une seule personne reste attaché à l'ancien compte et ne suit pas : vos comptes connectés, vos paramètres, et chaque entrée de vos [calendriers Mitra](integrations/mitra.md). Les comptes connectés se rajoutent vite, mais les entrées des calendriers Mitra ne peuvent pas vous suivre. Activez la connexion avant de commencer à remplir Mitra, ou déplacez d'abord ces entrées vers un calendrier connecté (**Déplacer les entrées vers…** dans le menu **⋯** du calendrier) et reconnectez ensuite ce compte.

## Activer la connexion

Définissez les variables OIDC sur le conteneur :

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'          # the address people use to reach Mitra
      MITRA_OIDC_ISSUER: 'https://auth.example.com'   # your provider's issuer URL
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'                   # leave out for a public client
```

Auprès de votre fournisseur, enregistrez `MITRA_URL` suivi de `/auth/callback` comme adresse de redirection :

```text
https://mitra.example.com/auth/callback
```

C'est tout ce dont le fournisseur a besoin. Redémarrez Mitra avec `docker compose up -d`, et il demande à chacun de se connecter.

Définir `MITRA_OIDC_ISSUER` est ce qui active la connexion, et cela exige aussi `MITRA_OIDC_CLIENT_ID` et `MITRA_URL`. Si l'une d'elles manque, Mitra refuse de démarrer. Tourner discrètement sans connexion serait bien pire.

## Secret client et scopes

Si vous avez enregistré un secret client auprès de votre fournisseur, définissez `MITRA_OIDC_CLIENT_SECRET`. Si vous avez enregistré un client public, omettez-le ; c'est pleinement pris en charge, puisque Mitra utilise toujours PKCE.

Mitra demande les scopes `openid profile email`. `openid` est obligatoire, et les deux autres donnent à Mitra le nom et l'e-mail de chacun. Ne les modifiez avec `MITRA_OIDC_SCOPES` que si votre fournisseur a besoin d'autre chose.

## Qui peut se connecter

Toute personne que votre fournisseur laisse passer obtient un compte Mitra à sa première connexion. Il n'y a pas de liste d'utilisateurs à gérer dans Mitra : décidez donc qui peut se connecter chez votre fournisseur, par groupe, attribution d'application ou selon la manière dont il gère les accès. Le nom et l'e-mail de chacun sont mis à jour depuis le fournisseur à chaque connexion.

## Comment fonctionne la connexion

La connexion elle-même se déroule sur le serveur (le flux de code d'autorisation avec PKCE). Votre navigateur ne reçoit qu'un cookie, et aucun jeton n'est conservé dans son stockage : un script malveillant sur la page n'a donc rien à voler.

Une session dure 30 jours à partir de la dernière fois que vous avez utilisé Mitra. Le cookie est marqué sécurisé quand `MITRA_URL` commence par `https://`, et un émetteur en `http://` est autorisé pour les fournisseurs de votre propre réseau sans HTTPS. Si votre fournisseur le prend en charge, vous déconnecter de Mitra vous y déconnecte aussi.

## Dépannage

- **Mitra ne démarre pas et nomme une variable manquante.** Quand `MITRA_OIDC_ISSUER` est défini, `MITRA_OIDC_CLIENT_ID` et `MITRA_URL` doivent l'être aussi.
- **Le fournisseur se plaint de l'adresse de redirection.** Elle doit être exactement `MITRA_URL` suivi de `/auth/callback`.
- **Le journal indique que la découverte a échoué.** Mitra interroge votre fournisseur à la première connexion et réessaie à la suivante : un fournisseur qui démarre après Mitra se règle donc de lui-même. Si l'échec persiste, vérifiez l'URL de l'émetteur et si Mitra peut l'atteindre, avec le [niveau de journalisation](logging.md) sur `debug`.
- **Mes calendriers ont disparu après l'activation de la connexion.** C'est normal : chacun repart avec un nouveau compte. Reconnectez vos comptes.
