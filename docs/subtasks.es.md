---
title: Subtareas
description: "Divide una tarea en subtareas o en una lista de comprobación, sigue su progreso y termina, mueve o elimina de una vez un árbol completo de tareas."
---

Una tarea puede tener **subtareas**: tareas más pequeñas que juntas la forman. Una subtarea puede estar en otro calendario, incluso en otra cuenta, puede tener subtareas propias y puede estar [sin programar](planning.md#the-planning-tab).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/hierarchy-detail-dark.webp">
  <img src="../assets/screenshots/hierarchy-detail-light.webp" alt="Una tarea con una lista de comprobación en su descripción y una subtarea terminada, contadas como 1/1" />
</picture>

## Añadir una subtarea

Abre la tarea más pequeña, pulsa **＋** en **Subtarea de** y escribe parte del título de la tarea más grande. La búsqueda abarca todos tus calendarios. La tarea más grande la lista entonces en **Subtareas**, con un recuento de cuántas están hechas, como 1/3. El vínculo siempre se añade desde la subtarea: la fila **Subtareas** de la tarea más grande solo las enumera.

Cada subtarea de la lista muestra su casilla con el [color de su calendario](calendars.md#recolor), así que puedes marcarla sin salir de la tarea más grande. Las subtareas hechas y canceladas aparecen tachadas. Haz clic en un título para abrir esa tarea, o pulsa la **✕** junto a ella para quitar el vínculo, desde cualquiera de los dos lados. En el calendario, una línea une una tarea con sus subtareas cuando ambas están a la vista.

Mitra rechaza un vínculo que formaría un círculo, como una tarea que acaba siendo subtarea de sí misma.

## Listas de comprobación

La descripción de una tarea también puede contener una lista de comprobación, escrita en Markdown:

```markdown
- [ ] Book the venue
- [x] Send the invitations
```

Marca una casilla directamente en la descripción para completarla. Mitra cambia `[ ]` por `[x]` en el texto, de modo que otras aplicaciones que usen el calendario también lo ven. Marcar casillas nunca cambia por sí solo el estado de la tarea. Solo las tareas cuentan sus listas de comprobación: las casillas de un evento se pueden marcar, pero no cuentan para nada.

## Progreso

Una tarea con subtareas o con una lista de comprobación muestra su progreso. Cada subtarea y cada casilla cuenta como un paso, todos con el mismo peso, así que una tarea con tres casillas y dos subtareas tiene cinco pasos.

Una subtarea a medio hacer cuenta en parte, tanto si tiene un progreso propio como si tiene subtareas propias. Si una tarea tiene tres subtareas, dos hechas y la tercera al 80 %, la tarea está al 93 %. Las subtareas canceladas no cuentan, de modo que el trabajo descartado nunca frena la tarea. Los eventos vinculados como subtareas tampoco cuentan.

En el calendario, el contorno de la casilla de una tarea se va llenando a medida que avanza. Apunta a la casilla para ver el recuento, como «2 de 3 subtareas hechas», o «2 de 4 pasos hechos» cuando cuentan casillas y subtareas juntas. Haz clic derecho en ella, o <kbd>Alt</kbd> + clic, para abrir el menú de estado con el porcentaje exacto.

## Fijar el progreso a mano

Una tarea sin subtareas ni lista de comprobación puede llevar un progreso que fijas tú. Haz clic derecho en su casilla, o <kbd>Alt</kbd> + clic, y arrastra **Progreso** en pasos del 5 %. Al 100 %, la tarea pasa a **Hecho**. Por debajo del 100 %, una tarea hecha vuelve a **En progreso**, o a **Por hacer** al 0 %. La **✕** junto al valor lo borra.

El calendario tiene que poder guardar el progreso: los [servidores de calendario](integrations/caldav.md), [Apple Calendar](integrations/apple.md) y los [calendarios de Mitra](integrations/mitra.md) pueden. Google Calendar, Notion y Tempo no, así que sus tareas no tienen el control deslizante **Progreso**.

## Terminar un árbol de tareas

Cuando marcas la última subtarea abierta, Mitra pregunta si quieres marcar también como hecha la tarea más grande. Si con eso se terminan más tareas por encima, ofrece marcarlas todas como hechas. Solo pregunta cuando la lista de comprobación de la tarea más grande también está completamente marcada.

Cuando marcas una tarea como hecha o cancelada mientras algunas de sus subtareas siguen abiertas, Mitra pregunta qué hacer con ellas: **Marcar como hecha** o **Marcar como cancelada**. Cierra la pregunta para dejarlas abiertas. Puedes volver a ella más tarde: en el menú de estado de la tarea, el recuento de subtareas lleva a la misma pregunta.

## Mover o eliminar una tarea con subtareas

Cuando arrastras una tarea con subtareas a otro momento, Mitra pregunta **¿Mover también las subtareas?**. Elige **Solo esta entrada**, o mueve la tarea con todas sus subtareas la misma cantidad de tiempo. Eliminar una tarea así pregunta **¿Eliminar también las subtareas?** del mismo modo.

> [!TIP]
> Mantén pulsada <kbd>Ctrl</kbd> (<kbd>⌘</kbd> en un Mac) mientras sueltas o eliminas para saltarte la pregunta y cambiar solo esa tarea. Consulta los [atajos de teclado](shortcuts.md).

## Qué calendarios lo admiten

Un vínculo se guarda con la subtarea, en el calendario de esa entrada. Los [servidores de calendario](integrations/caldav.md), [Apple Calendar](integrations/apple.md) y los [calendarios de Mitra](integrations/mitra.md) admiten cualquier vínculo, y en un servidor de calendario se escribe en el formato estándar de calendario, así que otras aplicaciones que usen el mismo calendario pueden leerlo.

- En [Notion](integrations/notion.md), un vínculo a una tarea de la misma base de datos va a la propiedad de relación correspondiente, como "Parent task". Mitra guarda por sí mismo los vínculos a cualquier otra cosa.
- [Google Calendar](integrations/google.md) descarta los vínculos, así que una entrada de un calendario de Google no puede tener un padre. Las entradas de otros calendarios sí pueden vincularse a ella.
- Las [suscripciones a calendarios](integrations/subscriptions.md) son de solo lectura, y [Tempo](integrations/tempo.md) no tiene vínculos.
