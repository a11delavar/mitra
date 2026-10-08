---
title: Google Calendar
description: Configura una volta sola l'accesso con Google per il tuo server Mitra, poi collega gli account Google dall'app e sincronizza i loro calendari in entrambe le direzioni.
---

Mitra si collega a Google Calendar via CalDAV, come a qualsiasi server di calendari. La differenza sta nell'accesso: Google non accetta una password, ti chiede di concedere l'accesso dalla sua pagina. Per questo Google deve conoscere il tuo server Mitra, quindi chi gestisce il server lo registra una volta presso Google e dà a Mitra l'ID client e il segreto che Google fornisce.

Dopo di che, chiunque usi Mitra collega il proprio account Google dall'app, ciascuno con la propria autorizzazione. La configurazione si fa in tre passaggi:

1. [Registrare Mitra presso Google](#register-mitra-with-google).
2. [Dare a Mitra l'ID client e il segreto](#give-mitra-the-client-id-and-secret).
3. [Collegare un account](#connect-an-account).

I primi due si fanno una volta per ogni server Mitra.

## Registrare Mitra presso Google

1. Crea un progetto nella [console Google Cloud](https://console.cloud.google.com) e, sotto **APIs & Services**, abilita la **CalDAV API**.
2. Configura la **OAuth consent screen**. Aggiungi te stesso e tutti gli altri che collegheranno un account come **test user**, oppure pubblica l'app.
3. Crea un **OAuth client** di tipo **Web application**. Come **authorized redirect URI**, inserisci l'indirizzo del tuo server Mitra seguito da `/api/integrations/google/callback`:

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Copia il **client ID** e il **client secret** che Google ti mostra.

> [!CAUTION]
> Finché la schermata di consenso è in modalità di test, Google termina ogni autorizzazione dopo 7 giorni, e tutti devono ricollegare il proprio account ogni settimana. Pubblica l'app per mantenere le autorizzazioni definitivamente.

## Dare a Mitra l'ID client e il segreto

Impostali come variabili d'ambiente, insieme a `MITRA_URL`, l'indirizzo del tuo server:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'
    # …
```

Poi riavvia Mitra:

```bash
docker compose up -d
```

Imposta entrambe le variabili o nessuna. Mitra si rifiuta di avviarsi con un ID client e senza segreto, così una configurazione lasciata a metà non passa inosservata.

`MITRA_URL` deve corrispondere all'indirizzo nel tuo redirect URI. Senza, Mitra usa l'indirizzo con cui l'hai aperto, che basta per provarlo su `localhost`. Google accetta solo indirizzi di reindirizzamento `https://` per tutto ciò che non è `localhost`, quindi un server vero ha bisogno di [HTTPS](../configuration.md#put-it-behind-https) e di `MITRA_URL`. Tutte le variabili sono elencate in [Configurazione](../configuration.md#all-variables).

## Collegare un account

1. Scegli **Aggiungi integrazione** in fondo alla barra laterale, poi **Google Calendar**.
2. Premi **Continua con Google**. Google ti chiede di scegliere un account e di lasciare che Mitra veda e modifichi i tuoi calendari.
3. Tornato in Mitra, vedi elencati i calendari dell'account, tutti attivi. Disattiva quelli che non vuoi, poi premi **Salva**.

Collegare di nuovo lo stesso account Google rinnova la sua autorizzazione invece di aggiungerlo una seconda volta.

Google limita la frequenza con cui le app possono interrogarlo, quindi Mitra sincronizza gli account Google circa una volta al minuto (vedi [come funziona la sincronizzazione](README.md#how-syncing-works)).

## Calendari condivisi con te

I calendari di cui sei proprietario compaiono appena ti colleghi. I calendari che altre persone hanno condiviso con te, come quello di un team o di un collega, arrivano alle altre app solo dopo che lo consenti nelle impostazioni di Google:

1. Con l'accesso a Google effettuato, apri [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect).
2. Sotto **Shared Calendars**, spunta ogni calendario che vuoi in Mitra e premi **Save**.
3. In Mitra, apri il menu **⋯** dell'account nella barra laterale, scegli **Modifica** e premi **Aggiorna**.
4. Attiva i calendari che compaiono, poi premi **Salva**.

Un calendario condiviso con te come **See all event details** è in sola lettura in Mitra: vedi tutto ciò che contiene, ma non puoi aggiungere, modificare o eliminare eventi. Se il proprietario ti dà in seguito **Make changes to events**, la modifica si attiva con la sincronizzazione successiva. Vedi [Calendari in sola lettura](../calendars.md#read-only-calendars).

## Cosa si sincronizza

Tutto si sincronizza come per [CalDAV](caldav.md#what-syncs), tranne le relazioni tra le voci. Google le elimina dalla sua copia di un evento, quindi Mitra non le offre sui calendari Google.

La [disponibilità](../availability.md) che contrassegni come occupato in un calendario Google viene aggiunta a quel calendario come eventi occupati, così gli altri vedono il tempo come impegnato. Funziona come descritto per [CalDAV](caldav.md#busy-availability).

## Il tuo token Google

Il token che Google rilascia non lascia mai il server. Il tuo browser passa solo dalla pagina di Google per concedere l'accesso. Mitra conserva il token insieme all'account e lo usa per ottenere un accesso di breve durata a ogni sincronizzazione.

## Scollegare un account

Scegli **Elimina** nel menu **⋯** dell'account per rimuoverlo, insieme al suo token, da Mitra. Per revocare l'accesso di Mitra anche dal lato di Google, rimuovi Mitra dalle [connessioni di terze parti del tuo account Google](https://myaccount.google.com/permissions). Fare solo questo interrompe anche la sincronizzazione: l'account resta in Mitra, ma ogni sincronizzazione fallisce finché non lo colleghi di nuovo.

## Risoluzione dei problemi

- Se scegliendo **Google Calendar** compare una nota che dice che non è configurato su questo server invece del pulsante **Continua con Google**, `MITRA_GOOGLE_CLIENT_ID` e `MITRA_GOOGLE_CLIENT_SECRET` non sono impostati, oppure Mitra non è stato riavviato dopo averli impostati.
- Se Google risponde `redirect_uri_mismatch`, il redirect URI nella console Google Cloud non corrisponde a `MITRA_URL` seguito da `/api/integrations/google/callback`. Deve coincidere esattamente, compreso `https://` e senza barra finale.
- Se gli account smettono di sincronizzarsi dopo 7 giorni, la tua schermata di consenso è ancora in modalità di test. Pubblica l'app, poi ricollega gli account.
