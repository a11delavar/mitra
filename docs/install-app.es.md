---
title: Instalar la aplicación
description: "Instala Mitra como aplicación en un ordenador, un teléfono Android, un iPhone o un iPad, para que se abra en su propia ventana."
---

Mitra funciona en tu navegador, y también puedes instalarlo como aplicación. No viene de ninguna tienda de aplicaciones: tu navegador le da a Mitra su propia ventana y su propio icono, y lo abres desde tu dock, tu barra de tareas, tu menú de inicio o tu pantalla de inicio como cualquier otra aplicación.

Instalarlo vale la pena por tres razones:

- Mitra se abre en su propia ventana, aparte de las pestañas del navegador, y sus notificaciones aparecen con su propio nombre e icono.
- En un iPhone o un iPad, es la única forma de recibir [recordatorios](reminders.md).
- En un ordenador, Mitra puede abrir por ti archivos `.ics` y enlaces `webcal://`. Consulta [Archivos de calendario](calendar-files.md).

La aplicación instalada siempre se llama Mitra y tiene el icono de Mitra, incluso cuando tu servidor le da a la instancia [un nombre propio](configuration.md#name-your-instance).

## En un ordenador

En Chrome, Edge y otros navegadores basados en Chromium, abre Mitra y haz clic en el icono de instalación al final de la barra de direcciones. Cuando el navegador ofrece instalar Mitra, la barra lateral también muestra un botón **Instalar como aplicación** al final. También puedes ir por el menú del navegador: en Chrome, **Cast, save, and share → Install page as app**, y en Edge, **Apps → Install this site as an app**.

En Safari en un Mac, elige **File → Add to Dock**.

Una vez instalado, Mitra se abre en su propia ventana. Si esa ventana ya está abierta cuando abres un archivo o un enlace de calendario, Mitra la trae al frente en lugar de abrir una segunda.

## En Android

Abre Mitra en Chrome, abre el menú del navegador (**⋮**) y elige **Install app** o **Add to Home screen**. Mitra aparece entonces junto a tus otras aplicaciones.

Los recordatorios también funcionan en el navegador en Android, así que instalarlo es opcional.

## En iPhone y iPad

Abre Mitra en Safari, toca el botón de compartir y luego **Add to Home Screen**. A partir de entonces, abre Mitra desde su icono en tu pantalla de inicio.

En iPhone y iPad, las notificaciones solo funcionan en la aplicación instalada, a partir de iOS y iPadOS 16.4. Permítelas desde dentro de la aplicación instalada: Safari y la aplicación son independientes, y solo la aplicación puede recibir recordatorios.

> [!NOTE]
> Si tu servidor está detrás de un proxy inverso que te identifica con una cookie, instalar sigue funcionando. Mitra pide la descripción de su aplicación (el manifiesto de la aplicación web) con tus cookies, de modo que el proxy deja pasar la solicitud.
