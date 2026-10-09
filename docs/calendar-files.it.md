---
title: File di calendario
description: "Apri file .ics e link webcal:// con Mitra e rendilo l'app di calendario che il tuo computer usa per essi."
---

I file di calendario (`.ics`) e i link di iscrizione (`webcal://`) sono il modo in cui il web distribuisce gli eventi: un invito allegato a un'email, un pulsante «Aggiungi al calendario» su una pagina di prenotazione, un link «Iscriviti» per le partite di una squadra. Una volta installato, Mitra può aprire entrambi, e puoi renderlo l'app che il tuo computer usa per essi.

> [!NOTE]
> Aprire file e link richiede Mitra [installato come app](install-app.md) da un browser basato su Chromium su un computer, come Chrome, Edge, Brave o Opera. In qualsiasi browser puoi comunque trascinare un file `.ics` su Mitra.

## Rendere Mitra l'app predefinita

Installa prima Mitra. La prima volta che un file o un link di calendario lo apre, il browser può chiedere se Mitra può gestirlo: scegli **Consenti**. Poi di' al sistema di aprire i file `.ics` con Mitra.

Su Windows, fai clic con il tasto destro su un file `.ics` in Esplora file e scegli **Apri con → Scegli un'altra app**. Seleziona **Mitra**, poi **Sempre**. Puoi anche cambiarlo più tardi in **Impostazioni → App → App predefinite**.

Su macOS, fai Control-clic su un file `.ics` nel Finder e scegli **Ottieni informazioni**. In **Apri con**, seleziona **Mitra**, poi clicca **Cambia tutto…** e conferma.

Su Linux, fai clic con il tasto destro su un file `.ics` nel tuo file manager e apri **Proprietà → Apri con**. Seleziona **Mitra** e impostalo come predefinito.

Se Mitra è già aperto, un file o un link che apri va a quella finestra invece di aprirne una seconda.

## Aggiungere un file di calendario

Apri un file `.ics` con Mitra, oppure trascinalo su Mitra dal desktop o dal file manager. Il trascinamento funziona anche in una normale scheda del browser, senza installare nulla. Più file si aprono uno dopo l'altro.

Mitra chiede a quale calendario aggiungere le voci. Prima di aggiungere qualsiasi cosa, mostra ciò che quel calendario non può memorizzare: le voci che lascerebbe fuori e i dettagli che alcune voci perderebbero, come i promemoria in un calendario che non ne ha. Per procedere, premi il pulsante che indica quante voci vengono aggiunte, come **Aggiungi 12 voci**. Per scegliere un altro calendario, torna indietro con la freccia. Il file stesso non cambia mai.

Ogni voce viene aggiunta come nuova copia, quindi aggiungere due volte lo stesso file ti dà ogni voce due volte. Nulla di ciò che è già nel tuo calendario viene sovrascritto.

Le attività secondarie e le dipendenze tra voci dello stesso file restano collegate dopo l'importazione. Una serie ricorrente mantiene eliminate le sue occorrenze eliminate. Una serie con occorrenze modificate, come una riunione spostata a un altro giorno, viene lasciata fuori, perché Mitra non può aggiungere una serie insieme alle sue modifiche.

Se l'aggiunta fallisce a metà, Mitra rimuove le voci che aveva già aggiunto, così nulla del file resta importato a metà. Se non riesce a rimuoverne alcune, ti dice quante eliminarne a mano.

## Iscriversi da un link webcal

I siti che ti permettono di iscriverti a un calendario, come le partite sportive, i periodi scolastici o i giorni festivi, di solito rimandano a un indirizzo `webcal://`. Cliccane uno e Mitra apre il modulo **Abbonamento a un calendario** con l'indirizzo già compilato. Controllalo, compila **Nome utente (facoltativo)** e **Password (facoltativa)** se il feed li richiede, e premi **Connetti**. Poi attiva il calendario e premi **Salva**.

Cliccare il link non ti iscrive mai da solo: Mitra scarica il feed solo quando premi **Connetti**.

Un abbonamento è un calendario di sola lettura che Mitra tiene aggiornato dal feed. Vedi [Abbonamenti a un calendario](integrations/subscriptions.md) per come funziona.
