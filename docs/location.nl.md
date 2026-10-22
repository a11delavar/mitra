---
title: Locatie
description: "Hoe het locatieveld plaatsen voorstelt, wat het waarheen stuurt, en hoe je je eigen geocoder gebruikt in plaats van de openbare."
---

Het locatieveld in de editor stelt plaatsen voor terwijl je typt. Je hebt geen API-sleutel en geen account nodig: Mitra gebruikt [Photon](https://photon.komoot.io), een gratis, opensource geocoder die is gebouwd op OpenStreetMap.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/location-detail-dark.webp">
  <img src="../assets/screenshots/location-detail-light.webp" alt="Een nieuw item met Genève getypt als locatie, met daaronder voorstellen: de stad, het vliegveld, het centraal station, het Palais des Nations, een park, en Geneva in Illinois" />
</picture>

## Voorstellen

Klik in het locatieveld om plaatsen te zien die je onlangs in je agenda's hebt gebruikt. Terwijl je typt, blijven alleen de plaatsen over die overeenkomen, en vanaf de tweede letter komen er plaatsen van Photon bij. Kies er een om de naam en het adres in te vullen, of typ gewoon verder: een locatie is gewone tekst, en je kunt erin zetten wat je wilt. Met de kaartknop naast het veld open je de locatie in Google Maps.

Voorstellen geven de voorkeur aan plaatsen bij jou in de buurt. De eerste keer dat je in het veld klikt, kan je browser vragen of Mitra je locatie mag gebruiken. Sta je dat toe, dan gaat je positie mee met elke zoekopdracht, zodat plaatsen in de buurt bovenaan staan. Sta je het niet toe, dan werken de voorstellen nog steeds, alleen zonder die voorkeur.

Photon geeft plaatsen een Engelse, Duitse of Franse naam als Mitra in een van die talen staat, en anders de naam in de plaatselijke taal.

Agenda's van [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) en [Tempo](integrations/tempo.md) kennen geen locatie, dus hun items hebben geen locatieveld.

## Privacy

Je browser maakt nooit contact met Photon. Zoekopdrachten gaan naar je Mitra-server, die Photon raadpleegt en de antwoorden doorgeeft. Photon ziet dus alleen het adres van je server, niet het jouwe. Wat je typt ziet Photon wel, en ook je positie als je die hebt toegestaan.

Recente plaatsen komen alleen uit je eigen agenda's. Op een server met meerdere gebruikers ziet niemand de plaatsen van een ander.

## Je eigen Photon-server gebruiken

Standaard raadpleegt Mitra de openbare Photon-server van komoot. Die heeft limieten voor redelijk gebruik en geeft geen garantie dat hij beschikbaar blijft. Wil je daar niet van afhankelijk zijn, [host Photon dan zelf](https://github.com/komoot/photon) en verwijs Mitra ernaar met `MITRA_PHOTON_URL`:

```yaml
environment:
  MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```

Na een herstart gaan zoekopdrachten naar jouw server. In de app verandert er niets. De andere instellingen vind je onder [Configuratie](configuration.md).

## Problemen oplossen

Zie je alleen recente plaatsen, dan heeft Photon niet binnen vijf seconden geantwoord of de zoekopdracht geweigerd. Dat gebeurt als de openbare server druk is of verzoeken beperkt. Mitra schrijft dan een waarschuwing in het [logboek](logging.md). Het veld accepteert nog steeds alles wat je typt, en met [je eigen Photon-server](#use-your-own-photon-server) heb je dit probleem niet.

Krijgen plaatsen een naam in een onverwachte taal, dan ligt dat aan Photon: het kent alleen Engels, Duits en Frans, en gebruikt voor elke andere taal de plaatselijke naam van een plaats.
