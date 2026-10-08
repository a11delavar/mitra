---
title: Enlaces
description: "Cómo muestra Mitra los enlaces de una entrada: la reunión a la que unirse, la nota que abrir, la página que leer."
---

Los enlaces de una entrada muestran a qué llevan en lugar de su dirección sin procesar. Un enlace de reunión dice **Unirse a Google Meet**, un enlace a una nota de Obsidian muestra el nombre de la nota y una página web muestra su sitio y su ruta, como `example.atlassian.net/browse/DEV-9177`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/links-detail-dark.webp">
  <img src="../assets/screenshots/links-detail-light.webp" alt="El editor de una entrada con una fila de Enlaces sobre su descripción, que contiene un enlace a una nota de Obsidian" />
</picture>

## En el editor

Cuando la descripción de una entrada contiene enlaces, el editor los reúne en una fila de **Enlaces** justo encima de la descripción, para que puedas abrirlos sin leer todo el texto. Haz clic en uno para abrirlo: una página web se abre en una pestaña nueva y cualquier otro enlace abre su aplicación. A partir de dos líneas, la fila se desplaza.

La fila no tiene almacenamiento propio: muestra lo que contiene la descripción. Para añadir o quitar un enlace, edita la descripción y la fila lo sigue. Cualquier otra aplicación de calendario que uses ve los mismos enlaces en la descripción.

## En la descripción

Los enlaces de la descripción empiezan con un pequeño icono de lo que abren. Una dirección sin más, como la que se pega desde un navegador, se acorta a su sitio y su ruta. Un enlace que escribiste con tus propias palabras conserva tus palabras.

Mitra también reconoce enlaces de aplicaciones, como `obsidian://open?vault=…`, que la mayoría de las aplicaciones de calendario dejan como texto sin formato. Los enlaces que ejecutarían código, como `javascript:`, se muestran como texto sin formato y nunca como enlaces.

## Enlaces de reunión y de aplicación en la ubicación

Una ubicación que es un único enlace se trata como ese enlace en lugar de como un lugar. Un enlace de Zoom, Google Meet, Microsoft Teams, Webex, Jitsi, Whereby, FaceTime o Skype se muestra como **Unirse** con el nombre del servicio, en el editor, en el calendario y en la tabla. No tiene botón de mapa. Haz clic junto al enlace para editarlo.

## Enlaces a aplicaciones

Mitra nombra la aplicación a la que pertenece un enlace a partir de su dirección. Conoce Obsidian, Notion, Slack, Linear, Figma, Things, OmniFocus, Bear, Craft, Drafts, DEVONthink, Evernote, OneNote, Visual Studio Code, Cursor y Spotify. Todo enlace a una aplicación, conocida o no, muestra el mismo icono para abrir en otra aplicación.

> [!NOTE]
> Una página web no puede saber si una aplicación está instalada. La primera vez que abres un enlace a una aplicación, tu navegador pregunta si quieres abrirla. Si la aplicación no está, no pasa nada.
