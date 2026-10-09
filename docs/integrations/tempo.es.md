---
title: Tempo
description: Ve en tu calendario las horas que registras en Tempo, y regístralas, muévelas, redimensiónalas y elimínalas desde Mitra.
---

[Tempo](https://www.tempo.io/) es una aplicación de control de tiempo para Jira. Mitra muestra tus **worklogs**, las horas que registraste en incidencias de Jira, como entradas con hora en tu calendario, junto a las reuniones y tareas en las que se fue ese tiempo.

Los worklogs se sincronizan en ambas direcciones. Mueve o redimensiona una entrada para cambiar cuándo y cuánto trabajaste, edita su descripción para cambiar la nota del worklog, elimínala para eliminar el worklog, o crea una para registrar tiempo nuevo.

Te conectas desde la aplicación con dos tokens de API. No hay nada que configurar en el servidor.

## Conectar tu hoja de horas

Mitra necesita un token de Tempo y otro de Atlassian: Tempo guarda las horas, y Jira conoce las incidencias y quién eres.

1. Crea un token de API de Tempo. En Jira, abre los **Settings** de Tempo (el icono del engranaje) → **Data Access** → **API integration**, elige **New Token**, llámalo «Mitra» y copia el token.
2. Crea un token de API de Atlassian en [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) con **Create API token**, y cópialo. Crea ambos tokens como el mismo usuario de Jira.
3. En Mitra, elige **Añadir integración** al pie de la barra lateral y luego **Tempo**, y rellena:
   - **URL del sitio**, tu dirección de Atlassian, como `https://your-company.atlassian.net`.
   - **Token de API de Tempo**, el token del paso 1.
   - **Correo de la cuenta de Atlassian**, la dirección de correo de tu cuenta de Atlassian.
   - **Token de API de Atlassian**, el token del paso 2.
4. Pulsa **Conectar**. Mitra lista un calendario, **My worklogs**.
5. Déjalo activado y pulsa **Guardar**.

Tempo limita cada cuánto pueden llamarle las aplicaciones, así que Mitra lo sincroniza cerca de una vez por minuto (consulta [cómo funciona la sincronización](README.md#how-syncing-works)).

## Cómo se ven los worklogs

El título de una entrada es la incidencia de Jira en la que se registra el tiempo, su clave y su resumen:

```text
ACME-1234 Code review for auth migration
```

La nota del worklog es la descripción de la entrada. La propia aplicación de Tempo los muestra igual, porque la incidencia dice de qué trataba el tiempo, mientras que la nota suele ser una etiqueta de actividad como «Review», o un texto que Jira escribió por ti, como «Working on work item ACME-1234».

El título pertenece a la incidencia, así que no puedes editarlo en un worklog guardado: Mitra no renombra una incidencia de Jira porque edites una entrada de calendario. Edita la descripción para decir qué hiciste. Si Jira no puede nombrar la incidencia, porque se eliminó o ya no puedes verla, el título muestra `#` y el ID de la incidencia, y la entrada sigue funcionando.

Tempo guarda los worklogs como horas de reloj simples, sin zona horaria. Mitra los lee en la zona horaria de tu perfil de Jira, así que se muestran a las mismas horas que en Tempo.

Algunos sitios de Tempo desactivan las horas de inicio. Allí, todos los worklogs de un día empiezan a la misma hora, así que se apilan, pero sus duraciones son correctas.

## Registrar tiempo desde Mitra

Crea una entrada con hora en **My worklogs** y pon la clave de la incidencia de Jira en cualquier parte de su título:

| Escribes | Se registra en |
| --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` |
| `Investigating ACME-1234 regression` | `ACME-1234` |
| `ACME-1234` | `ACME-1234` |

Mitra comprueba la clave con los proyectos de Jira que puedes ver. Si el título no tiene una clave así, o Jira no tiene esa incidencia, Mitra no registra nada y te dice por qué.

La nota del worklog es lo que escribiste en la descripción o, si la dejaste vacía, el título completo tal como lo escribiste. Una vez registrado el tiempo, el título pasa a ser la clave y el resumen de la incidencia. Ese cambio ocurre una sola vez, al registrar, por eso puedes editar el título mientras lo escribes y no después.

> [!TIP]
> Para registrar tiempo en una incidencia en la que ya registraste antes, duplica una de sus entradas: mantén pulsada <kbd>Alt</kbd> (<kbd>⌥</kbd> en Mac) mientras la arrastras a la nueva hora, o elige **Duplicar** en el menú **⋯** de su editor.

## Cambiar un worklog

Mover, redimensionar, eliminar y editar la descripción van directos a Tempo. Algunas cosas que conviene saber:

- Un worklog se queda en su incidencia. Tempo no puede mover un worklog a otra incidencia, así que para registrar el tiempo en otra, elimina la entrada y crea una nueva con la clave correcta.
- Mitra conserva los detalles propios de Tempo de un worklog, como su tiempo facturable y sus atributos de trabajo, cuando lo cambia.
- Cuando un periodo de la hoja de horas está cerrado o aprobado en Tempo, Tempo se niega a añadir, cambiar o eliminar worklogs en él.

Para abrir la incidencia en Jira, elige **Abrir en Jira** en el menú **⋯** del editor.

## Lo que un worklog no puede guardar

Un worklog es un tramo de tiempo en un día, registrado en una incidencia. Así que un calendario de Tempo guarda solo entradas con hora: no hay entradas de todo el día, repeticiones, recordatorios, ubicación, participantes, relaciones, estado ocupado o disponible, visibilidad ni [disponibilidad](../availability.md). Mitra oculta estos campos en los worklogs.

## Solución de problemas

- Si Mitra dice «Tempo rejected the API token», crea un token de API de Tempo nuevo e introdúcelo en **⋯ → Editar** de la cuenta.
- Si Mitra dice «Jira rejected the e-mail and API token», comprueba que la dirección de correo pertenece a la cuenta de Atlassian que creó el token de API.
- Si los worklogs aparecen a una hora del día equivocada, revisa la zona horaria de tu perfil de Jira (**Account settings** → **Time zone**). Tras cambiarla, usa **Re-importar entradas** en el menú **⋯** de **My worklogs**, para que también se muevan los worklogs que ya tienes.
- Si los worklogs se apilan a la misma hora cada día, tu sitio de Tempo ha desactivado las horas de inicio. Las horas siguen siendo correctas.
