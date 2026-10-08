---
title: Inicio de sesión único
description: Comparte un servidor de Mitra con tu familia o un equipo. Cada persona inicia sesión mediante un proveedor OpenID Connect con una cuenta que ya tiene.
---

De fábrica, Mitra es para una sola persona y no tiene inicio de sesión, lo cual está bien mientras solo tú puedas acceder a él. Para compartir un servidor con tu familia o un equipo, conéctalo a un proveedor OpenID Connect (OIDC). Entonces cada persona inicia sesión con una cuenta que ya tiene, y obtiene calendarios propios que nadie más ve.

Mitra funciona con cualquier proveedor OIDC estándar. La gente lo usa con Pocket ID, Authelia, Authentik, Keycloak y Google, entre otros.

> [!CAUTION]
> Activar el inicio de sesión da a cada persona una cuenta nueva y vacía, incluido a ti. Todo lo que configuraste mientras Mitra era para una sola persona se queda con esa cuenta antigua y no se traslada: tus cuentas conectadas, tus ajustes y todas las entradas de tus [calendarios de Mitra](integrations/mitra.md). Las cuentas conectadas es fácil volver a añadirlas, pero las entradas de los calendarios de Mitra no pueden acompañarte. Activa el inicio de sesión antes de empezar a llenar Mitra, o mueve antes esas entradas a un calendario conectado (**Mover las entradas a…** en el menú **⋯** del calendario) y vuelve a conectar esa cuenta después.

## Activar el inicio de sesión

Define las variables OIDC en el contenedor:

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

En tu proveedor, registra `MITRA_URL` seguido de `/auth/callback` como dirección de redirección:

```text
https://mitra.example.com/auth/callback
```

Eso es todo lo que necesita el proveedor. Reinicia Mitra con `docker compose up -d` y pedirá a todos que inicien sesión.

Definir `MITRA_OIDC_ISSUER` es lo que activa el inicio de sesión, y necesita también `MITRA_OIDC_CLIENT_ID` y `MITRA_URL`. Si falta alguna, Mitra se niega a arrancar. Funcionar en silencio sin inicio de sesión sería mucho peor.

## Secreto de cliente y scopes

Si registraste un secreto de cliente en tu proveedor, define `MITRA_OIDC_CLIENT_SECRET`. Si registraste un cliente público, omítelo; está totalmente soportado, ya que Mitra siempre usa PKCE.

Mitra pide los scopes `openid profile email`. `openid` es obligatorio, y los otros dos dan a Mitra el nombre y el correo de cada persona. Cámbialos con `MITRA_OIDC_SCOPES` solo si tu proveedor necesita otra cosa.

## Quién puede iniciar sesión

Cualquiera a quien tu proveedor deje pasar obtiene una cuenta de Mitra la primera vez que inicia sesión. No hay lista de usuarios que gestionar en Mitra, así que decide quién puede iniciar sesión en tu proveedor, por grupo, asignación de aplicación o como gestione el acceso. El nombre y el correo de cada persona se actualizan desde el proveedor cada vez que inicia sesión.

## Cómo funciona el inicio de sesión

El inicio de sesión en sí ocurre en el servidor (el flujo de código de autorización con PKCE). Tu navegador solo recibe una cookie, y no se guarda ningún token en su almacenamiento, así que un script malicioso en la página no tiene nada que robar.

Una sesión dura 30 días desde la última vez que usaste Mitra. La cookie se marca como segura cuando `MITRA_URL` empieza por `https://`, y se permite un emisor `http://` para proveedores en tu propia red sin HTTPS. Si tu proveedor lo admite, cerrar sesión en Mitra también la cierra allí.

## Solución de problemas

- **Mitra no arranca y nombra una variable que falta.** Con `MITRA_OIDC_ISSUER` definido, también deben estar definidos `MITRA_OIDC_CLIENT_ID` y `MITRA_URL`.
- **El proveedor se queja de la dirección de redirección.** Debe ser exactamente `MITRA_URL` seguido de `/auth/callback`.
- **El registro dice que falló el discovery.** Mitra busca tu proveedor en el primer inicio de sesión y lo reintenta en el siguiente, así que un proveedor que arranca después de Mitra se arregla solo. Si sigue fallando, comprueba la URL del emisor y si Mitra puede alcanzarlo, con el [nivel de registro](logging.md) en `debug`.
- **Mis calendarios han desaparecido tras activar el inicio de sesión.** Es lo esperado: todos empiezan con una cuenta nueva. Vuelve a conectar tus cuentas.
