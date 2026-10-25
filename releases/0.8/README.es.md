---
title: Seguimiento de rutinas, Todoist, subtareas y vencimientos de un vistazo
---
Mitra 0.8 te ayuda a mantener las cosas que haces una y otra vez, y muestra cómo encajan los trabajos más grandes.

## Seguimiento de rutinas
Mitra ya agrupa en rutinas lo que haces a menudo, como ir al gimnasio o cortarte el pelo cada cinco semanas. Ahora tienen un lugar propio, donde ves de un vistazo los últimos días de cada rutina: cuántos cumpliste y cuáles cancelaste o te saltaste. Puedes cambiar el nombre de una rutina, unir dos que van juntas o decirle a Mitra que algo no es una rutina. Las rutinas también se mantienen estables en las vistas de mes y año por mucho que te desplaces, y tu conector de IA puede decirte cómo van.

## La misma hora en todas partes
Algunas cosas no dependen de tu zona horaria: la medicación de las 7:30 es a las 7:30, en casa o de viaje. Elige **La misma hora en todas partes** al principio de las zonas horarias de una entrada, y se queda a esa hora estés donde estés, marcada con un globo tachado. Las entradas que llegan de otras aplicaciones sin zona horaria también lo muestran. Antes de que muevas una a un calendario que no tiene esas horas, como Google Calendar, Mitra te avisa de que recibirá una zona horaria fija.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="same-time-dark.webp">
	<img src="same-time-light.webp" alt="El editor de una entrada en la medicación de la mañana, con sus zonas horarias abiertas en La misma hora en todas partes">
</picture>

Docs: [La misma hora en todas partes](../../docs/time-zones.md#same-time-everywhere)

## Mejores subtareas
Las subtareas de una entrada comparten un carril en las vistas de mes y año, así que un proyecto se lee como una sola línea, con sus subtareas cortas plegadas dentro. La tabla anida las subtareas bajo su entrada principal, y la vista de año puede ocultarlas. El progreso de una tarea pondera cada subtarea según su tamaño, así que un trabajo largo cuenta más que uno rápido.

## Vencimientos de un vistazo
El día de vencimiento de una tarea aparece en su bandera, y al señalar la tarea se marca ese día en el calendario. El cronograma también lo marca, y la tabla gana una columna para él. Una subtarea sin fecha de vencimiento propia toma la de su entrada principal.

## Personalización
Da a cada calendario uno de dos colores más, o el color que quieras. Cambia el nombre del encabezado de una cuenta con un doble clic y oculta todos sus calendarios a la vez. Para todo lo demás, cambia el estilo de Mitra con tu propio CSS: para ti en Ajustes, o para todos en tu servidor con un archivo en su carpeta de datos. Quien administra el servidor tiene una sección propia en Ajustes.

## Duplicar en otros días
Algunas cosas ocurren en días que ninguna repetición puede describir. Una receta de ocho sesiones de fisioterapia se reparte entre los huecos libres de la consulta, y un cliente te reserva el 3, el 9 y el 17. Añade la primera, elige **Duplicar en otros días** en su menú ⋯ y marca las demás en los dos meses que aparecen. Mantén pulsado Mayús para elegir varios días seguidos de una vez. Cada día recibe una copia a la misma hora, una entrada propia que puedes mover o cambiar como cualquier otra.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="duplicate-days-dark.webp">
	<img src="duplicate-days-light.webp" alt="El diálogo Duplicar en otros días de una sesión de fisioterapia, con siete sesiones más elegidas en octubre y noviembre">
</picture>

Docs: [Duplicar en otros días](../../docs/entries.md#the--menu)

## Todoist
Conecta tus proyectos de Todoist y sus tareas estarán en la misma línea de tiempo que tus eventos, sincronizadas en ambos sentidos. Cada proyecto se convierte en un calendario con su color de Todoist. La fecha, la duración y la fecha límite de una tarea pasan a ser su programación, su duración y su fecha de vencimiento. Una tarea que se repite en Todoist aparece en su próxima fecha, y completarla en Mitra la pasa a la fecha siguiente, como hace Todoist. La prioridad, las etiquetas y las secciones quedan como están.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="todoist-dark.webp">
	<img src="todoist-light.webp" alt="El diálogo Añadir integración, con el puntero sobre Todoist entre los demás proveedores">
</picture>

Docs: [Todoist](../../docs/integrations/todoist.md)

## Más idiomas
Mitra está aprendiendo árabe, ruso, polaco y neerlandés. Con cada versión, Mitra funciona mejor en otros idiomas, escrituras y calendarios. Cada idioma nuevo llega traducido por completo, incluidos la documentación y el sitio web.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="arabic-week-dark.webp">
	<img src="arabic-week-light.webp" alt="La vista de semana en árabe, de derecha a izquierda, con un evento abierto en el editor">
</picture>

## Colaboradores
- [@jkngale](https://github.com/jkngale): las bases para Todoist
