---
title: Back-ups
description: Alles wat Mitra opslaat, staat in één map. Maak er een back-up van met de tool die je al gebruikt.
---

Mitra bewaart alles in één map: `/app/data` in de container, en dat is `~/mitra` op de host als je [Aan de slag](README.md#install-mitra) hebt gevolgd. Maak een back-up van die map, en je hebt een back-up van de hele instantie. Er is geen databaseserver om te dumpen en er zijn geen configuratiebestanden om bij elkaar te zoeken.

> [!CAUTION]
> Voor een deel van wat je in Mitra bewaart, is deze map het enige exemplaar. Elk item in een [Mitra-agenda](integrations/mitra.md) staat hier en nergens anders. Hetzelfde geldt voor je accounts en inlogsessies, de inloggegevens van verbonden accounts, je instellingen, de kleuren, volgorde en namen van je agenda's, je [beschikbaarheid](availability.md), de volgorde van je taken, de [bestanden die je aan items hebt toegevoegd](attachments.md), een deel van de koppelingen tussen items, en de sleutel waar de [herinneringen](reminders.md) op je apparaten van afhangen. Raak je de map kwijt, dan kan een aanbieder je zijn afspraken en taken teruggeven, maar verder niets.

## Een back-up maken

Richt de tool die je al gebruikt op de map: [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, een snapshot van het bestandssysteem of de VM, of gewoon een archief.

De veiligste kopie maak je terwijl Mitra is gestopt:

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

Kun je Mitra niet stoppen, dan gaat het kopiëren van de map terwijl Mitra draait meestal goed, want SQLite kan daar prima mee overweg. Een snapshot van het bestandssysteem of de VM geeft je een consistente kopie zonder dat je iets hoeft te stoppen.

## Terugzetten

Stop Mitra, zet de map terug en start Mitra opnieuw:

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

Zet de map altijd in zijn geheel terug. De bestanden erin horen bij elkaar, en als je bestanden van verschillende dagen door elkaar haalt, kan de instantie onbruikbaar worden. Een back-up van een oudere versie kun je zonder problemen terugzetten op een nieuwere image, want Mitra werkt zijn database bij het starten bij.

## Wat een back-up niet dekt

Afspraken en taken in verbonden accounts, zoals een [CalDAV](integrations/caldav.md)-server, [Google Agenda](integrations/google.md) of [Notion](integrations/notion.md), staan bij die aanbieders. Een back-up bevat de kopie die Mitra ervan heeft, en na het terugzetten synchroniseert Mitra ze opnieuw.

Je omgevingsvariabelen staan in je `compose.yaml` of `.env`-bestand, niet in de datamap. Bewaar die ook goed, in versiebeheer of in je opslag voor geheimen.
