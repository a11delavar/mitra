---
title: IA, archivos adjuntos, regiones e idiomas
---
Mitra 0.7 te permite adjuntar archivos a tus entradas, escribe las fechas en el formato de tu región, mantiene contigo la zona horaria de casa cuando viajas y muestra lo que ha cambiado dentro de la aplicación. Además arrastra, hace zoom y carga más rápido, y trae muchas mejoras y correcciones pequeñas desde la 0.6.

## IA
Estamos explorando cómo puede ayudarte la IA a planificar tu tiempo, en el propio Mitra y desde los asistentes que ya usas.

## Regiones & idiomas
Elige tu país junto con tu idioma. Mitra escribe entonces las fechas, las horas y los números como se escriben allí. Tu semana empieza el día en que empieza allí, y el fin de semana cae en los días que tienes libres. Una vista previa te muestra cómo se verá todo antes de decidir. Los atajos de teclado ahora también funcionan cuando tu teclado escribe en otra escritura, como el persa.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="locales-dark.webp">
	<img src="locales-light.webp" alt="El ajuste Idioma, abierto en sus idiomas, con el italiano desplegado en los países donde se escribe">
</picture>

Docs: [Ajustes](../../docs/settings.md)

## Zona horaria de casa
Mitra ya conoce la zona horaria de tu casa y la guarda en tu cuenta. Cuando viajas, el calendario sigue a tu dispositivo y tu casa se queda en la columna de al lado. Tu lista de zonas se queda como estaba, así que al volver vuelves a ver una sola columna. Las zonas que añades y los nombres que les das son los mismos en todos tus dispositivos. Cada columna lleva el nombre corto que la gente usa de verdad para esa zona.

El selector de zonas horarias también se ha rediseñado. Las zonas que comparten nombre y hora se agrupan en una sola fila, y las de tu propio país van primero. Una casita señala tu casa, y un alfiler señala la zona en la que estás cuando viajas.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="time-zones-dark.webp">
	<img src="time-zones-light.webp" alt="El selector de zonas horarias, abierto en tu casa entre las zonas agrupadas que la rodean">
</picture>

> [!NOTE]
> Si le diste un nombre propio a la zona horaria en la que estás, vuelve a ponérselo, por favor. Hasta ahora, esos nombres se quedaban en el dispositivo donde los pusiste. A partir de ahora, un nombre te sigue a todos tus dispositivos.

Docs: [Zonas horarias](../../docs/time-zones.md)

## Archivos adjuntos
Ahora puedes adjuntar archivos a una entrada, como un billete, un orden del día o una foto de una pizarra. Añádelos con el clip en el editor de la entrada, o arrástralos sobre la entrada abierta. Haz clic en un archivo para abrirlo. También puedes añadir un archivo a la descripción, donde una imagen aparece como imagen y cualquier otro archivo como enlace. Si luego quitas el archivo, Mitra lo quita también de la descripción.

Los archivos adjuntos se sincronizan con tu calendario. En un calendario CalDAV, otras apps que usan el mismo calendario ven los archivos que adjuntas, y Mitra muestra los archivos que ellas adjuntaron. En Google Calendar, Mitra muestra los archivos de Google Drive adjuntos a un evento, pero no puede añadir ni quitar ninguno, porque Google solo conserva archivos de Drive. Las imágenes de una página de Notion ahora aparecen en la descripción de la tarea.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="attachments-dark.webp">
	<img src="attachments-light.webp" alt="Una tarea abierta junto a su entrada en la semana, cuyo clip muestra que lleva archivos: el editor enumera un PDF, un boceto y una hoja de cálculo sobre la descripción, que muestra el boceto">
</picture>

> [!NOTE]
> Mitra guarda los archivos que adjuntas en su carpeta de datos, así que al hacer copia de esa carpeta también guardas tus archivos. Puedes limitar el tamaño de un solo archivo con `MITRA_FILE_MAX_SIZE`, y cuánto puede guardar cada persona en total con `MITRA_FILE_QUOTA`.

Docs: [Archivos adjuntos](../../docs/attachments.md)

## Notas de versión en la aplicación
Ahora puedes ver qué ha cambiado sin salir de Mitra. El diálogo Acerca de muestra cada versión como lo hace el sitio web. Incluye las notas y las imágenes de la versión que usas, junto con las correcciones que llegaron después. También aparece cada commit, plegado hasta que lo necesites.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="about-dark.webp">
	<img src="about-light.webp" alt="El diálogo Acerca de, abierto en las notas y las imágenes de una versión">
</picture>

## Chino
Mitra aprende chino, en caracteres simplificados: la aplicación, su calendario de ejemplo, la documentación y el sitio web, con una tipografía hecha para él.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="chinese-detail-dark.webp">
	<img src="chinese-detail-light.webp" alt="El editor de entradas en chino, con su selector de fecha abierto en el mes">
</picture>

Docs: [Ajustes](../../docs/settings.md)
