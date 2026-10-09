---
title: Vista de tabla
sidebar:
  label: Tabla
description: Tus entradas como filas. Elige los días a listar, ordénalas y fíltralas, y cambia muchas a la vez.
---

La vista **Tabla** lista tus entradas como filas en lugar de dibujarlas en una cuadrícula. Ábrela con <kbd>S</kbd> o desde el selector de vistas.

Cada fila es una entrada, y cada ocurrencia de una entrada recurrente tiene su propia fila. Su título es el mismo chip que dibuja el calendario: haz clic en él para abrir el editor de la entrada.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/table-detail-dark.webp">
  <img src="../../assets/screenshots/table-detail-light.webp" alt="La vista de tabla, con una columna para cuándo, calendario, estado y participantes" />
</picture>

## Qué entradas

La tabla lista las entradas de un periodo de días contado desde hoy, que se nombra en el encabezado de la página: **Últimos 30 días**, **Hoy**, **Próximos 7 días**, **Próximos 30 días** (donde empieza), **Próximos 12 meses**, **Todas las entradas**, o un **Rango personalizado** de dos fechas. Elígelo en el menú de la columna **Cuándo**. El número junto al campo de búsqueda es cuántas filas se listan.

Las tareas sin fecha y las tareas abiertas que han vencido se listan sea cual sea el periodo que elijas, así que por defecto se ven juntos el trabajo pendiente y el próximo mes.

**Todas las entradas** sirve para poner orden. Una entrada recurrente es allí una sola fila, que representa toda la serie: su **Cuándo** indica dónde empieza, y moverla o eliminarla mueve o elimina todas las ocurrencias. Su estado permanece en cada ocurrencia, así que los botones de estado la omiten.

**Hoy** en la cabecera de la página, y <kbd>G</kbd> para otra fecha, desplazan hasta la primera fila de ese día sin cambiar el periodo.

## Buscar, ordenar y filtrar

El campo de **búsqueda** compara cada palabra que escribes con el título, la ubicación, la descripción y el calendario.

Haz clic en el encabezado de una columna para ver su menú:

- **Orden ascendente** u **Orden descendente**. Elige de nuevo el activo para quitarlo. Mantén pulsada <kbd>Shift</kbd> para ordenar por varias columnas.
- El **filtro** de la columna, si lo tiene: desmarca los valores que quieras dejar fuera. Mantén pulsada <kbd>Alt</kbd> para conservar solo el que pulses. **Sin estado** en el filtro de **Estado** representa los eventos, así que al desmarcarlo se listan solo las tareas.
- **Ocultar columna**, que también retira el filtro de la columna.

Las columnas **Estado**, **Calendario**, **Tipo** y **Se repite** pueden filtrar, y **Cuándo** contiene el periodo de días. Un embudo junto a un encabezado indica que la columna deja filas fuera. **Título** y **Cuándo** no se pueden ocultar.

## Columnas

La tabla empieza con **Título**, **Cuándo**, **Calendario**, **Estado**, **Ubicación**, **Participantes**, **Subtarea de** y **Bloqueado por**. El botón al final de la fila de encabezados muestra las demás (**Duración**, **Tipo**, **Se repite**, **Recordatorios** y **Descripción**), y **Restablecer columnas** devuelve los valores predeterminados.

Cada columna es tan ancha como su contenido. Arrastra un encabezado para mover su columna, y su borde para cambiar su tamaño; haz doble clic en el borde para ajustar de nuevo la columna a su contenido.

## Cambiar muchas a la vez

Haz clic en una fila para seleccionarla, mantén pulsada <kbd>Ctrl</kbd> (<kbd>⌘</kbd>) para añadir filas, <kbd>Shift</kbd> para seleccionar un rango, o usa las casillas. Una barra sobre las filas ofrece entonces:

- **Por hacer**, **Hecho** y **Cancelado** para las tareas seleccionadas;
- **Mover a…** otro calendario;
- **Eliminar**, tras preguntar.

En una entrada recurrente, esto cambia solo la ocurrencia seleccionada, salvo en **Todas las entradas**, donde la fila es toda la serie. Para cambiar una serie desde cualquier otro periodo, abre su editor.

Con el teclado, <kbd>Space</kbd> selecciona la fila en la que estás y <kbd>Enter</kbd> la abre. <kbd>Escape</kbd> quita la selección y <kbd>Delete</kbd> la elimina.

## Entradas nuevas

**Crear** en la cabecera de la página, o <kbd>C</kbd>, inicia una entrada para hoy y la abre como una fila de la tabla.
