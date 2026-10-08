---
title: Notion
description: Porta le viste dei tuoi database di attività di Notion in Mitra come calendari di attività che si sincronizzano in entrambe le direzioni.
---

Mitra si collega a Notion per le attività. Ogni vista di un database di attività, come «All tasks», «My tasks» o una board di sprint, diventa un calendario in Mitra che contiene esattamente le attività mostrate dalla vista: Notion applica i filtri della vista, e Mitra colloca il risultato nel tuo calendario. Titolo, stato, date e descrizione di un'attività si sincronizzano in entrambe le direzioni.

Ti colleghi dall'app con un token di integrazione. Sul server non c'è nulla da configurare.

## Collegare un workspace

1. Crea un'integrazione su [notion.so/profile/integrations](https://www.notion.so/profile/integrations). Basta un'integrazione interna.
2. Condividi con essa i tuoi database di attività. Apri ogni database in Notion, scegli **•••** → **Connections** e aggiungi la tua integrazione.
3. In Mitra, scegli **Aggiungi integrazione** in fondo alla barra laterale, poi **Notion**, e incolla il segreto dell'integrazione, che inizia con `ntn_`, in **Token di integrazione**.
4. Premi **Connetti**. Mitra elenca le viste dei database che hai condiviso, con il nome del database e della vista.
5. Scegli le viste che vuoi, poi premi **Salva**.

Per cominciare, Mitra attiva una vista per database. Un'attività appartiene a ogni vista di cui soddisfa i filtri, quindi con due viste dello stesso database attive comparirebbe due volte. Puoi comunque attivarne altre di proposito.

Mitra propone le viste tabella, board, elenco, calendario, timeline e galleria. Gli altri tipi di vista non vengono elencati.

## Quali database funzionano

Un database compare quando ha una proprietà di tipo Status e una di tipo Date. I modelli di attività di Notion le hanno entrambe.

Mitra legge lo stato di un'attività dal gruppo a cui appartiene il suo stato in Notion:

| Gruppo di stato di Notion | Stato in Mitra |
| --- | --- |
| To-do | Da fare |
| In progress | In corso |
| Complete | Fatto |

Quando cambi uno stato in Mitra, Notion riceve la prima opzione del gruppo corrispondente.

La proprietà Date è il punto in cui Mitra colloca l'attività, quindi è la sua pianificazione. Se un database ha più proprietà Date, Mitra preferisce una il cui nome inizia con «Due», poi una chiamata «Date», «When», «Deadline», «Scheduled» o «Do date», e altrimenti prende la prima.

## Cosa si sincronizza

Titolo, stato e data si sincronizzano in entrambe le direzioni, come date di tutto il giorno o con orario. Gli orari appaiono nel tuo fuso orario. Un'attività senza data aspetta nell'elenco **Non pianificate** della [scheda Pianificazione](../planning.md#the-planning-tab).

La descrizione di un'attività è il corpo della sua pagina Notion, scritto in Markdown, comprese le liste di cose da fare e i callout. Quando modifichi la descrizione in Mitra, Mitra sostituisce solo ciò che la descrizione mostra. Immagini, embed, sottopagine e blocchi sincronizzati restano in Notion così come sono, e Mitra non li mostra.

Le proprietà di relazione che collegano attività all'interno dello stesso database diventano collegamenti in Mitra, in entrambe le direzioni. Una proprietà chiamata «Parent task» o «Sub-tasks» crea [attività secondarie](../subtasks.md), una chiamata «Blocked by» o «Depends on» crea [dipendenze](../dependencies.md), e le altre relazioni compaiono con il loro nome. Le relazioni verso altri database non vengono mostrate.

Per aprire un'attività in Notion, scegli **Apri in Notion** nel menu **⋯** dell'editor. Eliminare un'attività in Mitra sposta la sua pagina nel cestino di Notion, dove puoi ancora ripristinarla.

Notion limita la frequenza con cui le app possono interrogarlo, quindi Mitra lo sincronizza circa una volta al minuto (vedi [come funziona la sincronizzazione](README.md#how-syncing-works)). Una nuova attività non sparisce mai per un attimo mentre Notion si aggiorna.

## Cosa Notion non può contenere

Un database Notion contiene attività con una sola data ciascuna, e questo determina ciò che può contenere un calendario Notion:

- Contiene solo attività, quindi niente eventi e niente [disponibilità](../availability.md).
- L'unica data di un'attività è la sua pianificazione, quindi non ci sono scadenze né stime.
- Le attività non possono ripetersi e non hanno promemoria, luogo né partecipanti.
- Non esiste lo stato **Annullato**, perché Notion non ha un gruppo per questo.
- Un'attività non può avere un fuso orario proprio, una percentuale di avanzamento, l'indicazione occupato o disponibile, né una visibilità.

Mitra nasconde questi campi sulle attività Notion, così nulla di ciò che scrivi lì sparisce alla sincronizzazione successiva. Per spostare in Notion le voci che li usano, vedi [Sposta o copia ogni voce in un altro calendario](../calendars.md#move-or-copy-every-entry-to-another-calendar), che mostra prima cosa non arriverebbe a destinazione.

## Viste e filtri

Un calendario mostra ciò che mostra la sua vista Notion, e un'attività che crei al suo interno riceve i valori dei filtri della vista, così finisce nella vista. Un'attività aggiunta a una vista «University» riceve «Area = University», come se avessi aggiunto la riga in Notion.

Mitra compila i filtri che un solo valore può soddisfare: una selezione, uno stato, una selezione multipla, una casella di controllo o una relazione con una pagina specifica. Alcuni filtri non possono essere soddisfatti da nessun valore singolo, come una formula, un intervallo di date o una tra più opzioni. Un'attività che crei in una vista del genere non la soddisfa, quindi, come in Notion, non vi compare. È comunque nel database, e una vista con meno filtri, come «All tasks», la mostra.

> [!TIP]
> Se una vista filtra su una relazione con un altro database, ad esempio le attività il cui «Area» punta a una pagina «University» in un database «Areas», condividi con la tua integrazione anche quel database. Altrimenti Mitra non può impostare la relazione sulle nuove attività, e queste non compaiono nella vista.

## Risoluzione dei problemi

- Se un database non è elencato, gli manca una proprietà Status o Date, oppure non è condiviso con la tua integrazione (**•••** → **Connections** in Notion). Dopo averlo condiviso, apri **⋯ → Modifica** dell'account in Mitra e premi **Aggiorna**.
- Se un'attività compare due volte, hai attivato due viste dello stesso database che la includono entrambe. Disattivane una da **⋯ → Modifica** dell'account.
