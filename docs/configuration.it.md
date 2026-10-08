---
title: Configurazione
description: Come configurare Mitra con le variabili d'ambiente, quelle che servono alla maggior parte dei server, e ogni variabile con il suo valore predefinito.
---

Mitra si configura interamente tramite variabili d'ambiente. Non c'è nessun file di configurazione da montare: imposti le variabili sul container e Mitra le legge all'avvio. Ogni variabile è facoltativa, e una che non imposti usa il valore predefinito elencato [più sotto](#all-variables).

Con Docker Compose vanno nel blocco `environment`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

Vanno bene anche un file `.env` o i secret di Docker, se preferisci tenere i segreti fuori dal file compose. Una modifica ha effetto al successivo avvio di Mitra:

```bash
docker compose up -d
```

## Cosa va configurato sul server

Quasi nulla. Le persone aggiungono da sé, nell'app, i [calendari Mitra](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Apple Calendar](integrations/apple.md), gli [abbonamenti a calendari](integrations/subscriptions.md), [Notion](integrations/notion.md) e [Tempo](integrations/tempo.md).

Due cose richiedono credenziali che devi prima registrare presso qualcun altro: [Google Calendar](integrations/google.md) (`MITRA_GOOGLE_*`) e l'[accesso con account](sso.md) (`MITRA_OIDC_*`).

## Metterlo dietro HTTPS

Appena Mitra è raggiungibile da qualsiasi posto che non sia la tua macchina, mettilo dietro un reverse proxy come Caddy, Traefik o nginx, e lascia che sia il proxy a gestire HTTPS. Mitra stesso parla HTTP semplice dentro il container. Alcune funzioni sono disponibili solo tramite HTTPS:

- I browser permettono i [promemoria](reminders.md) e l'[installazione dell'app](install-app.md) solo su indirizzi `https://` (e su `http://localhost`).
- I cookie dell'[accesso con account](sso.md) vengono marcati come sicuri solo su `https://`, e la maggior parte dei provider di identità pretende un indirizzo di reindirizzamento `https://`.
- [Google Calendar](integrations/google.md) richiede un indirizzo di reindirizzamento `https://`.

Poi imposta [`MITRA_URL`](#set-the-public-url) sull'indirizzo pubblico.

Con [Caddy](https://caddyserver.com/) basta questo:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

Con [Traefik](https://traefik.io/), indirizza il traffico a Mitra con le label sul servizio:

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

## Impostare l'URL pubblico

`MITRA_URL` è l'indirizzo che le persone digitano nel browser per raggiungere Mitra, non quello interno del container:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Mitra ne ricava gli indirizzi di ritorno per Google Calendar e per l'accesso con account, e marca i suoi cookie come sicuri quando inizia con `https://`. Puoi ometterlo finché provi Mitra su `http://localhost`. Impostalo appena Mitra ha un indirizzo vero, ed è obbligatorio per attivare l'accesso con account.

## Dare un nome alla tua istanza

`MITRA_NAME` sostituisce «Mitra» nella barra laterale e nella scheda del browser:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

Fare clic sul nome apre la finestra **Informazioni**, che mostra la versione e il commit che stai eseguendo. L'[app installata](install-app.md) mantiene il nome e l'icona «Mitra», perché vengono fissati quando l'app viene compilata.

## Tutte le variabili

### Base

| Variabile | Predefinito | Descrizione |
| --- | --- | --- |
| `MITRA_URL` | *(non impostata)* | L'[indirizzo pubblico](#set-the-public-url) a cui le persone raggiungono Mitra, come `https://mitra.example.com`. Da esso derivano gli indirizzi di ritorno per l'accesso con account e Google Calendar, e se i cookie sono sicuri. Facoltativa finché provi Mitra su localhost, obbligatoria per l'[accesso con account](sso.md), e consigliata per [Google Calendar](integrations/google.md) e per qualsiasi server pubblico. |
| `MITRA_NAME` | *(Mitra, nella lingua di ciascuno)* | Il [nome](#name-your-instance) mostrato nella barra laterale e nella scheda del browser. L'[app installata](install-app.md) resta «Mitra». |
| `MITRA_PORT` | `3000` | La porta su cui il server è in ascolto. Con Docker, cambia invece il lato host della mappatura delle porte; imposta questa solo quando il processo stesso deve restare in ascolto altrove. L'health check integrato la segue. |
| `MITRA_LOG_LEVEL` | `info` | [Quanto registra Mitra](logging.md): `error`, `warn`, `info`, `debug` o `trace`. Ogni livello include tutto ciò che è più silenzioso. |
| `MITRA_UPDATE_CHECK` | *(attivo)* | Impostala su `off` (o `false`, `0`, `no`) per disattivare il [controllo degli aggiornamenti](updates.md). |

### Promemoria

| Variabile | Predefinito | Descrizione |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | Il contatto che i servizi push vedono per i [promemoria](reminders.md) del tuo server, di solito un indirizzo `mailto:`. Nessuno di chi usa Mitra lo vede. Le chiavi di firma vengono generate automaticamente, quindi non c'è altro da impostare. |

### Luogo

| Variabile | Predefinito | Descrizione |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | Il [geocoder Photon](location.md) dietro il campo del luogo. Puntala alla tua istanza Photon invece di quella pubblica di komoot. |

### Google Calendar

Impostale entrambe per permettere alle persone di collegare [Google Calendar](integrations/google.md). Impostare solo l'ID impedisce l'avvio di Mitra.

| Variabile | Predefinito | Descrizione |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(non impostata)* | L'ID client OAuth dalla console Google Cloud. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(non impostata)* | Il segreto client OAuth. Obbligatorio ogni volta che `MITRA_GOOGLE_CLIENT_ID` è impostata. |

### Single sign-on

Impostare `MITRA_OIDC_ISSUER` attiva l'[accesso con account](sso.md). Se mancano le variabili di cui ha bisogno, Mitra si rifiuta di avviarsi.

| Variabile | Predefinito | Descrizione |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(non impostata)* | L'URL dell'issuer del tuo provider OIDC. Richiede `MITRA_OIDC_CLIENT_ID` e `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(non impostata)* | L'ID client registrato presso il tuo provider. |
| `MITRA_OIDC_CLIENT_SECRET` | *(non impostata)* | Il segreto client. Omettilo per un client pubblico; Mitra usa sempre PKCE. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Gli scope che Mitra richiede, separati da spazi. `openid` è obbligatorio; `profile` ed `email` danno a Mitra nome ed email di ciascuno. |

### Impostate dalla build

Queste non le imposti su un server. Le imposta la build o l'immagine, oppure servono per lavorare su Mitra stesso.

| Variabile | Impostata da | Descrizione |
| --- | --- | --- |
| `MITRA_VERSION` | Build | La versione inclusa nell'immagine. |
| `MITRA_COMMIT` | Build | Il commit incluso nell'immagine. |
| `MITRA_DEV` | Sviluppo | Offre l'integrazione **Demo**, un insieme di calendari di esempio, mentre si lavora su Mitra. |
| `NODE_ENV` | Immagine | `production` nell'immagine del container. |

### Esempio

Un server con accesso con account, Google Calendar e un proprio geocoder:

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
