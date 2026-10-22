---
title: Single sign-on
description: Deel één Mitra-server met je gezin of een team. Iedereen logt in via een OpenID Connect-provider, met een account dat hij al heeft.
---

Standaard is Mitra voor één persoon en heeft het geen inlogscherm. Dat is prima zolang alleen jij erbij kunt. Wil je één server delen met je gezin of een team, verbind hem dan met een OpenID Connect-provider (OIDC). Iedereen logt dan in met een account dat hij al heeft, en krijgt eigen agenda's die niemand anders ziet.

Mitra werkt met elke standaard-OIDC-provider. Mensen gebruiken het onder meer met Pocket ID, Authelia, Authentik, Keycloak en Google.

> [!CAUTION]
> Zet je inloggen aan, dan krijgt iedereen een nieuw, leeg account, jij ook. Wat je hebt ingesteld zolang Mitra voor één persoon was, blijft bij dat oude account en gaat niet mee: je verbonden accounts, je instellingen en elk item in je [Mitra-agenda's](integrations/mitra.md). Verbonden accounts voeg je snel opnieuw toe, maar items in Mitra-agenda's kunnen niet mee. Zet inloggen dus aan voordat je Mitra gaat vullen, of verplaats die items eerst naar een verbonden agenda (**Items verplaatsen naar…** in het **⋯**-menu van de agenda) en verbind dat account daarna opnieuw.

## Inloggen aanzetten

Stel de OIDC-variabelen in op de container:

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

Registreer bij je provider `MITRA_URL` gevolgd door `/auth/callback` als redirect-adres:

```text
https://mitra.example.com/auth/callback
```

Meer heeft de provider niet nodig. Start Mitra opnieuw met `docker compose up -d`, en het vraagt iedereen om in te loggen.

Inloggen gaat aan zodra `MITRA_OIDC_ISSUER` is ingesteld, en daarvoor zijn ook `MITRA_OIDC_CLIENT_ID` en `MITRA_URL` nodig. Ontbreekt er een, dan weigert Mitra te starten. Stilletjes zonder inloggen draaien zou veel erger zijn.

## Clientgeheim en scopes

Heb je bij je provider een clientgeheim geregistreerd, stel dan `MITRA_OIDC_CLIENT_SECRET` in. Heb je een openbare client geregistreerd, laat het dan weg. Dat wordt volledig ondersteund, omdat Mitra altijd PKCE gebruikt.

Mitra vraagt om de scopes `openid profile email`. `openid` is verplicht, en de andere twee geven Mitra de naam en het e-mailadres van elke persoon. Wijzig ze met `MITRA_OIDC_SCOPES` alleen als je provider iets anders nodig heeft.

## Wie kan inloggen

Iedereen die je provider doorlaat, krijgt een Mitra-account zodra hij voor het eerst inlogt. In Mitra is er geen gebruikerslijst om te beheren. Bepaal dus bij je provider wie mag inloggen, via groepen, app-toewijzing of hoe die provider toegang ook regelt. De naam en het e-mailadres van elke persoon worden bij elke keer inloggen bijgewerkt vanuit de provider.

## Hoe inloggen werkt

Het inloggen zelf gebeurt op de server (de authorization code flow met PKCE). Je browser krijgt alleen een cookie, en er worden geen tokens in de opslag van de browser bewaard. Een kwaadaardig script op de pagina heeft dus niets om te stelen.

Een sessie duurt 30 dagen vanaf de laatste keer dat je Mitra hebt gebruikt. De cookie wordt als beveiligd gemarkeerd als `MITRA_URL` met `https://` begint, en een `http://`-issuer is toegestaan voor providers op je eigen netwerk zonder HTTPS. Als je provider het ondersteunt, log je bij het uitloggen uit Mitra daar ook uit.

## Probleemoplossing

- **Mitra start niet en noemt een ontbrekende variabele.** Als `MITRA_OIDC_ISSUER` is ingesteld, moeten `MITRA_OIDC_CLIENT_ID` en `MITRA_URL` ook zijn ingesteld.
- **De provider klaagt over het redirect-adres.** Dat moet precies `MITRA_URL` zijn, gevolgd door `/auth/callback`.
- **Het log meldt dat discovery is mislukt.** Mitra zoekt je provider op bij de eerste keer inloggen en probeert het bij de volgende keer opnieuw. Een provider die na Mitra opstart, komt dus vanzelf goed. Blijft het mislukken, controleer dan de issuer-URL en of Mitra die kan bereiken, met het [logniveau](logging.md) op `debug`.
- **Mijn agenda's zijn weg nadat ik inloggen heb aangezet.** Dat is de bedoeling: iedereen begint met een nieuw account. Verbind je accounts opnieuw.
