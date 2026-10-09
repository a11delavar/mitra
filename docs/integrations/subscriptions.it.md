---
title: Abbonamenti a calendari
description: Abbonati a un link di calendario pubblicato, come un indirizzo webcal:// o un feed .ics, e vedi le sue voci in Mitra, in sola lettura.
---

Molti calendari sono pubblicati anziché condivisi: festività pubbliche, calendari sportivi, calendari scolastici, un feed di uno strumento di lavoro, o l'indirizzo privato del tuo calendario Google o Outlook. A questi non si accede con un account. Ti ci abboni con un link.

Un **abbonamento a un calendario** porta uno di questi link in Mitra come calendario a sé, con i suoi eventi e, se ne ha, le sue attività.

Gli abbonamenti sono in sola lettura. Il feed sta su un altro server, che non accetta modifiche, quindi Mitra mostra ciò che pubblica e non scrive mai di ritorno. Puoi comunque rinominare, cambiare colore, riordinare e nascondere il calendario; vedi [Calendari in sola lettura](../calendars.md#read-only-calendars). Per tenere una copia delle sue voci che puoi modificare, usa **Copia le voci in…** nel suo menu **⋯**.

## Abbonarsi a un calendario

1. Scegli **Aggiungi integrazione** in fondo alla barra laterale, poi **Abbonamento a un calendario**.
2. Incolla il link in **URL del calendario**. È un indirizzo `webcal://`, come lo danno spesso i pulsanti «Iscriviti», oppure un indirizzo `https://`, di solito che termina in `.ics`.
3. Lascia vuoti **Nome utente (facoltativo)** e **Password (facoltativa)**, a meno che il feed non li richieda (vedi [feed con password](#feeds-with-a-password)).
4. Premi **Connetti**. Mitra legge il feed ed elenca il suo calendario.
5. Lascialo attivo e premi **Salva**.

Un link è un calendario. Per abbonarti a più calendari, aggiungi un abbonamento per ciascuno.

Il calendario prende il nome dal feed, e anche il colore, se il feed ne ha uno. Puoi rinominarlo nella barra laterale, e il tuo nome resta finché non è il feed stesso a rinominare il calendario.

Se hai [reso Mitra la tua app di calendario predefinita](../calendar-files.md), fare clic su un link `webcal://` in una pagina web apre questo modulo con il link già inserito.

### Dove trovare il link di un calendario

| Provider | Dove cercare |
| --- | --- |
| Google Calendar | Nelle impostazioni del calendario, **Integrate calendar** → **Secret address in iCal format** |
| Outlook e Microsoft 365 | **Share** → **Publish a calendar**, poi copia il link ICS |
| iCloud | Clic destro sul calendario → **Share Calendar** → **Public Calendar** |
| Nextcloud | Il menu **⋯** del calendario → **Copy subscription link** |
| Calendari pubblici | La maggior parte dei siti di festività, sport e scuole offre un link `.ics` |

> [!CAUTION]
> Un indirizzo segreto è una password sotto forma di link: chiunque lo abbia può leggere il calendario. Tienilo per te e reimpostalo nelle impostazioni del tuo provider se mai dovesse trapelare.

### Feed con password

La maggior parte dei feed pubblicati porta la propria chiave di accesso nel link stesso e non richiede altro. Se un feed, ad esempio su un server aziendale o self-hosted, chiede nome utente e password (autenticazione HTTP Basic), inseriscili quando ti abboni. Mitra conserva la password sul server e non la rimanda mai al tuo browser.

## Come resta aggiornato

Mitra sincronizza ogni abbonamento ogni 15 minuti, che qualcuno abbia Mitra aperto o no, quindi aprire Mitra non scarica un feed prima (vedi [come funziona la sincronizzazione](README.md#how-syncing-works)). Una sincronizzazione costa poco: Mitra chiede al server del feed se qualcosa è cambiato e scarica il calendario solo in quel caso.

Il calendario rispecchia il feed. Le voci aggiunte al feed compaiono in Mitra, e quelle rimosse spariscono.

Se il calendario ti sembra sbagliato, **Reimporta voci** nel suo menu **⋯** rilegge il feed dall'inizio. Il feed stesso non viene mai toccato. Vedi [Reimportare un calendario](../calendars.md#re-import-a-calendar).

## Risoluzione dei problemi

- Se Mitra dice «The calendar requires a username and password», il feed è protetto. Inserisci il nome utente e la password richiesti.
- Se Mitra dice «No calendar was found at that address», controlla che nel link non ci siano errori di battitura. Un indirizzo segreto smette di funzionare anche quando il suo proprietario lo reimposta.
- Se Mitra dice «The address did not return a calendar», il link porta a una pagina web anziché al feed. Cerca un link con la dicitura iCal, ICS o Subscribe.
- Se Mitra dice «The calendar is too large to subscribe to», il feed supera i 20 MB, che Mitra non legge.
