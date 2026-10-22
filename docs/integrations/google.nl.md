---
title: Google Agenda
description: Stel inloggen via Google één keer in voor je Mitra-server, verbind daarna Google-accounts vanuit de app en synchroniseer hun agenda's in beide richtingen.
---

Mitra maakt verbinding met Google Agenda via CalDAV, net als met elke andere agendaserver. Het verschil zit in het inloggen: Google accepteert geen wachtwoord, maar vraagt je om op een eigen pagina toegang te verlenen. Daarvoor moet Google je Mitra-server kennen. Wie de server beheert, registreert hem daarom één keer bij Google en geeft Mitra de client-ID en het clientgeheim die Google uitgeeft.

Daarna verbindt iedereen die Mitra gebruikt zijn eigen Google-account vanuit de app, elk met een eigen toestemming. Het instellen gaat in drie stappen:

1. [Mitra registreren bij Google](#register-mitra-with-google).
2. [Mitra de client-ID en het clientgeheim geven](#give-mitra-the-client-id-and-secret).
3. [Een account verbinden](#connect-an-account).

De eerste twee stappen doe je één keer per Mitra-server.

## Mitra registreren bij Google

1. Maak een project aan in de [Google Cloud console](https://console.cloud.google.com) en schakel onder **APIs & Services** de **CalDAV API** in.
2. Stel het **OAuth consent screen** (het toestemmingsscherm) in. Voeg jezelf en iedereen die een account gaat verbinden toe als **test user**, of publiceer de app.
3. Maak een **OAuth client** aan van het type **Web application**. Vul als **authorized redirect URI** het adres van je Mitra-server in, gevolgd door `/api/integrations/google/callback`:

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Kopieer de **client ID** en het **client secret** die Google je toont.

> [!CAUTION]
> Zolang het toestemmingsscherm in de testfase is, laat Google elke toestemming na 7 dagen verlopen, en moet iedereen zijn account elke week opnieuw verbinden. Publiceer de app om toestemmingen voorgoed te behouden.

## Mitra de client-ID en het clientgeheim geven

Stel ze in als omgevingsvariabelen, samen met `MITRA_URL`, het adres van je server:

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

Start Mitra daarna opnieuw:

```bash
docker compose up -d
```

Stel beide variabelen in of geen van beide. Met een client-ID maar zonder geheim weigert Mitra te starten, zodat een half afgemaakte configuratie nooit onopgemerkt blijft.

`MITRA_URL` moet overeenkomen met het adres in je redirect-URI. Zonder deze variabele gebruikt Mitra het adres waarop je het hebt geopend. Dat is genoeg om het op `localhost` uit te proberen. Voor alles behalve `localhost` accepteert Google alleen redirect-adressen met `https://`, dus een echte server heeft [HTTPS](../configuration.md#put-it-behind-https) en `MITRA_URL` nodig. Alle variabelen staan in [Configuratie](../configuration.md#all-variables).

## Een account verbinden

1. Kies onder in de zijbalk **Integratie toevoegen** en daarna **Google Agenda**.
2. Klik op **Doorgaan met Google**. Google vraagt je een account te kiezen en Mitra toe te staan je agenda's te bekijken en te wijzigen.
3. Terug in Mitra zie je de agenda's van het account, allemaal ingeschakeld. Zet de agenda's uit die je niet wilt en klik op **Opslaan**.

Verbind je hetzelfde Google-account nog een keer, dan wordt de toestemming vernieuwd in plaats van dat het account een tweede keer wordt toegevoegd.

Google beperkt hoe vaak apps het mogen aanroepen, daarom synchroniseert Mitra Google-accounts ongeveer één keer per minuut (zie [hoe synchroniseren werkt](README.md#how-syncing-works)).

## Agenda's die met je zijn gedeeld

Agenda's waarvan je de eigenaar bent, verschijnen zodra je verbinding maakt. Agenda's die anderen met je hebben gedeeld, zoals die van een team of een collega, komen pas bij andere apps terecht als je dat toestaat in je Google-instellingen:

1. Open [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect) terwijl je bent ingelogd bij Google.
2. Vink onder **Shared Calendars** elke agenda aan die je in Mitra wilt zien, en klik op **Save**.
3. Open in Mitra het **⋯**-menu van het account in de zijbalk, kies **Bewerken** en klik op **Vernieuwen**.
4. Zet de agenda's aan die verschijnen en klik op **Opslaan**.

Een agenda die met je is gedeeld met **See all event details** is in Mitra alleen-lezen: je ziet alles wat erin staat, maar je kunt geen afspraken toevoegen, wijzigen of verwijderen. Geeft de eigenaar je later **Make changes to events**, dan kun je bij de volgende synchronisatie bewerken. Zie [Alleen-lezen agenda's](../calendars.md#read-only-calendars).

## Wat er synchroniseert

Alles synchroniseert zoals bij [CalDAV](caldav.md#what-syncs), behalve relaties tussen items: Google laat die weg uit zijn kopie van een afspraak, daarom biedt Mitra ze niet aan in Google-agenda's.

[Bijlagen](../attachments.md) in een Google-agenda zijn de Google Drive-bestanden die je in Google Agenda toevoegt. Mitra toont ze en opent elk ervan in Drive, maar kan er geen toevoegen of verwijderen: Google bewaart alleen Drive-bestanden en laat een bijlage weg die een andere app toevoegt.

[Beschikbaarheid](../availability.md) die je in een Google-agenda als bezet markeert, wordt als bezette afspraken aan die agenda toegevoegd, zodat anderen zien dat die tijd al bezet is. Het werkt zoals beschreven bij [CalDAV](caldav.md#busy-availability).

## Je Google-token

Het token dat Google uitgeeft, verlaat de server nooit. Je browser komt alleen langs de pagina van Google om toegang te verlenen. Mitra bewaart het token bij het account en gebruikt het om bij elke synchronisatie kortstondige toegang te krijgen.

## Een account loskoppelen

Kies **Verwijderen** in het **⋯**-menu van het account om het, samen met het token, uit Mitra te verwijderen. Wil je de toegang van Mitra ook aan de kant van Google intrekken, verwijder Mitra dan uit de [koppelingen met apps van derden in je Google-account](https://myaccount.google.com/permissions). Doe je alleen dat, dan stopt het synchroniseren ook: het account blijft in Mitra staan, maar elke synchronisatie mislukt tot je het opnieuw verbindt.

## Probleemoplossing

- Zie je na het kiezen van **Google Agenda** de melding dat het niet op deze server is ingesteld, in plaats van de knop **Doorgaan met Google**, dan zijn `MITRA_GOOGLE_CLIENT_ID` en `MITRA_GOOGLE_CLIENT_SECRET` niet ingesteld, of is Mitra nog niet opnieuw gestart sinds je ze hebt ingesteld.
- Antwoordt Google met `redirect_uri_mismatch`, dan komt de redirect-URI in de Google Cloud console niet overeen met `MITRA_URL` gevolgd door `/api/integrations/google/callback`. Die moet precies overeenkomen, inclusief `https://` en zonder slash aan het einde.
- Stoppen accounts na 7 dagen met synchroniseren, dan staat je toestemmingsscherm nog in de testfase. Publiceer de app en verbind de accounts daarna opnieuw.
