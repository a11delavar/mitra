---
title: Configuratie
description: Hoe je Mitra configureert met omgevingsvariabelen, welke variabelen de meeste servers nodig hebben, en elke variabele met zijn standaardwaarde.
---

Mitra configureer je volledig met omgevingsvariabelen. Er is geen configuratiebestand dat je hoeft te koppelen: je stelt variabelen in op de container, en Mitra leest ze bij het opstarten. Elke variabele is optioneel, en een variabele die je niet instelt, krijgt de standaardwaarde die je [hieronder](#all-variables) vindt.

Met Docker Compose zet je ze in het blok `environment`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

Een `.env`-bestand of Docker secrets werken net zo goed, als je geheimen liever buiten het compose-bestand houdt. Een wijziging gaat in zodra Mitra opnieuw opstart:

```bash
docker compose up -d
```

## Wat je op de server moet instellen

Bijna niets. Gebruikers voegen [Mitra-agenda's](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Apple Agenda](integrations/apple.md), [agenda-abonnementen](integrations/subscriptions.md), [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) en [Tempo](integrations/tempo.md) zelf toe, in de app.

Voor twee dingen heb je eerst inloggegevens nodig die je bij een andere partij registreert: [Google Agenda](integrations/google.md) (`MITRA_GOOGLE_*`) en [inloggen](sso.md) (`MITRA_OIDC_*`).

## Achter HTTPS zetten

Zodra Mitra bereikbaar is vanaf andere plekken dan je eigen computer, zet je het achter een reverse proxy zoals Caddy, Traefik of nginx, en laat je die proxy HTTPS afhandelen. Mitra zelf spreekt binnen de container gewoon HTTP. Sommige functies werken alleen via HTTPS:

- Browsers staan [herinneringen](reminders.md) en [de app installeren](install-app.md) alleen toe op `https://`-adressen (en op `http://localhost`).
- Cookies voor [inloggen](sso.md) worden alleen op `https://` als beveiligd gemarkeerd, en de meeste identiteitsproviders eisen een redirect-URL met `https://`.
- [Google Agenda](integrations/google.md) vereist een redirect-URL met `https://`.

Stel daarna [`MITRA_URL`](#set-the-public-url) in op het openbare adres.

Met [Caddy](https://caddyserver.com/) is dit alles wat je nodig hebt:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

Met [Traefik](https://traefik.io/) stuur je verkeer naar Mitra met labels op de service:

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

## De openbare URL instellen

`MITRA_URL` is het adres dat mensen in de browser typen om Mitra te bereiken, niet het interne adres van de container:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Mitra bouwt hiermee de redirect-URL's voor Google Agenda en voor inloggen, en markeert zijn cookies als beveiligd als het adres met `https://` begint. Zolang je Mitra op `http://localhost` uitprobeert, kun je hem weglaten. Stel hem in zodra Mitra een echt adres heeft; om inloggen in te schakelen is hij verplicht.

## Je installatie een naam geven

`MITRA_NAME` vervangt ‘Mitra’ in de zijbalk en op het browsertabblad:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

Klik je op de naam, dan opent het venster **Over**, met de versie en de commit die je draait. De [geïnstalleerde app](install-app.md) houdt de naam en het pictogram ‘Mitra’, omdat die vastliggen zodra de app wordt gebouwd.

## Alle variabelen

### Basis

| Variabele | Standaard | Beschrijving |
| --- | --- | --- |
| `MITRA_URL` | *(niet ingesteld)* | Het [openbare adres](#set-the-public-url) waarop mensen Mitra bereiken, zoals `https://mitra.example.com`. De redirect-URL's voor inloggen en Google Agenda, en of cookies beveiligd zijn, worden hiervan afgeleid. Optioneel zolang je Mitra op localhost uitprobeert, verplicht voor [inloggen](sso.md), en aanbevolen voor [Google Agenda](integrations/google.md) en elke openbare server. |
| `MITRA_NAME` | *(Mitra, in de taal van elke gebruiker)* | De [naam](#name-your-instance) in de zijbalk en op het browsertabblad. De [geïnstalleerde app](install-app.md) blijft ‘Mitra’ heten. |
| `MITRA_PORT` | `3000` | De poort waarop de server luistert. Wijzig bij Docker liever de hostkant van de poorttoewijzing; stel deze variabele alleen in als het proces zelf op een andere poort moet luisteren. De ingebouwde statuscontrole volgt hem. |
| `MITRA_LOG_LEVEL` | `info` | [Hoeveel Mitra logt](logging.md): `error`, `warn`, `info`, `debug` of `trace`. Elk niveau bevat alles van de stillere niveaus. |
| `MITRA_UPDATE_CHECK` | *(aan)* | Stel in op `off` (of `false`, `0`, `no`) om de [controle op updates](updates.md) uit te schakelen. |
| `MITRA_MCP` | *(aan)* | Stel in op `off` (of `false`, `0`, `no`) om het [adres waarmee AI-tools verbinding maken](ai-connectors.md) te sluiten. |

### Herinneringen

| Variabele | Standaard | Beschrijving |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | Het contactadres dat pushdiensten te zien krijgen voor de [herinneringen](reminders.md) van je server, meestal een `mailto:`-adres. Gebruikers van Mitra zien het niet. De ondertekeningssleutels worden automatisch gemaakt, dus verder hoef je niets in te stellen. |

### Locatie

| Variabele | Standaard | Beschrijving |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | De [Photon-geocoder](location.md) achter het locatieveld. Laat hem wijzen naar je eigen Photon-installatie in plaats van de openbare van komoot. |

### Bijlagen

| Variabele | Standaard | Beschrijving |
| --- | --- | --- |
| `MITRA_FILE_MAX_SIZE` | `25M` | Het grootste bestand dat iemand als [bijlage](attachments.md) aan een item kan toevoegen, in bytes of met het achtervoegsel `k`, `M` of `G`. Stel in op `0` om het toevoegen van bestanden uit te schakelen. |
| `MITRA_FILE_QUOTA` | *(niet ingesteld)* | Hoeveel iemand in totaal aan bijlagen kan opslaan, op dezelfde manier geschreven. Zonder deze variabele is er geen limiet. |

### Google Agenda

Stel ze allebei in om gebruikers [Google Agenda](integrations/google.md) te laten verbinden. Stel je alleen de ID in, dan start Mitra niet.

| Variabele | Standaard | Beschrijving |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(niet ingesteld)* | De OAuth-client-ID uit de Google Cloud Console. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(niet ingesteld)* | Het OAuth-clientgeheim. Verplicht zodra `MITRA_GOOGLE_CLIENT_ID` is ingesteld. |

### Single sign-on

Met `MITRA_OIDC_ISSUER` schakel je [inloggen](sso.md) in. Ontbreken de variabelen die daarvoor nodig zijn, dan weigert Mitra te starten.

| Variabele | Standaard | Beschrijving |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(niet ingesteld)* | De issuer-URL van je OIDC-provider. Vereist `MITRA_OIDC_CLIENT_ID` en `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(niet ingesteld)* | De client-ID die bij je provider is geregistreerd. |
| `MITRA_OIDC_CLIENT_SECRET` | *(niet ingesteld)* | Het clientgeheim. Laat het weg voor een openbare client; Mitra gebruikt altijd PKCE. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | De scopes die Mitra aanvraagt, gescheiden door spaties. `openid` is verplicht; met `profile` en `email` krijgt Mitra de naam en het e-mailadres van elke gebruiker. |

### Ingesteld door de build

Deze stel je niet in op een server. De build of de image stelt ze in, of ze zijn bedoeld voor wie aan Mitra zelf werkt.

| Variabele | Ingesteld door | Beschrijving |
| --- | --- | --- |
| `MITRA_VERSION` | Build | De versie die in de image is ingebouwd. |
| `MITRA_COMMIT` | Build | De commit die in de image is ingebouwd. |
| `MITRA_DEV` | Ontwikkeling | Biedt tijdens het werken aan Mitra de integratie **Demo** aan, een set voorbeeldagenda's. |
| `NODE_ENV` | Image | `production` in de containerimage. |

### Voorbeeld

Een server met inloggen, Google Agenda en een eigen geocoder:

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
