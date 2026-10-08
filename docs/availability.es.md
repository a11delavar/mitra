---
title: Disponibilidad
description: Marca en su calendario el tiempo que reservas para el trabajo, el estudio o cualquier otra cosa, y muéstralo como ocupado a los demás cuando quieras.
---

La **disponibilidad** es el tiempo que reservas de forma regular, como el trabajo de lunes a miércoles, el estudio el jueves y el viernes o la casa el sábado. Mitra lo sombrea en la vista de **Semana**, con el color de su calendario.

La disponibilidad pertenece a un calendario, junto a los eventos y las tareas de ese calendario. Tu horario laboral va en tu calendario de trabajo y tu tiempo de estudio, en el de la universidad. No es una cita, así que Mitra la guarda por sí mismo en lugar de añadirla a tu cuenta. La [disponibilidad ocupada](#busy-or-free) es la única excepción.

Es la forma habitual de tu semana, no una barrera. Una cita con el dentista en mitad de tu horario laboral no es ningún problema.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/availability-detail-dark.webp">
  <img src="../assets/screenshots/availability-detail-light.webp" alt="Tres días de la vista de semana: el horario laboral y el tiempo de estudio sombreados con los colores de sus calendarios, y el trabajo de la tarde del miércoles con la etiqueta Home office" />
</picture>

## Con nombre o sin él

Sin nombre, una franja es solo su sombreado. Eso sirve para la mayoría de la disponibilidad, ya que el color del calendario ya dice para qué es ese tiempo. Si le das un nombre o un lugar, ese texto recorre el borde del día, como Tiempo de concentración dentro de tu horario laboral, u Oficina y Home office en días distintos.

Cuando las franjas se solapan, sus sombreados se mezclan y se oscurecen, y sus etiquetas se separan: la primera hacia su inicio y la última hacia su final.

## Añadir disponibilidad

Abre la paleta de comandos con <kbd>/</kbd> o <kbd>Ctrl</kbd> + <kbd>K</kbd> y ejecuta **Añadir disponibilidad**. Va a tu calendario predeterminado:

- Si ese calendario aún no tiene disponibilidad, obtienes un horario laboral de lunes a viernes, de 9:00 a 17:00.
- Si ya tiene, obtienes una franja en el día de la semana de hoy.

Se abre el editor, para que puedas cambiar las horas, los días, el nombre, el lugar o el calendario. Una entrada que no se repite también puede convertirse en disponibilidad mediante su **Tipo**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/availability-editor-detail-dark.webp">
  <img src="../assets/screenshots/availability-editor-detail-light.webp" alt="El editor del trabajo del miércoles: su hora, su repetición semanal, Home office como lugar y Disponible" />
</picture>

## Editar y mover

- Haz clic dentro de una franja para abrirla. Arrastrar sobre ella sigue creando una entrada normal, igual que en una parte vacía de la cuadrícula.
- La disponibilidad se repite como cualquier otra entrada. Tiene zona horaria y regla de repetición, y cuando cambias o eliminas uno de sus días, Mitra te pregunta si te refieres a ese día o a todos.
- El campo **Calendario** del editor la mueve a otro calendario. Mover las entradas de un calendario con **Mover las entradas a…** se lleva también su disponibilidad.
- La disponibilidad solo aparece en la vista de Semana. No aparece en Mes, Año, Cronograma ni Tabla, ni en los resultados de búsqueda, ni en las relaciones.

## Mostrar y ocultar

El ojo de un calendario en la barra lateral oculta su disponibilidad junto con sus eventos y tareas. Para ocultar toda la disponibilidad y nada más, activa **Ocultar disponibilidad** en **Ajustes → Calendario**, o búscalo en la paleta de comandos.

## Dónde puede vivir la disponibilidad

Cualquier calendario al que puedas añadir entradas puede contener disponibilidad, incluidos los calendarios de [Mitra](integrations/mitra.md). Estos no pueden:

- Los calendarios de [Notion](integrations/notion.md) y [Tempo](integrations/tempo.md), porque sus entradas no pueden repetirse.
- Los calendarios de solo lectura, como las [suscripciones a calendarios](integrations/subscriptions.md).

La disponibilidad se queda con su calendario. Si eliminas el calendario, o desconectas la cuenta a la que pertenece, su disponibilidad se elimina también.

## Ocupado o disponible

La disponibilidad tiene la misma opción **Mostrar como ocupado o disponible** que un evento. Empieza como **Disponible**, que encaja con el horario laboral: te viene bien que te reserven en ese tiempo. Elige **Ocupado** para el tiempo que los demás no deberían ocupar, como el tiempo de concentración.

Dentro de Mitra, ambas se ven igual. La diferencia es lo que ven los demás. La disponibilidad libre nunca se escribe en ninguna de tus cuentas. La disponibilidad ocupada en un [calendario CalDAV, de Google o de Apple](integrations/caldav.md#busy-availability) se añade a ese calendario como eventos ocupados, con su nombre y su lugar, de modo que aparece en tu teléfono y quienes te invitan ven ese tiempo como ocupado.
