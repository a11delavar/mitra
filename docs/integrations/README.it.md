---
title: Integrazioni
description: Tieni i calendari in Mitra stesso, oppure collega CalDAV, Google Calendar, Apple Calendar, abbonamenti a calendari, Notion e Tempo, e scopri come funziona la sincronizzazione.
sidebar:
  label: Panoramica
---

Ci sono due modi per tenere un calendario in Mitra. Puoi salvarlo in Mitra stesso, sul tuo server, senza alcun account dietro. Oppure puoi collegare un account che hai già, e Mitra tiene sincronizzati i suoi calendari in entrambe le direzioni. Per lo più si finisce con un mix dei due, e le voci passano liberamente dall'uno all'altro.

Per aggiungere uno dei due, scegli **Aggiungi integrazione** in fondo alla barra laterale.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/integrations-detail-dark.webp">
  <img src="../../assets/screenshots/integrations-detail-light.webp" alt="La finestra Aggiungi integrazione, che propone Mitra, CalDAV, Google Calendar, Apple Calendar, abbonamenti a calendari, Notion e Tempo" />
</picture>

## Cosa contiene ognuna

| Integrazione | Cosa contiene | Configurazione sul server |
| --- | --- | --- |
| [Mitra](mitra.md) | Eventi e attività, salvati in Mitra | Nessuna |
| [CalDAV](caldav.md) | Eventi e attività di qualsiasi server CalDAV | Nessuna |
| [Google Calendar](google.md) | I calendari di un account Google | Una configurazione OAuth una tantum |
| [Apple Calendar](apple.md) | I calendari di un account iCloud | Nessuna |
| [Abbonamenti a calendari](subscriptions.md) | Un feed `webcal://` o `.ics` pubblicato, in sola lettura | Nessuna |
| [Notion](notion.md) | Attività dalle viste dei database di Notion | Nessuna |
| [Tempo](tempo.md) | Le ore che registri sulle issue di Jira | Nessuna |

Ogni provider salva cose diverse. Le attività di Notion, per esempio, non possono ripetersi, e un worklog di Tempo non ha un luogo. Mitra nasconde i campi che un calendario non può salvare, così nulla di ciò che scrivi sparisce alla sincronizzazione successiva.

## Come funziona la sincronizzazione

Quando colleghi un account, Mitra trova i suoi calendari e li elenca, tutti spuntati. Togli la spunta a quelli che non vuoi prima di salvare, e Mitra importa gli altri. I calendari che compaiono nell'account più tardi arrivano senza spunta, così niente di nuovo finisce nel tuo calendario senza una tua scelta. Mitra non scarica mai un calendario disattivato.

Dopo di che, il server sincronizza da solo in background. Controlla più spesso mentre qualcuno ha Mitra aperto e rallenta quando nessuno lo usa:

| | Con Mitra aperto | Con nessuno che lo ha aperto |
| --- | --- | --- |
| CalDAV e Apple Calendar | ogni 10 secondi | ogni 5 minuti |
| Google Calendar, Notion e Tempo | circa una volta al minuto | ogni 5 minuti |
| Abbonamenti a calendari | ogni 15 minuti | ogni 15 minuti |
| Calendari Mitra | niente da sincronizzare | niente da sincronizzare |

Google, Notion e Tempo limitano la frequenza con cui le app possono interrogarli, ed è per questo che sono più lenti. Quando apri Mitra, ogni account in scadenza si sincronizza subito, quindi non c'è nessun pulsante di aggiornamento da premere.

Le modifiche vanno in entrambe le direzioni. Quando crei, modifichi, sposti o elimini una voce, Mitra la riscrive nel calendario a cui appartiene. Se un account dà errore, gli altri non restano bloccati: Mitra riprova con quello un minuto dopo.

Alcuni calendari non si possono modificare da Mitra, come gli abbonamenti e i calendari condivisi con te in sola visualizzazione. Puoi comunque rinominarli, cambiarne il colore e nasconderli; vedi [Calendari in sola lettura](../calendars.md#read-only-calendars).

> [!NOTE]
> La sincronizzazione scarica solo ciò che è cambiato. Se un calendario ti sembra sbagliato, **Reimporta voci** nel suo menu **⋯** scarta la copia di Mitra e lo importa di nuovo dal provider; vedi [Reimportare un calendario](../calendars.md#re-import-a-calendar). In entrambi i casi nulla cambia presso il provider.

## Cambiare un account

Ogni account si può collegare una sola volta. Per cambiarne la password, o quali dei suoi calendari Mitra mostra, scegli **Modifica** nel suo menu **⋯** invece di aggiungerlo di nuovo. Google Calendar fa eccezione: collegare di nuovo lo stesso account Google rinnova l'accesso di Mitra.
