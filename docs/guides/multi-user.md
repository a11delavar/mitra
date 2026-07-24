---
title: Multi-user & sign-in (OIDC)
description: Share one Mitra deployment with family or a team by connecting it to any OpenID Connect provider — everyone signs in with their existing account.
sidebar:
  order: 1
---

Out of the box Mitra is **single-user with no login** — fine when only you can reach it. To share one deployment with family or a team, connect it to any **OpenID Connect (OIDC)** provider. Everyone then signs in with their existing account and gets their own private calendars.

Mitra has been used with Pocket ID, Authelia, Authentik, Keycloak, and Google, among others — any standards-compliant OIDC provider works.

## Enable multi-user mode

Set the OIDC variables on your deployment:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'          # the URL users reach Mitra at
      MITRA_OIDC_ISSUER: 'https://auth.example.com'   # your provider's issuer URL
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'                   # omit for a public client (PKCE is always on)
      # MITRA_OIDC_SCOPES: 'openid profile email'     # the default
    # …
```

Then register this **redirect URI** at your provider — `MITRA_URL` plus `/auth/callback`:

```text
https://mitra.example.com/auth/callback
```

That's all the provider needs to know. Restart Mitra (`docker compose up -d`) and it switches into multi-user mode.

> [!NOTE]
> Setting `MITRA_OIDC_ISSUER` is the switch. `MITRA_OIDC_CLIENT_ID` and `MITRA_URL` become **required** alongside it — a half-configured issuer fails the boot loudly on purpose. A calendar silently falling back to *no authentication* would be far worse than not starting.

### Public vs confidential clients

- **Confidential client** — register a client secret and set `MITRA_OIDC_CLIENT_SECRET`.
- **Public client** — omit the secret entirely. PKCE is always on, so a public client is fully supported.

### Scopes

`MITRA_OIDC_SCOPES` defaults to `openid profile email`. Override it only if your provider needs different scopes; `openid` is required, and `profile`/`email` populate the account's name and email.

## How sign-in works

- **Sign-in happens on the server** (Authorization Code flow with PKCE). Your browser only ever holds an opaque session cookie — **no tokens live in web storage**, so there's nothing for XSS to steal.
- **Sessions are Mitra's own**: a random cookie token, stored hashed, with a sliding 30-day expiry. CSRF protection rests on `SameSite=Lax`.
- **HTTPS matters**: session cookies are marked `Secure` when `MITRA_URL` is `https://`. An `http://` issuer is allowed for LAN/compose-internal providers that have no TLS.
- **Single sign-out** is supported where your provider offers it — signing out of Mitra ends the upstream SSO session too.

## Accounts provision themselves

Anyone your provider authenticates gets a Mitra account on **first sign-in** — there's no separate user list to manage in Mitra. **Control who may sign in from your provider** (by group, app assignment, or however your IdP scopes access). Each person's name and email refresh from the ID token on every sign-in.

## Turning OIDC on is a fresh start

> [!CAUTION]
> Enabling multi-user mode gives **every identity — including the first person to sign in — a brand-new, empty account.** The calendars you added while the deployment was single-user do **not** carry over.

This is deliberate: there's no automatic migration of the single-user data to an OIDC identity. After your first sign-in, simply **re-add your integrations**. (The same applies in reverse — the single-user account and OIDC accounts are separate.)

## Troubleshooting

- **Boot fails with a missing-variable error.** When `MITRA_OIDC_ISSUER` is set, `MITRA_OIDC_CLIENT_ID` and `MITRA_URL` must be too.
- **Redirect/`invalid redirect_uri` errors at the provider.** The registered redirect URI must exactly equal `MITRA_URL` + `/auth/callback`.
- **"Discovery failed" in the logs.** Mitra discovers the provider metadata lazily and retries on the next sign-in, so an IdP that boots *after* Mitra in the same stack recovers on its own. A persistent failure means a wrong issuer URL, DNS, or an unreachable IdP — check at [`debug` log level](logging.md).
- **My old calendars are gone after enabling OIDC.** Expected — see [Turning OIDC on is a fresh start](#turning-oidc-on-is-a-fresh-start). Re-add your integrations.
