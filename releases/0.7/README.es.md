---
title: Conectores de IA, archivos adjuntos, regiones e idiomas
---
Mitra 0.7 funciona con los asistentes de IA que ya usas, para que puedan planificar tu tiempo directamente en tu calendario. Ahora puedes adjuntar archivos a tus entradas, Mitra escribe las fechas como se escriben en tu región, y la zona horaria de casa te acompaña cuando viajas. Mitra ya está disponible en chino, y puedes leer lo que ha cambiado sin salir de la aplicación. Arrastrar, hacer zoom y cargar también es más rápido, y además hay muchas mejoras y correcciones pequeñas.

## Conectores de IA
Los asistentes de IA como Claude y Cursor ya pueden trabajar con tu calendario. Conecta uno con la dirección que aparece en Ajustes → IA y pídele lo que de otro modo harías a mano, como mirar tu semana, encontrar una entrada, planificar un viaje o mover una reunión. Lo que escribe llega a tus calendarios como cualquier otro cambio y se sincroniza desde ahí. En un servidor donde se inicia sesión, cada asistente recibe su propio token de acceso, que puede limitarse a la lectura y revocarse en cualquier momento.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="connectors-dark.webp">
	<img src="connectors-light.webp" alt="Un asistente de IA añade a la semana un viaje planeado a París: los planes anteriores se van, llega el viaje y la Torre Eiffel se abre con su foto y su entrada">
</picture>

Foto de la Torre Eiffel: David McSpadden, Wikimedia Commons, CC BY 2.0.

Docs: [Conectores de IA](../../docs/ai-connectors.md)

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
Mitra ahora habla chino, escrito en caracteres simplificados. La aplicación, el calendario de ejemplo, la documentación y el sitio web están traducidos, y el texto en chino se muestra con una tipografía hecha para él.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="chinese-detail-dark.webp">
	<img src="chinese-detail-light.webp" alt="El editor de entradas en chino, con su selector de fecha abierto en el mes">
</picture>

Docs: [Ajustes](../../docs/settings.md)

## Colaboradores
- [@a11delavar](https://github.com/a11delavar)
- [@d8monx](https://github.com/d8monx)
