---
title: Allegati
description: "Aggiungi file a un evento o a un'attività. Mitra li conserva sul tuo server e li salva con la voce, così li vedono anche le altre app di calendario."
---

Una voce può avere degli **allegati**: file come un biglietto, la foto di una lavagna o una ricetta. Mitra conserva il file sul tuo server e lo salva con la voce nel formato di calendario standard, così le altre app che usano lo stesso calendario, come Nextcloud o Apple Calendar, mostrano lo stesso file sullo stesso evento.

## Aggiungere un file

Apri la voce e premi **＋** nella riga con la graffetta, o la parola **Allegati** finché la riga è ancora vuota, e scegli uno o più file. Ogni allegato mostra un'icona per il suo tipo, il suo nome e la sua dimensione. Fai clic su uno per aprirlo in una nuova scheda, e premi la sua **✕** per toglierlo dalla voce.

Una graffetta sulla voce nel calendario mostra quali voci hanno dei file.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/attachments-detail-dark.webp">
  <img src="../assets/screenshots/attachments-detail-light.webp" alt="Un'attività aperta accanto alla sua voce nella settimana, la cui graffetta mostra che porta dei file: l'editor elenca un PDF, uno schizzo e un foglio di calcolo sopra la descrizione, che mostra lo schizzo" />
</picture>

I link non sono allegati. Per aggiungere un link a una voce, scrivilo nella descrizione, e la riga [Link](links.md) lo mostra.

## Dove vengono conservati i file

I file che aggiungi vengono conservati nella cartella `files` della cartella dei dati di Mitra, accanto al suo database, quindi un [backup](backups.md) di quella cartella li include. Ogni file viene salvato con un nome casuale invece del proprio, e lo stesso file aggiunto due volte viene conservato una volta sola.

> [!IMPORTANT]
> Chiunque abbia l'indirizzo di un file può aprirlo senza accedere a Mitra. È ciò che permette alle altre app di calendario di aprire il file: Mitra scrive l'indirizzo nel tuo calendario, e quelle app non possono accedere a Mitra. L'indirizzo contiene una parte casuale che non si può indovinare, ma trattalo come qualsiasi link di condivisione. Per avere un nuovo indirizzo, togli l'allegato e aggiungi di nuovo il file.

Immagini, video, audio, PDF e testo semplice si aprono nel browser. Ogni altro tipo di file viene scaricato, così un file non può mai eseguire codice dentro Mitra.

## Limiti

Un singolo file può arrivare a 25 MB, e non c'è limite a quanto una persona può conservare. Chi gestisce il server può cambiare entrambe le cose, o disattivare l'aggiunta di file; vedi [Configurazione](configuration.md#attachments). Nella [demo](https://demo.mitracal.com) l'aggiunta di file è sempre disattivata.

Un file che nessuna voce usa più viene eliminato circa un giorno dopo essere stato aggiunto. Fino ad allora puoi ancora aggiungerlo a una voce che non hai ancora salvato, o rimetterlo dopo averlo tolto per sbaglio.

## Quali calendari lo supportano

I calendari di un [server CalDAV](integrations/caldav.md) e di [Apple Calendar](integrations/apple.md) contengono allegati, e così i [calendari Mitra](integrations/mitra.md). In un [abbonamento a un calendario](integrations/subscriptions.md) vedi gli allegati del feed, ma non puoi modificarli.

Un file può comparire anche nella descrizione: il pulsante immagine o link nella sua riga lo aggiunge in fondo al testo, come immagine per le immagini e come link per il resto. Rimuovendo l'allegato, sparisce anche quello.

In un [calendario Google](integrations/google.md), gli allegati sono i file di Google Drive allegati in Google Calendar: Mitra li mostra, ma non può aggiungerne o toglierne. I calendari di [Notion](integrations/notion.md) e [Tempo](integrations/tempo.md) non hanno la riga degli allegati. Spostare una voce con allegati in uno di questi ne perde i file, e Mitra te lo dice prima che si sposti qualcosa.

> [!NOTE]
> Anche gli allegati aggiunti da altre app compaiono in Mitra, compresi i file che il tuo server di calendario conserva da sé, che si aprono con l'indirizzo di quel server. Mitra lascia esattamente come sono gli allegati che non riconosce, così modificare una voce in Mitra non cambia mai gli allegati di un'altra app.
