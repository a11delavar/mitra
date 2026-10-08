---
title: Zonas horarias
description: Cómo muestra Mitra la zona horaria propia de una entrada y cómo añadir las horas de otras zonas horarias a la vista semanal.
---

Mitra muestra las horas en tu zona horaria, la que tiene configurada tu dispositivo. Cuando viajas y tu dispositivo cambia de zona, Mitra lo sigue. En el editor, esta zona se llama zona horaria **principal**.

Una entrada también puede tener una zona horaria propia, como un vuelo que sale a las 9:00 en Nueva York. Y la vista semanal puede mostrar las horas de otras zonas horarias junto a la tuya.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zone-detail-dark.webp">
  <img src="../assets/screenshots/time-zone-detail-light.webp" alt="El editor de una entrada nueva con su zona horaria en GMT+4 Dubái, que muestra las 11:00 en Dubái, mientras la entrada está a las 9:00 en la semana de Berlín que hay detrás" />
</picture>

## La zona horaria de una entrada

Toda entrada con horas tiene una zona horaria. Las entradas que creas toman la tuya, y las entradas de otras aplicaciones conservan la zona en que se hicieron.

Abre una entrada para ver su zona en la fila del globo, bajo sus fechas, escrita como un desfase y una ciudad, como «GMT-4 Nueva York». Las entradas de todo el día no tienen zona horaria ni esa fila, porque cubren los mismos días para todos.

### Cambiar la zona horaria de una entrada

Haz clic en la zona y elige otra. Escribe una ciudad, el nombre de una zona o un desfase para encontrarla. Tu propia zona encabeza la lista, marcada como **Principal**.

La entrada conserva sus horas de reloj en la nueva zona: una reunión a las 9:00 en Berlín pasa a ser una reunión a las 9:00 en Nueva York. Si solo la zona era errónea y la reunión en sí no se movió, cambia después sus horas.

### Tu hora o la de la entrada

Cuando la zona de una entrada difiere de la tuya, el editor muestra sus horas en tu zona, así que una reunión a las 9:00 en Nueva York se lee 15:00 si estás en Berlín. Un botón junto a la zona alterna entre la hora de la entrada y la tuya. Muestra una casa mientras ves tu hora y un globo mientras ves la de la entrada, y al apuntar a él te dice cuál estás mirando.

Puedes editar las horas de cualquiera de las dos formas. Para cambiar la zona en sí, cambia primero a la hora de la entrada.

### Horas de reloj de pared

Algunas entradas llegan de otras aplicaciones sin ninguna zona horaria, y muestran **Reloj de pared (sin zona horaria)**. Sus horas no pertenecen a ningún lugar: una alarma a las 7:00 está pensada para las 7:00 estés donde estés, y el editor la muestra a las 7:00 en todas las zonas horarias. Sus recordatorios suenan a esa hora del reloj en cada dispositivo.

Elegir una zona para una entrada así le da esa zona y conserva sus horas de reloj. No puede volver a ser una entrada de reloj de pared.

### Qué calendarios lo admiten

- Los **calendarios guardados en Mitra**, los [servidores de calendario](integrations/caldav.md) y [Google Calendar](integrations/google.md) conservan la zona horaria de cada entrada, y otras aplicaciones la ven.
- **[Notion](integrations/notion.md)** no tiene zonas horarias. Sus horas se muestran en la tuya, y el editor no tiene fila de zona horaria.
- **[Tempo](integrations/tempo.md)** lee los registros de trabajo en la zona horaria de tu perfil de Jira, y el editor tampoco tiene fila de zona horaria.
- Las **[suscripciones](integrations/subscriptions.md)** son de solo lectura: puedes ver la zona de una entrada y alternar entre las dos horas, pero no cambiarla.

## Zonas horarias en la vista semanal

La [vista semanal](views/week.md) puede mostrar las horas de otras zonas horarias en columnas junto a la tuya, así ves qué hora es allí a cada hora de tu día.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zones-detail-dark.webp">
  <img src="../assets/screenshots/time-zones-detail-light.webp" alt="La vista semanal con una columna EDT de horas de Nueva York junto a la columna GMT+2, de modo que las 07:00 en Berlín se leen como las 01:00 en Nueva York" />
</picture>

### Añadir una zona horaria a la semana

Apunta a la parte superior de la columna de horas y pulsa **＋** (**Añadir zona horaria**), y luego elige una zona. Su columna aparece junto a la tuya, y tu propia zona sigue siendo la columna contigua a los días.

Cada columna lleva por encabezado un nombre corto, como «PDT» o «GMT+2». Apunta a él para ver el nombre completo.

### Renombrar o quitar una zona horaria

Haz clic en el nombre de una zona y elige **Renombrar** para darle una etiqueta propia, como «NYC», o **Eliminar** para quitar su columna. Para volver al nombre automático, renómbrala dejándola en blanco.

Tu propia zona se puede renombrar, pero no quitar.

### Plegar las columnas extra

Las columnas extra quitan espacio a los días. Para ocultarlas, apunta a la parte superior de la columna de horas y pulsa la flecha bajo el **＋**. Púlsala de nuevo para mostrarlas. También puedes arrastrar la columna de horas hacia los días para abrirlas, y de vuelta para cerrarlas, que es la forma de hacerlo en una pantalla táctil.

En una pantalla estrecha, las columnas empiezan plegadas hasta que las abres o cierras tú mismo. Añadir una zona siempre las despliega.

### En todos tus dispositivos

Las zonas que añades, y sus nombres, pertenecen a tu cuenta, así que se muestran en todos los dispositivos que uses. El nombre que das a tu propia zona, y si las columnas están plegadas, se quedan en cada dispositivo, ya que cada dispositivo puede estar en una zona distinta.
