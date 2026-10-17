---
title: Archivos adjuntos
description: "Añade archivos a un evento o una tarea. Mitra los guarda en tu servidor y los guarda con la entrada, así que otras apps de calendario también los ven."
---

Una entrada puede tener **archivos adjuntos**: archivos como un billete, una foto de una pizarra o una receta. Mitra guarda el archivo en tu servidor y lo guarda con la entrada en el formato estándar de calendario, así que las demás apps que usan el mismo calendario, como Nextcloud o Apple Calendar, muestran el mismo archivo en el mismo evento.

## Añadir un archivo

Abre la entrada y pulsa **＋** en la fila con el clip, o la palabra **Archivos adjuntos** mientras la fila siga vacía, y elige uno o varios archivos. Cada archivo adjunto muestra un icono de su tipo, su nombre y su tamaño. Haz clic en uno para abrirlo en una pestaña nueva, y pulsa su **✕** para quitarlo de la entrada.

Un clip en la entrada del calendario muestra qué entradas tienen archivos.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/attachments-detail-dark.webp">
  <img src="../assets/screenshots/attachments-detail-light.webp" alt="Una tarea abierta junto a su entrada en la semana, cuyo clip muestra que lleva archivos: el editor enumera un PDF, un boceto y una hoja de cálculo sobre la descripción, que muestra el boceto" />
</picture>

Los enlaces no son archivos adjuntos. Para añadir un enlace a una entrada, escríbelo en la descripción, y la fila [Enlaces](links.md) lo muestra.

## Dónde se guardan los archivos

Los archivos que añades se guardan en la carpeta `files` de la carpeta de datos de Mitra, junto a su base de datos, así que una [copia de seguridad](backups.md) de esa carpeta los incluye. Cada archivo se guarda con un nombre aleatorio en lugar del suyo, y el mismo archivo añadido dos veces se guarda una sola vez.

> [!IMPORTANT]
> Quien tenga la dirección de un archivo puede abrirlo sin iniciar sesión en Mitra. Eso es lo que permite a otras apps de calendario abrir el archivo: Mitra escribe la dirección en tu calendario, y esas apps no pueden iniciar sesión en Mitra. La dirección contiene una parte aleatoria que no se puede adivinar, pero trátala como cualquier enlace para compartir. Para obtener una dirección nueva, quita el archivo adjunto y vuelve a añadir el archivo.

Las imágenes, los vídeos, el audio, los PDF y el texto plano se abren en el navegador. Cualquier otro tipo de archivo se descarga, así que un archivo nunca puede ejecutar código dentro de Mitra.

## Límites

Un archivo puede ocupar hasta 25 MB, y no hay límite de cuánto puede guardar una persona. Quien gestiona el servidor puede cambiar ambas cosas, o desactivar los archivos adjuntos; consulta [Configuración](configuration.md#attachments). En la [demo](https://demo.mitracal.com), añadir archivos siempre está desactivado.

Un archivo que ya no usa ninguna entrada se borra más o menos un día después de añadirlo. Hasta entonces, aún puedes añadirlo a una entrada que no has guardado, o volver a añadirlo después de quitarlo por error.

## Qué calendarios lo admiten

Los calendarios de un [servidor CalDAV](integrations/caldav.md) y de [Apple Calendar](integrations/apple.md) admiten archivos adjuntos, igual que los [calendarios de Mitra](integrations/mitra.md). En una [suscripción a un calendario](integrations/subscriptions.md), ves los archivos adjuntos que trae el feed, pero no puedes cambiarlos.

Un archivo también puede aparecer en la descripción: el botón de imagen o de enlace de su fila lo añade al final del texto, como imagen si es una imagen y como enlace en los demás casos. Al quitar el archivo adjunto, eso también desaparece.

En un [calendario de Google](integrations/google.md), los archivos adjuntos son los archivos de Google Drive adjuntados en Google Calendar: Mitra los muestra, pero no puede añadir ni quitar ninguno. Los calendarios de [Notion](integrations/notion.md) y [Tempo](integrations/tempo.md) no tienen fila de archivos adjuntos. Mover una entrada con archivos adjuntos a cualquiera de estos pierde sus archivos, y Mitra te lo dice antes de mover nada.

> [!NOTE]
> Los archivos adjuntos que añadieron otras apps también aparecen en Mitra, incluidos los archivos que guarda tu propio servidor de calendario, que se abren con la dirección de ese servidor. Mitra deja exactamente como están los archivos adjuntos que no reconoce, así que editar una entrada en Mitra nunca cambia los archivos adjuntos de otra app.
