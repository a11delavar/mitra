---
title: Notion
description: Trae las vistas de tus bases de datos de tareas de Notion a Mitra como calendarios de tareas que se sincronizan en ambas direcciones.
---

Mitra se conecta a Notion para las tareas. Cada vista de una base de datos de tareas, como «All tasks», «My tasks» o un tablero de sprint, se convierte en un calendario en Mitra que guarda exactamente las tareas que muestra la vista: Notion aplica los filtros de la vista, y Mitra coloca el resultado en tu calendario. El título, el estado, las fechas y la descripción de una tarea se sincronizan en ambas direcciones.

Te conectas desde la aplicación con un token de integración. No hay nada que configurar en el servidor.

## Conectar un espacio de trabajo

1. Crea una integración en [notion.so/profile/integrations](https://www.notion.so/profile/integrations). Basta con una integración interna.
2. Comparte con ella tus bases de datos de tareas. Abre cada base de datos en Notion, elige **•••** → **Connections** y añade tu integración.
3. En Mitra, elige **Añadir integración** al pie de la barra lateral y luego **Notion**, y pega el secreto de la integración, que empieza por `ntn_`, en **Token de integración**.
4. Pulsa **Conectar**. Mitra lista las vistas de las bases de datos que compartiste, con el nombre de la base de datos y de la vista.
5. Elige las vistas que quieras y pulsa **Guardar**.

Para empezar, Mitra activa una vista por base de datos. Una tarea pertenece a toda vista cuyos filtros cumple, así que con dos vistas de la misma base de datos activadas aparecería dos veces. Aun así puedes activar más a propósito.

Mitra ofrece vistas de tabla, tablero, lista, calendario, línea de tiempo y galería. Los demás tipos de vista no se listan.

## Qué bases de datos sirven

Una base de datos aparece cuando tiene una propiedad de tipo Status y una de tipo Date. Las plantillas de tareas propias de Notion tienen ambas.

Mitra lee el estado de una tarea del grupo al que pertenece su estado de Notion:

| Grupo de estado de Notion | Estado en Mitra |
| --- | --- |
| To-do | Por hacer |
| In progress | En progreso |
| Complete | Hecho |

Cuando cambias un estado en Mitra, Notion recibe la primera opción del grupo correspondiente.

La propiedad Date es donde Mitra coloca la tarea, así que es la programación de la tarea. Si una base de datos tiene varias propiedades Date, Mitra prefiere una cuyo nombre empiece por «Due», luego una llamada «Date», «When», «Deadline», «Scheduled» o «Do date», y si no, toma la primera.

## Qué se sincroniza

El título, el estado y la fecha se sincronizan en ambas direcciones, como fechas de todo el día o con hora. Las horas se muestran en tu propia zona horaria. Una tarea sin fecha espera en la lista **Sin programar** de la [pestaña Planificación](../planning.md#the-planning-tab).

La descripción de una tarea es el cuerpo de su página de Notion, escrito como Markdown, incluidas las listas de tareas y los avisos. Cuando editas la descripción en Mitra, Mitra reemplaza solo lo que la descripción muestra. Las imágenes, los contenidos incrustados, las subpáginas y los bloques sincronizados se quedan en Notion tal como están, y Mitra no los muestra.

Las propiedades de relación que enlazan tareas dentro de la misma base de datos se convierten en vínculos en Mitra, en ambas direcciones. Una propiedad llamada «Parent task» o «Sub-tasks» crea [subtareas](../subtasks.md), una llamada «Blocked by» o «Depends on» crea [dependencias](../dependencies.md), y las demás relaciones aparecen con su propio nombre. Las relaciones con otras bases de datos no se muestran.

Para abrir una tarea en Notion, elige **Abrir en Notion** en el menú **⋯** del editor. Eliminar una tarea en Mitra mueve su página a la papelera de Notion, donde todavía puedes restaurarla.

Notion limita cada cuánto pueden llamarle las aplicaciones, así que Mitra lo sincroniza cerca de una vez por minuto (consulta [cómo funciona la sincronización](README.md#how-syncing-works)). Una tarea nueva nunca desaparece brevemente mientras Notion se pone al día.

## Lo que Notion no puede guardar

Una base de datos de Notion guarda tareas con una sola fecha cada una, y eso determina lo que puede guardar un calendario de Notion:

- Guarda solo tareas, así que no hay eventos ni [disponibilidad](../availability.md).
- La única fecha de una tarea es su programación, así que no hay fecha de vencimiento ni estimación.
- Las tareas no pueden repetirse y no tienen recordatorios, ubicación ni participantes.
- No hay estado **Cancelado**, ya que Notion no tiene un grupo para eso.
- Una tarea no puede tener zona horaria propia, porcentaje de progreso, estado ocupado o disponible, ni visibilidad.

Mitra oculta estos campos en las tareas de Notion, así que nada de lo que escribas allí desaparece en la siguiente sincronización. Para mover a Notion entradas que los usan, consulta [Mover o copiar cada entrada a otro calendario](../calendars.md#move-or-copy-every-entry-to-another-calendar), que primero muestra lo que no llegaría.

## Vistas y filtros

Un calendario muestra lo que muestra su vista de Notion, y una tarea que creas en él recibe los valores de filtro de la vista, así que aterriza en la vista. Una tarea añadida a una vista «University» recibe «Area = University», como si hubieras añadido la fila en Notion.

Mitra rellena los filtros que un solo valor puede satisfacer: un select, un estado, un multi-select, una casilla o una relación con una página concreta. Algunos filtros no los puede cumplir ningún valor único, como una fórmula, un rango de fechas o una de varias opciones. Una tarea que creas en una vista así no la cumple, así que, como en Notion, no aparece allí. Sigue en la base de datos, y una vista con menos filtros, como «All tasks», la muestra.

> [!TIP]
> Si una vista filtra por una relación con otra base de datos, por ejemplo tareas cuyo «Area» apunta a una página «University» de una base de datos «Areas», comparte también esa base de datos con tu integración. Si no, Mitra no puede establecer la relación en las tareas nuevas, y no aparecen en la vista.

## Solución de problemas

- Si una base de datos no aparece en la lista, le falta una propiedad Status o Date, o no está compartida con tu integración (**•••** → **Connections** en Notion). Tras compartirla, abre **⋯ → Editar** de la cuenta en Mitra y pulsa **Actualizar**.
- Si una tarea aparece dos veces, has activado dos vistas de la misma base de datos que la incluyen ambas. Desactiva una en **⋯ → Editar** de la cuenta.
