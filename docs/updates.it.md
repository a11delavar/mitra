---
title: Aggiornamenti
description: Come Mitra ti avvisa delle nuove versioni, cosa invia quel controllo, come disattivarlo e come aggiornare.
---

Mitra ti avvisa quando esiste una versione più recente di quella che stai usando. Non si aggiorna mai da solo: scaricare la nuova versione spetta a te.

## L'indicatore di aggiornamento

Quando esiste qualcosa di più recente, compare un piccolo punto sul logo nella barra laterale. Clicca sul nome della tua istanza per aprire **Informazioni**, che mostra la versione e il commit che stai usando e collega a ciò che c'è di nuovo. **Copia** lì copia i dettagli della versione, che è ciò che serve per una segnalazione di bug.

**Novità**, nella [palette dei comandi](shortcuts.md#command-palette), elenca le modifiche di ogni versione. Dopo l'aggiornamento del tuo server, Mitra mostra **Ricarica per completare l'aggiornamento** in ogni scheda rimasta aperta da prima.

Se usi una release (`latest`, `0.6` o una versione esatta), ti indica la release più recente. Se usi l'immagine `dev`, ti indica i commit più recenti su `main` e quanto sono avanti.

## Cosa invia il controllo

È il server, mai il tuo browser, a chiedere a GitHub un paio di volte al giorno se c'è qualcosa di più recente. La richiesta non porta nulla della tua istanza oltre a ciò che porta ogni richiesta: il tuo indirizzo IP e la versione in uso nello user agent. Nessuna telemetria, nessun identificatore, nessun conteggio.

Se il server non riesce a raggiungere GitHub, lo scrive nel log una volta sola e poi tace.

Per disattivare del tutto il controllo, imposta `MITRA_UPDATE_CHECK` su `off` (vanno bene anche `false`, `0` e `no`):

```yaml
environment:
  MITRA_UPDATE_CHECK: 'off'
```

## Scegli un tag dell'immagine

Il tag decide con quanta prontezza passi alle nuove versioni.

| Tag | Cosa ottieni |
| --- | --- |
| `latest` | La release più recente. |
| `0.6` | La release `0.6.x` più recente: correzioni, ma nessuna nuova versione minore. |
| `0.6.0` | Esattamente quella versione. |
| `dev` | L'ultimo commit su `main`, per provare le novità prima che vengano rilasciate. |

Fino alla 1.0, una nuova versione minore (da 0.6 a 0.7) può cambiare cose su cui fai affidamento. Se preferisci scegliere tu quando succede, usa `0.6` e passa oltre quando sei pronto. Tutti i tag sono elencati su [GitHub](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Aggiorna Mitra

Scarica la nuova immagine e ricrea il container:

```bash
docker compose pull
docker compose up -d
```

I tuoi dati stanno nella cartella montata, quindi si conservano. Se la nuova versione modifica il database, Mitra lo aggiorna all'avvio e non devi mai toccarlo tu. Strumenti come [Watchtower](https://containrrr.dev/watchtower/) possono farlo per te a intervalli regolari.

La versione che ottieni dipende dal tuo [tag dell'immagine](#choose-an-image-tag). Prima di passare a una nuova versione minore, vale la pena leggere le [note di rilascio](https://github.com/a11delavar/mitra/releases).
