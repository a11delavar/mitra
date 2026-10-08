---
title: Calendarios
description: Elige qué calendarios importa Mitra, renómbralos, cámbiales el color, reordénalos y ocúltalos, decide dónde van las nuevas entradas y mueve entradas entre calendarios.
---

Cada fila de la pestaña **Calendarios** de la barra lateral es un calendario. Algunos están [guardados en Mitra](integrations/mitra.md), y otros vienen de una cuenta que conectaste. Están bajo el encabezado de la integración a la que pertenecen, y todo lo de esta página funciona igual para todos ellos, salvo que se indique lo contrario.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/calendars-detail-dark.webp">
  <img src="../assets/screenshots/calendars-detail-light.webp" alt="La barra lateral, con una cuenta y sus cinco calendarios, cada uno de su propio color" />
</picture>

Un calendario es una fila, aunque contenga tanto eventos como tareas, como hacen la mayoría de los calendarios CalDAV. Que una entrada concreta sea un evento o una tarea depende de la entrada.

## Elegir qué se importa

Cuando conectas una cuenta, Mitra encuentra sus calendarios y los lista, todos marcados, cada uno indicando lo que contiene, como «Eventos · Tareas». Desmarca los que no quieras antes de guardar. Puedes cambiar de opinión más tarde en **⋯ → Editar** de la cuenta, donde los calendarios añadidos a la cuenta desde entonces esperan sin marcar. Mitra solo sincroniza y guarda los calendarios que están activados, así que los demás no cuestan nada.

## Añadir o eliminar un calendario

Un calendario de una cuenta conectada se crea y se elimina en el proveedor, y Mitra lo detecta en su siguiente sincronización. Los calendarios de Mitra son la excepción: añade uno con **Nuevo calendario** en el menú **⋯** del encabezado de Mitra, y elimina uno con **Eliminar calendario** en su propio menú **⋯**. Si aún tiene entradas, Mitra ofrece **Mover primero las entradas…**, para que no se pierda nada por accidente.

## Ocultar un calendario

El ojo al final de una fila oculta las entradas de ese calendario. Ocultar solo afecta a lo que ves: el calendario sigue sincronizando, y sus entradas vuelven enseguida cuando lo muestras de nuevo.

Ocultar no silencia un calendario, así que sus [recordatorios](reminders.md) siguen sonando. Para detener un calendario por completo, desactívalo en **⋯ → Editar** de su cuenta.

### Mostrar solo un calendario

Para despejar todo lo demás, elige **Mostrar solo este calendario** en el menú **⋯** de un calendario, o haz <kbd>Alt</kbd>-clic en su ojo. Todos los demás calendarios se ocultan, y Mitra recuerda cuáles tenías visibles. El mismo elemento de menú pasa entonces a decir **Mostrar los calendarios anteriormente visibles** y los recupera.

Los calendarios que ya estaban ocultos antes siguen ocultos. Un calendario que conectaste entretanto se muestra, ya que no formaba parte de lo que guardaste. Mostrar un calendario a mano tampoco te hace perder el camino de vuelta al resto. También puedes hacer ambas cosas desde la [paleta de comandos](shortcuts.md) buscando el nombre de un calendario.

## Renombrar

Haz doble clic en el nombre de un calendario, o elige **Renombrar** en su menú **⋯**. El nombre es tuyo: la sincronización nunca lo sobrescribe. Mitra solo vuelve a tomar el nombre del proveedor cuando el calendario se renombra de verdad allí.

## Cambiar el color

Elige un color en el menú **⋯** del calendario. Hasta que lo hagas, un calendario usa el color que le da su proveedor. Si el proveedor no da ninguno, Mitra elige uno a partir de la dirección del calendario, para que se vea igual en todos los dispositivos. Las entradas toman el color de su calendario salvo que tengan un color propio.

## Reordenar

Los calendarios empiezan en el orden en que Mitra los encontró, y las cuentas en el orden en que las conectaste. Para organizarlos tú mismo, arrastra un calendario hacia arriba o hacia abajo dentro de su cuenta, o arrastra una cuenta por su encabezado para moverla con todos sus calendarios. En una pantalla táctil, mantén pulsado un momento antes de arrastrar, ya que un simple deslizamiento desplaza la lista. **Mover arriba** y **Mover abajo** en el menú **⋯** hacen lo mismo sin arrastrar.

Un calendario solo se mueve dentro de su propia cuenta. Un calendario que activas más tarde se une al final de su cuenta, así que no altera el orden que estableciste.

## Dónde van las nuevas entradas

El calendario con el icono relleno es tu calendario predeterminado: las nuevas entradas van allí salvo que elijas otro. Haz clic en el icono de un calendario para convertirlo en el predeterminado, y haz clic de nuevo en el icono del predeterminado para quitarlo. Sin calendario predeterminado, las nuevas entradas van al primer calendario de la lista, así que mover un calendario al principio también lo convierte en el predeterminado. La misma opción está en **Ajustes → Entradas**.

Las nuevas entradas son eventos, salvo que el calendario solo pueda contener tareas, como una vista de Notion. Mientras una entrada es nueva, su editor tiene un conmutador **Evento** / **Tarea**. Una vez guardada, cámbialo con **Tipo** en el editor, siempre que su calendario pueda contener el otro tipo. Una entrada recurrente conserva su tipo.

## Mover o copiar todas las entradas a otro calendario

**Mover las entradas a…** en el menú **⋯** de un calendario, o **Mover las entradas de …** en la paleta de comandos, mueve todo lo que contiene a otro calendario de una vez. Elige adónde deben ir y, antes de que ocurra nada, Mitra te muestra lo que costaría el movimiento:

```
19 of 21 entries move to Personal
✓ 15 arrive with everything they carry
! 4 lose their reminders
⨯ 2 repeat and stay here
```

El informe depende de lo que pueda contener el destino, así que se lee distinto para un calendario CalDAV que para una vista de Notion. Las entradas que el destino no puede aceptar en absoluto, como una entrada recurrente que va a Notion, se quedan donde están y se listan por nombre.

**Copiar en su lugar** deja los originales donde están y pone una copia de cada uno en el destino. Así también sacas entradas de un calendario de solo lectura, como una suscripción: se puede copiar desde él, pero no mover fuera de él.

Los vínculos entre las entradas que mueves se mantienen, incluso hacia Notion, que da un ID nuevo a cada página. Los vínculos de entradas que se quedan atrás siguen apuntando a las que se movieron.

Si el destino no puede repetir entradas, Mitra pregunta qué hacer con las recurrentes: dejarlas aquí, o desplegarlas en entradas sueltas, una por cada ocurrencia del próximo año, que ya no se repiten. Nunca despliega sin preguntar.

> [!NOTE]
> Mitra copia primero y elimina los originales solo cuando sus copias han llegado. No hay deshacer entre dos proveedores, así que este orden es la red de seguridad: si algo sale mal, puedes acabar con una entrada en ambos calendarios, pero nunca con una que falte. Si la copia falla, todo el movimiento se detiene y no se elimina nada.

### Mover una sola entrada

Para mover una entrada, ábrela y elige otro calendario en su editor. Para una entrada recurrente, Mitra pregunta a cuáles te refieres. **Esta entrada** mueve esa ocurrencia por sí sola, **Esta y las siguientes entradas** mueve el resto de la serie y deja atrás las ocurrencias anteriores, y **Todas las entradas** mueve la serie entera, con su regla de repetición y todo.

## Calendarios de solo lectura

Algunos calendarios no se pueden cambiar desde Mitra: las [suscripciones a calendarios](integrations/subscriptions.md), y los calendarios que alguien compartió contigo solo para verlos. Mitra lo detecta por sí mismo y los marca como de solo lectura.

Puedes abrir sus entradas y leer, seleccionar y copiar todo lo que contienen, pero no puedes crear, cambiar, mover ni eliminar entradas allí, y no se puede mover una entrada a uno de ellos. Renombrar, cambiar el color, reordenar y ocultar siguen funcionando, ya que son tu propia vista del calendario. Si el propietario te permite más adelante hacer cambios, Mitra lo detecta en la siguiente sincronización.

## Re-importar un calendario

**Re-importar entradas**, en el menú **⋯** de un calendario o de una cuenta entera, descarta la copia de Mitra de las entradas y las importa de nuevo desde el proveedor. No cambia nada en el proveedor. No deberías necesitarlo a diario, ya que la [sincronización](integrations/README.md#how-syncing-works) se ocupa de sí misma; está para cuando un calendario se ve mal o desactualizado tras una actualización. Los calendarios de Mitra no lo ofrecen, ya que no hay proveedor desde el que importar.
