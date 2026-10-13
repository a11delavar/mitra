---
title: Zonas horarias
description: Cómo muestra Mitra la zona horaria propia de una entrada y cómo añadir las horas de otras zonas horarias a la vista semanal.
---

Mitra muestra las horas en tu zona horaria, la que tiene configurada tu dispositivo. Cuando viajas y tu dispositivo cambia de zona, Mitra lo sigue. En el editor, esta zona se llama zona horaria **actual**. Tu **casa** es la zona a la que perteneces, y se queda junto a la actual mientras viajas.

Una entrada también puede tener una zona horaria propia, como un vuelo que sale a las 9:00 en Nueva York. Y la vista semanal puede mostrar las horas de otras zonas horarias junto a la tuya.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zone-detail-dark.webp">
  <img src="../assets/screenshots/time-zone-detail-light.webp" alt="El editor de una entrada nueva con su zona horaria en GMT+4 Dubái, que muestra las 11:00 en Dubái, mientras la entrada está a las 9:00 en la semana de Berlín que hay detrás" />
</picture>

## La zona horaria de una entrada

Toda entrada con horas tiene una zona horaria. Las entradas que creas toman la tuya, y las entradas de otras aplicaciones conservan la zona en que se hicieron.

Abre una entrada para ver su zona en la fila del globo, bajo sus fechas, escrita como un desfase y una ciudad, como «GMT-4 Nueva York». Las entradas de todo el día no tienen zona horaria ni esa fila, porque cubren los mismos días para todos.

### Cambiar la zona horaria de una entrada

Haz clic en la zona y elige otra. La lista empieza por las zonas del país para el que está configurado tu [idioma](settings.md#general), luego todas las zonas, y marca tu casa con una casa allí donde está, y tu zona actual con un alfiler mientras estás fuera. Las zonas que mantienen el mismo nombre y la misma hora todo el año comparten una fila, que representa una de sus ciudades, la de tu propia zona o la de tu país si tiene una, como la hora de Europa central para Berlín en Alemania. La flecha al final de la fila despliega las demás ciudades, como París y Ámsterdam, y una búsqueda despliega las filas en las que encuentra algo. Escribe una ciudad, un país, el nombre de una zona o una diferencia horaria para encontrarla.

La entrada conserva sus horas de reloj en la nueva zona: una reunión a las 9:00 en Berlín pasa a ser una reunión a las 9:00 en Nueva York. Si solo la zona era errónea y la reunión en sí no se movió, cambia después sus horas.

### Tu hora o la de la entrada

Cuando la zona de una entrada difiere de la tuya, el editor muestra sus horas en tu zona, así que una reunión a las 9:00 en Nueva York se lee 15:00 si estás en Berlín. Un botón junto a la zona alterna entre la hora de la entrada y la tuya. Muestra un alfiler mientras ves tu hora y un globo mientras ves la de la entrada, y al apuntar a él te dice cuál estás mirando.

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

Señala la parte superior de la columna de horas y pulsa **＋** (**Añadir zona horaria**). La lista marca las zonas que ya tienes, con una casa en tu casa y un alfiler en tu zona actual mientras estás fuera. Elige una zona para añadir su columna, o una marcada para quitar la suya. La lista sigue abierta para más. Tu zona actual sigue siendo la columna junto a los días, y tu casa también se queda.

Cada columna lleva un nombre corto: la abreviatura que se usa para la zona, como «PDT» o «BST», o, si no hay ninguna, su lugar, como «Irán». La abreviatura sigue tu [idioma](settings.md#general): Berlín se llama «CEST» en inglés y «MESZ» en alemán, y cuando tu región no tiene una para una zona, la región de la zona presta la suya. Señala un nombre para ver el nombre completo.

### Renombrar o quitar una zona horaria

Haz clic en el nombre de una zona y elige **Renombrar** para darle una etiqueta propia, como «Mamá», **Establecer como casa** para hacerla tu casa, o **Eliminar** para quitar su columna. Para volver al nombre automático, renómbrala dejándola en blanco.

Tu zona actual y tu casa se pueden renombrar, pero no quitar. Para cambiar tu casa, establece otra zona como casa.

### Plegar las columnas extra

Las columnas extra quitan espacio a los días. Para ocultarlas, apunta a la parte superior de la columna de horas y pulsa la flecha bajo el **＋**. Púlsala de nuevo para mostrarlas. También puedes arrastrar la columna de horas hacia los días para abrirlas, y de vuelta para cerrarlas, que es la forma de hacerlo en una pantalla táctil.

En una pantalla estrecha, las columnas empiezan plegadas hasta que las abres o cierras tú mismo. Añadir una zona siempre las despliega.

### En todos tus dispositivos

Tu casa, las zonas que añades y cada nombre que les das pertenecen a tu cuenta, así que se muestran en todos los dispositivos que uses. Si las columnas están plegadas se queda en cada dispositivo.

Tu casa es la zona del primer dispositivo en el que abres Mitra. De viaje, la zona en la que estás pasa a ser la columna junto a los días y tu casa se queda a su lado, sin que nada se añada a tu lista, así que al volver es una sola columna otra vez. Dar un nombre a la zona en la que estás la guarda en tu lista. Si te mudas, elige **Establecer como casa** en la zona en la que vives ahora, y tu casa anterior se queda como columna hasta que la quites.
