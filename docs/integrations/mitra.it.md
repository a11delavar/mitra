---
title: Calendari Mitra
description: Calendari salvati in Mitra stesso, sul tuo server, senza alcun account dietro.
---

Un calendario Mitra è salvato nel database di Mitra invece che presso un provider. Non c'è nessun account da collegare e nulla da sincronizzare: crei un calendario e inizi ad aggiungere voci. È il modo più semplice per iniziare con Mitra, e un buon posto per tutto ciò che non appartiene a nessuno dei tuoi account esistenti.

I calendari Mitra stanno sul tuo server, non sul tuo dispositivo, quindi li ritrovi ovunque apri Mitra. Possono contenere tutto ciò che Mitra sa gestire: eventi e attività, ripetizioni, promemoria, [disponibilità](../availability.md), [attività secondarie](../subtasks.md), [dipendenze](../dependencies.md), scadenze e stime.

## Aggiungere calendari Mitra

1. Scegli **Aggiungi integrazione** in fondo alla barra laterale, poi **Mitra**.
2. Dai un nome al tuo primo calendario.
3. Premi **Salva**.

Il calendario è pronto subito. L'integrazione si aggiunge una sola volta: contiene tutti i calendari che vuoi, quindi dopo il suo riquadro sparisce da **Aggiungi integrazione**.

Per aggiungere un altro calendario, apri il menu **⋯** sull'intestazione Mitra nella barra laterale e scegli **Nuovo calendario**. Per eliminarne uno, scegli **Elimina calendario** dal menu **⋯** di quel calendario. Rinominare, cambiare colore, riordinare e nascondere funzionano come per qualsiasi calendario; vedi [Calendari](../calendars.md).

> [!CAUTION]
> Eliminare un calendario Mitra elimina per sempre tutte le sue voci, perché non c'è nessun provider da cui recuperarle. Mitra chiede conferma prima, e ti offre di [spostare le voci](../calendars.md#move-or-copy-every-entry-to-another-calendar) in un altro calendario prima di eliminare qualsiasi cosa.

## Spostare le voci dentro e fuori

Le voci passano da un calendario Mitra a qualsiasi altro calendario. Per spostarne una, scegli un altro calendario nel suo editor. Per spostare un intero calendario, usa **⋯ → Sposta le voci in…**, che mostra prima ciò che la destinazione non può salvare.

Funziona anche al contrario: puoi iniziare in Mitra e spostare tutto in un calendario CalDAV o Google più avanti.

## Farne il backup

Un account collegato conserva una sua copia delle tue voci. Un calendario Mitra no: le sue voci esistono solo nel database di Mitra. Assicurati che la cartella dei dati di Mitra faccia parte dei tuoi [backup](../backups.md).

Se pensi di attivare più avanti l'[accesso con account](../sso.md), sappi che fa partire tutti con un account nuovo e vuoto. I calendari Mitra che avevi creato prima restano con il vecchio account singolo.

## Cosa non possono fare

- I partecipanti sono conservati come semplice registro di chi è coinvolto, ma nessuno riceve un invito e non arriva nessuna risposta, perché non c'è un server di calendari che li invii. Se sposti qui una riunione da un calendario CalDAV, l'originale viene eliminato lì, e alcuni server avvisano allora i partecipanti che è stata annullata. Copiala invece, se non devono saperlo.
- Le altre app non possono vederli. Mitra non pubblica i suoi calendari via CalDAV, quindi usa un server [CalDAV](caldav.md) per i calendari che vuoi avere anche nell'app calendario del telefono.
- Non c'è nulla da reimportare, quindi **Reimporta voci** non viene offerto.
