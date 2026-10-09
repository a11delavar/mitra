---
title: Links
description: "Wie Mitra die Links in einem Eintrag zeigt: die Besprechung zum Beitreten, die Notiz zum Öffnen, die Seite zum Lesen."
---

Links in einem Eintrag zeigen, wohin sie führen, statt ihrer rohen Adresse. Ein Besprechungslink lautet **Google Meet beitreten**, ein Link zu einer Obsidian-Notiz zeigt den Namen der Notiz, und eine Webseite zeigt ihre Website und ihren Pfad, etwa `example.atlassian.net/browse/DEV-9177`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/links-detail-dark.webp">
  <img src="../assets/screenshots/links-detail-light.webp" alt="Der Editor eines Eintrags mit einer Zeile Links über der Beschreibung, die einen Link zu einer Notiz in Obsidian enthält" />
</picture>

## Im Editor

Enthält die Beschreibung eines Eintrags Links, sammelt der Editor sie in einer Zeile **Links** direkt über der Beschreibung, sodass du sie öffnen kannst, ohne den Text durchzulesen. Klick einen an, um ihn zu öffnen: Eine Webseite öffnet sich in einem neuen Tab, jeder andere Link öffnet seine App. Ab zwei Zeilen scrollt die Zeile.

Die Zeile hat keinen eigenen Speicher: Sie zeigt, was die Beschreibung enthält. Um einen Link hinzuzufügen oder zu entfernen, bearbeite die Beschreibung, und die Zeile folgt. Jede andere Kalender-App, die du nutzt, sieht dieselben Links in der Beschreibung.

## In der Beschreibung

Links in der Beschreibung beginnen mit einem kleinen Symbol für das, was sie öffnen. Eine nackte Adresse, etwa aus einem Browser eingefügt, wird auf Website und Pfad gekürzt. Ein Link, den du mit eigenen Worten geschrieben hast, behält deine Worte.

Mitra erkennt auch Links von Apps, etwa `obsidian://open?vault=…`, die die meisten Kalender-Apps als einfachen Text stehen lassen. Links, die Code ausführen würden, wie `javascript:`, werden als einfacher Text und nie als Links angezeigt.

## Besprechungs- und App-Links im Ort

Ein Ort, der aus einem einzigen Link besteht, wird als dieser Link behandelt statt als Ort. Ein Link zu Zoom, Google Meet, Microsoft Teams, Webex, Jitsi, Whereby, FaceTime oder Skype erscheint als **Beitreten** mit dem Namen des Dienstes, im Editor, im Kalender und in der Tabelle. Er bekommt keine Kartenschaltfläche. Klick neben den Link, um ihn zu bearbeiten.

## Links zu Apps

Mitra benennt die App, zu der ein Link gehört, anhand seiner Adresse. Es kennt Obsidian, Notion, Slack, Linear, Figma, Things, OmniFocus, Bear, Craft, Drafts, DEVONthink, Evernote, OneNote, Visual Studio Code, Cursor und Spotify. Jeder App-Link, bekannt oder nicht, zeigt dasselbe Symbol zum Öffnen in einer anderen App.

> [!NOTE]
> Eine Webseite kann nicht erkennen, ob eine App installiert ist. Beim ersten Öffnen eines App-Links fragt dein Browser, ob die App geöffnet werden soll. Fehlt die App, passiert nichts.
