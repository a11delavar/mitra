---
title: Connettori IA, allegati, regioni e lingue
---
Mitra 0.7 funziona con gli assistenti IA che già usi, così possono pianificare il tuo tempo direttamente nel tuo calendario. Ora puoi allegare file alle tue voci, Mitra scrive le date come si fa nella tua regione, e il fuso orario di casa resta con te quando viaggi. Mitra è ora disponibile in cinese, e puoi leggere cosa è cambiato senza lasciare l'app. Anche trascinare, ingrandire e caricare è più veloce, e dalla 0.6 sono arrivati molti piccoli miglioramenti e correzioni.

## Connettori IA
Assistenti IA come Claude e Cursor ora possono lavorare con il tuo calendario. Collegane uno con l'indirizzo che trovi in Impostazioni → IA, e chiedigli ciò che altrimenti faresti a mano, come guardare la tua settimana, trovare una voce, pianificare un viaggio o spostare una riunione. Ciò che scrive arriva nei tuoi calendari come qualsiasi altra modifica, e da lì si sincronizza. Su un server dove si accede con un account, ogni assistente riceve un proprio token di accesso, che si può limitare alla lettura e revocare in qualsiasi momento.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="connectors-dark.webp">
	<img src="connectors-light.webp" alt="Un assistente IA inserisce nella settimana un viaggio a Parigi già pianificato: i vecchi impegni se ne vanno, arriva il viaggio e la Torre Eiffel si apre con la sua foto e il suo biglietto">
</picture>

Foto della Torre Eiffel: David McSpadden, Wikimedia Commons, CC BY 2.0.

Documentazione: [Connettori IA](../../docs/ai-connectors.md)

## Regioni & lingue
Scegli il tuo paese insieme alla tua lingua. Mitra scrive allora date, orari e numeri come si fa lì. La tua settimana inizia nel giorno in cui inizia lì, e il fine settimana cade nei tuoi giorni liberi. Un'anteprima ti mostra come apparirà tutto prima che tu decida. Le scorciatoie da tastiera ora funzionano anche quando la tua tastiera scrive in un'altra scrittura, come il persiano.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="locales-dark.webp">
	<img src="locales-light.webp" alt="L'impostazione Lingua, aperta sulle sue lingue, con l'italiano aperto sui paesi in cui si scrive">
</picture>

Documentazione: [Impostazioni](../../docs/settings.md)

## Fuso orario di casa
Mitra ora conosce il fuso orario di casa tua e lo conserva nel tuo account. Quando viaggi, il calendario segue il tuo dispositivo, e casa tua resta nella colonna accanto. Il tuo elenco di fusi resta com'era, così al ritorno vedi di nuovo una sola colonna. I fusi che aggiungi e i nomi che dai loro sono gli stessi su ogni dispositivo. Ogni colonna porta il nome breve che la gente usa davvero per quel fuso.

Anche la scelta del fuso orario è stata ridisegnata. I fusi che condividono nome e ora sono raccolti in una sola riga, e quelli del tuo paese vengono per primi. Una casa indica casa tua, e una puntina indica il fuso in cui ti trovi quando viaggi.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="time-zones-dark.webp">
	<img src="time-zones-light.webp" alt="La scelta del fuso orario, aperta su casa tra i fusi raggruppati intorno">
</picture>

> [!NOTE]
> Se avevi dato un nome tuo al fuso orario in cui ti trovi, daglielo di nuovo, per favore. Finora quei nomi restavano sul dispositivo dove li avevi dati. Da ora in poi un nome ti segue su ogni dispositivo.

Documentazione: [Fusi orari](../../docs/time-zones.md)

## Allegati
Ora puoi allegare file a una voce, per esempio un biglietto, un ordine del giorno o la foto di una lavagna. Aggiungili con la graffetta nell'editor della voce, oppure trascinali sulla voce aperta. Fai clic su un file per aprirlo. Puoi anche aggiungere un file alla descrizione, dove un'immagine compare come immagine e ogni altro file come link. Se poi rimuovi il file, Mitra lo toglie anche dalla descrizione.

Gli allegati si sincronizzano con il tuo calendario. In un calendario CalDAV, le altre app che usano lo stesso calendario vedono i file che alleghi, e Mitra mostra i file che hanno allegato loro. In Google Calendar, Mitra mostra i file di Google Drive allegati a un evento, ma non può aggiungerne o toglierne, perché Google conserva solo i file di Drive. Le immagini di una pagina Notion ora compaiono nella descrizione dell'attività.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="attachments-dark.webp">
	<img src="attachments-light.webp" alt="Un'attività aperta accanto alla sua voce nella settimana, la cui graffetta mostra che porta dei file: l'editor elenca un PDF, uno schizzo e un foglio di calcolo sopra la descrizione, che mostra lo schizzo">
</picture>

> [!NOTE]
> Mitra salva i file che alleghi nella sua cartella dei dati, quindi facendo il backup di quella cartella salvi anche i tuoi file. Puoi limitare la dimensione di un singolo file con `MITRA_FILE_MAX_SIZE`, e quanto può salvare ogni persona in totale con `MITRA_FILE_QUOTA`.

Documentazione: [Allegati](../../docs/attachments.md)

## Note di rilascio nell'app
Ora puoi vedere cosa è cambiato senza lasciare Mitra. La finestra Informazioni mostra ogni versione come fa il sito. Contiene le note e le immagini della versione che usi, insieme alle correzioni arrivate dopo. C'è anche ogni commit, ripiegato finché non ti serve.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="about-dark.webp">
	<img src="about-light.webp" alt="La finestra Informazioni, aperta sulle note e sulle immagini di una release">
</picture>

## Cinese
Mitra ora parla cinese, scritto in caratteri semplificati. L’app, il calendario di esempio, la documentazione e il sito sono tradotti, e il testo cinese è composto in un carattere tipografico pensato apposta.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="chinese-detail-dark.webp">
	<img src="chinese-detail-light.webp" alt="L'editor delle voci in cinese, con il selettore di date aperto sul mese">
</picture>

Documentazione: [Impostazioni](../../docs/settings.md)
