---
title: Recordatorios
description: Añade recordatorios a eventos y tareas, elige con qué recordatorios empiezan las entradas nuevas y gestiona los dispositivos que los reciben.
---

Un recordatorio te avisa de un evento o una tarea con antelación, como una notificación de tu sistema, incluso cuando Mitra no está abierto. Viene de tu propio servidor de Mitra, así que no hay ningún otro servicio en el que registrarse. En un iPhone o un iPad, los recordatorios necesitan Mitra [instalado como aplicación](install-app.md); en cualquier otro sitio, basta con el navegador.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/notifications-detail-dark.webp">
  <img src="../assets/screenshots/notifications-detail-light.webp" alt="La página de ajustes de Notificaciones, con los recordatorios predeterminados, el permiso del navegador y la lista de dispositivos" />
</picture>

## Añadir un recordatorio

Abre una entrada y pulsa **＋** en su fila de recordatorios, la de la campana. Elige cuándo debe sonar: **Al inicio del evento** (**A la hora de la tarea** para una tarea), 5 o 10 minutos, media hora, una hora o un día antes, o **Personalizado…** para cualquier otro momento. Una entrada puede tener varios, y la **✕** junto a uno lo quita.

Un recordatorio cuenta hacia atrás desde el inicio de la entrada o, para una tarea sin inicio, desde su fecha límite. La primera vez que añades uno, tu navegador pregunta si Mitra puede mostrar notificaciones. Si dices que no, el recordatorio se guarda igualmente con la entrada.

Una entrada que se repite te avisa en cada repetición. Las tareas que marcaste como hechas o canceladas se quedan en silencio, pero un calendario que ocultas no: para silenciarlo, desactívalo en **⋯ → Editar** de su cuenta. Los calendarios de [Notion](integrations/notion.md) y [Tempo](integrations/tempo.md) no pueden contener recordatorios.

## Recordatorios predeterminados

**Ajustes → Notificaciones** fija los recordatorios con los que empiezan las entradas nuevas: 30 minutos antes para un evento y a la hora de la tarea para una tarea, a menos que los cambies o elijas **Ninguno**. Las entradas de todo el día empiezan sin recordatorios.

## Cuando suena un recordatorio

La notificación muestra el título de la entrada, cuándo es y su ubicación, en el idioma y la zona horaria del dispositivo. Se queda hasta que la descartas, y al tocarla se abre la entrada. **En 10 min** la vuelve a traer más tarde y, en una tarea, **Hecho** la marca como hecha sin abrir Mitra. Safari y Firefox no muestran estos botones.

Un dispositivo que estaba sin conexión cuando salió un recordatorio lo descarta cinco minutos después del inicio de la entrada, en lugar de mostrarlo tarde.

## Tus dispositivos

Cada navegador o aplicación instalada donde permites notificaciones es un dispositivo, y cada dispositivo recibe todos tus recordatorios. **Ajustes → Notificaciones** los enumera, con el que estás usando marcado como **este dispositivo**. Cambia el nombre de uno con el lápiz, quita uno con la **✕** y envíate una muestra con **Evento de prueba** o **Tarea de prueba**.

## Solución de problemas

- Si un recordatorio no llega, envía un **Evento de prueba**. Si la prueba llega, lo más probable es que la entrada esté en un calendario desactivado. El permiso es por navegador y por dirección, así que permitir Mitra en una dirección no cubre otra.
- Si no hay una fila **Notificaciones de recordatorio** en **Ajustes → Notificaciones**, este navegador no puede recibir notificaciones de Mitra: en un iPhone o un iPad, abre la [aplicación instalada](install-app.md) en lugar de Safari y, en cualquier otro sitio, Mitra tiene que servirse por HTTPS.
- Si la fila dice **Bloqueadas**, permite las notificaciones de Mitra en los ajustes del sitio del navegador.
- Si no llega nada en Windows con Chrome cerrado, activa **Continue running background apps when Google Chrome is closed** en los ajustes de Chrome, o instala Mitra desde Edge.

## En el servidor

Los recordatorios no necesitan configuración, solo [HTTPS](configuration.md#put-it-behind-https). Mitra firma sus notificaciones con una clave que crea en el primer arranque y guarda en su base de datos, así que restaura la carpeta de datos completa desde tus [copias de seguridad](backups.md): en una base de datos nueva, Mitra crea una clave nueva y los dispositivos registrados con la antigua dejan de recibir recordatorios. Los [registros](logging.md) anotan cada recordatorio a medida que sale.
