---
title: Log
description: Scegli quanto Mitra scrive nel log con MITRA_LOG_LEVEL, e quale livello aiuta con quale problema.
---

Mitra scrive il log sullo standard output, quindi `docker compose logs` mostra tutto:

```bash
docker compose logs -f mitra
```

Un server in salute è silenzioso di proposito: di default scrive solo ciò che conta. Alza il livello mentre cerchi la causa di un problema, e abbassalo di nuovo quando hai finito.

## Imposta il livello

```yaml
environment:
  MITRA_LOG_LEVEL: 'debug'
```

Ogni livello include tutto ciò che è più silenzioso:

| `MITRA_LOG_LEVEL` | Cosa ottieni |
| --- | --- |
| `error` | Solo i guasti. |
| `warn` | Anche i problemi che Mitra ha aggirato, come un promemoria che non è stato possibile consegnare, un geocoder che non ha risposto o un provider di accesso che non ha raggiunto. |
| `info` *(predefinito)* | Anche ciò che conta ogni giorno: l'avvio, gli accessi, gli account collegati, le modifiche sincronizzate dai provider e i promemoria inviati. |
| `debug` | Anche ogni richiesta con il suo stato e il suo tempo, ogni sincronizzazione, quando la sincronizzazione accelera o rallenta mentre le persone aprono e chiudono Mitra, le sessioni, le modifiche alle voci e le conversazioni con i server CalDAV. |
| `trace` | Anche ogni query al database e i dati grezzi del calendario. Ce n'è moltissimo. |

Mitra scrive nel log il livello con cui gira all'avvio.

> [!NOTE]
> Password, token e altri segreti non vengono mai scritti nel log, a nessun livello. `debug` e `trace` possono comunque mostrare titoli delle voci e dati del calendario, quindi dai un'occhiata a un log prima di condividerlo.

## Quale livello usare

- Quando un calendario non si sincronizza, `debug` mostra ogni sincronizzazione e le richieste a CalDAV e Notion.
- Quando i promemoria non arrivano, `info` registra già ogni promemoria man mano che parte, e `debug` aggiunge ogni tentativo di consegna e i dispositivi che sono stati scartati.
- Quando vedi una pagina di errore, `error` la riporta con lo stack trace, e anche il livello predefinito `info` la include.
- Quando ti serve vedere esattamente cosa ha inviato un provider, `trace` aggiunge i dati grezzi e le query al database. Lascialo attivo solo per poco.
