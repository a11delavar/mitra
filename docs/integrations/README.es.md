---
title: Integraciones
description: Guarda calendarios en el propio Mitra o conecta CalDAV, Google Calendar, Calendario de Apple, suscripciones a calendarios, Notion y Tempo, y descubre cómo funciona la sincronización.
sidebar:
  label: Resumen
---

Hay dos formas de tener un calendario en Mitra. Puedes guardarlo en el propio Mitra, en tu servidor, sin ninguna cuenta detrás. O puedes conectar una cuenta que ya tengas, y Mitra mantiene sus calendarios sincronizados en ambas direcciones. La mayoría acaba usando una mezcla, y las entradas se mueven libremente entre ambas.

Para añadir cualquiera de las dos, elige **Añadir integración** al pie de la barra lateral.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/integrations-detail-dark.webp">
  <img src="../../assets/screenshots/integrations-detail-light.webp" alt="El diálogo para añadir una integración, que ofrece Mitra, CalDAV, Google Calendar, Calendario de Apple, suscripciones a calendarios, Notion y Tempo" />
</picture>

## Qué guarda cada una

| Integración | Qué guarda | Configuración en el servidor |
| --- | --- | --- |
| [Mitra](mitra.md) | Eventos y tareas, guardados en Mitra | Ninguna |
| [CalDAV](caldav.md) | Eventos y tareas de cualquier servidor CalDAV | Ninguna |
| [Google Calendar](google.md) | Los calendarios de una cuenta de Google | Una configuración OAuth única |
| [Calendario de Apple](apple.md) | Los calendarios de una cuenta de iCloud | Ninguna |
| [Suscripciones a calendarios](subscriptions.md) | Un feed `webcal://` o `.ics` publicado, de solo lectura | Ninguna |
| [Notion](notion.md) | Tareas de las vistas de bases de datos de Notion | Ninguna |
| [Tempo](tempo.md) | Las horas que registras en incidencias de Jira | Ninguna |

Cada proveedor guarda cosas distintas. Las tareas de Notion no pueden repetirse, por ejemplo, y un registro de horas de Tempo no tiene ubicación. Mitra oculta los campos que un calendario no puede guardar, así que nada de lo que escribas desaparece en la siguiente sincronización.

## Cómo funciona la sincronización

Cuando conectas una cuenta, Mitra encuentra sus calendarios y los lista, todos marcados. Desmarca los que no quieras antes de guardar, y Mitra importará el resto. Los calendarios que aparezcan más tarde en la cuenta llegan desmarcados, así que nada nuevo aterriza en tu calendario sin que lo elijas. Mitra nunca descarga un calendario que esté desactivado.

Después, el servidor sincroniza en segundo plano por su cuenta. Comprueba con más frecuencia mientras alguien tiene Mitra abierto, y espacia las comprobaciones cuando nadie lo tiene:

| | Con Mitra abierto | Sin nadie que lo tenga abierto |
| --- | --- | --- |
| CalDAV y Calendario de Apple | cada 10 segundos | cada 5 minutos |
| Google Calendar, Notion y Tempo | cerca de una vez por minuto | cada 5 minutos |
| Suscripciones a calendarios | cada 15 minutos | cada 15 minutos |
| Calendarios de Mitra | nada que sincronizar | nada que sincronizar |

Google, Notion y Tempo limitan cada cuánto pueden llamarles las aplicaciones, por eso son más lentos. Al abrir Mitra, todas las cuentas que toca sincronizar lo hacen de inmediato, así que no hay botón de actualizar que pulsar.

Los cambios van en ambas direcciones. Cuando creas, editas, mueves o eliminas una entrada, Mitra la escribe de vuelta en el calendario al que pertenece. Que una cuenta falle no retrasa a las demás: Mitra lo reintenta un minuto después.

Algunos calendarios no se pueden cambiar desde Mitra, como las suscripciones y los calendarios que han compartido contigo solo para ver. Aun así puedes renombrarlos, cambiarles el color y ocultarlos; consulta [Calendarios de solo lectura](../calendars.md#read-only-calendars).

> [!NOTE]
> La sincronización solo obtiene lo que ha cambiado. Si alguna vez un calendario se ve mal, **Re-importar entradas** en su menú **⋯** descarta la copia de Mitra y la importa de nuevo desde el proveedor; consulta [Re-importar un calendario](../calendars.md#re-import-a-calendar). En ambos casos no cambia nada en el proveedor.

## Cambiar una cuenta

Cada cuenta se puede conectar una sola vez. Para cambiar su contraseña, o qué calendarios suyos muestra Mitra, elige **Editar** en su menú **⋯** en lugar de añadirla otra vez. Google Calendar es la excepción: conectar de nuevo la misma cuenta de Google renueva el acceso de Mitra a ella.
