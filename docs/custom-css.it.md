---
title: CSS personalizzato
description: "Cambia l'aspetto di Mitra con il tuo CSS: un foglio di stile tuo che segue il tuo account, e uno per tutti sul server."
---

L'aspetto di Mitra è normale CSS, e puoi aggiungere il tuo sopra. Nascondi quello che non usi mai, metti un bordo attorno a oggi o dai i tuoi colori a tutto il server. Ci sono due posti per farlo: **Impostazioni → Generale → CSS personalizzato** per te, e, dove si accede con un account, **Impostazioni → Amministrazione → CSS personalizzato per tutti** per tutti sul server.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/custom-css-dark.webp">
  <img src="../assets/screenshots/custom-css-light.webp" alt="Mitra nell'oro del suo logo, con la regola di CSS personalizzato che lo fa aperta nelle impostazioni" />
</picture>

> [!WARNING]
> Fino a Mitra 1.0, qualsiasi aggiornamento può cambiare gli elementi, gli attributi e le variabili a cui puntano le tue regole. Una regola che funziona oggi può smettere di funzionare dopo un aggiornamento, o iniziare a nascondere qualcosa. Tieni il tuo foglio di stile breve e dai un'occhiata a Mitra dopo ogni aggiornamento.

## Il tuo foglio di stile

Apri **Impostazioni → Generale** e scrivi CSS nel campo sotto **CSS personalizzato**. Mitra lo applica mentre scrivi, lo salva un attimo dopo che ti fermi, e segue il tuo account su ogni dispositivo e browser da cui accedi.

L'interruttore accanto a **CSS personalizzato** disattiva il tuo foglio di stile senza perderlo, e la [tavolozza dei comandi](shortcuts.md) offre **CSS personalizzato: Non attivo** e **CSS personalizzato: Attivo**.

`@import` viene rimosso al salvataggio: incolla un foglio di stile intero invece di collegarne uno.

## Il foglio di stile del server

Dove si accede con un account, chi amministra il server può cambiare l'aspetto di Mitra per tutti: apri **Impostazioni → Amministrazione** e scrivi CSS nel riquadro sotto **CSS personalizzato per tutti**. Tu lo vedi mentre scrivi, gli altri la prossima volta che caricano Mitra. Il suo interruttore lo spegne per tutti senza perderlo. La prima persona che accede a un server ne è l'amministratore. Senza accesso, il tuo foglio di stile raggiunge già tutti quelli che usano Mitra, quindi c'è solo quello.

È adatto a ciò che rende tuo un server, come i suoi colori, il suo carattere o il [nome](configuration.md#name-your-instance) che porta già. Il foglio di stile di ogni persona viene dopo, quindi il suo vince dove entrambi impostano la stessa cosa.

## La tua regola vince

Le regole proprie di Mitra stanno in un livello della cascata chiamato `mitra`, le tue no, quindi una tua regola batte quella di Mitra qualunque sia il suo selettore. Non ti serve `!important`. Le poche dichiarazioni `!important` di Mitra restano sopra, perché i livelli le ordinano al contrario: tengono insieme il layout.

Per togliere qualcosa che Mitra imposta, invece di dipingerci sopra, dai alla proprietà il valore `revert`. Questo toglie lo sfondo dei giorni nella vista mese:

```css
mitra-weeks mitra-day {
	background: revert;
}
```

## Esempi

### Nascondere i giorni fuori dal mese

```css
mitra-weeks [data-outside] {
	visibility: hidden;
}
```

Nella [vista mese](views/month.md), questo nasconde i giorni prima e dopo il mese mostrato, la loro data e il loro sfondo. Le voci che vi si trovano restano. `visibility` lascia la griglia al suo posto, dove `display: none` la scomporrebbe. Ingrandisci per dare più spazio ai giorni del mese.

### Un bordo attorno a oggi

```css
mitra-weeks mitra-day[today] {
	outline: 2px solid var(--color-accent);
	outline-offset: -2px;
}
```

`outline` invece di `border`: un bordo ingrandirebbe il giorno e sposterebbe la griglia.

### I tuoi colori

```css
:root {
	--color-accent: light-dark(#2e7d32, #81c784);
	--border-radius: 8px;
}
```

`light-dark()` prende il colore del tema chiaro, poi quello del tema scuro. Tutto ciò che Mitra colora con queste variabili segue, compresa la barra del titolo dell'[app installata](install-app.md):

| Variabile | Cosa colora |
| --- | --- |
| `--color-accent` | Oggi, ciò che è selezionato, gli anelli di focus e i pulsanti principali |
| `--color-background-seed` | Lo sfondo dietro a tutto; i dialoghi ne ricavano il loro |
| `--color-surface` | I giorni nelle viste, e ciò che poggia sullo sfondo, come la tavolozza dei comandi |
| `--color-text` | Il testo |
| `--color-text-muted` | Il testo secondario, come i suggerimenti e gli orari |
| `--color-error` | Errori e avvisi |
| `--border-radius` | Gli angoli di pulsanti, voci e della maggior parte dei controlli |
| `--font-family` | Il carattere del testo |

## Trovare a cosa puntare

Gli strumenti per sviluppatori del browser mostrano cosa c'è nella pagina: fai clic destro su qualcosa e scegli **Ispeziona**. Gli elementi propri di Mitra si chiamano `mitra-…`, come le viste `mitra-days` (settimana), `mitra-weeks` (mese), `mitra-months` (anno), `mitra-timeline` e `mitra-table`, un giorno `mitra-day`, una voce `mitra-entry-segment` e la barra laterale `mitra-sidebar`. Gli attributi dichiarano fatti, come `today`, `data-outside` e `data-date`.

Pulsanti, campi, interruttori, menu e gli altri controlli tengono per sé il loro interno. Raggiungili attraverso le loro parti, come `mitra-switch::part(switch)`, e le variabili `--mitra-…` che leggono. Se ti serve arrivare più a fondo, chiedi una parte in una [issue](https://github.com/a11delavar/mitra/issues).

## Cosa lasciare stare

Alcune cose tengono insieme Mitra, e cambiarle lo rompe:

- `display` o `position` su `mitra-day`, o sui `.entries` dentro una vista: poggiano su una griglia che tutta la vista condivide, e senza di essa la vista settimana diventa molto lenta.
- Le variabili che iniziano con `--_`: cambiano a ogni fotogramma di uno zoom, e impostarle lo ostacola.
- La dimensione di una voce: il suo titolo sceglie il layout in base alla larghezza, quindi dimensionarla dall'esterno può cambiarlo.
- `all: unset` annulla anche il nascondere, quindi aggiungi `[hidden] { display: none }` accanto.

## Quando una regola nasconde la via del ritorno

Aggiungi `?css=off` all'indirizzo, per esempio `https://mitra.example.com/?css=off`. Mitra si carica allora una volta senza nessuno dei due fogli di stile, così puoi aprire **Impostazioni** e sistemare il tuo. Chi amministra il server sistema quello di tutti allo stesso modo.

## Prima di incollare

Un foglio di stile non esegue codice, ma può caricare indirizzi, e uno scritto apposta può inviare loro ciò che hai sullo schermo. Incolla solo CSS che capisci. Il tuo foglio di stile riguarda solo te; quello del server tutti quelli che lo usano.

## Condividi il tuo

Sotto il riquadro, **Condividi su GitHub** apre una nuova discussione nella categoria [Custom CSS](https://github.com/a11delavar/mitra/discussions/categories/custom-css) con il tuo foglio di stile già dentro. Racconta cosa fa, aggiungi uno screenshot se mostra qualcosa e pubblicala. Un foglio di stile troppo lungo per il link viene copiato negli appunti, così lo incolli nella discussione. Nella categoria trovi anche i fogli di stile condivisi da altri: leggili prima di incollarli.
