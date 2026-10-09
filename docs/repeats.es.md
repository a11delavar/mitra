---
title: Repeticiones
description: "Haz que una entrada se repita, cambia o elimina una ocurrencia o la serie entera, y comprueba qué calendarios pueden contener repeticiones."
---

Una entrada recurrente es una sola entrada con una regla de repetición, como una reunión de equipo cada lunes o el alquiler que vence el día 1 de cada mes. Esta página llama serie al conjunto, y ocurrencia a cada una de sus fechas. Cada ocurrencia muestra un pequeño icono de repetición en las vistas.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-detail-dark.webp">
  <img src="../assets/screenshots/repeat-detail-light.webp" alt="El editor de una reunión de equipo semanal con su lista Repetir abierta: No se repite, Todos los días, Todos los días laborables, Todas las semanas el mar, Cada 2 semanas, Todos los meses el 1.º, el 1.º mar, Todos los años y Personalizado" />
</picture>

## Hacer que una entrada se repita

Abre la entrada y elige una regla en su fila **Repetir**. La fila aparece cuando la entrada tiene una fecha: un inicio, o una fecha de vencimiento en una tarea sin programar.

La lista ofrece reglas construidas a partir de la fecha en que empieza la serie, aunque hayas abierto una ocurrencia posterior. Para una entrada en martes 13, ofrece **Todos los días**, **Todos los días laborables** (de lunes a viernes), **Todas las semanas** el martes, **Cada 2 semanas** el martes, **Todos los meses** el 13, **Todos los meses** el 2.º martes y **Todos los años** en esa fecha. Cuando el inicio cae en los últimos siete días de su mes, también hay **Todos los meses** el último martes.

Para que una entrada deje de repetirse, elige **No se repite**. Un cambio en la regla siempre se aplica a toda la serie, así que Mitra no pregunta a qué ocurrencias te refieres.

### Reglas personalizadas

Para cualquier otra cosa, elige **Personalizado…**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-custom-detail-dark.webp">
  <img src="../assets/screenshots/repeat-custom-detail-light.webp" alt="El diálogo Repetir: cada 1 semana el martes, que termina nunca, en una fecha o tras un número de veces" />
</picture>

Después de **Cada**, escribe un número y elige días, semanas, meses o años. Una regla semanal muestra entonces los días de la semana: activa cada día en que se repite la entrada, y al menos uno queda activado. Una regla mensual se repite en el mismo número de día que el inicio, como el 13, o en el mismo día de la semana del mes, como el 2.º martes. Cuando el inicio está en los últimos siete días de su mes, también puede repetirse el último martes.

En **Termina**, elige **Nunca**, **El** una fecha, o **Después** de un número de veces. Pulsa **Hecho**, y la fila **Repetir** lee de vuelta la regla, como «Cada 2 semanas el jue hasta el 18 dic».

## Cambiar o eliminar una ocurrencia

Cuando cambias una ocurrencia, Mitra pregunta a qué entradas te refieres. Lo pregunta cuando arrastras la ocurrencia a otra hora, arrastras su borde, la eliminas o cambias un campo en su editor, como su título.

- **Esta entrada** cambia solo la ocurrencia que elegiste.
- **Esta y las siguientes entradas** la cambia a ella y a todas las posteriores. La serie termina justo antes de ella, y empieza una serie nueva con tu cambio, así que las ocurrencias anteriores quedan como estaban. La primera ocurrencia no la ofrece, ya que ahí significaría toda la serie.
- **Todas las entradas** cambia todas las ocurrencias. Mover una un día mueve todas, así que una reunión semanal el lunes pasa a ser una reunión semanal el martes. Redimensionar una da a todas la nueva duración.

Eliminar funciona igual: **Esta entrada** quita una fecha, **Esta y las siguientes entradas** termina la serie antes de ella, y **Todas las entradas** elimina la serie.

Para saltarte la pregunta y cambiar solo esta ocurrencia, mantén pulsada <kbd>Ctrl</kbd> (<kbd>⌘</kbd> en un Mac) al soltarla, o pulsa <kbd>Ctrl</kbd> + <kbd>Delete</kbd> mientras está abierta.

Algunos cambios nunca preguntan. Marcar como hecha una ocurrencia de tarea se aplica solo a esa ocurrencia, y lo mismo ocurre al programar una ocurrencia de una tarea que se repite por su fecha de vencimiento.

## Ocurrencias cambiadas y eliminadas

Una ocurrencia que cambias con **Esta entrada** sale de la serie y se convierte en una entrada propia. La serie omite su fecha, así que nunca aparece dos veces, y los cambios posteriores en toda la serie no la alcanzan.

Una ocurrencia eliminada se queda eliminada. No vuelve cuando más tarde mueves o cambias toda la serie, y otras aplicaciones que usan el mismo calendario también la omiten.

## Mover una serie a otro calendario

Elige otro calendario en el editor de una ocurrencia, y la misma pregunta decide si se mueve esa ocurrencia, el resto de la serie o la serie entera, como se describe en [Mover una sola entrada](calendars.md#move-a-single-entry).

## Tareas recurrentes

Cada ocurrencia de una tarea recurrente es una tarea propia que marcar como hecha. Una tarea también puede repetirse solo por su fecha de vencimiento, como pagar el alquiler antes del día 1 de cada mes: consulta [fechas de vencimiento recurrentes](planning.md#repeating-due-dates). Las tareas recurrentes nunca están vencidas, y no se pueden dejar sin programar, ya que sus fechas son lo que forma la serie.

## Cómo se muestran las repeticiones

Algo que se repite a menudo, como un entrenamiento diario, se muestra como una [rutina](routines.md) en las vistas de mes y año: una línea de pequeñas marcas en lugar de una barra para cada día. El [cronograma](views/timeline.md) solo muestra las ocurrencias de una tarea recurrente que vencen, así que una tarea diaria no lo llena.

## Qué calendarios pueden repetir

Los [calendarios guardados en Mitra](integrations/mitra.md) y los [servidores de calendario](integrations/caldav.md), incluidos Google y Apple, contienen entradas recurrentes. Los calendarios de [Notion](integrations/notion.md) y [Tempo](integrations/tempo.md) no pueden, así que su editor no tiene fila **Repetir**, y el editor de una serie no los ofrece como su calendario.

Cuando [mueves todas las entradas de un calendario](calendars.md#move-or-copy-every-entry-to-another-calendar) a uno que no puede repetir, Mitra pregunta qué hacer con las recurrentes. **Dejarlas aquí** las mantiene donde están. **Desplegar en entradas sueltas** escribe cada ocurrencia del próximo año como una entrada separada que ya no se repite.

La [disponibilidad](availability.md) también es una entrada recurrente, y empieza siendo semanal. Por la misma razón, no puede estar en calendarios de Notion o Tempo.
