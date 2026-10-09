---
title: Archivos de calendario
description: "Abre archivos .ics y enlaces webcal:// con Mitra, y haz que sea la aplicación de calendario que tu ordenador usa para ellos."
---

Los archivos de calendario (`.ics`) y los enlaces de suscripción (`webcal://`) son la forma en que la web reparte eventos: una invitación adjunta a un correo, un botón «Añadir al calendario» en una página de reservas, un enlace «Suscribirse» a los partidos de un equipo. Una vez instalado, Mitra puede abrir ambos, y puedes hacer que sea la aplicación que tu ordenador usa para ellos.

> [!NOTE]
> Abrir archivos y enlaces necesita Mitra [instalado como aplicación](install-app.md) desde un navegador basado en Chromium en un ordenador, como Chrome, Edge, Brave u Opera. En cualquier navegador, aun así puedes arrastrar un archivo `.ics` sobre Mitra.

## Hacer de Mitra la aplicación predeterminada

Instala Mitra primero. La primera vez que un archivo o un enlace de calendario lo abre, tu navegador puede preguntar si Mitra puede gestionarlo: elige **Permitir**. Después, indica a tu sistema que abra los archivos `.ics` con Mitra.

En Windows, haz clic derecho en un archivo `.ics` en el Explorador de archivos y elige **Open with → Choose another app**. Elige **Mitra** y luego **Always**. También puedes cambiarlo más tarde en **Settings → Apps → Default apps**.

En macOS, haz clic con Control en un archivo `.ics` en el Finder y elige **Get Info**. En **Open with**, elige **Mitra**, luego haz clic en **Change All…** y confirma.

En Linux, haz clic derecho en un archivo `.ics` en tu gestor de archivos y abre **Properties → Open With**. Elige **Mitra** y establécelo como predeterminado.

Si Mitra ya está abierto, un archivo o un enlace que abras va a esa ventana en lugar de abrir una segunda.

## Añadir un archivo de calendario

Abre un archivo `.ics` con Mitra, o arrástralo sobre Mitra desde el escritorio o el gestor de archivos. Arrastrar también funciona en una pestaña normal del navegador, sin instalar nada. Varios archivos se abren uno tras otro.

Mitra pregunta a qué calendario añadir las entradas. Antes de añadir nada, muestra lo que ese calendario no puede guardar: las entradas que dejaría fuera y los detalles que algunas entradas perderían, como los recordatorios en un calendario que no los tiene. Para seguir adelante, pulsa el botón que indica cuántas entradas se añaden, como **Añadir 12 entradas**. Para elegir otro calendario, vuelve atrás con la flecha. El archivo en sí nunca cambia.

Cada entrada se añade como una copia nueva, así que añadir el mismo archivo dos veces te da cada entrada por duplicado. Nada de lo que ya hay en tu calendario se sobrescribe.

Las subtareas y las dependencias entre entradas del mismo archivo siguen vinculadas tras la importación. Una serie que se repite conserva eliminadas sus repeticiones eliminadas. Una serie con repeticiones editadas, como una reunión movida a otro día, se deja fuera, porque Mitra no puede añadir una serie junto con sus ediciones.

Si añadir falla a medias, Mitra quita las entradas que ya había añadido, de modo que nada del archivo queda importado a medias. Si no puede quitar algunas, te dice cuántas debes eliminar a mano.

## Suscribirse desde un enlace webcal

Los sitios que te permiten suscribirte a un calendario, como partidos, periodos escolares o festivos, suelen enlazar a una dirección `webcal://`. Haz clic en una y Mitra abre el formulario **Suscripción a un calendario** con la dirección rellenada. Compruébala, rellena **Usuario (opcional)** y **Contraseña (opcional)** si el feed los necesita, y pulsa **Conectar**. Después activa el calendario y pulsa **Guardar**.

Hacer clic en el enlace nunca te suscribe por sí solo: Mitra solo descarga el feed cuando pulsas **Conectar**.

Una suscripción es un calendario de solo lectura que Mitra mantiene al día a partir del feed. Consulta [Suscripciones a calendarios](integrations/subscriptions.md) para ver cómo funciona.
