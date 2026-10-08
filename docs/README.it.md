---
title: Per iniziare
description: Installa Mitra con Docker Compose, ottieni il tuo primo calendario e prova qualche funzione.
sidebar:
  label: Per iniziare
---

Mitra è un calendario self-hosted per i tuoi eventi e le tue attività. Se vuoi prima dare un'occhiata, [prova la demo](https://demo.mitracal.com).

## Installa Mitra

Con [Docker](https://docs.docker.com/get-docker/) e il suo plugin Compose, crea un file `compose.yaml`:

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

Esegui `docker compose up -d` e apri [http://localhost:3000](http://localhost:3000).

Prima di farci affidamento, fai un [backup](backups.md) di `~/mitra` e [mettilo dietro HTTPS](configuration.md#put-it-behind-https). Se lo useranno anche altri, attiva prima l'[accesso](sso.md): attivarlo dopo fa ripartire tutti da un account vuoto.

## Ottieni un calendario

Mitra ti propone di aggiungerne uno al primo avvio: un [calendario Mitra](integrations/mitra.md) salvato sul tuo server, oppure un account che hai già, come [CalDAV](integrations/caldav.md) o [Google Calendar](integrations/google.md).

## Da provare

- Trascina su un'ora vuota nella [vista settimanale](views/week.md) per creare un evento.
- Premi **Aggiungi attività** nella scheda [Pianificazione](planning.md) della barra laterale, e più tardi trascina l'attività nella tua settimana.
- Premi <kbd>/</kbd> ed esegui **Aggiungi disponibilità** per colorare i tuoi [orari di lavoro](availability.md).
- [Installa Mitra sul telefono](install-app.md) per ricevere i [promemoria](reminders.md).
- Premi <kbd>?</kbd> per vedere tutte le [scorciatoie da tastiera](shortcuts.md).
