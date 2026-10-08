---
title: Configuración
description: Cómo configurar Mitra con variables de entorno, las que necesitan la mayoría de los servidores y todas las variables con su valor predeterminado.
---

Mitra se configura por completo con variables de entorno. No hay archivo de configuración que montar: defines variables en el contenedor y Mitra las lee al arrancar. Todas las variables son opcionales, y una que no definas usa el valor predeterminado indicado [más abajo](#all-variables).

Con Docker Compose, van en el bloque `environment`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

Un archivo `.env` o los secretos de Docker funcionan igual de bien, si prefieres mantener los secretos fuera del archivo compose. Un cambio surte efecto la próxima vez que arranque Mitra:

```bash
docker compose up -d
```

## Qué hay que configurar en el servidor

Casi nada. Cada persona añade ella misma en la aplicación los [calendarios de Mitra](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Calendario de Apple](integrations/apple.md), las [suscripciones a calendarios](integrations/subscriptions.md), [Notion](integrations/notion.md) y [Tempo](integrations/tempo.md).

Dos cosas necesitan credenciales que primero registras en otro sitio: [Google Calendar](integrations/google.md) (`MITRA_GOOGLE_*`) y el [inicio de sesión](sso.md) (`MITRA_OIDC_*`).

## Ponerlo detrás de HTTPS

En cuanto Mitra sea accesible desde cualquier sitio que no sea tu propio equipo, ponlo detrás de un proxy inverso como Caddy, Traefik o nginx, y deja que el proxy se encargue de HTTPS. Mitra habla HTTP plano dentro del contenedor. Algunas funciones solo funcionan con HTTPS:

- Los navegadores solo permiten los [recordatorios](reminders.md) y la [instalación de la aplicación](install-app.md) en direcciones `https://` (y en `http://localhost`).
- Las cookies del [inicio de sesión](sso.md) solo se marcan como seguras en `https://`, y la mayoría de los proveedores de identidad exigen una dirección de redirección `https://`.
- [Google Calendar](integrations/google.md) exige una dirección de redirección `https://`.

Después define [`MITRA_URL`](#set-the-public-url) con la dirección pública.

Con [Caddy](https://caddyserver.com/), basta con esto:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

Con [Traefik](https://traefik.io/), dirige el tráfico a Mitra con etiquetas en el servicio:

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

## Definir la URL pública

`MITRA_URL` es la dirección que la gente escribe en el navegador para llegar a Mitra, no la interna del contenedor:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Mitra construye a partir de ella las direcciones de retorno de Google Calendar y del inicio de sesión, y marca sus cookies como seguras cuando empieza por `https://`. Puedes omitirla mientras pruebas Mitra en `http://localhost`. Defínela en cuanto Mitra tenga una dirección real, y es obligatoria para activar el inicio de sesión.

## Poner nombre a tu instancia

`MITRA_NAME` sustituye «Mitra» en la barra lateral y en la pestaña del navegador:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

Al hacer clic en el nombre se abre el diálogo **Acerca de**, que muestra la versión y el commit que estás ejecutando. La [aplicación instalada](install-app.md) conserva el nombre y el icono «Mitra», porque se fijan al compilar la aplicación.

## Todas las variables

### Núcleo

| Variable | Valor predeterminado | Descripción |
| --- | --- | --- |
| `MITRA_URL` | *(sin definir)* | La [dirección pública](#set-the-public-url) en la que la gente accede a Mitra, como `https://mitra.example.com`. De ella salen las direcciones de retorno del inicio de sesión y de Google Calendar, y si las cookies son seguras. Opcional mientras pruebas Mitra en localhost, obligatoria para el [inicio de sesión](sso.md), y recomendada para [Google Calendar](integrations/google.md) y cualquier servidor público. |
| `MITRA_NAME` | *(Mitra, en el idioma de cada persona)* | El [nombre](#name-your-instance) que se muestra en la barra lateral y en la pestaña del navegador. La [aplicación instalada](install-app.md) sigue siendo «Mitra». |
| `MITRA_PORT` | `3000` | El puerto en el que escucha el servidor. Con Docker, cambia en su lugar el lado del anfitrión de la asignación de puertos; defínelo solo cuando el propio proceso deba escuchar en otro puerto. La comprobación de estado integrada lo sigue. |
| `MITRA_LOG_LEVEL` | `info` | [Cuánto registra Mitra](logging.md): `error`, `warn`, `info`, `debug` o `trace`. Cada nivel incluye todo lo más silencioso que él. |
| `MITRA_UPDATE_CHECK` | *(activada)* | Defínela como `off` (o `false`, `0`, `no`) para desactivar la [comprobación de actualizaciones](updates.md). |

### Recordatorios

| Variable | Valor predeterminado | Descripción |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | El contacto que ven los servicios push para los [recordatorios](reminders.md) de tu servidor, normalmente una dirección `mailto:`. Nadie que use Mitra lo ve. Las claves de firma se generan automáticamente, así que no hay nada más que definir. |

### Ubicación

| Variable | Valor predeterminado | Descripción |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | El [geocodificador Photon](location.md) que hay detrás del campo de ubicación. Apúntala a tu propia instancia de Photon en lugar de la pública de komoot. |

### Google Calendar

Define ambas para que la gente pueda conectar [Google Calendar](integrations/google.md). Si defines solo el ID, Mitra no arranca.

| Variable | Valor predeterminado | Descripción |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(sin definir)* | El ID de cliente OAuth de la consola de Google Cloud. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(sin definir)* | El secreto de cliente OAuth. Obligatorio siempre que `MITRA_GOOGLE_CLIENT_ID` esté definido. |

### Inicio de sesión único

Definir `MITRA_OIDC_ISSUER` activa el [inicio de sesión](sso.md). Si faltan las variables que necesita, Mitra se niega a arrancar.

| Variable | Valor predeterminado | Descripción |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(sin definir)* | La URL del emisor de tu proveedor OIDC. Requiere `MITRA_OIDC_CLIENT_ID` y `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(sin definir)* | El ID de cliente registrado en tu proveedor. |
| `MITRA_OIDC_CLIENT_SECRET` | *(sin definir)* | El secreto de cliente. Omítelo para un cliente público; Mitra siempre usa PKCE. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Los scopes que pide Mitra, separados por espacios. `openid` es obligatorio; `profile` y `email` dan a Mitra el nombre y el correo de cada persona. |

### Definidas por la compilación

No las defines en un servidor. Las define la compilación o la imagen, o sirven para trabajar en el propio Mitra.

| Variable | Definida por | Descripción |
| --- | --- | --- |
| `MITRA_VERSION` | Compilación | La versión integrada en la imagen. |
| `MITRA_COMMIT` | Compilación | El commit integrado en la imagen. |
| `MITRA_DEV` | Desarrollo | Ofrece la integración **Demo**, un conjunto de calendarios de ejemplo, mientras se trabaja en Mitra. |
| `NODE_ENV` | Imagen | `production` en la imagen del contenedor. |

### Ejemplo

Un servidor con inicio de sesión, Google Calendar y su propio geocodificador:

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
