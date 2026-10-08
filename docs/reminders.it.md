---
title: Promemoria
description: Aggiungi promemoria a eventi e attività, scegli i promemoria con cui partono le nuove voci e gestisci i dispositivi che li ricevono.
---

Un promemoria ti avvisa di un evento o di un'attività in anticipo, come notifica del tuo sistema, anche quando Mitra non è aperto. Arriva dal tuo server Mitra, quindi non c'è nessun altro servizio a cui iscriversi. Su un iPhone o un iPad, i promemoria richiedono Mitra [installato come app](install-app.md); ovunque altrove basta il browser.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/notifications-detail-dark.webp">
  <img src="../assets/screenshots/notifications-detail-light.webp" alt="La pagina delle impostazioni Notifiche, con i promemoria predefiniti, il permesso del browser e l'elenco dei dispositivi" />
</picture>

## Aggiungere un promemoria

Apri una voce e premi **＋** sulla sua riga dei promemoria, quella con la campanella. Scegli quando deve scattare: **All'inizio dell'evento** (**All'ora dell'attività** per un'attività), 5 o 10 minuti, mezz'ora, un'ora o un giorno prima, oppure **Personalizzato…** per qualsiasi altro momento. Una voce può averne diversi, e la **✕** accanto a uno lo rimuove.

Un promemoria conta a ritroso dall'inizio della voce o, per un'attività senza inizio, dalla sua data di scadenza. La prima volta che ne aggiungi uno, il browser chiede se Mitra può mostrare notifiche. Se rispondi di no, il promemoria viene comunque salvato con la voce.

Una voce ricorrente ti ricorda ogni occorrenza. Le attività che hai segnato come fatte o annullate restano in silenzio, ma un calendario che nascondi no: per silenziarlo, disattivalo in **⋯ → Modifica** del suo account. I calendari [Notion](integrations/notion.md) e [Tempo](integrations/tempo.md) non possono contenere promemoria.

## Promemoria predefiniti

**Impostazioni → Notifiche** definisce i promemoria con cui partono le nuove voci: 30 minuti prima per un evento, e all'ora dell'attività per un'attività, a meno che tu non li cambi o scelga **Nessuno**. Le voci di tutto il giorno partono senza promemoria.

## Quando scatta un promemoria

La notifica mostra il titolo della voce, quando è e il suo luogo, nella lingua e nel fuso orario del dispositivo. Resta finché non la chiudi, e toccarla apre la voce. **Tra 10 min** la riporta più tardi e, su un'attività, **Fatto** la segna come fatta senza aprire Mitra. Safari e Firefox non mostrano questi pulsanti.

Un dispositivo che era offline quando è partito un promemoria lo scarta cinque minuti dopo l'inizio della voce, invece di mostrarlo in ritardo.

## I tuoi dispositivi

Ogni browser o app installata in cui consenti le notifiche è un dispositivo, e ogni dispositivo riceve tutti i tuoi promemoria. **Impostazioni → Notifiche** li elenca, con quello che stai usando contrassegnato come **questo dispositivo**. Rinominane uno con la matita, rimuovine uno con la **✕**, e invia a te stesso un esempio con **Evento di prova** o **Attività di prova**.

## Risoluzione dei problemi

- Se un promemoria non arriva, invia un **Evento di prova**. Se la prova arriva, la voce è probabilmente in un calendario disattivato. Il permesso vale per browser e per indirizzo, quindi consentire Mitra a un indirizzo non copre un altro.
- Se in **Impostazioni → Notifiche** non c'è la riga **Notifiche dei promemoria**, questo browser non può ricevere notifiche da Mitra: su un iPhone o un iPad, apri l'[app installata](install-app.md) invece di Safari, e ovunque altrove Mitra deve essere servito tramite HTTPS.
- Se la riga indica **Bloccate**, consenti le notifiche per Mitra nelle impostazioni del sito del browser.
- Se non arriva nulla su Windows mentre Chrome è chiuso, attiva **Continue running background apps when Google Chrome is closed** nelle impostazioni di Chrome, oppure installa Mitra da Edge.

## Sul server

I promemoria non richiedono configurazione, solo [HTTPS](configuration.md#put-it-behind-https). Mitra firma le sue notifiche con una chiave che crea al primo avvio e conserva nel suo database, quindi ripristina la cartella dei dati per intero dai tuoi [backup](backups.md): su un database nuovo, Mitra crea una nuova chiave, e i dispositivi registrati con la vecchia smettono di ricevere promemoria. I [log](logging.md) registrano ogni promemoria man mano che parte.
