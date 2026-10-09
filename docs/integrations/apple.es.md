---
title: Calendario de Apple
description: Conecta tus calendarios de iCloud a Mitra con una contraseña específica de la aplicación, sin nada que configurar en el servidor.
---

Mitra se conecta a tus calendarios de iCloud por CalDAV y sincroniza sus eventos en ambas direcciones. Apple no deja que otras aplicaciones inicien sesión con tu contraseña de Apple, así que primero creas una contraseña específica de la aplicación para Mitra. Lleva un minuto, y no hay nada que configurar en el servidor.

## Crear una contraseña específica de la aplicación

1. Inicia sesión en [appleid.apple.com](https://appleid.apple.com/).
2. En **Sign-In and Security**, elige **App-Specific Passwords**.
3. Crea una contraseña nueva, llámala «Mitra» para reconocerla más adelante y cópiala.

Apple solo ofrece contraseñas específicas de la aplicación si tu cuenta tiene activada la autenticación en dos pasos.

## Conectar tu cuenta

1. Elige **Añadir integración** al pie de la barra lateral y luego **Calendario de Apple**.
2. Introduce tu **ID de Apple**, la dirección de correo con la que inicias sesión en Apple, y la **Contraseña específica de la aplicación** que creaste para Mitra.
3. Pulsa **Conectar**. Mitra lista tus calendarios de iCloud, todos activados.
4. Desactiva los que no quieras y pulsa **Guardar**.

Mitra importa los calendarios que conservaste y los sincroniza cada 10 segundos mientras lo tengas abierto (consulta [cómo funciona la sincronización](README.md#how-syncing-works)).

## Qué se sincroniza

Los eventos se sincronizan en ambas direcciones, con todo lo que lleva [CalDAV](caldav.md#what-syncs).

> [!NOTE]
> Las tareas son distintas. Las tareas que Mitra guarda en un calendario de iCloud se almacenan en iCloud, y otras aplicaciones CalDAV pueden leerlas, pero la aplicación Recordatorios de Apple no las muestra. Recordatorios dejó de usar CalDAV con iOS 13, y Apple no ofrece a aplicaciones como Mitra ninguna otra vía de acceso.

La [disponibilidad](../availability.md) que marcas como ocupada en un calendario de iCloud se añade a ese calendario como eventos ocupados, de modo que el tiempo aparece como no libre en tu iPhone y para cualquiera que te invite. Funciona como se describe para [CalDAV](caldav.md#busy-availability).

## Desconectar tu cuenta

Elige **Eliminar** en el menú **⋯** de la cuenta en la barra lateral para quitarla de Mitra. Para retirar el acceso de Mitra en el lado de Apple, elimina la contraseña «Mitra» en la página **Sign-In and Security** donde la creaste. Tu contraseña de Apple y tus otras aplicaciones no se ven afectadas.

## Solución de problemas

- Si la conexión falla por la contraseña, comprueba que has introducido la contraseña específica de la aplicación, no tu contraseña de Apple.
- Si falta un calendario, está desactivado. Actívalo en **⋯ → Editar** de la cuenta y pulsa **Guardar**.
