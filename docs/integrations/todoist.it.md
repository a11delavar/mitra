---
title: Todoist
description: Porta i tuoi progetti Todoist in Mitra come calendari di attività che si sincronizzano in entrambe le direzioni.
---

Mitra si collega a Todoist per le attività. Ognuno dei tuoi progetti Todoist diventa in Mitra un calendario che contiene le sue attività. Titolo, descrizione, date e completamento di un'attività si sincronizzano in entrambe le direzioni.

Ti colleghi dall'app con il tuo token API. Non c'è niente da configurare sul server.

## Collegare un account

1. In Todoist, apri **Impostazioni** → **Integrazioni** → **Sviluppatore** e copia il tuo token API.
2. In Mitra, scegli **Aggiungi integrazione** in fondo alla barra laterale, poi **Todoist**, e incolla il token in **Token API Todoist**.
3. Premi **Connetti**. Mitra elenca i tuoi progetti, ciascuno con il suo colore di Todoist. Un progetto dentro un altro prende il nome di entrambi, come "Lavoro · Lancio".
4. Scegli i progetti che vuoi, poi premi **Salva**.

Puoi collegare più di un account Todoist. I progetti archiviati non vengono elencati.

## Cosa si sincronizza

Titolo, descrizione e completamento si sincronizzano in entrambe le direzioni, e così le date:

| In Todoist | In Mitra |
| --- | --- |
| Data | La pianificazione dell'attività: un giorno o un orario |
| Durata | Per quanto tempo l'attività è pianificata, oppure la sua [stima](../planning.md#set-an-estimate) finché non ha una data |
| Scadenza | La sua [data di scadenza](../planning.md#set-a-due-date) |
| Sotto-attività | Un'[attività secondaria](../subtasks.md) |

Un'attività senza data aspetta nell'elenco **Non pianificate** della [scheda Pianificazione](../planning.md#the-planning-tab). Le attività che hai completato nelle ultime dodici settimane arrivano quando ti colleghi, e dopo ogni completamento.

Todoist tiene un orario o fluttuante, lo stesso su ogni orologio ovunque tu sia, o fisso in un fuso orario. Mitra li tiene entrambi come sono: un orario fluttuante resta [lo stesso ovunque](../time-zones.md#same-time-everywhere), e uno fisso mantiene il suo fuso.

Le scadenze e le durate fanno parte dei piani Pro e Business di Todoist. Con un account gratuito, le attività Todoist non hanno data di scadenza, fine né stima in Mitra: un'attività con un orario è un momento, e un'attività su un giorno occupa solo quel giorno. Quando il tuo piano cambia, ad esempio quando un periodo di prova inizia o finisce, Mitra rilegge tutte le attività. Una scadenza è un giorno, quindi una data di scadenza a cui dai un orario in Mitra mantiene solo il giorno.

Mitra non mostra la priorità, le etichette, la sezione, i commenti né i promemoria di un'attività, e li lascia come sono in Todoist. Spostare un'attività in un altro calendario Todoist la sposta in quel progetto, e li mantiene tutti.

Per aprire un'attività in Todoist, scegli **Apri in Todoist** nel menu **⋯** dell'editor. Eliminare un'attività in Mitra la elimina in Todoist.

Todoist limita la frequenza con cui le app possono interrogarlo, quindi Mitra lo sincronizza circa una volta al minuto (vedi [come funziona la sincronizzazione](README.md#how-syncing-works)).

## Attività ricorrenti

Un'attività che si ripete in Todoist appare alla sua prossima data, come la tiene Todoist, senza la sua regola. Completarla in Mitra la completa in Todoist, che la porta alla data successiva, come fa sempre. Spostarla in un altro giorno cambia solo la sua prossima data, e la sua regola resta com'è. Per cambiare la regola, modifica l'attività in Todoist.

## Cosa resta in Mitra

Todoist non ha dipendenze, quindi le [dipendenze](../dependencies.md) tra attività Todoist restano solo in Mitra. Si perdono se scolleghi l'account o [reimporti un calendario](../calendars.md#re-import-a-calendar). L'attività principale di un'attività secondaria resta in entrambi, purché sia un'attività dello stesso account Todoist. Todoist sposta allora l'attività secondaria nel progetto della sua attività principale.

## Cosa Todoist non può contenere

- Contiene solo attività, quindi niente eventi e niente [disponibilità](../availability.md).
- Un'attività è aperta o fatta, quindi non esistono gli stati **In corso** e **Annullato**. Un'attività in corso altrove torna **Da fare** quando la sposti in Todoist.
- Non puoi far ripetere un'attività da Mitra.
- In Mitra un'attività non ha promemoria, luogo, partecipanti, allegati, avanzamento, occupato o libero, né visibilità.

Mitra nasconde questi campi nelle attività Todoist, così niente di ciò che scrivi lì sparisce alla sincronizzazione successiva. Per spostare in Todoist voci che li usano, vedi [Spostare o copiare tutte le voci in un altro calendario](../calendars.md#move-or-copy-every-entry-to-another-calendar), che mostra prima cosa non arriverebbe.

## Risoluzione dei problemi

- Se Mitra dice che Todoist ha rifiutato il token API, copialo di nuovo da **Impostazioni** → **Integrazioni** → **Sviluppatore**. Se l'hai reimpostato in Todoist, apri **⋯ → Modifica** dell'account in Mitra e incolla quello nuovo.
- Se manca un progetto, forse è archiviato. Dopo averlo ripristinato in Todoist, apri **⋯ → Modifica** dell'account in Mitra e premi **Aggiorna**.
