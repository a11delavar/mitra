---
title: Link
description: "Come Mitra mostra i link in una voce: la riunione a cui partecipare, la nota da aprire, la pagina da leggere."
---

I link in una voce mostrano ciò a cui portano invece del loro indirizzo grezzo. Il link di una riunione si legge **Partecipa su Google Meet**, il link a una nota di Obsidian mostra il nome della nota e una pagina web mostra il suo sito e il suo percorso, come `example.atlassian.net/browse/DEV-9177`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/links-detail-dark.webp">
  <img src="../assets/screenshots/links-detail-light.webp" alt="L'editor di una voce con una riga Link sopra la descrizione, che contiene un link a una nota in Obsidian" />
</picture>

## Nell'editor

Quando la descrizione di una voce contiene dei link, l'editor li raccoglie in una riga **Link** subito sopra la descrizione, così puoi aprirli senza leggere tutto il testo. Cliccane uno per aprirlo: una pagina web si apre in una nuova scheda, qualsiasi altro link apre la sua app. Oltre le due righe, la riga scorre.

La riga non ha una memoria propria: mostra ciò che contiene la descrizione. Per aggiungere o rimuovere un link, modifica la descrizione e la riga lo segue. Ogni altra app di calendario che usi vede gli stessi link nella descrizione.

## Nella descrizione

I link nella descrizione iniziano con una piccola icona di ciò che aprono. Un indirizzo nudo, come uno incollato da un browser, viene abbreviato al suo sito e percorso. Un link che hai scritto con parole tue mantiene le tue parole.

Mitra riconosce anche i link delle app, come `obsidian://open?vault=…`, che la maggior parte delle app di calendario lascia come testo semplice. I link che eseguirebbero codice, come `javascript:`, vengono mostrati come testo semplice e mai come link.

## Link di riunioni e app nel luogo

Un luogo che è un singolo link viene trattato come quel link invece che come un posto. Un link di Zoom, Google Meet, Microsoft Teams, Webex, Jitsi, Whereby, FaceTime o Skype appare come **Partecipa** con il nome del servizio, nell'editor, sul calendario e nella tabella. Non ha il pulsante della mappa. Clicca accanto al link per modificarlo.

## Link alle app

Mitra riconosce l'app a cui appartiene un link dal suo indirizzo. Conosce Obsidian, Notion, Slack, Linear, Figma, Things, OmniFocus, Bear, Craft, Drafts, DEVONthink, Evernote, OneNote, Visual Studio Code, Cursor e Spotify. Ogni link di un'app, nota o no, mostra la stessa icona per aprire in un'altra app.

> [!NOTE]
> Una pagina web non può sapere se un'app è installata. La prima volta che apri il link di un'app, il browser chiede se aprire l'app. Se l'app manca, non succede nulla.
