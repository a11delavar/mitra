---
title: Luogo
description: "Come il campo del luogo suggerisce posti, cosa invia e dove, e come usare un tuo geocoder invece di quello pubblico."
---

Il campo del luogo nell'editor delle voci suggerisce posti mentre scrivi. Non richiede chiavi API né registrazione: Mitra usa [Photon](https://photon.komoot.io), un geocoder gratuito e open source basato su OpenStreetMap.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/location-detail-dark.webp">
  <img src="../assets/screenshots/location-detail-light.webp" alt="Una nuova voce con Ginevra scritta nel luogo e dei suggerimenti sotto: la città, il suo aeroporto, la stazione centrale, il Palazzo delle Nazioni, un parco e Geneva in Illinois" />
</picture>

## Suggerimenti

Clicca nel campo del luogo per vedere i posti usati di recente nei tuoi calendari. Mentre scrivi, si restringono a quelli che corrispondono e, dalla seconda lettera in poi, si aggiungono i posti di Photon. Sceglierne uno ne compila il nome e l'indirizzo, oppure continua a scrivere: un luogo è testo semplice e puoi scrivere ciò che vuoi. Il pulsante della mappa accanto al campo apre il luogo in Google Maps.

I suggerimenti favoriscono i posti vicini a te. La prima volta che clicchi nel campo, il browser può chiedere se Mitra può usare la tua posizione. Se consenti, la tua posizione accompagna ogni ricerca, così i posti vicini vengono per primi. Se non consenti, i suggerimenti funzionano comunque, senza quella preferenza.

Photon nomina i posti in inglese, tedesco o francese quando il tuo browser è impostato su una di queste lingue, e nella lingua locale altrimenti.

I calendari [Notion](integrations/notion.md) e [Tempo](integrations/tempo.md) non hanno un luogo, quindi le loro voci non hanno il campo del luogo.

## Privacy

Il tuo browser non contatta mai Photon. Le ricerche vanno al tuo server Mitra, che interroga Photon e ti passa le risposte, quindi Photon vede soltanto l'indirizzo del tuo server, non il tuo. Vede però ciò che scrivi e, se lo hai consentito, la tua posizione.

I posti recenti provengono solo dai tuoi calendari. Su un server con più utenti, nessuno vede i posti di un altro utente.

## Usare un tuo server Photon

Per impostazione predefinita, Mitra interroga il server Photon pubblico di komoot, che ha limiti di uso equo e nessuna promessa di restare attivo. Per non dipendere da lui, [ospita Photon da te](https://github.com/komoot/photon) e indirizza Mitra verso di esso con `MITRA_PHOTON_URL`:

```yaml
environment:
  MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```

Dopo un riavvio, le ricerche vanno al tuo server. Nell'app non cambia nulla. Vedi [Configurazione](configuration.md) per le altre impostazioni.

## Risoluzione dei problemi

Se compaiono solo i posti recenti, Photon non ha risposto entro cinque secondi o ha rifiutato la ricerca, cosa che accade quando il server pubblico è occupato o limita le richieste. Mitra scrive un avviso nel suo [log](logging.md). Il campo accetta comunque tutto ciò che scrivi, e [un tuo server Photon](#use-your-own-photon-server) evita il problema.

Se i posti sono nominati in una lingua inattesa, è un limite di Photon: conosce solo inglese, tedesco e francese, e usa il nome locale di ogni posto per qualsiasi altra lingua.
