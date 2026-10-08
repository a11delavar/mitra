---
title: Lieu
description: "Comment le champ de lieu suggère des endroits, ce qu'il envoie et où, et comment utiliser votre propre géocodeur plutôt que le public."
---

Le champ de lieu de l'éditeur d'entrée suggère des endroits pendant que vous écrivez. Il n'a besoin ni de clé d'API ni d'inscription : Mitra utilise [Photon](https://photon.komoot.io), un géocodeur gratuit et libre, fondé sur OpenStreetMap.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/location-detail-dark.webp">
  <img src="../assets/screenshots/location-detail-light.webp" alt="Une nouvelle entrée avec Genève saisie dans son lieu, et des suggestions en dessous : la ville, son aéroport, sa gare principale, le Palais des Nations, un parc, et Geneva dans l'Illinois" />
</picture>

## Suggestions

Cliquez dans le champ de lieu pour voir les endroits utilisés récemment dans vos calendriers. Pendant que vous écrivez, ils se réduisent à ceux qui correspondent, et dès la deuxième lettre, des endroits de Photon s'y ajoutent. Choisissez-en un pour remplir son nom et son adresse, ou continuez à écrire : un lieu est du texte brut, et vous pouvez écrire ce que vous voulez. Le bouton de carte à côté du champ ouvre le lieu dans Google Maps.

Les suggestions favorisent les endroits proches de vous. La première fois que vous cliquez dans le champ, votre navigateur peut demander si Mitra peut utiliser votre position. Si vous l'autorisez, votre position accompagne chaque recherche, et les endroits proches passent en premier. Sinon, les suggestions fonctionnent quand même, sans cette préférence.

Photon nomme les endroits en anglais, en allemand ou en français quand votre navigateur est réglé sur l'une de ces langues, et dans la langue locale sinon.

Les calendriers [Notion](integrations/notion.md) et [Tempo](integrations/tempo.md) n'ont pas de lieu, leurs entrées n'ont donc pas de champ de lieu.

## Confidentialité

Votre navigateur ne contacte jamais Photon. Les recherches vont à votre serveur Mitra, qui interroge Photon et renvoie les réponses : Photon ne voit donc que l'adresse de votre serveur, pas la vôtre. Il voit en revanche ce que vous saisissez et, si vous l'avez autorisée, votre position.

Les endroits récents viennent uniquement de vos propres calendriers. Sur un serveur à plusieurs utilisateurs, personne ne voit les endroits d'un autre utilisateur.

## Utiliser votre propre serveur Photon

Par défaut, Mitra interroge le serveur Photon public de komoot, qui a des limites d'usage raisonnable et aucune garantie de rester disponible. Pour ne plus en dépendre, [hébergez Photon vous-même](https://github.com/komoot/photon) et indiquez-le à Mitra avec `MITRA_PHOTON_URL` :

```yaml
environment:
  MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```

Après un redémarrage, les recherches vont à votre serveur. Rien ne change dans l'application. Voir [Configuration](configuration.md) pour les autres réglages.

## Dépannage

Si seuls les endroits récents s'affichent, Photon n'a pas répondu en cinq secondes ou a refusé la recherche, ce qui arrive quand le serveur public est occupé ou limite les requêtes. Mitra écrit un avertissement dans son [journal](logging.md). Le champ accepte toujours ce que vous saisissez, et [votre propre serveur Photon](#use-your-own-photon-server) évite le problème.

Si des endroits sont nommés dans une langue inattendue, c'est une limite de Photon : il ne connaît que l'anglais, l'allemand et le français, et utilise le nom local de chaque endroit pour toute autre langue.
