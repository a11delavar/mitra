---
title: Copias de seguridad
description: Todo lo que guarda Mitra está en una sola carpeta. Haz su copia con la herramienta que ya uses.
---

Mitra guarda todo en una sola carpeta: `/app/data` dentro del contenedor, que es `~/mitra` en el host si seguiste [Primeros pasos](README.md#install-mitra). Haz una copia de esa carpeta y habrás copiado toda la instancia. No hay un servidor de base de datos que volcar ni archivos de configuración que buscar.

> [!CAUTION]
> Para parte de lo que guardas en Mitra, esta carpeta es la única copia. Cada entrada de un [calendario de Mitra](integrations/mitra.md) vive aquí y en ningún otro sitio. Lo mismo ocurre con tus cuentas y sesiones, las credenciales de las cuentas conectadas, tus ajustes, los colores, el orden y los nombres de tus calendarios, tu [disponibilidad](availability.md), el orden de tus tareas, algunos vínculos entre entradas y la clave de la que dependen los [recordatorios](reminders.md) de tus dispositivos. Si pierdes la carpeta, un proveedor puede devolverte sus eventos y tareas, pero nada más.

## Hacer la copia

Apunta a la carpeta con lo que ya uses: [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, una instantánea del sistema de archivos o de la máquina virtual, o un archivo comprimido sin más.

La copia más segura es la que se hace con Mitra detenido:

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

Si no puedes detenerlo, copiar la carpeta mientras Mitra funciona suele estar bien, ya que SQLite lo soporta sin problemas. Una instantánea del sistema de archivos o de la máquina virtual te da una copia consistente sin detener nada.

## Restaurar

Detén Mitra, vuelve a poner la carpeta y arráncalo de nuevo:

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

Restaura la carpeta entera. Sus archivos van juntos, y mezclar archivos de días distintos puede estropear la instancia. Una copia de una versión anterior se restaura sin problemas sobre una imagen más reciente, porque Mitra actualiza su base de datos al arrancar.

## Lo que una copia no cubre

Los eventos y las tareas de las cuentas conectadas, como un servidor [CalDAV](integrations/caldav.md), [Google Calendar](integrations/google.md) o [Notion](integrations/notion.md), viven con esos proveedores. La copia incluye la copia local que Mitra tiene de ellos, y tras restaurarla Mitra los vuelve a sincronizar.

Tus variables de entorno están en tu `compose.yaml` o en tu archivo `.env`, no en la carpeta de datos. Guárdalos también en un lugar seguro, en control de versiones o en tu almacén de secretos.
