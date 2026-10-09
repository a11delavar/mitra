---
title: Ripetizioni
description: "Fai ripetere una voce, modifica o elimina una singola occorrenza o l'intera serie, e scopri quali calendari possono contenere ripetizioni."
---

Una voce ricorrente è una sola voce con una regola di ripetizione, come una riunione di team ogni lunedì o l'affitto da pagare il 1° di ogni mese. Questa pagina chiama l'insieme una serie, e ciascuna delle sue date un'occorrenza. Ogni occorrenza mostra una piccola icona di ripetizione nelle viste.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-detail-dark.webp">
  <img src="../assets/screenshots/repeat-detail-light.webp" alt="L'editor di una riunione settimanale del team con l'elenco Ripeti aperto: Non si ripete, Ogni giorno, Ogni giorno feriale, Ogni settimana il mar, Ogni 2 settimane, Ogni mese il giorno 1, il 1° mar, Ogni anno e Personalizzato" />
</picture>

## Far ripetere una voce

Apri la voce e scegli una regola nella sua riga **Ripeti**. La riga compare quando la voce ha una data: un inizio, o una data di scadenza per un'attività non pianificata.

L'elenco offre regole costruite a partire dalla data in cui la serie inizia, anche se hai aperto un'occorrenza successiva. Per una voce di martedì 13 offre **Ogni giorno**, **Ogni giorno feriale** (da lunedì a venerdì), **Ogni settimana** di martedì, **Ogni 2 settimane** di martedì, **Ogni mese** il 13, **Ogni mese** il 2° martedì, e **Ogni anno** in quella data. Quando l'inizio cade negli ultimi sette giorni del suo mese, c'è anche **Ogni mese** l'ultimo martedì.

Per fermare la ripetizione di una voce, scegli **Non si ripete**. Una modifica alla regola si applica sempre all'intera serie, quindi Mitra non chiede a quali occorrenze ti riferisci.

### Regole personalizzate

Per qualsiasi altro caso, scegli **Personalizzato…**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-custom-detail-dark.webp">
  <img src="../assets/screenshots/repeat-custom-detail-light.webp" alt="La finestra Ripeti: ogni 1 settimana il martedì, termina mai, in una data, o dopo un certo numero di volte" />
</picture>

Dopo **Ogni**, scrivi un numero e scegli giorni, settimane, mesi o anni. Una regola settimanale mostra poi i giorni della settimana: attiva ogni giorno in cui la voce si ripete, e almeno uno resta attivo. Una regola mensile si ripete nello stesso numero di giorno dell'inizio, come il 13, oppure nello stesso giorno della settimana del mese, come il 2° martedì. Quando l'inizio cade negli ultimi sette giorni del suo mese, può anche ripetersi l'ultimo martedì.

Sotto **Termina**, scegli **Mai**, **Il** una data, oppure **Dopo** un certo numero di volte. Premi **Fatto**, e la riga **Ripeti** rilegge la regola, per esempio "Ogni 2 settimane il gio fino al 18 dic".

## Modificare o eliminare una singola occorrenza

Quando modifichi un'occorrenza, Mitra chiede a quali voci ti riferisci. Lo chiede quando trascini l'occorrenza a un altro orario, trascini il suo bordo, la elimini, o cambi un campo nel suo editor, come il titolo.

- **Questa voce** modifica solo l'occorrenza che hai scelto.
- **Questa e le voci seguenti** modifica questa e tutte quelle successive. La serie termina subito prima di essa, e da lì inizia una nuova serie con la tua modifica, così le occorrenze precedenti restano com'erano. La prima occorrenza non la offre, dato che lì significherebbe l'intera serie.
- **Tutte le voci** modifica ogni occorrenza. Spostarne una di un giorno le sposta tutte, quindi una riunione settimanale di lunedì diventa una riunione settimanale di martedì. Ridimensionarne una dà a tutte la nuova durata.

L'eliminazione funziona allo stesso modo: **Questa voce** rimuove una data, **Questa e le voci seguenti** termina la serie prima di essa, e **Tutte le voci** elimina la serie.

Per saltare la domanda e modificare solo questa occorrenza, tieni premuto <kbd>Ctrl</kbd> (<kbd>⌘</kbd> su un Mac) mentre la rilasci, oppure premi <kbd>Ctrl</kbd> + <kbd>Delete</kbd> mentre è aperta.

Alcune modifiche non chiedono mai nulla. Segnare come fatta un'occorrenza di un'attività vale solo per quell'occorrenza, e lo stesso vale per la pianificazione di una singola occorrenza di un'attività che si ripete in base alla data di scadenza.

## Occorrenze modificate ed eliminate

Un'occorrenza che modifichi con **Questa voce** lascia la serie e diventa una voce a sé. La serie salta la sua data, così non compare mai due volte, e le modifiche successive all'intera serie non la raggiungono.

Un'occorrenza eliminata resta eliminata. Non torna quando in seguito sposti o modifichi l'intera serie, e anche le altre app che usano lo stesso calendario la escludono.

## Spostare una serie in un altro calendario

Scegli un altro calendario nell'editor di un'occorrenza, e la stessa domanda decide se si sposta quell'occorrenza, il resto della serie o l'intera serie, come descritto in [Spostare una singola voce](calendars.md#move-a-single-entry).

## Attività ricorrenti

Ogni occorrenza di un'attività ricorrente è un'attività a sé da segnare come fatta. Un'attività può anche ripetersi solo in base alla sua data di scadenza, come pagare l'affitto entro il 1° di ogni mese: vedi [scadenze ricorrenti](planning.md#repeating-due-dates). Le attività ricorrenti non sono mai scadute e non si possono rimuovere dalla pianificazione, dato che sono le loro date a formare la serie.

## Come si mostrano le ripetizioni

Qualcosa che si ripete spesso, come un allenamento quotidiano, compare come [routine](routines.md) nelle viste mensile e annuale: una linea di piccoli segni invece di una barra per ogni giorno. La [cronologia](views/timeline.md) mostra solo le occorrenze di un'attività ricorrente che sono in scadenza, così un'attività quotidiana non la riempie.

## Quali calendari possono ripetere

I [calendari salvati in Mitra](integrations/mitra.md) e i [server di calendario](integrations/caldav.md), compresi Google e Apple, contengono voci ricorrenti. I calendari [Notion](integrations/notion.md) e [Tempo](integrations/tempo.md) no, quindi il loro editor non ha la riga **Ripeti**, e l'editor di una serie non li offre come suo calendario.

Quando [sposti ogni voce di un calendario](calendars.md#move-or-copy-every-entry-to-another-calendar) in uno che non può ripetere, Mitra chiede che cosa fare delle voci ricorrenti. **Lasciarle qui** le tiene dove sono. **Espandi in voci singole** scrive ogni occorrenza dell'anno a venire come voce separata che non si ripete più.

Anche la [disponibilità](availability.md) è una voce ricorrente, e parte come settimanale. Per lo stesso motivo non può stare nei calendari Notion o Tempo.
