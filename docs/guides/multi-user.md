---
title: Multi-user & sign-in (OIDC)
description: Share one Mitra deployment with family or a team by connecting it to any OpenID Connect provider. Everyone signs in with their existing account.
---

By default Mitra is **single-user with no login**, which is fine when only you can reach it. To share one deployment with family or a team, connect it to any **OpenID Connect (OIDC)** provider. Everyone then signs in with their existing account and gets their own private calendars.

Mitra has been used with Pocket ID, Authelia, Authentik, Keycloak and Google, among others. Any standards-compliant OIDC provider works.

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

Then register this **redirect URI** at your provider. It is `MITRA_URL` plus `/auth/callback`:

```text
https://mitra.example.com/auth/callback
```

That's all the provider needs to know. Restart Mitra (`docker compose up -d`) and it switches into multi-user mode.

> [!NOTE]
> Setting `MITRA_OIDC_ISSUER` is the switch. `MITRA_OIDC_CLIENT_ID` and `MITRA_URL` are then **required** as well. If one is missing, Mitra refuses to start on purpose: quietly falling back to *no authentication* would be much worse.

### Public vs confidential clients

- **Confidential client**: register a client secret and set `MITRA_OIDC_CLIENT_SECRET`.
- **Public client**: leave the secret out. PKCE is always on, so a public client is fully supported.

### Scopes

`MITRA_OIDC_SCOPES` defaults to `openid profile email`. Override it only if your provider needs different scopes; `openid` is required, and `profile`/`email` populate the account's name and email.

## How sign-in works

- **Sign-in happens on the server** (Authorization Code flow with PKCE). Your browser only holds an opaque session cookie. **No tokens are kept in web storage**, so there is nothing for an XSS attack to steal.
- **Sessions are Mitra's own**: a random cookie token, stored hashed, with a sliding 30-day expiry. CSRF protection rests on `SameSite=Lax`.
- **HTTPS matters**: session cookies are marked `Secure` when `MITRA_URL` is `https://`. An `http://` issuer is allowed for LAN/compose-internal providers that have no TLS.
- **Single sign-out** works where your provider offers it: signing out of Mitra also ends your session at the provider.

## Accounts provision themselves

Anyone your provider lets in gets a Mitra account on **first sign-in**. There is no separate user list to manage in Mitra. **Control who may sign in from your provider** (by group, app assignment, or however your IdP scopes access). Each person's name and email refresh from the ID token on every sign-in.

## Turning OIDC on is a fresh start

> [!CAUTION]
> Enabling multi-user mode gives **every identity a brand-new, empty account, including the first person to sign in.** The calendars you added while the deployment was single-user do **not** carry over.

This is deliberate: there's no automatic migration of the single-user data to an OIDC identity. After your first sign-in, **add your integrations again**. The same applies the other way round: the single-user account and the OIDC accounts are separate.

## Troubleshooting

- **Boot fails with a missing-variable error.** When `MITRA_OIDC_ISSUER` is set, `MITRA_OIDC_CLIENT_ID` and `MITRA_URL` must be too.
- **Redirect/`invalid redirect_uri` errors at the provider.** The registered redirect URI must exactly equal `MITRA_URL` + `/auth/callback`.
- **"Discovery failed" in the logs.** Mitra discovers the provider metadata lazily and retries on the next sign-in, so an IdP that boots *after* Mitra in the same stack recovers on its own. If it keeps failing, the issuer URL is wrong, DNS doesn't resolve, or the provider is unreachable. Check at the [`debug` log level](logging.md).
- **My old calendars are gone after enabling OIDC.** That is expected. See [Turning OIDC on is a fresh start](#turning-oidc-on-is-a-fresh-start) and add your integrations again.
