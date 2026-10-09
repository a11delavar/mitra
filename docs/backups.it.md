---
title: Backup
description: Tutto ciò che Mitra conserva sta in una sola cartella. Fanne il backup con lo strumento che usi già.
---

Mitra tiene tutto in una sola cartella: `/app/data` dentro il container, cioè `~/mitra` sull'host se hai seguito [Per iniziare](README.md#install-mitra). Fai il backup di quella cartella e hai fatto il backup dell'intera istanza. Non c'è nessun server di database da esportare e nessun file di configurazione da cercare.

> [!CAUTION]
> Per una parte di ciò che tieni in Mitra, questa cartella è l'unica copia. Ogni voce di un [calendario Mitra](integrations/mitra.md) vive qui e da nessun'altra parte. Lo stesso vale per i tuoi account e le sessioni di accesso, le credenziali degli account collegati, le tue impostazioni, i colori, l'ordine e i nomi dei calendari, la tua [disponibilità](availability.md), l'ordine delle attività, alcuni collegamenti tra le voci e la chiave da cui dipendono i [promemoria](reminders.md) dei tuoi dispositivi. Se perdi la cartella, un provider può restituirti i suoi eventi e le sue attività, ma nient'altro.

## Fai il backup

Punta alla cartella lo strumento che usi già: [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, uno snapshot del filesystem o della VM, oppure un semplice archivio.

La copia più sicura è quella fatta mentre Mitra è fermo:

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

Se non puoi fermarlo, copiare la cartella mentre Mitra è in esecuzione di solito va bene, perché SQLite se la cava bene. Uno snapshot del filesystem o della VM ti dà una copia coerente senza fermare nulla.

## Ripristina

Ferma Mitra, rimetti a posto la cartella e riavvialo:

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

Ripristina la cartella per intero. I suoi file vanno insieme, e mescolare file di giorni diversi può rovinare l'istanza. Un backup di una versione precedente si ripristina senza problemi su un'immagine più recente, perché Mitra aggiorna il suo database all'avvio.

## Cosa non copre un backup

Gli eventi e le attività degli account collegati, come un server [CalDAV](integrations/caldav.md), [Google Calendar](integrations/google.md) o [Notion](integrations/notion.md), restano presso quei provider. Un backup include la copia che Mitra ne tiene, e dopo un ripristino Mitra li sincronizza di nuovo.

Le tue variabili d'ambiente stanno nel tuo `compose.yaml` o nel file `.env`, non nella cartella dei dati. Conserva al sicuro anche quelli, nel controllo di versione o nel tuo archivio di segreti.
