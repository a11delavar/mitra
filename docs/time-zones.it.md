---
title: Fusi orari
description: Come Mitra mostra il fuso orario di una voce e come aggiungere le ore di altri fusi orari alla vista settimanale.
---

Mitra mostra gli orari nel tuo fuso orario, quello impostato sul tuo dispositivo. Quando viaggi e il dispositivo cambia fuso, Mitra lo segue. Nell'editor questo fuso si chiama fuso **principale**.

Una voce può anche avere un fuso orario tutto suo, come un volo che parte alle 9:00 a New York. E la vista settimanale può mostrare le ore di altri fusi orari accanto alle tue.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zone-detail-dark.webp">
  <img src="../assets/screenshots/time-zone-detail-light.webp" alt="L'editor di una nuova voce con il fuso orario impostato su GMT+4 Dubai, che mostra le 11:00 a Dubai, mentre la voce sta alle 9:00 nella settimana di Berlino sullo sfondo" />
</picture>

## Il fuso orario di una voce

Ogni voce con degli orari ha un fuso orario. Le voci che crei prendono il tuo, e le voci di altre app mantengono il fuso in cui sono state create.

Apri una voce per vedere il suo fuso nella riga con il globo, sotto le sue date, scritto come uno scarto e una città, per esempio "GMT-4 New York". Le voci di tutto il giorno non hanno fuso orario né questa riga, perché coprono gli stessi giorni per tutti.

### Cambiare il fuso orario di una voce

Clicca il fuso e scegline un altro. Scrivi una città, il nome di un fuso o uno scarto per trovarlo. Il tuo fuso apre l'elenco, contrassegnato come **Principale**.

La voce mantiene i suoi orari sull'orologio nel nuovo fuso: una riunione alle 9:00 a Berlino diventa una riunione alle 9:00 a New York. Se era sbagliato solo il fuso e la riunione in sé non si è spostata, cambia poi i suoi orari.

### Il tuo orario o quello della voce

Quando il fuso di una voce è diverso dal tuo, l'editor mostra i suoi orari nel tuo fuso, quindi una riunione alle 9:00 a New York risulta alle 15:00 se ti trovi a Berlino. Un pulsante accanto al fuso passa all'ora propria della voce e viceversa. Mostra una casa mentre vedi la tua ora e un globo mentre vedi quella della voce, e puntandolo ti dice quale stai guardando.

Puoi modificare gli orari in entrambi i modi. Per cambiare il fuso stesso, passa prima all'ora della voce.

### Orari sull'orologio da parete

Alcune voci arrivano da altre app senza alcun fuso orario e mostrano **Orologio da parete (nessun fuso orario)**. I loro orari non appartengono ad alcun luogo: una sveglia alle 7:00 vale per le 7:00 ovunque tu sia, e l'editor la mostra alle 7:00 in ogni fuso orario. I suoi promemoria suonano a quell'ora dell'orologio su ogni dispositivo.

Scegliere un fuso per una voce di questo tipo le dà quel fuso e mantiene i suoi orari sull'orologio. Non può tornare a essere una voce sull'orologio da parete.

### Quali calendari lo supportano

- I **calendari salvati in Mitra**, i [server di calendario](integrations/caldav.md) e [Google Calendar](integrations/google.md) conservano il fuso orario di ogni voce, e le altre app lo vedono.
- **[Notion](integrations/notion.md)** non ha fusi orari. I suoi orari compaiono nel tuo, e l'editor non ha la riga del fuso orario.
- **[Tempo](integrations/tempo.md)** legge i registri di lavoro nel fuso orario del tuo profilo Jira, e anche qui l'editor non ha la riga del fuso orario.
- Gli **[Abbonamenti](integrations/subscriptions.md)** sono di sola lettura: puoi vedere il fuso di una voce e passare tra i due orari, ma non cambiarlo.

## Fusi orari nella vista settimanale

La [vista settimanale](views/week.md) può mostrare le ore di altri fusi orari in colonne accanto alle tue, così vedi che ora è là a ogni ora della tua giornata.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zones-detail-dark.webp">
  <img src="../assets/screenshots/time-zones-detail-light.webp" alt="La vista settimanale con una colonna EDT di ore di New York accanto alla colonna GMT+2, così le 07:00 a Berlino risultano le 01:00 a New York" />
</picture>

### Aggiungere un fuso orario alla settimana

Punta la parte alta della colonna dell'ora e premi **＋** (**Aggiungi fuso orario**), poi scegli un fuso. La sua colonna compare accanto alla tua, e il tuo fuso resta la colonna vicina ai giorni.

Ogni colonna ha come intestazione un nome breve, come "PDT" o "GMT+2". Puntalo per vedere il nome completo.

### Rinominare o rimuovere un fuso orario

Clicca il nome di un fuso e scegli **Rinomina** per dargli un'etichetta tua, come "NYC", oppure **Rimuovi** per eliminare la sua colonna. Per tornare al nome automatico, rinominalo lasciando il campo vuoto.

Il tuo fuso si può rinominare, ma non rimuovere.

### Nascondere le colonne in più

Le colonne in più tolgono spazio ai giorni. Per nasconderle, punta la parte alta della colonna dell'ora e premi la freccia sotto il **＋**. Premila di nuovo per mostrarle. Puoi anche trascinare la colonna dell'ora verso i giorni per aprirle, e indietro per chiuderle, che è il modo da usare su uno schermo touch.

Su uno schermo stretto, le colonne partono nascoste finché non le apri o le chiudi tu stesso. Aggiungere un fuso le fa sempre comparire.

### Sui tuoi dispositivi

I fusi che aggiungi, e i loro nomi, appartengono al tuo account, quindi compaiono su ogni dispositivo che usi. Il nome che dai al tuo fuso, e se le colonne sono nascoste, restano su ciascun dispositivo, dato che ogni dispositivo può trovarsi in un fuso diverso.
