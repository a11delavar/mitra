---
title: Registros
description: Elige cuánto registra Mitra con MITRA_LOG_LEVEL y qué nivel ayuda con cada problema.
---

Mitra registra en la salida estándar, así que `docker compose logs` lo muestra todo:

```bash
docker compose logs -f mitra
```

Un servidor sano es silencioso a propósito: por defecto solo registra lo importante. Sube el nivel mientras investigas algo y bájalo de nuevo cuando termines.

## Establece el nivel

```yaml
environment:
  MITRA_LOG_LEVEL: 'debug'
```

Cada nivel incluye todo lo que es más silencioso que él:

| `MITRA_LOG_LEVEL` | Qué obtienes |
| --- | --- |
| `error` | Solo fallos. |
| `warn` | También los problemas que Mitra resolvió por su cuenta, como un recordatorio que no se pudo entregar, un geocodificador que no respondió o un proveedor de inicio de sesión al que no pudo llegar. |
| `info` *(por defecto)* | También lo que importa en el día a día: el arranque, los inicios de sesión, las cuentas conectadas, los cambios sincronizados desde los proveedores y los recordatorios enviados. |
| `debug` | También cada solicitud con su estado y su duración, cada sincronización, cuándo se acelera o se ralentiza la sincronización según la gente abre y cierra Mitra, las sesiones, las ediciones de entradas y las conversaciones con los servidores CalDAV. |
| `trace` | También cada consulta a la base de datos y los datos en bruto del calendario. Hay muchísimo. |

Mitra registra el nivel con el que se ejecuta al arrancar.

> [!NOTE]
> Las contraseñas, los tokens y otros secretos nunca se registran, en ningún nivel. `debug` y `trace` aún pueden mostrar títulos de entradas y datos del calendario, así que revisa un registro antes de compartirlo.

## Qué nivel usar

- Cuando un calendario no se sincroniza, `debug` muestra cada sincronización y las solicitudes a CalDAV y Notion.
- Cuando no llegan los recordatorios, `info` ya registra cada recordatorio al salir, y `debug` añade cada intento de entrega y los dispositivos que se descartaron.
- Cuando ves una página de error, `error` lo tiene con su traza de pila, y el `info` por defecto lo incluye.
- Cuando necesitas ver exactamente qué envió un proveedor, `trace` añade los datos en bruto y las consultas a la base de datos. Déjalo activado solo un rato.
