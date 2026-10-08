---
title: Calendarios de Mitra
description: Calendarios guardados en el propio Mitra, en tu servidor, sin ninguna cuenta detrás.
---

Un calendario de Mitra se guarda en la propia base de datos de Mitra en lugar de en un proveedor. No hay cuenta que conectar ni nada que sincronizar: creas un calendario y empiezas a añadir entradas. Es la forma más sencilla de empezar con Mitra, y un buen hogar para todo lo que no encaja en ninguna de tus cuentas existentes.

Los calendarios de Mitra viven en tu servidor, no en tu dispositivo, así que están ahí dondequiera que abras Mitra. Pueden guardar todo lo que Mitra sabe hacer: eventos y tareas, repeticiones, recordatorios, [disponibilidad](../availability.md), [subtareas](../subtasks.md), [dependencias](../dependencies.md), fechas de vencimiento y estimaciones.

## Añadir calendarios de Mitra

1. Elige **Añadir integración** al pie de la barra lateral y luego **Mitra**.
2. Dale nombre a tu primer calendario.
3. Pulsa **Guardar**.

El calendario está listo al instante. Solo añades la integración una vez: guarda tantos calendarios como quieras, así que después su icono desaparece de **Añadir integración**.

Para añadir otro calendario, abre el menú **⋯** del encabezado de Mitra en la barra lateral y elige **Nuevo calendario**. Para eliminar uno, elige **Eliminar calendario** en el menú **⋯** de ese calendario. Renombrar, cambiar el color, reordenar y ocultar funcionan como en cualquier calendario; consulta [Calendarios](../calendars.md).

> [!CAUTION]
> Eliminar un calendario de Mitra elimina todas sus entradas para siempre, ya que no hay ningún proveedor del que recuperarlas. Mitra pregunta antes, y ofrece [mover las entradas](../calendars.md#move-or-copy-every-entry-to-another-calendar) a otro calendario antes de eliminar nada.

## Mover entradas hacia dentro y hacia fuera

Las entradas se mueven entre un calendario de Mitra y cualquier otro calendario. Para mover una, elige otro calendario en su editor. Para mover un calendario entero, usa **⋯ → Mover las entradas a…**, que primero muestra lo que el destino no puede guardar.

También funciona al revés: puedes empezar en Mitra y mover todo a un calendario de CalDAV o de Google más adelante.

## Hacer copias de seguridad

Una cuenta conectada guarda su propia copia de tus entradas. Un calendario de Mitra no: sus entradas existen solo en la base de datos de Mitra. Asegúrate de que la carpeta de datos de Mitra forme parte de tus [copias de seguridad](../backups.md).

Si piensas activar el [inicio de sesión](../sso.md) más adelante, ten en cuenta que todos empiezan con una cuenta nueva y vacía. Los calendarios de Mitra que creaste antes se quedan con la antigua cuenta de un solo usuario.

## Lo que no pueden hacer

- Los participantes se guardan como registro de quién está implicado, pero nadie recibe una invitación ni llegan respuestas, porque no hay un servidor de calendario que las envíe. Si mueves aquí una reunión desde un calendario de CalDAV, el original se elimina allí, y algunos servidores avisan entonces a sus participantes de que se canceló. Cópiala en su lugar si no deben enterarse.
- Otras aplicaciones no pueden verlos. Mitra no publica sus calendarios por CalDAV, así que usa un servidor [CalDAV](caldav.md) para los calendarios que también quieras en la aplicación de calendario de tu teléfono.
- No hay nada que re-importar, así que **Re-importar entradas** no se ofrece.
