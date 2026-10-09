---
title: Configuration
description: Comment configurer Mitra avec des variables d'environnement, celles dont la plupart des serveurs ont besoin, et chaque variable avec sa valeur par défaut.
---

Mitra se configure entièrement par des variables d'environnement. Il n'y a pas de fichier de configuration à monter : vous définissez des variables sur le conteneur, et Mitra les lit au démarrage. Chaque variable est facultative, et une variable que vous ne définissez pas prend la valeur par défaut indiquée [plus bas](#all-variables).

Avec Docker Compose, elles se placent dans le bloc `environment` :

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

Un fichier `.env` ou des secrets Docker fonctionnent tout aussi bien, si vous préférez garder les secrets hors du fichier compose. Une modification prend effet au prochain démarrage de Mitra :

```bash
docker compose up -d
```

## Ce qu'il faut configurer sur le serveur

Presque rien. Les utilisateurs ajoutent eux-mêmes, dans l'application, les [calendriers Mitra](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Apple Calendar](integrations/apple.md), les [abonnements à des calendriers](integrations/subscriptions.md), [Notion](integrations/notion.md) et [Tempo](integrations/tempo.md).

Deux choses demandent des identifiants que vous devez d'abord enregistrer auprès d'un tiers : [Google Calendar](integrations/google.md) (`MITRA_GOOGLE_*`) et la [connexion](sso.md) (`MITRA_OIDC_*`).

## Le placer derrière HTTPS

Dès que Mitra est accessible depuis autre chose que votre propre machine, placez-le derrière un proxy inverse comme Caddy, Traefik ou nginx, et laissez le proxy gérer HTTPS. Mitra lui-même parle en HTTP simple à l'intérieur du conteneur. Certaines fonctionnalités ne marchent qu'en HTTPS :

- Les navigateurs n'autorisent les [rappels](reminders.md) et l'[installation de l'application](install-app.md) que sur des adresses `https://` (et sur `http://localhost`).
- Les cookies de [connexion](sso.md) ne sont marqués comme sécurisés que sur `https://`, et la plupart des fournisseurs d'identité exigent une adresse de redirection en `https://`.
- [Google Calendar](integrations/google.md) exige une adresse de redirection en `https://`.

Définissez ensuite [`MITRA_URL`](#set-the-public-url) avec l'adresse publique.

Avec [Caddy](https://caddyserver.com/), c'est tout ce qu'il faut :

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

Avec [Traefik](https://traefik.io/), dirigez le trafic vers Mitra avec des labels sur le service :

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    volumes:
      - ~/mitra:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mitra.rule=Host(`mitra.example.com`)"
      - "traefik.http.services.mitra.loadbalancer.server.port=3000"
    environment:
      MITRA_URL: 'https://mitra.example.com'
```

## Définir l'URL publique

`MITRA_URL` est l'adresse que les gens saisissent dans le navigateur pour atteindre Mitra, et non l'adresse interne du conteneur :

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Mitra en déduit les adresses de retour pour Google Calendar et la connexion, et marque ses cookies comme sécurisés quand elle commence par `https://`. Vous pouvez l'omettre tant que vous essayez Mitra sur `http://localhost`. Définissez-la dès que Mitra a une vraie adresse ; elle est obligatoire pour activer la connexion.

## Nommer votre instance

`MITRA_NAME` remplace « Mitra » dans la barre latérale et dans l'onglet du navigateur :

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

Cliquer sur le nom ouvre la boîte de dialogue **À propos**, qui indique la version et le commit que vous exécutez. L'[application installée](install-app.md) garde le nom et l'icône « Mitra », car ils sont fixés lors de la construction de l'application.

## Toutes les variables

### Cœur

| Variable | Valeur par défaut | Description |
| --- | --- | --- |
| `MITRA_URL` | *(non définie)* | L'[adresse publique](#set-the-public-url) à laquelle on atteint Mitra, par exemple `https://mitra.example.com`. Les adresses de retour pour la connexion et Google Calendar, et le caractère sécurisé des cookies, en découlent. Facultative tant que vous essayez Mitra sur localhost, obligatoire pour la [connexion](sso.md), et recommandée pour [Google Calendar](integrations/google.md) et tout serveur public. |
| `MITRA_NAME` | *(Mitra, dans la langue de chacun)* | Le [nom](#name-your-instance) affiché dans la barre latérale et dans l'onglet du navigateur. L'[application installée](install-app.md) reste « Mitra ». |
| `MITRA_PORT` | `3000` | Le port sur lequel le serveur écoute. Avec Docker, modifiez plutôt le côté hôte du mappage de port ; ne le définissez que si le processus lui-même doit écouter ailleurs. La vérification d'état intégrée le suit. |
| `MITRA_LOG_LEVEL` | `info` | [Le niveau de détail des journaux de Mitra](logging.md) : `error`, `warn`, `info`, `debug` ou `trace`. Chaque niveau inclut tout ce qui est plus discret que lui. |
| `MITRA_UPDATE_CHECK` | *(activée)* | Réglez sur `off` (ou `false`, `0`, `no`) pour désactiver la [vérification des mises à jour](updates.md). |

### Rappels

| Variable | Valeur par défaut | Description |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | Le contact que voient les services push pour les [rappels](reminders.md) de votre serveur, en général une adresse `mailto:`. Personne parmi les utilisateurs de Mitra ne le voit. Les clés de signature sont générées automatiquement : il n'y a rien d'autre à définir. |

### Lieu

| Variable | Valeur par défaut | Description |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | Le [géocodeur Photon](location.md) derrière le champ de lieu. Faites-la pointer vers votre propre instance Photon plutôt que vers celle, publique, de komoot. |

### Google Calendar

Définissez les deux pour permettre de connecter [Google Calendar](integrations/google.md). Ne définir que l'ID empêche Mitra de démarrer.

| Variable | Valeur par défaut | Description |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(non définie)* | L'ID client OAuth de la console Google Cloud. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(non définie)* | Le secret client OAuth. Obligatoire dès que `MITRA_GOOGLE_CLIENT_ID` est défini. |

### Authentification unique

Définir `MITRA_OIDC_ISSUER` active la [connexion](sso.md). Si les variables nécessaires manquent, Mitra refuse de démarrer.

| Variable | Valeur par défaut | Description |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(non définie)* | L'URL de l'émetteur de votre fournisseur OIDC. Exige `MITRA_OIDC_CLIENT_ID` et `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(non définie)* | L'ID client enregistré auprès de votre fournisseur. |
| `MITRA_OIDC_CLIENT_SECRET` | *(non définie)* | Le secret client. Omettez-le pour un client public ; Mitra utilise toujours PKCE. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Les scopes que Mitra demande, séparés par des espaces. `openid` est obligatoire ; `profile` et `email` donnent à Mitra le nom et l'e-mail de chacun. |

### Définies par la construction

Vous ne les définissez pas sur un serveur. La construction ou l'image les définit, ou elles servent à travailler sur Mitra lui-même.

| Variable | Définie par | Description |
| --- | --- | --- |
| `MITRA_VERSION` | Construction | La version intégrée à l'image. |
| `MITRA_COMMIT` | Construction | Le commit intégré à l'image. |
| `MITRA_DEV` | Développement | Propose l'intégration **Demo**, un ensemble de calendriers d'exemple, pendant le travail sur Mitra. |
| `NODE_ENV` | Image | `production` dans l'image du conteneur. |

### Exemple

Un serveur avec connexion, Google Calendar et son propre géocodeur :

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'

      # Sign-in
      MITRA_OIDC_ISSUER: 'https://auth.example.com'
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'

      # Google Calendar
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'

      # Your own geocoder
      MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```
