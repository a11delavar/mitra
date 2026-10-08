---
title: Calendari
description: Scegli quali calendari importa Mitra, rinominali, ricolorali, riordinali e nascondili, stabilisci dove vanno le nuove voci e sposta le voci tra i calendari.
---

Ogni riga della scheda **Calendari** della barra laterale è un calendario. Alcuni sono [salvati in Mitra](integrations/mitra.md), altri provengono da un account che hai collegato. Stanno sotto l'intestazione dell'integrazione a cui appartengono, e tutto ciò che c'è in questa pagina funziona allo stesso modo per tutti, salvo diversa indicazione.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/calendars-detail-dark.webp">
  <img src="../assets/screenshots/calendars-detail-light.webp" alt="La barra laterale, con un account e i suoi cinque calendari, ciascuno del suo colore" />
</picture>

Un calendario è una riga, anche quando contiene sia eventi sia attività, come fanno la maggior parte dei calendari CalDAV. Se una data voce sia un evento o un'attività dipende dalla voce.

## Scegliere che cosa importare

Quando colleghi un account, Mitra trova i suoi calendari e li elenca, tutti spuntati, ciascuno con ciò che contiene, come "Eventi · Attività". Togli la spunta a quelli che non vuoi prima di salvare. Puoi cambiare idea in seguito in **⋯ → Modifica** dell'account, dove i calendari aggiunti all'account nel frattempo aspettano senza spunta. Mitra sincronizza e conserva solo i calendari attivati, quindi gli altri non costano nulla.

## Aggiungere o eliminare un calendario

Un calendario di un account collegato si crea e si elimina presso il provider, e Mitra se ne accorge alla sincronizzazione successiva. I calendari Mitra sono l'eccezione: aggiungine uno con **Nuovo calendario** nel menu **⋯** dell'intestazione Mitra, ed eliminane uno con **Elimina calendario** nel suo menu **⋯**. Se contiene ancora delle voci, Mitra offre **Sposta prima le voci…**, così nulla va perso per sbaglio.

## Nascondere un calendario

L'occhio alla fine di una riga nasconde le voci di quel calendario. Nascondere riguarda solo ciò che vedi: il calendario continua a sincronizzarsi, e le sue voci tornano subito quando lo mostri di nuovo.

Nascondere non silenzia un calendario, quindi i suoi [promemoria](reminders.md) suonano ancora. Per fermare del tutto un calendario, disattivalo in **⋯ → Modifica** del suo account.

### Mostrare un solo calendario

Per togliere di mezzo tutto il resto, scegli **Mostra solo questo calendario** nel menu **⋯** di un calendario, oppure fai <kbd>Alt</kbd>-clic sul suo occhio. Tutti gli altri calendari si nascondono, e Mitra ricorda quali stavi mostrando. La stessa voce di menu diventa allora **Mostra i calendari precedentemente visibili** e li riporta indietro.

I calendari già nascosti prima restano nascosti. Un calendario collegato nel frattempo viene mostrato, dato che non faceva parte di ciò che avevi messo da parte. Anche mostrare un calendario a mano non ti fa perdere la strada per tornare agli altri. Puoi fare entrambe le cose anche dalla [palette dei comandi](shortcuts.md) cercando il nome di un calendario.

## Rinominare

Fai doppio clic sul nome di un calendario, oppure scegli **Rinomina** nel suo menu **⋯**. Il nome è tuo: la sincronizzazione non lo sovrascrive mai. Mitra riprende il nome del provider solo quando il calendario viene effettivamente rinominato lì.

## Ricolorare

Scegli un colore nel menu **⋯** del calendario. Finché non lo fai, un calendario usa il colore che gli dà il suo provider. Se il provider non ne dà nessuno, Mitra ne sceglie uno dall'indirizzo del calendario, così appare uguale su ogni dispositivo. Le voci prendono il colore del loro calendario a meno che non ne abbiano uno proprio.

## Riordinare

I calendari partono nell'ordine in cui Mitra li ha trovati, e gli account nell'ordine in cui li hai collegati. Per disporli a modo tuo, trascina un calendario su o giù all'interno del suo account, oppure trascina un account dalla sua intestazione per spostarlo con tutti i suoi calendari. Su uno schermo touch, tieni premuto per un attimo prima di trascinare, dato che un semplice scorrimento fa scorrere l'elenco. **Sposta su** e **Sposta giù** nel menu **⋯** fanno lo stesso senza trascinare.

Un calendario si sposta solo all'interno del proprio account. Un calendario che attivi in seguito si unisce alla fine del suo account, così non disturba l'ordine che hai stabilito.

## Dove finiscono le nuove voci

Il calendario con l'icona piena è il tuo predefinito: le nuove voci vanno lì a meno che tu non ne scelga un altro. Clicca l'icona di un calendario per renderlo il predefinito, e clicca di nuovo l'icona del predefinito per toglierlo. Senza un predefinito, le nuove voci vanno nel primo calendario dell'elenco, quindi spostare un calendario in cima lo rende anche il predefinito. La stessa scelta si trova in **Impostazioni → Voci**.

Le nuove voci sono eventi, a meno che il calendario non possa contenere solo attività, come una vista Notion. Finché una voce è nuova, il suo editor ha un selettore **Evento** / **Attività**. Una volta salvata, cambiala con **Tipo** nell'editor, purché il suo calendario possa contenere l'altro tipo. Una voce ricorrente mantiene il suo tipo.

## Spostare o copiare ogni voce in un altro calendario

**Sposta le voci in…** nel menu **⋯** di un calendario, oppure **Sposta le voci da …** nella palette dei comandi, sposta tutto ciò che contiene in un altro calendario in una volta. Scegli dove devono andare e, prima che accada qualcosa, Mitra ti mostra che cosa costerebbe lo spostamento:

```
19 of 21 entries move to Personal
✓ 15 arrive with everything they carry
! 4 lose their reminders
⨯ 2 repeat and stay here
```

Il resoconto dipende da ciò che la destinazione può contenere, quindi si legge in modo diverso per un calendario CalDAV e per una vista Notion. Le voci che la destinazione non può accogliere affatto, come una voce ricorrente diretta a Notion, restano dove sono e sono elencate per nome.

**Copia invece** lascia gli originali dove sono e mette una copia di ciascuno nella destinazione. È anche il modo per estrarre voci da un calendario di sola lettura, come un abbonamento: si può copiare da esso, ma non spostare fuori.

I collegamenti tra le voci che sposti vengono con loro, anche in Notion, che dà a ogni pagina un nuovo ID. I collegamenti dalle voci che restano indietro continuano a puntare a quelle che si sono spostate.

Se la destinazione non può ripetere le voci, Mitra chiede che cosa fare di quelle ricorrenti: lasciarle qui, oppure espanderle in voci singole, una per ogni occorrenza dell'anno a venire, che non si ripetono più. Non espande mai senza chiedere.

> [!NOTE]
> Mitra copia per prima cosa ed elimina gli originali solo quando le loro copie sono arrivate. Non c'è annullamento tra due provider, quindi quest'ordine è la rete di sicurezza: se qualcosa va storto, potresti ritrovarti con una voce in entrambi i calendari, ma mai con una mancante. Se la copia fallisce, l'intero spostamento si ferma e non viene eliminato nulla.

### Spostare una singola voce

Per spostare una voce, aprila e scegli un altro calendario nel suo editor. Per una voce ricorrente, Mitra chiede a quali ti riferisci. **Questa voce** sposta da sola quella singola occorrenza, **Questa e le voci seguenti** sposta il resto della serie e lascia indietro le occorrenze precedenti, e **Tutte le voci** sposta l'intera serie, regola di ripetizione compresa.

## Calendari di sola lettura

Alcuni calendari non si possono modificare da Mitra: gli [abbonamenti ai calendari](integrations/subscriptions.md) e i calendari che qualcuno ha condiviso con te solo in visualizzazione. Mitra se ne accorge da sola e li contrassegna come di sola lettura.

Puoi aprire le loro voci e leggere, selezionare e copiare tutto ciò che contengono, ma non puoi creare, modificare, spostare o eliminare voci lì, e una voce non può essere spostata in uno di essi. Rinominare, ricolorare, riordinare e nascondere funzionano ancora, dato che sono la tua vista personale del calendario. Se il proprietario in seguito ti permette di apportare modifiche, Mitra se ne accorge alla sincronizzazione successiva.

## Reimportare un calendario

**Reimporta voci**, nel menu **⋯** di un calendario o di un intero account, scarta la copia delle voci di Mitra e le importa di nuovo dal provider. Presso il provider non cambia nulla. Non dovrebbe servirti nell'uso quotidiano, dato che la [sincronizzazione](integrations/README.md#how-syncing-works) si occupa di sé; c'è per quando un calendario appare sbagliato o non aggiornato dopo un aggiornamento. I calendari Mitra non la offrono, dato che non c'è alcun provider da cui importare.
