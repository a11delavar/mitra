---
title: Suscripciones a calendarios
description: Suscríbete a un enlace de calendario publicado, como una dirección webcal:// o un feed .ics, y ve sus entradas en Mitra, de solo lectura.
---

Muchos calendarios se publican en lugar de compartirse: festivos, calendarios de partidos, periodos escolares, un feed de una herramienta del trabajo, o la dirección privada de tu propio calendario de Google o Outlook. En estos no inicias sesión. Te suscribes con un enlace.

Una **suscripción a un calendario** trae uno de esos enlaces a Mitra como un calendario propio, con sus eventos, y con sus tareas si las tiene.

Las suscripciones son de solo lectura. El feed vive en otro servidor, que no acepta cambios, así que Mitra muestra lo que publica y nunca escribe de vuelta. Aun así puedes renombrar el calendario, cambiarle el color, reordenarlo y ocultarlo; consulta [Calendarios de solo lectura](../calendars.md#read-only-calendars). Para conservar una copia editable de sus entradas, usa **Copiar las entradas a…** en su menú **⋯**.

## Suscribirse a un calendario

1. Elige **Añadir integración** al pie de la barra lateral y luego **Suscripción a un calendario**.
2. Pega el enlace en **URL del calendario**. Es una dirección `webcal://`, como las que suelen dar los botones «Suscribirse», o una dirección `https://`, que normalmente termina en `.ics`.
3. Deja **Usuario (opcional)** y **Contraseña (opcional)** vacíos, a menos que el feed los pida (consulta [feeds con contraseña](#feeds-with-a-password)).
4. Pulsa **Conectar**. Mitra lee el feed y lista su calendario.
5. Déjalo activado y pulsa **Guardar**.

Un enlace es un calendario. Para suscribirte a varios, añade una suscripción por cada uno.

El calendario toma su nombre del feed, y también su color, si el feed lo tiene. Puedes renombrarlo en la barra lateral, y tu nombre se mantiene hasta que el propio feed renombre el calendario.

Si has [hecho de Mitra tu aplicación de calendario predeterminada](../calendar-files.md), al hacer clic en un enlace `webcal://` de una página web se abre este formulario con el enlace ya rellenado.

### Dónde encontrar el enlace de un calendario

| Proveedor | Dónde buscar |
| --- | --- |
| Google Calendar | En los ajustes del calendario, **Integrate calendar** → **Secret address in iCal format** |
| Outlook y Microsoft 365 | **Share** → **Publish a calendar**, y copia el enlace ICS |
| iCloud | Clic derecho en el calendario → **Share Calendar** → **Public Calendar** |
| Nextcloud | El menú **⋯** del calendario → **Copy subscription link** |
| Calendarios públicos | La mayoría de los sitios de festivos, deportes y colegios ofrecen un enlace `.ics` |

> [!CAUTION]
> Una dirección secreta es una contraseña en forma de enlace: cualquiera que la tenga puede leer el calendario. Mantenla para ti y restablécela en los ajustes de tu proveedor si alguna vez se filtra.

### Feeds con contraseña

La mayoría de los feeds publicados llevan su clave de acceso en el propio enlace y no necesitan nada más. Si un feed, como uno de un servidor de empresa o autoalojado, pide un nombre de usuario y una contraseña (autenticación HTTP Basic), introdúcelos al suscribirte. Mitra guarda la contraseña en el servidor y nunca la devuelve a tu navegador.

## Cómo se mantiene al día

Mitra sincroniza cada suscripción cada 15 minutos, tenga o no alguien Mitra abierto, así que abrir Mitra no obtiene un feed antes (consulta [cómo funciona la sincronización](README.md#how-syncing-works)). Una sincronización cuesta poco: Mitra pregunta al servidor del feed si algo ha cambiado, y solo descarga el calendario cuando es así.

El calendario refleja el feed. Las entradas añadidas al feed aparecen en Mitra, y las que se quitan de él desaparecen.

Si alguna vez el calendario se ve mal, **Re-importar entradas** en su menú **⋯** vuelve a leer el feed desde el principio. El feed en sí nunca se toca. Consulta [Re-importar un calendario](../calendars.md#re-import-a-calendar).

## Solución de problemas

- Si Mitra dice «The calendar requires a username and password», el feed está protegido. Introduce el nombre de usuario y la contraseña que necesita.
- Si Mitra dice «No calendar was found at that address», revisa el enlace por si tiene errores. Una dirección secreta también deja de funcionar cuando su propietario la restablece.
- Si Mitra dice «The address did not return a calendar», el enlace lleva a una página web y no al feed. Busca un enlace llamado iCal, ICS o Suscribirse.
- Si Mitra dice «The calendar is too large to subscribe to», el feed pesa más de 20 MB, que Mitra no lee.
