---
title: CSS personalizado
description: "Cambia el aspecto de Mitra con tu propio CSS: una hoja de estilos tuya que sigue a tu cuenta, y otra para todos en el servidor."
---

El aspecto de Mitra es CSS normal, y puedes añadir el tuyo encima. Oculta lo que nunca usas, pon un borde alrededor de hoy o dale tus colores a todo el servidor. Hay dos sitios para hacerlo: **Ajustes → General → CSS personalizado** para ti, y, donde se inicia sesión, **Ajustes → Administración → CSS personalizado para todos** para todos en el servidor.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/custom-css-dark.webp">
  <img src="../assets/screenshots/custom-css-light.webp" alt="Mitra en el dorado de su logotipo, con la regla de CSS personalizado que lo hace abierta en los ajustes" />
</picture>

> [!WARNING]
> Hasta Mitra 1.0, cualquier actualización puede cambiar los elementos, atributos y variables a los que apuntan tus reglas. Una regla que funciona hoy puede dejar de funcionar tras una actualización, o empezar a ocultar algo. Mantén tu hoja de estilos corta y revisa Mitra después de cada actualización.

## Tu propia hoja de estilos

Abre **Ajustes → General** y escribe CSS en el campo bajo **CSS personalizado**. Mitra lo aplica mientras escribes, lo guarda un momento después de que pares, y sigue a tu cuenta a todos los dispositivos y navegadores desde los que inicias sesión.

El interruptor junto a **CSS personalizado** desactiva tu hoja de estilos sin perderla, y la [paleta de comandos](shortcuts.md) ofrece **CSS personalizado: Desactivado** y **CSS personalizado: Activado**.

`@import` se elimina al guardar: pega una hoja de estilos entera en lugar de enlazar una.

## La hoja de estilos del servidor

Donde se inicia sesión, quien administra el servidor puede cambiar el aspecto de Mitra para todos: abre **Ajustes → Administración** y escribe CSS en el cuadro bajo **CSS personalizado para todos**. Tú lo ves mientras escribes, y los demás la próxima vez que cargan Mitra. Su interruptor lo apaga para todos sin perderlo. La primera persona que inicia sesión en un servidor es quien lo administra. Sin inicio de sesión, tu propia hoja de estilos ya llega a todos los que usan Mitra, así que es la única.

Encaja con lo que hace tuyo un servidor, como sus colores, su tipografía o el [nombre](configuration.md#name-your-instance) que ya lleva. La hoja de estilos de cada persona va después, así que la suya gana donde ambas fijan lo mismo.

## Tu regla gana

Las reglas propias de Mitra están en una capa de cascada llamada `mitra`, y las tuyas no, así que una regla tuya gana a la de Mitra sea cual sea su selector. No necesitas `!important`. Las pocas declaraciones `!important` de Mitra quedan por encima, porque las capas las ordenan al revés: sostienen el diseño.

Para quitar algo que Mitra define, en lugar de pintar encima, dale a la propiedad el valor `revert`. Esto quita el fondo de los días en la vista de mes:

```css
mitra-weeks mitra-day {
	background: revert;
}
```

## Ejemplos

### Ocultar los días fuera del mes

```css
mitra-weeks [data-outside] {
	visibility: hidden;
}
```

En la [vista de mes](views/month.md), esto oculta los días antes y después del mes que muestra, su fecha y su fondo. Las entradas que hay en ellos se quedan. `visibility` mantiene la cuadrícula en su sitio, donde `display: none` la desharía. Acerca el zoom para dar más espacio a los días del mes.

### Un borde alrededor de hoy

```css
mitra-weeks mitra-day[today] {
	outline: 2px solid var(--color-accent);
	outline-offset: -2px;
}
```

`outline` en lugar de `border`: un borde agrandaría el día y movería la cuadrícula.

### Tus propios colores

```css
:root {
	--color-accent: light-dark(#2e7d32, #81c784);
	--border-radius: 8px;
}
```

`light-dark()` toma el color del tema claro y luego el del oscuro. Todo lo que Mitra colorea con estas variables lo sigue, incluida la barra de título de la [aplicación instalada](install-app.md):

| Variable | Qué colorea |
| --- | --- |
| `--color-accent` | Hoy, lo seleccionado, los anillos de foco y los botones principales |
| `--color-background-seed` | El fondo detrás de todo; los diálogos toman el suyo de él |
| `--color-surface` | Los días en las vistas, y lo que se apoya sobre el fondo, como la paleta de comandos |
| `--color-text` | El texto |
| `--color-text-muted` | El texto secundario, como las indicaciones y las horas |
| `--color-error` | Errores y advertencias |
| `--border-radius` | Las esquinas de botones, entradas y la mayoría de los controles |
| `--font-family` | La tipografía del texto |

## Encontrar a qué apuntar

Las herramientas de desarrollo de tu navegador muestran lo que hay en la página: haz clic derecho sobre algo y elige **Inspeccionar**. Los elementos propios de Mitra se llaman `mitra-…`, como las vistas `mitra-days` (semana), `mitra-weeks` (mes), `mitra-months` (año), `mitra-timeline` y `mitra-table`, un día `mitra-day`, una entrada `mitra-entry-segment` y la barra lateral `mitra-sidebar`. Los atributos expresan hechos, como `today`, `data-outside` y `data-date`.

Los botones, campos, interruptores, menús y demás controles guardan su interior para sí. Llega a ellos por sus partes, como `mitra-switch::part(switch)`, y por las variables `--mitra-…` que leen. Si necesitas llegar más lejos, pide una parte en un [issue](https://github.com/a11delavar/mitra/issues).

## Lo que conviene no tocar

Algunas cosas sostienen Mitra, y cambiarlas lo rompe:

- `display` o `position` en `mitra-day`, o en los `.entries` dentro de una vista: se apoyan en una cuadrícula que comparte toda la vista, y sin ella la vista de semana se vuelve muy lenta.
- Las variables que empiezan por `--_`: cambian en cada fotograma de un zoom, y fijarlas lo contraría.
- El tamaño de una entrada: su título elige el diseño según su ancho, así que dimensionarla desde fuera puede cambiarlo.
- `all: unset` también anula el ocultar, así que añade `[hidden] { display: none }` al lado.

## Cuando una regla oculta el camino de vuelta

Añade `?css=off` a la dirección, por ejemplo `https://mitra.example.com/?css=off`. Mitra carga entonces una vez sin ninguna de las dos hojas de estilos, para que puedas abrir **Ajustes** y arreglar la tuya. Quien administra el servidor arregla la de todos de la misma forma.

## Antes de pegar

Una hoja de estilos no ejecuta código, pero puede cargar direcciones, y una escrita para ello puede enviarles lo que hay en tu pantalla. Pega solo CSS que entiendas. Tu hoja de estilos solo te afecta a ti; la del servidor, a todos en él.

## Comparte la tuya

Bajo el cuadro, **Compartir en GitHub** abre una discusión nueva en la categoría [Custom CSS](https://github.com/a11delavar/mitra/discussions/categories/custom-css) con tu hoja de estilos ya dentro. Cuenta qué hace, añade una captura si se ve algo y publícala. Una hoja de estilos demasiado larga para el enlace se copia en tu portapapeles, para que la pegues en la discusión. En la categoría también encontrarás las hojas de estilos que otros han compartido: léelas antes de pegarlas.
