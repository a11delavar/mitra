---
title: Todoist
description: Trae tus proyectos de Todoist a Mitra como calendarios de tareas que se sincronizan en ambas direcciones.
---

Mitra se conecta con Todoist para las tareas. Cada uno de tus proyectos de Todoist se convierte en un calendario de Mitra que guarda sus tareas. El título, la descripción, las fechas y la finalización de una tarea se sincronizan en ambas direcciones.

Te conectas desde la app con tu token de API. No hay nada que configurar en el servidor.

## Conectar una cuenta

1. En Todoist, abre **Configuración** → **Integraciones** → **Desarrollador** y copia tu token de API.
2. En Mitra, elige **Añadir integración** al pie de la barra lateral y luego **Todoist**, y pega el token en **Token de API de Todoist**.
3. Pulsa **Conectar**. Mitra lista tus proyectos, cada uno con su color de Todoist. Un proyecto dentro de otro lleva el nombre de ambos, como "Trabajo · Lanzamiento".
4. Elige los proyectos que quieras y pulsa **Guardar**.

Puedes conectar más de una cuenta de Todoist. Los proyectos archivados no aparecen en la lista.

## Qué se sincroniza

El título, la descripción y la finalización se sincronizan en ambas direcciones, y también las fechas:

| En Todoist | En Mitra |
| --- | --- |
| Fecha | La programación de la tarea: un día o una hora |
| Duración | Cuánto tiempo está programada la tarea, o su [estimación](../planning.md#set-an-estimate) mientras no tiene fecha |
| Fecha límite | Su [fecha de vencimiento](../planning.md#set-a-due-date) |
| Subtarea | Una [subtarea](../subtasks.md) |

Una tarea sin fecha espera en la lista **Sin programar** de la [pestaña Planificación](../planning.md#the-planning-tab). Las tareas que completaste en las últimas doce semanas llegan al conectar, y después cada finalización.

Todoist guarda una hora como flotante, la misma en cualquier reloj estés donde estés, o fija en una zona horaria. Mitra conserva ambas tal como son: una hora flotante sigue siendo [la misma en todas partes](../time-zones.md#same-time-everywhere), y una fija conserva su zona.

Las fechas límite y las duraciones forman parte de los planes Pro y Business de Todoist. En una cuenta gratuita, las tareas de Todoist no tienen fecha de vencimiento, fin ni estimación en Mitra: una tarea con hora es un momento, y una tarea en un día ocupa solo ese día. Cuando tu plan cambia, como cuando empieza o termina un periodo de prueba, Mitra vuelve a leer todas las tareas. Una fecha límite es un día, así que una fecha de vencimiento a la que das una hora en Mitra conserva solo su día.

Mitra no muestra la prioridad, las etiquetas, la sección, los comentarios ni los recordatorios de una tarea, y los deja como están en Todoist. Mover una tarea a otro calendario de Todoist la mueve a ese proyecto, y los conserva todos.

Para abrir una tarea en Todoist, elige **Abrir en Todoist** en el menú **⋯** del editor. Eliminar una tarea en Mitra la elimina en Todoist.

Todoist limita cada cuánto pueden llamarle las aplicaciones, así que Mitra lo sincroniza cerca de una vez por minuto (consulta [cómo funciona la sincronización](README.md#how-syncing-works)).

## Tareas que se repiten

Una tarea que se repite en Todoist aparece en su próxima fecha, como la guarda Todoist, sin su regla. Completarla en Mitra la completa en Todoist, que la pasa a la fecha siguiente, como hace siempre. Moverla a otro día cambia solo su próxima fecha, y su regla queda como está. Para cambiar la regla, edita la tarea en Todoist.

## Lo que se queda en Mitra

Todoist no tiene dependencias, así que las [dependencias](../dependencies.md) entre tareas de Todoist se guardan solo en Mitra. Se pierden si desconectas la cuenta o [vuelves a importar un calendario](../calendars.md#re-import-a-calendar). La tarea principal de una subtarea se guarda en ambos, siempre que sea una tarea de la misma cuenta de Todoist. Entonces Todoist mueve la subtarea al proyecto de su tarea principal.

## Lo que Todoist no puede guardar

- Solo guarda tareas, así que no hay eventos ni [disponibilidad](../availability.md).
- Una tarea está abierta o hecha, así que no hay estado **En progreso** ni **Cancelado**. Una tarea que está en progreso en otro lugar vuelve a estar **Por hacer** cuando la mueves a Todoist.
- No puedes hacer que una tarea se repita desde Mitra.
- En Mitra, una tarea no tiene recordatorios, ubicación, participantes, adjuntos, progreso, ocupado o libre ni visibilidad.

Mitra oculta estos campos en las tareas de Todoist, así que nada de lo que escribas ahí desaparece en la siguiente sincronización. Para mover a Todoist entradas que los usan, consulta [Mover o copiar todas las entradas a otro calendario](../calendars.md#move-or-copy-every-entry-to-another-calendar), que muestra primero lo que no llegaría.

## Solución de problemas

- Si Mitra dice que Todoist rechazó el token de API, cópialo de nuevo desde **Configuración** → **Integraciones** → **Desarrollador**. Si lo restableciste en Todoist, abre **⋯ → Editar** de la cuenta en Mitra y pega el nuevo.
- Si falta un proyecto, puede estar archivado. Tras desarchivarlo en Todoist, abre **⋯ → Editar** de la cuenta en Mitra y pulsa **Actualizar**.
