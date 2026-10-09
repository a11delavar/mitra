---
title: Actualizaciones
description: Cómo te avisa Mitra de las nuevas versiones, qué envía esa comprobación, cómo desactivarla y cómo actualizar.
---

Mitra te avisa cuando existe una versión más reciente que la que ejecutas. Nunca se actualiza solo: descargar la nueva versión te corresponde a ti.

## El indicador de actualización

Cuando hay algo más reciente, aparece un pequeño punto sobre el logotipo en la barra lateral. Haz clic en el nombre de tu instancia para abrir **Acerca de**, que muestra la versión y el commit que ejecutas y enlaza con las novedades. **Copiar** copia los detalles de la versión, que es lo que necesita un informe de error.

**Novedades**, en la [paleta de comandos](shortcuts.md#command-palette), lista los cambios de cada versión. Después de actualizar tu servidor, Mitra te pide **Recargar para terminar la actualización** en cualquier pestaña que estuviera abierta de antes.

Si ejecutas una versión publicada (`latest`, `0.6` o una versión exacta), te remite a la versión más reciente. Si ejecutas la imagen `dev`, te remite a los commits más recientes de `main` y te dice cuántos te llevan de ventaja.

## Qué envía la comprobación

El servidor, nunca tu navegador, pregunta a GitHub unas cuantas veces al día si hay algo más reciente. La solicitud no lleva nada de tu instancia aparte de lo que lleva cualquier solicitud: tu dirección IP y la versión en ejecución en su user agent. Sin telemetría, sin identificadores, sin contadores.

Si el servidor no puede llegar a GitHub, lo registra una vez y después guarda silencio.

Para desactivar la comprobación por completo, establece `MITRA_UPDATE_CHECK` en `off` (`false`, `0` y `no` también sirven):

```yaml
environment:
  MITRA_UPDATE_CHECK: 'off'
```

## Elige una etiqueta de imagen

La etiqueta decide con cuánta rapidez pasas a las nuevas versiones.

| Etiqueta | Qué obtienes |
| --- | --- |
| `latest` | La versión publicada más reciente. |
| `0.6` | La última versión `0.6.x`: correcciones, pero ninguna versión menor nueva. |
| `0.6.0` | Exactamente esa versión. |
| `dev` | El último commit de `main`, para probar cosas antes de que se publiquen. |

Hasta la 1.0, una nueva versión menor (de 0.6 a 0.7) puede cambiar cosas en las que confías. Si prefieres elegir cuándo ocurre, usa `0.6` y avanza cuando estés listo. Todas las etiquetas aparecen en [GitHub](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Actualiza Mitra

Descarga la nueva imagen y vuelve a crear el contenedor:

```bash
docker compose pull
docker compose up -d
```

Tus datos están en la carpeta montada, así que se conservan. Si la nueva versión cambia la base de datos, Mitra la actualiza al arrancar y tú nunca tienes que tocarla. Herramientas como [Watchtower](https://containrrr.dev/watchtower/) pueden hacerlo por ti de forma programada.

La versión que obtienes depende de tu [etiqueta de imagen](#choose-an-image-tag). Antes de pasar a una nueva versión menor, conviene leer las [notas de la versión](https://github.com/a11delavar/mitra/releases).
