---
title: Kalenderabonnements
description: Abonniere einen veröffentlichten Kalenderlink, etwa eine webcal://-Adresse oder einen .ics-Feed, und sieh seine Einträge schreibgeschützt in Mitra.
---

Viele Kalender werden veröffentlicht statt geteilt: Feiertage, Spielpläne, Schulferien, ein Feed aus einem Werkzeug bei der Arbeit oder die private Adresse deines eigenen Google- oder Outlook-Kalenders. Bei diesen meldest du dich nicht an. Du abonnierst sie mit einem Link.

Ein **Kalenderabonnement** bringt einen solchen Link als eigenen Kalender in Mitra, mit seinen Terminen und, falls vorhanden, seinen Aufgaben.

Abonnements sind schreibgeschützt. Der Feed liegt auf einem anderen Server, der keine Änderungen annimmt, deshalb zeigt Mitra, was er veröffentlicht, und schreibt nie zurück. Du kannst den Kalender trotzdem umbenennen, umfärben, umsortieren und ausblenden; siehe [Schreibgeschützte Kalender](../calendars.md#read-only-calendars). Um eine bearbeitbare Kopie seiner Einträge zu behalten, nutze **Einträge kopieren nach…** in seinem **⋯**-Menü.

## Einen Kalender abonnieren

1. Wähle unten in der Seitenleiste **Integration hinzufügen** und dann **Kalenderabonnement**.
2. Füge den Link bei **Kalender-URL** ein. Das ist entweder eine `webcal://`-Adresse, wie „Abonnieren“-Schaltflächen sie oft liefern, oder eine `https://`-Adresse, meist mit der Endung `.ics`.
3. Lass **Benutzername (optional)** und **Passwort (optional)** leer, es sei denn, der Feed verlangt sie (siehe [Feeds mit Passwort](#feeds-with-a-password)).
4. Drück auf **Verbinden**. Mitra liest den Feed und listet seinen Kalender auf.
5. Lass ihn eingeschaltet und drück auf **Speichern**.

Ein Link ist ein Kalender. Um mehrere zu abonnieren, füge für jeden ein Abonnement hinzu.

Der Kalender übernimmt seinen Namen vom Feed und, falls der Feed eine hat, auch seine Farbe. Du kannst ihn in der Seitenleiste umbenennen, und dein Name bleibt, bis der Feed den Kalender selbst umbenennt.

Wenn du [Mitra zu deiner Standard-Kalender-App gemacht](../calendar-files.md) hast, öffnet ein Klick auf einen `webcal://`-Link auf einer Webseite dieses Formular mit ausgefülltem Link.

### Wo du einen Kalenderlink findest

| Anbieter | Wo du suchst |
| --- | --- |
| Google Calendar | In den Einstellungen des Kalenders, **Integrate calendar** → **Secret address in iCal format** |
| Outlook und Microsoft 365 | **Share** → **Publish a calendar**, dann den ICS-Link kopieren |
| iCloud | Rechtsklick auf den Kalender → **Share Calendar** → **Public Calendar** |
| Nextcloud | Im **⋯**-Menü des Kalenders → **Copy subscription link** |
| Öffentliche Kalender | Die meisten Websites mit Feiertagen, Spielplänen und Schulterminen bieten einen `.ics`-Link an |

> [!CAUTION]
> Eine geheime Adresse ist ein Passwort in Form eines Links: Wer sie hat, kann den Kalender lesen. Behalte sie für dich und setze sie in den Einstellungen deines Anbieters zurück, falls sie je nach außen gelangt.

### Feeds mit Passwort

Die meisten veröffentlichten Feeds tragen ihren Zugangsschlüssel im Link selbst und brauchen sonst nichts. Wenn ein Feed, etwa auf einem Firmen- oder selbst gehosteten Server, nach Benutzername und Passwort fragt (HTTP Basic Authentication), gib sie beim Abonnieren ein. Mitra behält das Passwort auf dem Server und schickt es nie zurück an deinen Browser.

## So bleibt er aktuell

Mitra synchronisiert jedes Abonnement alle 15 Minuten, egal ob jemand Mitra geöffnet hat, deshalb holt das Öffnen von Mitra einen Feed nicht früher (siehe [So funktioniert das Synchronisieren](README.md#how-syncing-works)). Eine Synchronisierung kostet wenig: Mitra fragt den Server des Feeds, ob sich etwas geändert hat, und lädt den Kalender nur herunter, wenn ja.

Der Kalender spiegelt den Feed. Einträge, die zum Feed hinzukommen, erscheinen in Mitra, und Einträge, die daraus verschwinden, verschwinden auch dort.

Wenn der Kalender einmal falsch aussieht, liest **Einträge neu importieren** in seinem **⋯**-Menü den Feed noch einmal von Anfang an. Der Feed selbst wird nie angetastet. Siehe [Einen Kalender neu importieren](../calendars.md#re-import-a-calendar).

## Fehlerbehebung

- Wenn Mitra „The calendar requires a username and password“ meldet, ist der Feed geschützt. Gib den Benutzernamen und das Passwort ein, die er braucht.
- Wenn Mitra „No calendar was found at that address“ meldet, prüfe den Link auf Tippfehler. Eine geheime Adresse funktioniert auch nicht mehr, wenn ihr Besitzer sie zurücksetzt.
- Wenn Mitra „The address did not return a calendar“ meldet, führt der Link auf eine Webseite statt auf den Feed. Suche nach einem Link mit iCal, ICS oder Abonnieren.
- Wenn Mitra „The calendar is too large to subscribe to“ meldet, ist der Feed größer als 20 MB, was Mitra nicht liest.
