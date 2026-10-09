---
title: Installare l'app
description: "Installa Mitra come app su un computer, un telefono Android, un iPhone o un iPad, così si apre in una finestra tutta sua."
---

Mitra funziona nel tuo browser, e puoi anche installarlo come app. Non arriva nulla da un app store: il browser dà a Mitra una finestra e un'icona proprie, e lo apri dal dock, dalla barra delle applicazioni, dal menu Start o dalla schermata Home come qualsiasi altra app.

Installarlo conviene per tre motivi:

- Mitra si apre in una finestra propria, lontano dalle schede del browser, e le sue notifiche compaiono con il suo nome e la sua icona.
- Su un iPhone o un iPad è l'unico modo per avere i [promemoria](reminders.md).
- Su un computer, Mitra può aprire per te i file `.ics` e i link `webcal://`. Vedi [File di calendario](calendar-files.md).

L'app installata si chiama sempre Mitra e ha l'icona di Mitra, anche quando il tuo server dà all'istanza [un nome tutto suo](configuration.md#name-your-instance).

## Su un computer

In Chrome, Edge e altri browser basati su Chromium, apri Mitra e clicca l'icona di installazione in fondo alla barra degli indirizzi. Quando il browser offre di installare Mitra, la barra laterale mostra anche un pulsante **Installa come app** in fondo. Puoi anche passare dal menu del browser: in Chrome, **Trasmetti, salva e condividi → Installa pagina come app**, e in Edge, **App → Installa questo sito come app**.

In Safari su un Mac, scegli **File → Aggiungi al Dock**.

Una volta installato, Mitra si apre in una finestra propria. Se quella finestra è già aperta quando apri un file di calendario o un link, Mitra la porta in primo piano invece di aprirne una seconda.

## Su Android

Apri Mitra in Chrome, apri il menu del browser (**⋮**) e scegli **Installa app** o **Aggiungi a schermata Home**. Mitra compare poi insieme alle tue altre app.

I promemoria funzionano anche nel browser su Android, quindi installarlo dipende da te.

## Su iPhone e iPad

Apri Mitra in Safari, tocca il pulsante Condividi, poi **Aggiungi alla schermata Home**. Da allora in poi, apri Mitra dalla sua icona nella schermata Home.

Su iPhone e iPad, le notifiche funzionano solo nell'app installata, da iOS e iPadOS 16.4 in poi. Consentile dall'interno dell'app installata: Safari e l'app sono separati, e solo l'app può ricevere promemoria.

> [!NOTE]
> Se il tuo server sta dietro un reverse proxy che ti fa accedere con un cookie, l'installazione funziona comunque. Mitra richiede la descrizione della sua app (il web app manifest) con i tuoi cookie, così il proxy lascia passare la richiesta.
