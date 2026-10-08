---
title: Participantes
description: "Añade a las personas implicadas en una entrada y sigue sus respuestas. Que reciban una invitación depende del calendario."
---

Una entrada puede tener **participantes**: las personas implicadas en ella. Mitra los guarda con la entrada en el formato estándar de calendario, así que cualquier otra aplicación que use el mismo calendario ve la misma lista, y las respuestas hechas en Apple Calendar, Thunderbird o un correo web también aparecen en Mitra.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/participants-detail-dark.webp">
  <img src="../assets/screenshots/participants-detail-light.webp" alt="Una entrada con tres participantes, con sus respuestas mostradas como insignias sobre sus avatares" />
</picture>

## Quién envía las invitaciones

Mitra nunca envía correos por sí mismo. Lo que ocurre al añadir a alguien depende del calendario en el que está la entrada.

Cuando la entrada está en un calendario de un [servidor de calendario](integrations/caldav.md), de [Google Calendar](integrations/google.md) o de [Apple Calendar](integrations/apple.md), es ese servidor el que envía: la invitación, una actualización cuando la entrada cambia y una cancelación cuando quitas a alguien o eliminas la entrada. También recoge las respuestas, y así es como llegan a Mitra. La mayoría de los servidores lo hacen, incluidos Google, iCloud, Nextcloud, Fastmail, mailbox.org y Zimbra. Un servidor que solo almacena calendarios no envía nada, así que nadie se entera de la entrada y todas las respuestas quedan pendientes.

En un [calendario de Mitra](integrations/mitra.md) no hay ningún servidor detrás del calendario, así que la lista es solo un registro de quién está implicado. Nadie recibe invitación y no llegan respuestas.

Los calendarios de [Notion](integrations/notion.md) y [Tempo](integrations/tempo.md) no pueden contener participantes, así que sus entradas no tienen fila de participantes. En una [suscripción a un calendario](integrations/subscriptions.md) puedes ver a los participantes pero no cambiarlos, porque el calendario es de solo lectura.

## Añadir personas

Abre la entrada, escribe una dirección de correo en **Añadir participantes** y pulsa Intro. Puedes añadir varias a la vez, separadas por comas, puntos y comas o espacios. Para añadir más después, pulsa **＋** junto al recuento de participantes.

En un calendario con una cuenta detrás, la primera persona que añades te convierte en el **organizador**: tu propia dirección se une a la lista, marcada como **Organizador**, y aceptada. Un calendario de Mitra no tiene ninguna dirección tuya que usar, así que sus listas no tienen organizador.

Cada persona aparece con su inicial, su correo, su nombre si el calendario lo conoce, y **Organizador** u **Opcional** cuando corresponde. Los correos se pueden seleccionar, así que puedes copiar una sola dirección desde su fila. Cuando la lista tiene más de cinco personas, muestra las cuatro primeras y pliega el resto tras una fila de «más».

Apunta a una persona para cambiarla. Un botón la marca como opcional, o de nuevo como obligatoria, y la **✕** la quita. En una pantalla táctil, estos botones están siempre visibles.

## Respuestas

Una insignia sobre la inicial de cada persona muestra su respuesta: una marca verde para aceptado, una cruz roja para rechazado y un guion amarillo para provisional. Sin insignia significa que aún no hay respuesta. Una línea bajo el recuento las resume, como «2 sí, 1 no, 3 pendientes».

Las respuestas llegan a Mitra a través del servidor de calendario, así que una nueva aparece en la siguiente sincronización, no al instante.

Mitra muestra la respuesta de todos, pero no envía la tuya. Para aceptar o rechazar una invitación que envió otra persona, responde en tu aplicación de correo o en otra aplicación de calendario, y tu respuesta se sincroniza de vuelta con Mitra.

## Actuar sobre todos

El menú **⋯** junto al recuento actúa sobre toda la lista:

- **Enviar correo a los participantes** abre tu aplicación de correo con un mensaje para todos los demás.
- **Copiar correos de los participantes** copia todas las direcciones.
- **Marcar todos como obligatorios** y **Marcar todos como opcionales** cambian el papel de todos a la vez.
- **Eliminar todos** vacía la lista.

## Solo el organizador cambia la lista

En una entrada que organizó otra persona, no puedes añadir, quitar ni cambiar a nadie: la **＋** está oculta y el menú solo permite enviar correo y copiar. Esa es la regla del estándar de programación que siguen las aplicaciones de calendario, y el servidor de Mitra también rechaza un cambio así. Aun así puedes editar el resto de la entrada, como su título, su hora y su descripción.

> [!CAUTION]
> Mover una entrada con participantes a otro calendario la elimina del primero, y algunos servidores avisan entonces a los participantes de que se canceló. [Cópiala](calendars.md#move-or-copy-every-entry-to-another-calendar) en su lugar si no deben enterarse.

## Solución de problemas

- Si todos siguen pendientes y no llegó ninguna invitación, la entrada está en un calendario de Mitra, o su servidor de calendario no envía invitaciones. Para comprobar el servidor, invita a las mismas personas desde la propia aplicación del proveedor.
- Si llegó una respuesta pero su insignia no cambió, espera a la siguiente sincronización de Mitra, ya que las respuestas llegan a través del servidor de calendario.
- Si no hay forma de añadir personas, otra persona organiza la entrada o el calendario es de solo lectura.
- Si la entrada no tiene fila de participantes, su calendario no puede contener participantes, como en Notion y Tempo.
- Si falta una sala de reuniones en la lista, es a propósito: las salas y el equipamiento no son personas, así que Mitra los deja fuera.
