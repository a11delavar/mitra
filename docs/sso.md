---
title: Single sign-on
description: Share one Mitra server with family or a team. Everyone signs in through an OpenID Connect provider with an account they already have.
---

Out of the box, Mitra is for one person and has no sign-in, which is fine while only you can reach it. To share one server with family or a team, connect it to an OpenID Connect (OIDC) provider. Everyone then signs in with an account they already have, and gets calendars of their own that nobody else sees.

Mitra works with any standard OIDC provider. People use it with Pocket ID, Authelia, Authentik, Keycloak and Google, among others.

> [!CAUTION]
> Turning sign-in on gives every person a new, empty account, including you. Whatever you set up while Mitra was for one person stays with that old account and doesn't carry over: your connected accounts, your settings, and every entry in your [Mitra calendars](integrations/mitra.md). Connected accounts are quick to add again, but entries in Mitra calendars can't follow you. Turn sign-in on before you start filling Mitra, or move those entries into a connected calendar first (**Move entries to…** in the calendar's **⋯** menu) and connect that account again afterwards.

## Turn on sign-in

Set the OIDC variables on the container:

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

At your provider, register `MITRA_URL` followed by `/auth/callback` as the redirect address:

```text
https://mitra.example.com/auth/callback
```

That's all the provider needs. Restart Mitra with `docker compose up -d`, and it asks everyone to sign in.

Setting `MITRA_OIDC_ISSUER` is what turns sign-in on, and it needs `MITRA_OIDC_CLIENT_ID` and `MITRA_URL` too. If one of them is missing, Mitra refuses to start. Quietly running without sign-in would be much worse.

## Client secret and scopes

If you registered a client secret at your provider, set `MITRA_OIDC_CLIENT_SECRET`. If you registered a public client, leave it out; that's fully supported, since Mitra always uses PKCE.

Mitra asks for the scopes `openid profile email`. `openid` is required, and the other two give Mitra each person's name and email. Change them with `MITRA_OIDC_SCOPES` only if your provider needs something else.

## Who can sign in

Anyone your provider lets through gets a Mitra account the first time they sign in. There's no user list to manage in Mitra, so decide who may sign in at your provider, by group, app assignment or however it handles access. Each person's name and email are updated from the provider every time they sign in.

## How sign-in works

The sign-in itself happens on the server (the authorization code flow with PKCE). Your browser only gets a cookie, and no tokens are kept in its storage, so a malicious script on the page has nothing to steal.

A session lasts 30 days from the last time you used Mitra. The cookie is marked secure when `MITRA_URL` starts with `https://`, and an `http://` issuer is allowed for providers on your own network without HTTPS. If your provider supports it, signing out of Mitra signs you out there as well.

## Troubleshooting

- **Mitra won't start and names a missing variable.** With `MITRA_OIDC_ISSUER` set, `MITRA_OIDC_CLIENT_ID` and `MITRA_URL` must be set too.
- **The provider complains about the redirect address.** It must be exactly `MITRA_URL` followed by `/auth/callback`.
- **The log says discovery failed.** Mitra looks up your provider on the first sign-in and tries again on the next one, so a provider that starts after Mitra sorts itself out. If it keeps failing, check the issuer URL and whether Mitra can reach it, with the [log level](logging.md) at `debug`.
- **My calendars are gone after turning on sign-in.** That's expected: everyone starts with a new account. Connect your accounts again.
