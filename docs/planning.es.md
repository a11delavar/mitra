---
title: Planificación
description: "Da a las tareas una fecha de vencimiento y una estimación, guarda las que están sin programar en la pestaña Planificación y prográmalas cuando sepas cuándo las harás."
---

La planificación trata de las tareas que aún no tienen un sitio en tu semana: ideas que quieres conservar, trabajo con fecha de vencimiento pero sin plan, y cosas a las que simplemente no has llegado. Esperan en la pestaña **Planificación** de la barra lateral, con una fecha de vencimiento y una estimación, hasta que las arrastras a tu semana.

Esta página trata de la pestaña Planificación, las fechas de vencimiento, las estimaciones, programar y desprogramar tareas, y las tareas vencidas.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/planning-detail-dark.webp">
  <img src="../assets/screenshots/planning-detail-light.webp" alt="La pestaña Planificación de la barra lateral, con las tareas vencidas encima de las que están sin programar" />
</picture>

## Programación, restricciones y planificación

Mitra separa dos tipos de información sobre el tiempo de una tarea.

- La **programación** es cuándo trabajarás en la tarea: su inicio y su fin. Es lo que muestran las vistas. Una tarea con programación está **programada**, y una tarea sin ella está **sin programar**.
- Las **restricciones** son lo que la programación tiene que respetar. Una tarea tiene dos: su **fecha de vencimiento**, cuándo tiene que estar hecha, y su **estimación**, cuánto tiempo llevará.

**Planificar** es programar tus tareas sin programar para que cada programación encaje con sus restricciones: termina antes de la fecha de vencimiento y dura lo que indica la estimación. Mitra tiene en cuenta la estimación por ti, así que una tarea que programas ya tiene la duración correcta.

Ni la programación ni las restricciones son obligatorias. Una tarea puede tener fecha de vencimiento y ninguna programación, una programación y ninguna fecha de vencimiento, ambas, o ninguna.

Por ejemplo, una presentación vence el viernes a mediodía, y programas el martes por la mañana para prepararla. Las vistas muestran la tarea el martes, y una pequeña bandera a su lado indica que tiene fecha de vencimiento.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/due-detail-dark.webp">
  <img src="../assets/screenshots/due-detail-light.webp" alt="Una tarea programada para el martes de 9:00 a 12:00, con una fecha de vencimiento el viernes a mediodía" />
</picture>

## La pestaña Planificación

La pestaña **Planificación** de la barra lateral es donde planificas: tus tareas sin programar esperan allí hasta que las programas. Abre la barra lateral y cambia a **Planificación**. También puedes deslizar hacia un lado desde **Calendarios**, con dos dedos en un trackpad o con un dedo en una pantalla táctil.

La pestaña tiene dos listas:

- **Sin programar** contiene todas las tareas sin programar. Hasta que las [pongas en orden](#put-tasks-in-order), las tareas con fecha de vencimiento van primero, la más próxima arriba. El resto siguen en orden alfabético, y las tareas terminadas pasan al final.
- **Vencidas** contiene las tareas en las que vas con retraso. Consulta [tareas vencidas](#overdue-tasks).

El número de la pestaña cuenta ambas listas, así que también puedes ver cuánto está esperando desde la pestaña **Calendarios**. Haz clic en una tarea para abrirla, como harías en las vistas.

Para anotar una tarea para más tarde, pulsa **Añadir tarea** en la parte inferior de la pestaña. Solo pide un título. La tarea va a tu [calendario predeterminado](calendars.md#where-new-entries-land), o al primer calendario que pueda contener tareas si el tuyo no puede.

## Poner las tareas en orden

Arrastra una tarea hacia arriba o hacia abajo en la lista **Sin programar** para reordenarla. El orden se guarda, y una tarea conserva su lugar cuando pasa a otro calendario.

Tu orden va antes que las fechas de vencimiento. Las tareas nuevas aparecen debajo de las que has colocado, y las tareas terminadas se quedan al final.

Mitra guarda el orden por sí mismo, así que otras aplicaciones no lo ven.

## Fijar una fecha de vencimiento

Abre la tarea, pulsa **Fecha de vencimiento** y elige un día. Para quitar la fecha de vencimiento, pulsa la **✕** a su lado.

Una tarea con fecha de vencimiento muestra una pequeña bandera, en las vistas y en la pestaña Planificación. Programar, desprogramar o mover la tarea nunca cambia su fecha de vencimiento.

Una tarea de todo el día vence en un día. Para darle una hora, desactiva **Todo el día** al final de la fecha de vencimiento, que aparece mientras estás en ella. Eso da horas a toda la tarea, así que su fecha de vencimiento pasa a ser las 17:00 del mismo día, que puedes cambiar.

## Fijar una estimación

Una tarea sin programar tiene un campo **Estimación**, con un reloj de arena, donde una tarea programada tiene su fin. Haz clic en él y escribe las horas y los minutos, o elige una duración de la lista.

Solo las tareas sin programar tienen estimación. Cuando programas una tarea, su estimación pasa a ser la duración de su programación. Cuando la desprogramas, la duración de su programación vuelve a ser su estimación, así que no se pierde nada en ninguno de los dos sentidos.

## Programar una tarea

Programar da a una tarea un inicio y un fin. Hay dos maneras de hacerlo.

### Arrastrarla a una vista

Arrastra la tarea fuera de la pestaña Planificación y suéltala en una vista.

- **En una hora del día en la vista semanal**, la tarea empieza donde la sueltas y dura lo que indica su estimación. Sin estimación, dura tu [duración predeterminada](settings.md#entries).
- **En el carril de todo el día de la vista semanal, o en un día de la vista mensual o anual**, la tarea pasa a ser de todo el día. Cubre tantos días como su estimación, y al menos uno.

Después, arrastra su borde para alargarla o acortarla, como cualquier otra entrada.

### Fijar una fecha de inicio

Abre la tarea, pulsa **Fecha de inicio** y elige un día.

- Si su estimación es menor que un día, la tarea empieza a las 9:00 y dura lo que indica su estimación.
- En caso contrario, la tarea pasa a ser de todo el día, cubriendo tantos días como su estimación, y al menos uno.

La vista se desplaza a ese día, y la tarea sigue abierta, así que puedes ajustar sus horas de inmediato. Esto funciona en todas partes, incluso en un teléfono, donde la barra lateral abierta cubre la vista y no hay adónde arrastrar.

## Desprogramar una tarea

Desprogramar quita la programación de una tarea y la devuelve a la pestaña Planificación. Hay dos maneras de hacerlo:

- **Arrastra** la tarea fuera de la vista y suéltala en la lista **Sin programar**.
- **Abre la tarea y pulsa la ✕** junto a su fecha de inicio. Se abre la pestaña Planificación, con la tarea aún abierta.

La tarea conserva su fecha de vencimiento, y la duración de su programación pasa a ser su estimación. Sus recordatorios se mantienen si tiene una fecha de vencimiento hacia la que contar, y se quitan en caso contrario.

La **✕** junto a la fecha de fin hace otra cosa. No desprograma la tarea, la convierte en un [momento](#moments).

> [!NOTE]
> Solo se pueden desprogramar las tareas. Un evento siempre tiene fecha. Una tarea que se repite según una programación, como una revisión semanal, tampoco se puede desprogramar.

## Tareas vencidas

Una tarea está **vencida** cuando no está terminada y su día ha pasado. Su día es su fecha de vencimiento o, sin fecha de vencimiento, el último día de su programación. La lista **Vencidas** muestra estas tareas, la más vencida primero.

Mitra cuenta días enteros, así que una tarea que vence esta mañana solo pasa a estar vencida mañana.

Una tarea sale de la lista cuando la marcas como hecha. También puedes darle una fecha de vencimiento posterior o, si no tiene fecha de vencimiento, programarla en un día posterior.

## Fechas de vencimiento recurrentes

Algunas tareas vencen una y otra vez, como pagar el alquiler antes del día 1 de cada mes. Da a la tarea una fecha de vencimiento y configúrala para que se repita.

La lista **Sin programar** muestra solo la siguiente, para que no se llene con todos los meses a la vez. Cuando la programas, solo se programa la tarea de ese mes, y la del mes siguiente ocupa su lugar en la lista.

Las tareas recurrentes nunca están vencidas.

## Momentos

Un **momento** es una tarea programada con un inicio y sin fin, para algo que haces en un punto del tiempo en lugar de a lo largo de un tramo, como tomar tu medicación de la mañana a las 7:30. En la vista semanal se muestra como una entrada delgada de una línea a su hora de inicio.

Para convertir una tarea en un momento, ábrela y pulsa la **✕** junto a su fecha de fin. Para darle de nuevo un fin, pulsa **Fecha de fin**.

## Qué calendarios lo admiten

Cada cambio se guarda directamente en el calendario al que pertenece la tarea.

- Los **calendarios guardados en Mitra** admiten todo lo de esta página.
- Los **[servidores de calendario](integrations/caldav.md)** también admiten todo. Otras aplicaciones que usan el mismo calendario ven el inicio y la fecha de vencimiento de la tarea.
- **[Notion](integrations/notion.md)** admite programaciones, pero no restricciones, porque una base de datos de Notion guarda una única fecha para cada tarea.
