---
title: Apple Calendar
description: Collega i tuoi calendari iCloud a Mitra con una password specifica per l'app, senza nulla da configurare sul server.
---

Mitra si collega ai tuoi calendari iCloud via CalDAV e ne sincronizza gli eventi in entrambe le direzioni. Apple non permette ad altre app di accedere con la tua password Apple, quindi prima crei una password specifica per l'app per Mitra. Ci vuole un minuto, e sul server non c'è nulla da configurare.

## Creare una password specifica per l'app

1. Accedi su [appleid.apple.com](https://appleid.apple.com/).
2. Sotto **Sign-In and Security**, scegli **App-Specific Passwords**.
3. Crea una nuova password, chiamala «Mitra» per riconoscerla in seguito, e copiala.

Apple offre le password specifiche per l'app solo se per il tuo account è attiva l'autenticazione a due fattori.

## Collegare il tuo account

1. Scegli **Aggiungi integrazione** in fondo alla barra laterale, poi **Apple Calendar**.
2. Inserisci il tuo **ID Apple**, l'indirizzo email con cui accedi ad Apple, e la **Password specifica per l'app** che hai creato per Mitra.
3. Premi **Connetti**. Mitra elenca i tuoi calendari iCloud, tutti attivi.
4. Disattiva quelli che non vuoi, poi premi **Salva**.

Mitra importa i calendari che hai tenuto e li sincronizza ogni 10 secondi mentre lo hai aperto (vedi [come funziona la sincronizzazione](README.md#how-syncing-works)).

## Cosa si sincronizza

Gli eventi si sincronizzano in entrambe le direzioni, con tutto ciò che trasporta [CalDAV](caldav.md#what-syncs).

> [!NOTE]
> Le attività sono diverse. Le attività che Mitra salva in un calendario iCloud vengono conservate in iCloud, e le altre app CalDAV possono leggerle, ma l'app Promemoria di Apple non le mostra. Promemoria ha smesso di usare CalDAV con iOS 13, e Apple non offre alle app come Mitra nessun altro accesso.

La [disponibilità](../availability.md) che contrassegni come occupato in un calendario iCloud viene aggiunta a quel calendario come eventi occupati, così il tempo risulta impegnato sul tuo iPhone e a chiunque ti inviti. Funziona come descritto per [CalDAV](caldav.md#busy-availability).

## Scollegare il tuo account

Scegli **Elimina** nel menu **⋯** dell'account nella barra laterale per rimuoverlo da Mitra. Per revocare l'accesso di Mitra anche dal lato di Apple, elimina la password «Mitra» nella pagina **Sign-In and Security** in cui l'hai creata. La tua password Apple e le tue altre app non ne risentono.

## Risoluzione dei problemi

- Se il collegamento non riesce per via della password, controlla di aver inserito la password specifica per l'app, non la tua password Apple.
- Se manca un calendario, è disattivato. Attivalo da **⋯ → Modifica** dell'account e premi **Salva**.
