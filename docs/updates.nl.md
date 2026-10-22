---
title: Updates
description: Hoe Mitra je laat weten dat er een nieuwe versie is, wat die controle verstuurt, hoe je haar uitschakelt en hoe je bijwerkt.
---

Mitra laat je weten wanneer er een nieuwere versie is dan de versie die je gebruikt. Het werkt zichzelf nooit bij: de nieuwe versie binnenhalen doe je zelf.

## De update-indicator

Is er iets nieuwers, dan verschijnt er een stipje op het logo in de zijbalk. Klik op de naam van je instantie om **Over** te openen. Daar zie je welke versie en commit je gebruikt, met een link naar wat er nieuw is. Met **Kopiëren** kopieer je de versiegegevens, precies wat er in een bugmelding hoort.

**Wat is er nieuw** in het [opdrachtenpalet](shortcuts.md#command-palette) toont de wijzigingen van elke versie. Nadat je server is bijgewerkt, toont Mitra in elk tabblad dat al open stond de knop **Opnieuw laden om de update af te ronden**.

Gebruik je een uitgebrachte versie (`latest`, `0.6` of een exacte versie), dan wijst Mitra je op de nieuwste versie. Gebruik je de `dev`-image, dan wijst het je op de nieuwste commits op `main` en laat het zien hoeveel commits die voorlopen.

## Wat de controle verstuurt

De server, nooit je browser, vraagt een paar keer per dag aan GitHub of er iets nieuwers is. Het verzoek bevat over je instantie niets meer dan elk verzoek bevat: je IP-adres, en de draaiende versie in de user agent. Geen telemetrie, geen identificatiegegevens, geen tellingen.

Kan de server GitHub niet bereiken, dan legt hij dat één keer vast in het logboek en houdt hij zich daarna stil.

Wil je de controle helemaal uitschakelen, zet `MITRA_UPDATE_CHECK` dan op `off` (`false`, `0` en `no` werken ook):

```yaml
environment:
  MITRA_UPDATE_CHECK: 'off'
```

## Een image-tag kiezen

De tag bepaalt hoe snel je overstapt op nieuwe versies.

| Tag | Wat je krijgt |
| --- | --- |
| `latest` | De nieuwste versie. |
| `0.6` | De nieuwste `0.6.x`-versie: wel oplossingen, maar geen nieuwe minor-versie. |
| `0.6.0` | Precies die versie. |
| `dev` | De laatste commit op `main`, om dingen uit te proberen voordat ze zijn uitgebracht. |

Tot 1.0 kan een nieuwe minor-versie (van 0.6 naar 0.7) dingen veranderen waar je op vertrouwt. Wil je liever zelf bepalen wanneer dat gebeurt, gebruik dan `0.6` en stap over zodra je er klaar voor bent. Alle tags staan op [GitHub](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Mitra bijwerken

Haal de nieuwe image binnen en maak de container opnieuw aan:

```bash
docker compose pull
docker compose up -d
```

Je gegevens staan in de gekoppelde map, dus die blijven bewaard. Verandert de nieuwe versie iets aan de database, dan werkt Mitra die bij het starten bij. Daar hoef je zelf nooit iets aan te doen. Tools zoals [Watchtower](https://containrrr.dev/watchtower/) kunnen dit volgens een schema voor je doen.

Welke versie je krijgt, hangt af van je [image-tag](#choose-an-image-tag). Voordat je overstapt op een nieuwe minor-versie, is het de moeite waard om de [releaseopmerkingen](https://github.com/a11delavar/mitra/releases) te lezen.
