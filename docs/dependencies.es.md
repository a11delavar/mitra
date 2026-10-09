---
title: Dependencias
description: "Haz que una entrada espere a otra, mira el orden como líneas en el calendario y mueve una cadena entera a la vez."
---

Una **dependencia** dice que una entrada no puede empezar hasta que otra haya terminado: el borrador antes de la revisión, la revisión antes del lanzamiento. La entrada que espera está bloqueada por la otra.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/week-detail-dark.webp">
  <img src="../assets/screenshots/week-detail-light.webp" alt="Una semana con tres tareas de estudio unidas por líneas, cada una conduce a la siguiente y luego al examen" />
</picture>

## Añadir una dependencia

Abre la entrada que espera, pulsa **＋** en **Bloqueado por** y escribe parte del título de la entrada que tiene que terminar primero. La búsqueda abarca todos tus calendarios, así que una entrada puede esperar a otra de otro calendario o cuenta. La otra entrada enumera entonces a esta en **Bloquea**, que solo muestra vínculos: siempre se añade uno desde la entrada que espera.

En el editor, haz clic en el título de una entrada vinculada para abrirla, o pulsa la **✕** junto a ella para quitar el vínculo, desde cualquiera de los dos lados. Mitra rechaza un vínculo que formaría un círculo, como dos entradas que se esperan mutuamente.

Con un ratón, también puedes dibujar una dependencia en la vista de semana o de mes. Apunta a la entrada que va primero, agarra la línea corta de su final y suéltala sobre la entrada que debe esperarla. Mientras arrastras, la línea se vuelve roja sobre una entrada que ya empieza demasiado pronto.

## Líneas en el calendario

La vista de semana, la de mes y el cronograma dibujan una línea desde el final de cada entrada hasta el inicio de la entrada que la espera. Apunta a una entrada para traer sus líneas al frente. Las líneas de cada vista se pueden desactivar en **Ajustes → Calendario**, con **Líneas de conexión en la vista de semana**, **Líneas de conexión en la vista de mes** y **Líneas de conexión en el cronograma**.

## Dependencias rotas

Cuando una entrada empieza antes de que termine aquella a la que espera, la dependencia está rota. Su línea en el calendario se vuelve roja y, en las filas **Bloqueado por** y **Bloquea** del editor, la entrada del otro lado aparece nombrada en rojo. Vuelve a poner cualquiera de las dos entradas en orden y el aviso desaparece.

## Mover una cadena

Cuando arrastras una entrada, o uno de sus bordes, y otras entradas dependen de ella, Mitra pregunta **¿Mover también las entradas dependientes?**. Las opciones que mueven otras entradas indican cuántas son:

- **Solo esta entrada** mueve esta y deja las demás donde están.
- **Mantener la cadena intacta** mueve las demás solo lo necesario para que sigan en orden. Las entradas posteriores a esta se mueven más tarde y, si moviste esta antes, las entradas anteriores se mueven antes. Una entrada con holgura suficiente se queda donde está.
- **Moverlas todas la misma cantidad** mueve la cadena entera, antes y después de esta entrada, la misma cantidad de tiempo, de modo que los huecos entre ellas se mantienen.

Mitra solo pregunta cuando las opciones darían resultados distintos. Cambiar horas en el editor nunca mueve otras entradas.

Cuando una entrada se mueve como parte de una cadena, sus subtareas se mueven con ella. Las entradas que se repiten y las tareas sin programar de una cadena nunca se mueven.

> [!TIP]
> Mantén pulsada <kbd>Ctrl</kbd> (<kbd>⌘</kbd> en un Mac) mientras sueltas para saltarte la pregunta y mover solo esa entrada. Consulta los [atajos de teclado](shortcuts.md).

## Qué calendarios lo admiten

Un vínculo se guarda con la entrada que espera, en el calendario de esa entrada. Los [servidores de calendario](integrations/caldav.md), [Apple Calendar](integrations/apple.md) y los [calendarios de Mitra](integrations/mitra.md) admiten cualquier vínculo, y en un servidor de calendario se escribe en el formato estándar de calendario, así que otras aplicaciones que usen el mismo calendario pueden leerlo.

- En [Notion](integrations/notion.md), un vínculo a una tarea de la misma base de datos va a la propiedad de relación correspondiente, como "Blocked by". Mitra guarda por sí mismo los vínculos a cualquier otra cosa.
- [Google Calendar](integrations/google.md) descarta los vínculos, así que una entrada de un calendario de Google no puede tener algo que esperar. Las entradas de otros calendarios sí pueden vincularse a ella.
- Las [suscripciones a calendarios](integrations/subscriptions.md) son de solo lectura, y [Tempo](integrations/tempo.md) no tiene vínculos.
