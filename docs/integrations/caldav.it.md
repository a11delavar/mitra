---
title: CalDAV
description: Collega qualsiasi server CalDAV, come Nextcloud, Radicale, Fastmail o mailbox.org, e sincronizza i suoi eventi e le sue attività in entrambe le direzioni.
---

CalDAV è lo standard aperto che parlano la maggior parte dei server di calendari. Colleghi un account CalDAV dall'app, senza nulla da configurare sul server, e Mitra ne sincronizza eventi e attività in entrambe le direzioni.

I tuoi calendari restano sul tuo server, quindi ogni altra app CalDAV che usi, come il calendario del telefono, vede le stesse voci. È questa la differenza rispetto ai [calendari Mitra](mitra.md), che solo Mitra può aprire.

## Collegare un account

1. Scegli **Aggiungi integrazione** in fondo alla barra laterale, poi **CalDAV**.
2. Compila il modulo:
   - **URL del server** è l'indirizzo CalDAV del tuo server, come `https://caldav.example.com`. La [tabella qui sotto](#server-urls-for-common-providers) lo elenca per i provider più comuni.
   - **Nome utente** di solito è il nome del tuo account o il tuo indirizzo email.
   - **Password** è la password del tuo account, o una password per le app se il tuo provider te ne dà una.
3. Premi **Connetti**. Mitra elenca i calendari dell'account, tutti attivi, e dice cosa contiene ciascuno, ad esempio «Eventi · Attività».
4. Disattiva quelli che non vuoi, poi premi **Salva**.

Mitra importa i calendari che hai tenuto e poi li sincronizza ogni 10 secondi mentre lo hai aperto (vedi [come funziona la sincronizzazione](README.md#how-syncing-works)).

Per cambiare la password più tardi, apri il menu **⋯** dell'account nella barra laterale, scegli **Modifica**, digita la nuova password e premi **Salva**. L'URL del server e il nome utente restano quelli che sono; per un altro account, collegalo a parte.

## URL del server per i provider più comuni

Dai a Mitra l'indirizzo CalDAV del provider, e da lì trova i calendari.

| Provider | URL del server |
| --- | --- |
| Nextcloud | `https://<your-nextcloud>/remote.php/dav` |
| Radicale | `https://<your-radicale>/` (oppure `.../<user>/`) |
| Fastmail | `https://caldav.fastmail.com/` |
| mailbox.org | `https://dav.mailbox.org/` |
| Baïkal | `https://<your-baikal>/dav.php` |

Anche Google Calendar e iCloud parlano CalDAV, ma non accettano la tua password normale: Google ti fa accedere dalla propria pagina, e Apple richiede una password specifica per l'app. Usa invece i loro riquadri, come descritto in [Google Calendar](google.md) e [Apple Calendar](apple.md).

## Cosa si sincronizza

Ogni calendario sul server è un calendario in Mitra. Contiene eventi, attività o entrambi, a seconda di quanto permette il server. La maggior parte dei server permette entrambi; in un calendario che ne accetta uno solo, le nuove voci sono sempre di quel tipo.

Tutto ciò che Mitra salva di una voce si sincronizza, nella misura in cui il tuo server lo conserva:

- Voci di tutto il giorno e di più giorni, luoghi, descrizioni, colori e promemoria.
- Se una voce risulta come occupato o disponibile, e la sua visibilità.
- Lo stato e l'avanzamento di un'attività.
- I [partecipanti](../participants.md). Il tuo server invia gli inviti e raccoglie le risposte.
- [Attività secondarie](../subtasks.md) e [dipendenze](../dependencies.md).

Una voce ricorrente resta una sola serie sul server. Quando modifichi una singola occorrenza, Mitra ti chiede se intendi **Questa voce**, **Questa e le voci seguenti** o **Tutte le voci**, e modifica la serie di conseguenza.

Un'attività mantiene la sua pianificazione, la sua [scadenza e la sua stima](../planning.md#schedule-constraints-and-planning). Se ti interessa come: l'inizio viene salvato come `DTSTART`, la durata della pianificazione (o la stima, finché l'attività non è pianificata) come `ESTIMATED-DURATION`, e la scadenza come `DUE`, così le altre app vedono l'inizio e la scadenza. Un'attività che un'altra app, o una versione precedente di Mitra, ha salvato con un inizio e un `DUE` ma senza durata viene letta come pianificata dall'uno all'altro, senza scadenza.

I calendari condivisi con te in sola visualizzazione sono contrassegnati come in sola lettura. Puoi comunque rinominarli, cambiarne il colore, riordinarli e nasconderli; vedi [Calendari in sola lettura](../calendars.md#read-only-calendars).

## Disponibilità come occupato

La [disponibilità](../availability.md) che contrassegni come **Occupato** viene aggiunta al suo calendario come eventi occupati, così il tempo risulta impegnato sul tuo telefono e a chiunque ti inviti. Non c'è nulla da configurare.

- Ogni disponibilità occupata diventa un evento ricorrente con gli stessi orari e la stessa regola di ripetizione, contrassegnato come occupato. Prende il nome della disponibilità, o «Occupato» se non ne ha uno, e ne riprende il luogo e la visibilità, ad esempio **Privato**.
- Dentro Mitra vedi la disponibilità stessa invece di questi eventi, così il tempo non compare due volte.
- Mitra mantiene gli eventi allineati alla tua disponibilità. Se uno viene modificato, spostato o eliminato in un'altra app, Mitra lo rimette a posto alla sincronizzazione successiva.
- Contrassegnare di nuovo la disponibilità come **Disponibile**, eliminarla, disattivare il suo calendario o eliminare l'account rimuove gli eventi. Spostare la disponibilità in un altro calendario sposta con sé i suoi eventi.
- Un calendario che contiene solo attività, o uno in cui non puoi scrivere, non riceve eventi.

> [!NOTE]
> Le modifiche a un singolo giorno di disponibilità occupata non vengono riportate. L'evento continua a seguire la regola di ripetizione, quindi un giorno che hai spostato o accorciato mostra comunque agli altri il suo orario abituale.

Funziona allo stesso modo per [Google Calendar](google.md) e [Apple Calendar](apple.md), che Mitra collega anch'essi via CalDAV.

## Risoluzione dei problemi

- Se manca un calendario, è disattivato. Succede ai calendari che hai disattivato al momento del collegamento, e a quelli creati dopo sul server, che Mitra aggiunge disattivati. Attivalo da **⋯ → Modifica** dell'account e premi **Salva**. **Aggiorna** lì elenca i calendari creati sul server dall'ultima sincronizzazione.
- Se Mitra dice «This account is already connected», l'account è già nella tua barra laterale. Modificalo invece da **⋯ → Modifica**, ad esempio per inserire una nuova password.
- Se il collegamento non riesce, controlla che l'URL del server inizi con `https://` e punti all'indirizzo CalDAV, non alla pagina web in cui accedi. Per vedere ogni richiesta che Mitra fa al server, imposta il [livello di log](../logging.md) su `debug`.
- Se un calendario ti sembra sbagliato dopo aver aggiornato Mitra, usa **Reimporta voci** nel suo menu **⋯**. La sincronizzazione scarica solo ciò che è cambiato sul server, quindi le voci rimaste uguali non vengono più rilette; una reimportazione le legge tutte. Vedi [Reimportare un calendario](../calendars.md#re-import-a-calendar).
