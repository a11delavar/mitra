---
title: Entradas
description: "Abre el editor de entradas y descubre todo lo que puede contener un evento o una tarea: su calendario, tipo, color, estado, descripción y más."
---

Todo lo que hay en tu calendario es una **entrada**. La mayoría de las entradas son **eventos**, que tienen lugar en un momento, o **tareas**, que sacas adelante y marcas como hechas. Un tercer tipo, la [disponibilidad](availability.md), sombrea el tiempo que reservas para algo, detrás de tus eventos y tareas.

Esta página trata del editor de entradas: su cabecera, las filas de debajo y la descripción.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/due-detail-dark.webp">
  <img src="../assets/screenshots/due-detail-light.webp" alt="El editor de una tarea del calendario Work, con su casilla de estado y título, su inicio, fin y fecha de vencimiento, un enlace y una descripción, su visibilidad, recordatorios y relaciones" />
</picture>

## Abrir el editor

Haz clic en una entrada para abrir su editor a su lado. Para crear una, pulsa <kbd>C</kbd> o **Crear** en la parte superior de la página. La nueva entrada empieza en la siguiente hora en punto, dura una hora y va a tu [calendario predeterminado](calendars.md#where-new-entries-land). En la [vista semanal](views/week.md) también puedes arrastrar por un tramo vacío.

Cada cambio se guarda al hacerlo. Cierra el editor con su **✕**, o haciendo clic fuera de él. En una pantalla estrecha, como un teléfono, el editor sube desde abajo como una hoja.

## La cabecera

La línea superior del editor contiene el color de la entrada, su calendario, su tipo y el menú **⋯**.

### Dar a una entrada su propio color

Una entrada lleva el color de su calendario. Para dar a una entrada un color propio, haz clic en el punto del inicio de la cabecera y elige uno. **Restablecer al color del calendario**, en el mismo selector, le devuelve el color del calendario.

### Mover una entrada a otro calendario

Junto al punto está el nombre del calendario de la entrada. Haz clic en él y elige otro calendario para mover allí la entrada. La lista omite los calendarios que no podrían conservar algo que tiene la entrada, como una repetición o un estado **Cancelado**. Consulta [Mover una sola entrada](calendars.md#move-a-single-entry).

### Cambiar el tipo de una entrada

Más adelante, la cabecera muestra el tipo de la entrada: **Evento**, **Tarea** o **Disponibilidad**. Haz clic en él y elige otro. Los servidores de calendario mantienen separados los eventos y las tareas, así que Mitra guarda la entrada de nuevo como el otro tipo y elimina la antigua. El editor sigue abierto sobre el resultado.

Lo que el nuevo tipo no pueda contener se descarta. Una tarea que se convierte en evento pierde su estado, su progreso, su fecha de vencimiento y su estimación. Un evento que se convierte en tarea pierde lo de ocupado o disponible. La disponibilidad no tiene participantes ni recordatorios.

El tipo no se puede cambiar en una entrada recurrente, ni en un calendario que solo admite un tipo, como un calendario de Notion. **Disponibilidad** solo se ofrece donde el calendario puede contenerla.

### El menú ⋯

**Duplicar** hace una copia en el mismo calendario y la abre. Mantener pulsada <kbd>Alt</kbd> mientras arrastras una entrada hace una copia donde la sueltes.

**Eliminar** quita la entrada. Mientras el editor está abierto, <kbd>Delete</kbd> o <kbd>Backspace</kbd> también lo hace, siempre que no estés escribiendo en un campo. Si la entrada se repite o tiene subtareas, Mitra pregunta a cuáles te refieres.

Una entrada de Notion o Tempo también ofrece **Abrir en Notion** o **Abrir en Jira**, que la abre donde se originó.

## Título y hora

El título es la línea grande bajo la cabecera. Las filas de debajo indican cuándo tiene lugar la entrada: su inicio, su fin, su zona horaria y si se repite. Para alternar entre días y horas, pulsa **Todo el día** al final de una fecha, que aparece mientras estás en esa fila.

Una tarea también tiene una fecha de vencimiento y, mientras está sin programar, una estimación. Consulta [Planificación](planning.md). Para las zonas horarias, consulta [Zonas horarias](time-zones.md), y para las repeticiones, [Repeticiones](repeats.md).

## Estado de la tarea

Una tarea tiene una casilla antes de su título y uno de cuatro estados: **Por hacer**, **En progreso**, **Hecho** o **Cancelado**. Haz clic en la casilla para marcar la tarea como hecha, y vuelve a hacer clic para reabrirla. Para elegir cualquier estado, haz clic derecho en la casilla o haz <kbd>Alt</kbd>-clic. Esto funciona también en el calendario.

Las tareas hechas y canceladas aparecen tachadas. Un calendario sin estado cancelado, como Notion, omite **Cancelado** del menú. Una tarea con subtareas o una lista de comprobación muestra su progreso en la casilla; consulta [Subtareas](subtasks.md#progress).

## Ocupado o disponible y visibilidad

La fila del ojo indica lo que otras personas saben de la entrada cuando miran tu calendario.

Los eventos eligen entre **Ocupado** y **Disponible**. Ocupado, el valor predeterminado, marca el tiempo como tomado, así que quien consulte cuándo estás libre para una reunión lo ve como bloqueado. Disponible muestra la entrada sin bloquear el tiempo, lo que va bien para un recordatorio para ti o un festivo que no vas a tomarte libre. Las tareas no tienen ocupado o disponible. La disponibilidad sí, y empieza como libre; consulta [Disponibilidad](availability.md#busy-or-free).

Cada entrada tiene una visibilidad. **Visibilidad predeterminada** lo deja en manos del calendario. **Público** permite que cualquiera que pueda ver tu calendario lea la entrada. **Privado** pide a otras aplicaciones que muestren a las personas con quienes compartes el calendario solo que el tiempo está ocupado, no qué es. **Confidencial** es lo más estricto, para entradas que deben quedar entre tú y las personas invitadas. Mitra guarda tu elección con la entrada, y el servidor y las aplicaciones que la leen deciden qué ocultar.

## Ubicación, personas y más

- [Ubicación](location.md) contiene un lugar, con un mapa, o un enlace de reunión.
- [Participantes](participants.md) lista a las personas implicadas y sus respuestas.
- [Recordatorios](reminders.md) te avisan antes de que empiece la entrada, o antes de la fecha de vencimiento de una tarea.
- [Enlaces](links.md) reúne los enlaces de la descripción que tiene encima.
- **Subtarea de** y **Subtareas** construyen un árbol de tareas; consulta [Subtareas](subtasks.md).
- **Bloqueado por** y **Bloquea** indican qué tiene que terminar antes; consulta [Dependencias](dependencies.md).

## La descripción

Haz clic en la descripción para editarla, y haz clic en otro sitio para verla de nuevo con formato. Está escrita en Markdown, así que se muestran encabezados, listas con viñetas y numeradas, texto en negrita y cursiva, código, tablas y enlaces. Una cita que empieza con `> [!NOTE]`, `> [!TIP]` o `> [!WARNING]` se convierte en un recuadro de color. Al hacer clic en un enlace, este se abre en lugar de editarse.

Las líneas que empiezan con `- [ ]` se convierten en una lista de comprobación, que puedes marcar sin abrir el texto. Consulta [Listas de comprobación](subtasks.md#checklists).

## Relaciones de otras aplicaciones

Otras aplicaciones de calendario pueden vincular entradas de formas que Mitra no crea por sí mismo. Mitra muestra estos vínculos en una sección propia: **Relacionado con** para las entradas que van juntas, y una sección con el nombre del tipo de vínculo para los tipos que no conoce. Puedes quitar un vínculo así con su **✕**, pero no añadir uno.

## Qué calendarios lo admiten

Cada calendario guarda cosas distintas, y Mitra oculta las filas que un calendario no puede guardar, para que nada de lo que escribas desaparezca en la siguiente sincronización. Un calendario de Notion solo contiene tareas, por ejemplo, y un calendario de Google no tiene relaciones. Consulta [Integraciones](integrations/README.md#what-each-one-holds) para saber qué contiene cada una.
