---
title: Apple Calendar
description: Connectez vos calendriers iCloud à Mitra avec un mot de passe spécifique à l'application, sans rien configurer sur le serveur.
---

Mitra se connecte à vos calendriers iCloud via CalDAV et synchronise leurs événements dans les deux sens. Apple ne laisse pas les autres applications se connecter avec votre mot de passe Apple : vous créez donc d'abord un mot de passe spécifique à l'application pour Mitra. Cela prend une minute, et il n'y a rien à configurer sur le serveur.

## Créer un mot de passe spécifique à l'application

1. Connectez-vous sur [appleid.apple.com](https://appleid.apple.com/).
2. Sous **Sign-In and Security**, choisissez **App-Specific Passwords**.
3. Créez un nouveau mot de passe, nommez-le « Mitra » pour le reconnaître plus tard, et copiez-le.

Apple ne propose les mots de passe spécifiques à l'application que si l'authentification à deux facteurs est activée sur votre compte.

## Connecter votre compte

1. Choisissez **Ajouter une intégration** au bas de la barre latérale, puis **Calendrier Apple**.
2. Saisissez votre **Identifiant Apple**, l'adresse e-mail avec laquelle vous vous connectez à Apple, et le **Mot de passe spécifique à l'application** que vous avez créé pour Mitra.
3. Appuyez sur **Connecter**. Mitra liste vos calendriers iCloud, tous activés.
4. Désactivez ceux dont vous ne voulez pas, puis appuyez sur **Enregistrer**.

Mitra importe les calendriers que vous avez gardés et les synchronise toutes les 10 secondes tant que vous l'avez ouvert (voir [comment fonctionne la synchronisation](README.md#how-syncing-works)).

## Ce qui est synchronisé

Les événements sont synchronisés dans les deux sens, avec tout ce que [CalDAV](caldav.md#what-syncs) transporte.

> [!NOTE]
> Les tâches font exception. Les tâches que Mitra enregistre dans un calendrier iCloud sont stockées dans iCloud, et les autres applications CalDAV peuvent les lire, mais l'application Rappels d'Apple ne les affiche pas. Rappels a cessé d'utiliser CalDAV avec iOS 13, et Apple n'offre aucune autre porte d'entrée à des applications comme Mitra.

La [disponibilité](../availability.md) que vous marquez comme occupée dans un calendrier iCloud est ajoutée à ce calendrier sous forme d'événements occupés : le créneau apparaît donc comme pris sur votre iPhone et pour quiconque vous invite. Cela fonctionne comme décrit pour [CalDAV](caldav.md#busy-availability).

## Déconnecter votre compte

Choisissez **Supprimer** dans le menu **⋯** du compte dans la barre latérale pour le retirer de Mitra. Pour retirer l'accès de Mitra côté Apple, supprimez le mot de passe « Mitra » sur la page **Sign-In and Security** où vous l'avez créé. Votre mot de passe Apple et vos autres applications ne sont pas affectés.

## Dépannage

- Si la connexion échoue à cause du mot de passe, vérifiez que vous avez saisi le mot de passe spécifique à l'application, et non votre mot de passe Apple.
- Si un calendrier manque, c'est qu'il est désactivé. Activez-le sous **⋯ → Modifier** du compte et appuyez sur **Enregistrer**.
