---
title: Konfiguration
description: Wie du Mitra mit Umgebungsvariablen konfigurierst, die Variablen, die die meisten Server brauchen, und jede Variable mit ihrem Standardwert.
---

Mitra wird vollständig über Umgebungsvariablen konfiguriert. Es gibt keine Konfigurationsdatei, die du einbinden müsstest: Du setzt Variablen am Container, und Mitra liest sie beim Start. Jede Variable ist optional, und eine, die du nicht setzt, nutzt den [unten](#all-variables) aufgeführten Standardwert.

Mit Docker Compose kommen sie in den Block `environment`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

Eine `.env`-Datei oder Docker Secrets funktionieren genauso gut, wenn du Geheimnisse lieber aus der Compose-Datei heraushalten willst. Eine Änderung wird beim nächsten Start von Mitra wirksam:

```bash
docker compose up -d
```

## Was auf dem Server eingerichtet werden muss

Fast nichts. Nutzer fügen [Mitra-Kalender](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Apple Calendar](integrations/apple.md), [Kalenderabonnements](integrations/subscriptions.md), [Notion](integrations/notion.md) und [Tempo](integrations/tempo.md) selbst in der App hinzu.

Zwei Dinge brauchen Zugangsdaten, die du zuerst bei jemand anderem registrierst: [Google Calendar](integrations/google.md) (`MITRA_GOOGLE_*`) und die [Anmeldung](sso.md) (`MITRA_OIDC_*`).

## Hinter HTTPS betreiben

Sobald Mitra von mehr als deinem eigenen Rechner erreichbar ist, stell es hinter einen Reverse Proxy wie Caddy, Traefik oder nginx und lass den Proxy HTTPS übernehmen. Mitra selbst spricht im Container reines HTTP. Manche Funktionen gehen nur über HTTPS:

- Browser erlauben [Erinnerungen](reminders.md) und das [Installieren der App](install-app.md) nur auf `https://`-Adressen (und auf `http://localhost`).
- Cookies der [Anmeldung](sso.md) werden nur auf `https://` als sicher markiert, und die meisten Identitätsanbieter bestehen auf einer `https://`-Weiterleitungsadresse.
- [Google Calendar](integrations/google.md) verlangt eine `https://`-Weiterleitungsadresse.

Setz dann [`MITRA_URL`](#set-the-public-url) auf die öffentliche Adresse.

Mit [Caddy](https://caddyserver.com/) genügt das hier:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

Mit [Traefik](https://traefik.io/) leitest du per Labels am Dienst zu Mitra:

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

## Die öffentliche URL festlegen

`MITRA_URL` ist die Adresse, die Leute im Browser eingeben, um Mitra zu erreichen, nicht die interne Adresse des Containers:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Mitra baut daraus die Rückkehradressen für Google Calendar und die Anmeldung und markiert seine Cookies als sicher, wenn sie mit `https://` beginnt. Du kannst sie weglassen, solange du Mitra auf `http://localhost` ausprobierst. Setz sie, sobald Mitra eine echte Adresse hat, und du musst sie setzen, um die Anmeldung einzuschalten.

## Deine Instanz benennen

`MITRA_NAME` ersetzt „Mitra“ in der Seitenleiste und im Browser-Tab:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

Ein Klick auf den Namen öffnet den Dialog **Über**, der die Version und den Commit zeigt, die du betreibst. Die [installierte App](install-app.md) behält Namen und Symbol „Mitra“, weil sie beim Bauen der App festgelegt werden.

## Alle Variablen

### Kern

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `MITRA_URL` | *(nicht gesetzt)* | Die [öffentliche Adresse](#set-the-public-url), unter der Leute Mitra erreichen, etwa `https://mitra.example.com`. Rückkehradressen für die Anmeldung und Google Calendar sowie ob Cookies sicher sind, stammen daraus. Optional, solange du Mitra auf localhost ausprobierst, erforderlich für die [Anmeldung](sso.md) und empfohlen für [Google Calendar](integrations/google.md) und jeden öffentlichen Server. |
| `MITRA_NAME` | *(Mitra, in der Sprache jeder Person)* | Der [Name](#name-your-instance) in der Seitenleiste und im Browser-Tab. Die [installierte App](install-app.md) bleibt „Mitra“. |
| `MITRA_PORT` | `3000` | Der Port, auf dem der Server lauscht. Ändere mit Docker stattdessen die Host-Seite der Portzuordnung; setz diese Variable nur, wenn der Prozess selbst woanders lauschen muss. Der eingebaute Health-Check folgt ihr. |
| `MITRA_LOG_LEVEL` | `info` | [Wie viel Mitra protokolliert](logging.md): `error`, `warn`, `info`, `debug` oder `trace`. Jede Stufe enthält alles, was leiser ist. |
| `MITRA_UPDATE_CHECK` | *(an)* | Setz sie auf `off` (oder `false`, `0`, `no`), um die [Update-Prüfung](updates.md) auszuschalten. |

### Erinnerungen

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | Der Kontakt, den Push-Dienste für die [Erinnerungen](reminders.md) deines Servers sehen, meist eine `mailto:`-Adresse. Niemand, der Mitra nutzt, sieht ihn. Die Signaturschlüssel werden automatisch erzeugt, du musst also nichts weiter setzen. |

### Ort

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | Der [Photon-Geocoder](location.md) hinter dem Ortsfeld. Richte sie auf deine eigene Photon-Instanz statt auf den öffentlichen Server von komoot. |

### Google Calendar

Setz beide, damit Leute [Google Calendar](integrations/google.md) verbinden können. Wenn du nur die ID setzt, startet Mitra nicht.

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(nicht gesetzt)* | Die OAuth-Client-ID aus der Google Cloud Console. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(nicht gesetzt)* | Das OAuth-Client-Secret. Erforderlich, sobald `MITRA_GOOGLE_CLIENT_ID` gesetzt ist. |

### Single Sign-on

Wenn du `MITRA_OIDC_ISSUER` setzt, schaltet das die [Anmeldung](sso.md) ein. Fehlen die dafür nötigen Variablen, weigert sich Mitra zu starten.

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(nicht gesetzt)* | Die Issuer-URL deines OIDC-Anbieters. Erfordert `MITRA_OIDC_CLIENT_ID` und `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(nicht gesetzt)* | Die bei deinem Anbieter registrierte Client-ID. |
| `MITRA_OIDC_CLIENT_SECRET` | *(nicht gesetzt)* | Das Client-Secret. Lass es für einen öffentlichen Client weg; Mitra nutzt immer PKCE. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Die Scopes, die Mitra anfordert, durch Leerzeichen getrennt. `openid` ist erforderlich; `profile` und `email` geben Mitra Namen und E-Mail-Adresse jeder Person. |

### Vom Build gesetzt

Du setzt diese nicht auf einem Server. Der Build oder das Image setzt sie, oder sie sind für die Arbeit an Mitra selbst.

| Variable | Gesetzt durch | Beschreibung |
| --- | --- | --- |
| `MITRA_VERSION` | Build | Die ins Image eingebaute Version. |
| `MITRA_COMMIT` | Build | Der ins Image eingebaute Commit. |
| `MITRA_DEV` | Entwicklung | Bietet die Integration **Demo** an, eine Reihe von Beispielkalendern, während du an Mitra arbeitest. |
| `NODE_ENV` | Image | `production` im Container-Image. |

### Beispiel

Ein Server mit Anmeldung, Google Calendar und eigenem Geocoder:

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
