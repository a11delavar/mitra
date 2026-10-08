---
title: Primeros pasos
description: Instala Mitra con Docker Compose, consigue tu primer calendario y prueba algunas cosas.
sidebar:
  label: Primeros pasos
---

Mitra es un calendario autoalojado para tus eventos y tus tareas. Si quieres echar un vistazo antes, [prueba la demo](https://demo.mitracal.com).

## Instala Mitra

Con [Docker](https://docs.docker.com/get-docker/) y su plugin Compose, crea un `compose.yaml`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
```

Ejecuta `docker compose up -d` y abre [http://localhost:3000](http://localhost:3000).

Antes de depender de él, [haz una copia de seguridad](backups.md) de `~/mitra` y [ponlo detrás de HTTPS](configuration.md#put-it-behind-https). Si lo van a usar más personas, activa primero el [inicio de sesión](sso.md), porque activarlo más tarde hace que todos empiecen de cero con una cuenta vacía.

## Consigue un calendario

Mitra te ofrece añadir uno la primera vez que lo abres: un [calendario de Mitra](integrations/mitra.md) guardado en tu servidor, o una cuenta que ya tengas, como [CalDAV](integrations/caldav.md) o [Google Calendar](integrations/google.md).

## Cosas que probar

- Arrastra sobre una hora vacía en la [vista Semana](views/week.md) para crear un evento.
- Pulsa **Añadir tarea** en la pestaña [Planificación](planning.md) de la barra lateral y arrastra la tarea a tu semana más tarde.
- Pulsa <kbd>/</kbd> y ejecuta **Añadir disponibilidad** para sombrear tu [horario de trabajo](availability.md).
- [Instala Mitra en tu teléfono](install-app.md) para recibir [recordatorios](reminders.md).
- Pulsa <kbd>?</kbd> para ver todos los [atajos de teclado](shortcuts.md).
