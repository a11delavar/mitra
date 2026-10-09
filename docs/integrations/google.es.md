---
title: Google Calendar
description: Configura el inicio de sesión de Google una vez en tu servidor de Mitra, y después conecta cuentas de Google desde la aplicación y sincroniza sus calendarios en ambas direcciones.
---

Mitra se conecta a Google Calendar por CalDAV, como a cualquier servidor de calendario. La diferencia está en el inicio de sesión: Google no acepta una contraseña, sino que te pide conceder acceso en su propia página. Para eso, Google necesita conocer tu servidor de Mitra, así que quien lo administra lo registra una vez en Google y entrega a Mitra el ID de cliente y el secreto que Google le da.

Después, cualquiera que use Mitra conecta su cuenta de Google desde la aplicación, cada uno con su propia autorización. La configuración tiene tres pasos:

1. [Registrar Mitra en Google](#register-mitra-with-google).
2. [Dar a Mitra el ID de cliente y el secreto](#give-mitra-the-client-id-and-secret).
3. [Conectar una cuenta](#connect-an-account).

Los dos primeros se hacen una sola vez por servidor de Mitra.

## Registrar Mitra en Google

1. Crea un proyecto en la [consola de Google Cloud](https://console.cloud.google.com) y, en **APIs & Services**, activa la **CalDAV API**.
2. Configura la **OAuth consent screen**. O bien te añades a ti y a todos los demás que vayan a conectar una cuenta como **test user**, o bien publicas la aplicación.
3. Crea un **OAuth client** de tipo **Web application**. Como **authorized redirect URI**, escribe la dirección de tu servidor de Mitra seguida de `/api/integrations/google/callback`:

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Copia el **client ID** y el **client secret** que te muestra Google.

> [!CAUTION]
> Mientras la pantalla de consentimiento está en pruebas, Google termina cada autorización a los 7 días, y todos tienen que volver a conectar su cuenta cada semana. Publica la aplicación para conservar las autorizaciones de forma permanente.

## Dar a Mitra el ID de cliente y el secreto

Defínelos como variables de entorno, junto con `MITRA_URL`, la dirección de tu servidor:

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

Luego reinicia Mitra:

```bash
docker compose up -d
```

Define ambas variables o ninguna. Mitra se niega a arrancar con un ID de cliente sin secreto, para que una configuración a medias nunca pase desapercibida.

`MITRA_URL` tiene que coincidir con la dirección de tu URI de redirección. Sin ella, Mitra usa la dirección con la que lo abriste, lo cual basta para probarlo en `localhost`. Google solo acepta direcciones de redirección `https://` salvo para `localhost`, así que un servidor real necesita [HTTPS](../configuration.md#put-it-behind-https) y `MITRA_URL`. Todas las variables están en [Configuración](../configuration.md#all-variables).

## Conectar una cuenta

1. Elige **Añadir integración** al pie de la barra lateral y luego **Google Calendar**.
2. Pulsa **Continuar con Google**. Google te pide que elijas una cuenta y que permitas a Mitra ver y cambiar tus calendarios.
3. De vuelta en Mitra, se listan los calendarios de la cuenta, todos activados. Desactiva los que no quieras y pulsa **Guardar**.

Conectar de nuevo la misma cuenta de Google renueva su autorización en lugar de añadirla por segunda vez.

Google limita cada cuánto pueden llamarle las aplicaciones, así que Mitra sincroniza las cuentas de Google cerca de una vez por minuto (consulta [cómo funciona la sincronización](README.md#how-syncing-works)).

## Calendarios compartidos contigo

Los calendarios de tu propiedad aparecen en cuanto conectas. Los calendarios que otras personas han compartido contigo, como el de un equipo o el de un compañero, solo llegan a otras aplicaciones cuando lo permites en tus ajustes de Google:

1. Con la sesión iniciada en Google, abre [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect).
2. En **Shared Calendars**, marca cada calendario que quieras en Mitra y pulsa **Save**.
3. En Mitra, abre el menú **⋯** de la cuenta en la barra lateral, elige **Editar** y pulsa **Actualizar**.
4. Activa los calendarios que aparezcan y pulsa **Guardar**.

Un calendario compartido contigo como **See all event details** es de solo lectura en Mitra: ves todo lo que contiene, pero no puedes añadir, cambiar ni eliminar eventos. Si el propietario te da más tarde **Make changes to events**, la edición se activa con la siguiente sincronización. Consulta [Calendarios de solo lectura](../calendars.md#read-only-calendars).

## Qué se sincroniza

Todo se sincroniza como en [CalDAV](caldav.md#what-syncs), salvo las relaciones entre entradas. Google las elimina de su copia de un evento, así que Mitra no las ofrece en los calendarios de Google.

La [disponibilidad](../availability.md) que marcas como ocupada en un calendario de Google se añade a ese calendario como eventos ocupados, para que los demás vean el tiempo como no libre. Funciona como se describe para [CalDAV](caldav.md#busy-availability).

## Tu token de Google

El token que emite Google nunca sale del servidor. Tu navegador solo pasa por la página de Google para conceder el acceso. Mitra guarda el token con la cuenta y lo usa para obtener acceso de corta duración cada vez que sincroniza.

## Desconectar una cuenta

Elige **Eliminar** en el menú **⋯** de la cuenta para quitarla de Mitra, junto con su token. Para retirar también el acceso de Mitra en el lado de Google, elimina Mitra de las [conexiones de terceros de tu cuenta de Google](https://myaccount.google.com/permissions). Hacer solo esto también detiene la sincronización: la cuenta sigue en Mitra, pero cada sincronización falla hasta que la conectes de nuevo.

## Solución de problemas

- Si al elegir **Google Calendar** aparece una nota que dice que no está configurado en este servidor en lugar del botón **Continuar con Google**, `MITRA_GOOGLE_CLIENT_ID` y `MITRA_GOOGLE_CLIENT_SECRET` no están definidos, o Mitra no se ha reiniciado desde que los definiste.
- Si Google responde `redirect_uri_mismatch`, el URI de redirección de la consola de Google Cloud no coincide con `MITRA_URL` seguido de `/api/integrations/google/callback`. Tiene que coincidir exactamente, incluido `https://` y sin barra final.
- Si las cuentas dejan de sincronizarse tras 7 días, tu pantalla de consentimiento sigue en pruebas. Publica la aplicación y luego vuelve a conectar las cuentas.
