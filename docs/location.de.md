---
title: Ort
description: "Wie das Ortsfeld Orte vorschlägt, was es wohin sendet und wie du statt des öffentlichen Dienstes deinen eigenen Geocoder nutzt."
---

Das Ortsfeld im Eintragseditor schlägt Orte vor, während du tippst. Du brauchst dafür keinen API-Schlüssel und keine Registrierung: Mitra nutzt [Photon](https://photon.komoot.io), einen kostenlosen Open-Source-Geocoder auf Basis von OpenStreetMap.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/location-detail-dark.webp">
  <img src="../assets/screenshots/location-detail-light.webp" alt="Ein neuer Eintrag mit „Genf“ im Ortsfeld und Vorschlägen darunter: die Stadt, ihr Flughafen, ihr Hauptbahnhof, der Palais des Nations, ein Park und Geneva in Illinois" />
</picture>

## Vorschläge

Klick ins Ortsfeld, um Orte zu sehen, die du zuletzt in deinen Kalendern verwendet hast. Beim Tippen werden es immer weniger, nur die passenden bleiben, und ab dem zweiten Buchstaben kommen Orte von Photon dazu. Wähl einen aus, um seinen Namen und seine Adresse einzutragen, oder tipp einfach weiter: Ein Ort ist reiner Text, du kannst alles schreiben. Die Karten-Schaltfläche neben dem Feld öffnet den Ort in Google Maps.

Die Vorschläge bevorzugen Orte in deiner Nähe. Wenn du zum ersten Mal ins Feld klickst, fragt dein Browser vielleicht, ob Mitra deinen Standort verwenden darf. Wenn du zustimmst, geht deine Position bei jeder Suche mit, und Orte in der Nähe stehen vorn. Wenn nicht, funktionieren die Vorschläge trotzdem, nur ohne diese Gewichtung.

Photon nennt Orte auf Englisch, Deutsch oder Französisch, wenn dein Browser auf eine dieser Sprachen eingestellt ist, sonst in der Landessprache.

Kalender von [Notion](integrations/notion.md) und [Tempo](integrations/tempo.md) haben keinen Ort, deshalb haben ihre Einträge kein Ortsfeld.

## Datenschutz

Dein Browser nimmt nie Kontakt zu Photon auf. Suchen gehen an deinen Mitra-Server, der Photon fragt und die Antworten weitergibt. Photon sieht also nur die Adresse deines Servers, nicht deine. Es sieht aber, was du tippst und, falls du es erlaubt hast, deine Position.

Zuletzt verwendete Orte stammen nur aus deinen eigenen Kalendern. Auf einem Server mit mehreren Nutzern sieht niemand die Orte eines anderen.

## Eigenen Photon-Server verwenden

Standardmäßig fragt Mitra den öffentlichen Photon-Server von komoot, der Fair-Use-Grenzen hat und keine Verfügbarkeit verspricht. Um dich nicht darauf zu verlassen, [betreibe Photon selbst](https://github.com/komoot/photon) und richte Mitra mit `MITRA_PHOTON_URL` darauf aus:

```yaml
environment:
  MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```

Nach einem Neustart gehen Suchen an deinen Server. In der App ändert sich nichts. Die übrigen Einstellungen findest du unter [Konfiguration](configuration.md).

## Fehlerbehebung

Wenn nur zuletzt verwendete Orte erscheinen, hat Photon nicht innerhalb von fünf Sekunden geantwortet oder die Suche abgelehnt. Das passiert, wenn der öffentliche Server ausgelastet ist oder Anfragen begrenzt. Mitra schreibt dann eine Warnung ins [Log](logging.md). Das Feld nimmt weiterhin alles an, was du tippst, und [dein eigener Photon-Server](#use-your-own-photon-server) löst das Problem.

Wenn Orte in einer unerwarteten Sprache benannt sind, liegt das an Photon: Es kennt nur Englisch, Deutsch und Französisch und verwendet für jede andere Sprache den lokalen Namen des Ortes.
