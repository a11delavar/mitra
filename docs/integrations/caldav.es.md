---
title: CalDAV
description: Conecta cualquier servidor CalDAV, como Nextcloud, Radicale, Fastmail o mailbox.org, y sincroniza sus eventos y tareas en ambas direcciones.
---

CalDAV es el estándar abierto que hablan la mayoría de los servidores de calendario. Conectas una cuenta CalDAV desde la aplicación, sin nada que configurar en el servidor, y Mitra sincroniza sus eventos y tareas en ambas direcciones.

Tus calendarios se quedan en tu servidor, así que cualquier otra aplicación CalDAV que uses, como el calendario de tu teléfono, ve las mismas entradas. Esa es la diferencia con los [calendarios de Mitra](mitra.md), que solo Mitra puede abrir.

## Conectar una cuenta

1. Elige **Añadir integración** al pie de la barra lateral y luego **CalDAV**.
2. Rellena el formulario:
   - **URL del servidor** es la dirección CalDAV de tu servidor, como `https://caldav.example.com`. La [tabla de más abajo](#server-urls-for-common-providers) la indica para los proveedores habituales.
   - **Nombre de usuario** suele ser el nombre de tu cuenta o tu dirección de correo.
   - **Contraseña** es la contraseña de tu cuenta, o una contraseña de aplicación si tu proveedor te da una.
3. Pulsa **Conectar**. Mitra lista los calendarios de la cuenta, todos activados, e indica qué guarda cada uno, como «Eventos · Tareas».
4. Desactiva los que no quieras y pulsa **Guardar**.

Mitra importa los calendarios que conservaste y luego los sincroniza cada 10 segundos mientras lo tengas abierto (consulta [cómo funciona la sincronización](README.md#how-syncing-works)).

Para cambiar la contraseña más adelante, abre el menú **⋯** de la cuenta en la barra lateral, elige **Editar**, escribe la nueva contraseña y pulsa **Guardar**. La URL del servidor y el nombre de usuario se quedan como están; para una cuenta distinta, conéctala por separado.

## URL del servidor de los proveedores habituales

Dale a Mitra la dirección CalDAV del proveedor y él encuentra los calendarios a partir de ahí.

| Proveedor | URL del servidor |
| --- | --- |
| Nextcloud | `https://<your-nextcloud>/remote.php/dav` |
| Radicale | `https://<your-radicale>/` (o `.../<user>/`) |
| Fastmail | `https://caldav.fastmail.com/` |
| mailbox.org | `https://dav.mailbox.org/` |
| Baïkal | `https://<your-baikal>/dav.php` |

Google Calendar e iCloud también hablan CalDAV, pero no aceptan tu contraseña normal: Google te hace iniciar sesión en su propia página, y Apple exige una contraseña específica de la aplicación. Usa en su lugar sus propios iconos, como se describe en [Google Calendar](google.md) y [Calendario de Apple](apple.md).

## Qué se sincroniza

Cada calendario del servidor es un calendario en Mitra. Guarda eventos, tareas o ambos, según lo que permita el servidor. La mayoría de los servidores permiten ambos; en un calendario que solo admite un tipo, las entradas nuevas son siempre de ese tipo.

Todo lo que Mitra guarda de una entrada se sincroniza, en la medida en que tu servidor lo conserve:

- Entradas de todo el día y de varios días, ubicaciones, descripciones, colores y recordatorios.
- Si una entrada se muestra como ocupada o disponible, y su visibilidad.
- El estado y el progreso de una tarea.
- [Participantes](../participants.md). Tu servidor envía las invitaciones y recoge las respuestas.
- [Subtareas](../subtasks.md) y [dependencias](../dependencies.md).

Una entrada recurrente sigue siendo una sola serie en el servidor. Cuando cambias una única repetición, Mitra pregunta si te refieres a **Esta entrada**, **Esta y las siguientes entradas** o **Todas las entradas**, y cambia la serie en consecuencia.

Una tarea conserva su programación, su [fecha de vencimiento y su estimación](../planning.md#schedule-constraints-and-planning). Si te da curiosidad cómo: el inicio se guarda como `DTSTART`, la duración de la programación (o la estimación, mientras la tarea está sin programar) como `ESTIMATED-DURATION`, y la fecha de vencimiento como `DUE`, de modo que otras aplicaciones ven el inicio y la fecha de vencimiento. Una tarea que otra aplicación, o una versión anterior de Mitra, guardó con un inicio y un `DUE` pero sin duración se lee como programada del uno al otro, sin fecha de vencimiento.

Los calendarios que han compartido contigo solo para ver se marcan como de solo lectura. Aun así puedes renombrarlos, cambiarles el color, reordenarlos y ocultarlos; consulta [Calendarios de solo lectura](../calendars.md#read-only-calendars).

## Disponibilidad ocupada

La [disponibilidad](../availability.md) que marcas como **Ocupado** se añade a su calendario como eventos ocupados, de modo que el tiempo aparece como no libre en tu teléfono y para cualquiera que te invite. No hay nada que configurar.

- Cada disponibilidad ocupada se convierte en un evento recurrente con los mismos horarios y la misma regla de repetición, marcado como ocupado. Toma el nombre de la disponibilidad, o «Ocupado» si no tiene, y su lugar y visibilidad, como **Privado**.
- Dentro de Mitra ves la propia disponibilidad en lugar de estos eventos, así que el tiempo no aparece dos veces.
- Mitra mantiene los eventos al día con tu disponibilidad. Si uno se cambia, se mueve o se elimina en otra aplicación, Mitra lo restaura en la siguiente sincronización.
- Volver a marcar la disponibilidad como **Disponible**, eliminarla, desactivar su calendario o eliminar la cuenta elimina los eventos. Mover la disponibilidad a otro calendario mueve también sus eventos.
- Un calendario que solo guarda tareas, o en el que no puedes escribir, no recibe eventos.

> [!NOTE]
> Los cambios en un solo día de una disponibilidad ocupada no se trasladan. El evento sigue la regla de repetición, así que un día que moviste o acortaste sigue mostrando a los demás su horario habitual.

Funciona igual para [Google Calendar](google.md) y [Calendario de Apple](apple.md), a los que Mitra también se conecta por CalDAV.

## Solución de problemas

- Si falta un calendario, está desactivado. Les pasa a los calendarios que desactivaste al conectar, y a los creados después en el servidor, que Mitra añade desactivados. Actívalo en **⋯ → Editar** de la cuenta y pulsa **Guardar**. **Actualizar** ahí lista los calendarios creados en el servidor desde la última sincronización.
- Si Mitra dice «This account is already connected», la cuenta ya está en tu barra lateral. Cámbiala desde su **⋯ → Editar**, por ejemplo para introducir una contraseña nueva.
- Si falla la conexión, comprueba que la URL del servidor empiece por `https://` y apunte a la dirección CalDAV, no a la página web en la que inicias sesión. Para ver todas las peticiones que Mitra hace al servidor, pon el [nivel de registro](../logging.md) en `debug`.
- Si un calendario se ve mal tras actualizar Mitra, usa **Re-importar entradas** en su menú **⋯**. La sincronización solo obtiene lo que cambió en el servidor, así que las entradas que no cambiaron no se vuelven a leer; una re-importación las lee todas. Consulta [Re-importar un calendario](../calendars.md#re-import-a-calendar).
