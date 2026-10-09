---
title: Tempo
description: Vedi nel tuo calendario le ore che registri in Tempo, e registrale, spostale, ridimensionale ed eliminale da Mitra.
---

[Tempo](https://www.tempo.io/) è un'app di tracciamento del tempo per Jira. Mitra mostra i tuoi **worklog**, le ore che hai registrato sulle issue di Jira, come voci con orario nel tuo calendario, accanto alle riunioni e alle attività in cui il tempo è andato.

I worklog si sincronizzano in entrambe le direzioni. Sposta o ridimensiona una voce per cambiare quando e per quanto hai lavorato, modifica la sua descrizione per cambiare la nota del worklog, eliminala per eliminare il worklog, oppure creane una per registrare nuovo tempo.

Ti colleghi dall'app con due token API. Sul server non c'è nulla da configurare.

## Collegare il tuo timesheet

Mitra ha bisogno di un token di Tempo e di uno di Atlassian: Tempo conserva le ore, e Jira conosce le issue e chi sei.

1. Crea un token API di Tempo. In Jira apri **Settings** di Tempo (l'icona dell'ingranaggio) → **Data Access** → **API integration**, scegli **New Token**, chiamalo «Mitra» e copia il token.
2. Crea un token API di Atlassian su [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) con **Create API token**, e copialo. Crea entrambi i token come lo stesso utente Jira.
3. In Mitra, scegli **Aggiungi integrazione** in fondo alla barra laterale, poi **Tempo**, e compila:
   - **URL del sito**, il tuo indirizzo Atlassian, come `https://your-company.atlassian.net`.
   - **Token API Tempo**, il token del passaggio 1.
   - **E-mail dell'account Atlassian**, l'indirizzo email del tuo account Atlassian.
   - **Token API Atlassian**, il token del passaggio 2.
4. Premi **Connetti**. Mitra elenca un calendario, **My worklogs**.
5. Lascialo attivo e premi **Salva**.

Tempo limita la frequenza con cui le app possono interrogarlo, quindi Mitra lo sincronizza circa una volta al minuto (vedi [come funziona la sincronizzazione](README.md#how-syncing-works)).

## Come appaiono i worklog

Il titolo di una voce è la issue Jira su cui è registrato il tempo, con la sua chiave e il suo riepilogo:

```text
ACME-1234 Code review for auth migration
```

La nota del worklog è la descrizione della voce. L'app di Tempo li mostra allo stesso modo, perché la issue dice a cosa era dedicato il tempo, mentre la nota è spesso un'etichetta di attività come «Review», o un testo che Jira ha scritto per te, come «Working on work item ACME-1234».

Il titolo appartiene alla issue, quindi non puoi modificarlo su un worklog salvato: Mitra non rinomina una issue Jira perché hai modificato una voce del calendario. Modifica la descrizione per dire cosa hai fatto. Se Jira non riesce a nominare la issue, perché è stata eliminata o non puoi più vederla, il titolo mostra `#` e l'ID della issue, e la voce continua a funzionare.

Tempo salva i worklog come semplici orari dell'orologio, senza fuso orario. Mitra li legge nel fuso orario del tuo profilo Jira, così compaiono agli stessi orari di Tempo.

Alcuni siti Tempo disattivano gli orari di inizio. Lì ogni worklog di un giorno inizia alla stessa ora, quindi si sovrappongono, ma le durate sono giuste.

## Registrare tempo da Mitra

Crea una voce con orario in **My worklogs** e metti la chiave della issue Jira in un punto qualsiasi del titolo:

| Cosa scrivi | Registrato su |
| --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` |
| `Investigating ACME-1234 regression` | `ACME-1234` |
| `ACME-1234` | `ACME-1234` |

Mitra controlla la chiave rispetto ai progetti Jira che puoi vedere. Se il titolo non contiene una chiave del genere, o Jira non ha quella issue, Mitra non registra nulla e ti dice perché.

La nota del worklog è ciò che hai scritto nella descrizione o, se l'hai lasciata vuota, l'intero titolo così come l'hai digitato. Una volta registrato il tempo, il titolo diventa la chiave e il riepilogo della issue. Questo scambio avviene una volta sola, al momento della registrazione, ed è per questo che puoi modificare il titolo mentre lo scrivi e non dopo.

> [!TIP]
> Per registrare tempo su una issue su cui hai già registrato, duplica una delle sue voci: tieni premuto <kbd>Alt</kbd> (<kbd>⌥</kbd> su Mac) mentre la trascini al nuovo orario, oppure scegli **Duplica** nel menu **⋯** del suo editor.

## Modificare un worklog

Spostare, ridimensionare, eliminare e modificare la descrizione vanno direttamente a Tempo. Alcune cose da sapere:

- Un worklog resta sulla sua issue. Tempo non può spostare un worklog su un'altra issue, quindi per registrare il tempo altrove, elimina la voce e creane una nuova con la chiave giusta.
- Mitra conserva i dettagli propri di Tempo di un worklog, come il tempo fatturabile e gli attributi di lavoro, quando lo modifica.
- Quando un periodo di timesheet è chiuso o approvato in Tempo, Tempo rifiuta di aggiungere, modificare o eliminare worklog al suo interno.

Per aprire la issue in Jira, scegli **Apri in Jira** nel menu **⋯** dell'editor.

## Cosa non può contenere un worklog

Un worklog è un intervallo di tempo in un giorno, registrato su una issue. Quindi un calendario Tempo contiene solo voci con orario: niente voci di tutto il giorno, ripetizioni, promemoria, luogo, partecipanti, relazioni, occupato o disponibile, visibilità né [disponibilità](../availability.md). Mitra nasconde questi campi sui worklog.

## Risoluzione dei problemi

- Se Mitra dice «Tempo rejected the API token», crea un nuovo token API di Tempo e inseriscilo da **⋯ → Modifica** dell'account.
- Se Mitra dice «Jira rejected the e-mail and API token», controlla che l'indirizzo email appartenga all'account Atlassian che ha creato il token API.
- Se i worklog compaiono all'ora sbagliata del giorno, controlla il fuso orario nel tuo profilo Jira (**Account settings** → **Time zone**). Dopo averlo cambiato, usa **Reimporta voci** nel menu **⋯** di **My worklogs**, così si spostano anche i worklog che hai già.
- Se i worklog si sovrappongono alla stessa ora ogni giorno, il tuo sito Tempo ha disattivato gli orari di inizio. Le ore sono comunque giuste.
