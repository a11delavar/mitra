---
title: Partecipanti
description: "Aggiungi le persone coinvolte in una voce e segui le loro risposte. Se ricevono un invito dipende dal calendario."
---

Una voce può avere dei **partecipanti**: le persone coinvolte. Mitra li salva con la voce nel formato standard dei calendari, così ogni altra app che usa lo stesso calendario vede lo stesso elenco, e le risposte date in Apple Calendar, Thunderbird o in una webmail compaiono anche in Mitra.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/participants-detail-dark.webp">
  <img src="../assets/screenshots/participants-detail-light.webp" alt="Una voce con tre partecipanti, le cui risposte sono mostrate come badge sui loro avatar" />
</picture>

## Chi invia gli inviti

Mitra non invia mai email da sé. Cosa succede quando aggiungi qualcuno dipende dal calendario in cui si trova la voce.

Quando la voce è in un calendario di un [server di calendario](integrations/caldav.md), di [Google Calendar](integrations/google.md) o di [Apple Calendar](integrations/apple.md), è quel server a inviare: l'invito, un aggiornamento quando la voce cambia e un annullamento quando rimuovi qualcuno o elimini la voce. Raccoglie anche le risposte, ed è così che arrivano a Mitra. La maggior parte dei server lo fa, compresi Google, iCloud, Nextcloud, Fastmail, mailbox.org e Zimbra. Un server che si limita a memorizzare i calendari non invia nulla, quindi nessuno viene a sapere della voce e ogni risposta resta in sospeso.

In un [calendario Mitra](integrations/mitra.md) non c'è nessun server dietro il calendario, quindi l'elenco è solo un registro di chi è coinvolto. Nessuno viene invitato e non arrivano risposte.

I calendari [Notion](integrations/notion.md) e [Tempo](integrations/tempo.md) non possono contenere partecipanti, quindi le loro voci non hanno la riga dei partecipanti. In un [abbonamento a un calendario](integrations/subscriptions.md) puoi vedere i partecipanti ma non modificarli, perché il calendario è di sola lettura.

## Aggiungere persone

Apri la voce, scrivi un indirizzo email in **Aggiungi partecipanti** e premi Invio. Puoi aggiungerne più di uno insieme, separati da virgole, punti e virgola o spazi. Per aggiungerne altri più tardi, premi **＋** accanto al conteggio dei partecipanti.

In un calendario con un account dietro, la prima persona che aggiungi ti rende l'**organizzatore**: il tuo indirizzo entra nell'elenco, contrassegnato come **Organizzatore**, come accettato. Un calendario Mitra non ha un tuo indirizzo da usare, quindi i suoi elenchi non hanno un organizzatore.

Ogni persona compare con la sua iniziale, la sua email, il suo nome se il calendario lo conosce, e **Organizzatore** o **Facoltativo** quando si applica. Le email sono selezionabili, così puoi copiare un singolo indirizzo dalla sua riga. Quando l'elenco ha più di cinque persone, mostra le prime quattro e ripiega le altre dietro una riga «altri».

Punta una persona per modificarla. Un pulsante la segna come facoltativa, o di nuovo come obbligatoria, e la **✕** la rimuove. Su uno schermo touch, questi pulsanti sono sempre visibili.

## Risposte

Un badge sull'iniziale di ogni persona mostra la sua risposta: un segno di spunta verde per accettato, una croce rossa per rifiutato e un trattino giallo per provvisorio. Nessun badge significa nessuna risposta finora. Una riga sotto il conteggio le riassume, come «2 sì, 1 no, 3 in attesa».

Le risposte arrivano a Mitra tramite il server di calendario, quindi una nuova compare alla sincronizzazione successiva, non all'istante.

Mitra mostra la risposta di tutti ma non invia la tua. Per accettare o rifiutare un invito inviato da qualcun altro, rispondi nella tua app di posta o in un'altra app di calendario, e la tua risposta si sincronizza con Mitra.

## Agire su tutti

Il menu **⋯** accanto al conteggio agisce sull'intero elenco:

- **Invia email ai partecipanti** apre la tua app di posta con un'email a tutti gli altri.
- **Copia le email dei partecipanti** copia ogni indirizzo.
- **Segna tutti come obbligatori** e **Segna tutti come facoltativi** cambiano il ruolo di tutti insieme.
- **Rimuovi tutti** svuota l'elenco.

## Solo l'organizzatore modifica l'elenco

In una voce organizzata da qualcun altro non puoi aggiungere, rimuovere o modificare persone: la **＋** è nascosta e il menu permette solo di inviare email e copiare. È la regola dello standard di pianificazione che le app di calendario seguono, e anche il server di Mitra rifiuta una modifica del genere. Puoi comunque modificare il resto della voce, come titolo, orario e descrizione.

> [!CAUTION]
> Spostare una voce con partecipanti in un altro calendario la elimina dal primo, e alcuni server comunicano poi ai partecipanti che è stata annullata. [Copiala](calendars.md#move-or-copy-every-entry-to-another-calendar) invece, se non devono saperlo.

## Risoluzione dei problemi

- Se tutti restano in attesa e non è arrivato nessun invito, la voce è in un calendario Mitra, oppure il suo server di calendario non invia inviti. Per verificare il server, invita le stesse persone dall'app del provider.
- Se è arrivata una risposta ma il suo badge non è cambiato, attendi la prossima sincronizzazione di Mitra, perché le risposte arrivano tramite il server di calendario.
- Se non c'è modo di aggiungere persone, la voce è organizzata da qualcun altro, oppure il calendario è di sola lettura.
- Se la voce non ha la riga dei partecipanti, il suo calendario non può contenere partecipanti, come in Notion e Tempo.
- Se una sala riunioni manca dall'elenco, è voluto: sale e attrezzature non sono persone, quindi Mitra le esclude.
