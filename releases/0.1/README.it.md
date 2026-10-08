---
title: Mitra, un calendario tutto tuo
---
La prima versione di Mitra: un calendario che mette le tue attività sulla stessa cronologia dei tuoi eventi, sincronizzato in entrambe le direzioni con i calendari che già usi.

## Perché Mitra
Esistono ottime app di calendario ed esistono calendari che puoi ospitare da te, e per molto tempo non erano gli stessi.

Le app curate vivono sui server di qualcun altro e leggono tutto ciò che ci scrivi. Quelle che puoi far girare a casa sono per lo più dei server: conservano fedelmente i tuoi calendari e ti lasciano guardarli con una qualsiasi app tu riesca a trovare. Mitra è nato dal desiderio di avere entrambe le cose insieme: un calendario in cui è piacevole passare la giornata, che gira su una macchina tua e non risponde a nessun altro.

Non ti chiede di traslocare. Mitra è uno strato sopra i calendari che già usi, non un altro posto dove tenerli. Ogni fonte del tuo tempo è un'integrazione che si inserisce accanto alle altre, prima un server CalDAV e da allora molte altre, e tutte si incontrano su un'unica cronologia mentre ognuna tiene i suoi dati dove si trovano. Anche i tuoi eventi e le tue attività condividono quella cronologia, così la fatica di far stare l'uno nell'altra non si svolge più nella tua testa.

È anche una scommessa sul web di oggi, non su quello di dieci anni fa. Mitra è scritto per i browser attuali e si appoggia a ciò che sanno fare in modo nativo: layout che si adattano al proprio spazio, popover ancorati al loro posto, transizioni tra le viste, un vero modello di date e fusi orari. Non portarsi dietro livelli di compatibilità né un framework pesante è ciò che lo mantiene piccolo e veloce, gli permette di installarsi come app e di sentirsi a casa su un telefono come su un computer. Il prezzo è che richiede un browser recente, e continuerà a richiederlo.

Sotto c'è una convinzione semplice: il tuo tempo è il registro più personale che tieni. Dove vive, chi può leggerlo e quanto sia sereno guardarlo dovrebbero essere decisioni tue. Mitra è un tentativo di renderlo facile.

[@a11delavar](https://github.com/a11delavar)

## Vista settimanale
Un giorno è una colonna di 24 ore con una linea all'ora attuale, e una settimana ne è sette affiancate. Torna a oggi con un solo pulsante.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="week-dark.webp">
	<img src="week-light.webp" alt="La vista settimanale, con la linea all'ora attuale">
</picture>

Documentazione: [Vista settimanale](../../docs/views/week.md)

## Vista mensile
Il mese scorre senza fine, una riga per ogni settimana e una barra per ogni voce lungo i suoi giorni. Passa dall'una all'altra dall'intestazione.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="month-dark.webp">
	<img src="month-light.webp" alt="La vista mensile, una riga per ogni settimana">
</picture>

Documentazione: [Vista mensile](../../docs/views/month.md)

## Eventi e attività
Un'attività sta nella giornata come un evento, con una casella da spuntare quando è fatta. Trascina nella griglia per creare una voce, trascinala per spostarla e dai a ogni calendario il suo colore.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="entries-dark.webp">
	<img src="entries-light.webp" alt="Eventi e attività affiancati in una giornata">
</picture>

Documentazione: [Voci](../../docs/entries.md)

## CalDAV
Collega un server CalDAV, scegli quali dei suoi calendari mostrare, e Mitra li tiene allineati in entrambe le direzioni, con le modifiche fatte altrove che compaiono mentre accadono.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="caldav-dark.webp">
	<img src="caldav-light.webp" alt="Collegare un server CalDAV">
</picture>

Documentazione: [CalDAV](../../docs/integrations/caldav.md)

## Note in Markdown
La descrizione di una voce è in Markdown: titoli, elenchi e link si leggono come tali, e restano testo semplice per ogni altra app.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="markdown-dark.webp">
	<img src="markdown-light.webp" alt="Un ordine del giorno nella descrizione di una voce, scritto in Markdown">
</picture>

## Collaboratori
- [@a11delavar](https://github.com/a11delavar)
