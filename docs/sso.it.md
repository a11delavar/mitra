---
title: Single sign-on
description: Condividi un solo server Mitra con la famiglia o un team. Ognuno accede tramite un provider OpenID Connect con un account che ha già.
---

Di serie, Mitra è pensato per una sola persona e non ha accesso con account, il che va bene finché solo tu puoi raggiungerlo. Per condividere un server con la famiglia o un team, collegalo a un provider OpenID Connect (OIDC). Ognuno accede allora con un account che ha già, e ottiene calendari propri che nessun altro vede.

Mitra funziona con qualsiasi provider OIDC standard. Le persone lo usano con Pocket ID, Authelia, Authentik, Keycloak e Google, tra gli altri.

> [!CAUTION]
> Attivare l'accesso con account dà a ogni persona un account nuovo e vuoto, compreso te. Tutto ciò che hai configurato quando Mitra era per una sola persona resta con quel vecchio account e non viene trasferito: i tuoi account collegati, le tue impostazioni e ogni voce nei tuoi [calendari Mitra](integrations/mitra.md). Gli account collegati si aggiungono di nuovo in fretta, ma le voci nei calendari Mitra non possono seguirti. Attiva l'accesso con account prima di iniziare a riempire Mitra, oppure sposta prima quelle voci in un calendario collegato (**Sposta le voci in…** nel menu **⋯** del calendario) e collega poi di nuovo quell'account.

## Attivare l'accesso con account

Imposta le variabili OIDC sul container:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'          # the address people use to reach Mitra
      MITRA_OIDC_ISSUER: 'https://auth.example.com'   # your provider's issuer URL
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'                   # leave out for a public client
```

Presso il tuo provider, registra `MITRA_URL` seguito da `/auth/callback` come indirizzo di reindirizzamento:

```text
https://mitra.example.com/auth/callback
```

Al provider serve solo questo. Riavvia Mitra con `docker compose up -d`, e chiederà a tutti di accedere.

È l'impostazione di `MITRA_OIDC_ISSUER` ad attivare l'accesso con account, e servono anche `MITRA_OIDC_CLIENT_ID` e `MITRA_URL`. Se ne manca una, Mitra si rifiuta di avviarsi. Funzionare in silenzio senza accesso con account sarebbe molto peggio.

## Segreto client e scope

Se hai registrato un segreto client presso il tuo provider, imposta `MITRA_OIDC_CLIENT_SECRET`. Se hai registrato un client pubblico, omettilo; è pienamente supportato, perché Mitra usa sempre PKCE.

Mitra richiede gli scope `openid profile email`. `openid` è obbligatorio, e gli altri due danno a Mitra nome ed email di ciascuno. Cambiali con `MITRA_OIDC_SCOPES` solo se il tuo provider ha bisogno di qualcos'altro.

## Chi può accedere

Chiunque il tuo provider lasci passare ottiene un account Mitra la prima volta che accede. In Mitra non c'è nessun elenco di utenti da gestire, quindi decidi chi può accedere presso il tuo provider, per gruppo, assegnazione all'app o come preferisce gestire gli accessi. Nome ed email di ciascuno vengono aggiornati dal provider a ogni accesso.

## Come funziona l'accesso

L'accesso vero e proprio avviene sul server (l'authorization code flow con PKCE). Il tuo browser riceve solo un cookie, e nel suo storage non viene conservato nessun token, quindi uno script malevolo nella pagina non ha nulla da rubare.

Una sessione dura 30 giorni dall'ultima volta che hai usato Mitra. Il cookie è marcato come sicuro quando `MITRA_URL` inizia con `https://`, ed è ammesso un issuer `http://` per i provider nella tua rete senza HTTPS. Se il tuo provider lo supporta, uscire da Mitra ti fa uscire anche lì.

## Risoluzione dei problemi

- **Mitra non si avvia e nomina una variabile mancante.** Con `MITRA_OIDC_ISSUER` impostata, devono essere impostate anche `MITRA_OIDC_CLIENT_ID` e `MITRA_URL`.
- **Il provider si lamenta dell'indirizzo di reindirizzamento.** Deve essere esattamente `MITRA_URL` seguito da `/auth/callback`.
- **Il log dice che il discovery è fallito.** Mitra cerca il tuo provider al primo accesso e riprova al successivo, quindi un provider che parte dopo Mitra si sistema da solo. Se continua a fallire, controlla l'URL dell'issuer e se Mitra riesce a raggiungerlo, con il [livello di log](logging.md) su `debug`.
- **I miei calendari sono spariti dopo aver attivato l'accesso con account.** È normale: tutti partono con un account nuovo. Collega di nuovo i tuoi account.
