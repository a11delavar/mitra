---
title: App installieren
description: "Installiere Mitra als App auf einem Computer, einem Android-Handy, einem iPhone oder einem iPad, sodass es in einem eigenen Fenster öffnet."
---

Mitra läuft in deinem Browser, und du kannst es auch als App installieren. Nichts kommt aus einem App-Store: Dein Browser gibt Mitra ein eigenes Fenster und ein eigenes Symbol, und du öffnest es wie jede andere App über Dock, Taskleiste, Startmenü oder Startbildschirm.

Das Installieren lohnt sich aus drei Gründen:

- Mitra öffnet in einem eigenen Fenster, getrennt von deinen Browser-Tabs, und seine Benachrichtigungen erscheinen unter eigenem Namen und Symbol.
- Auf einem iPhone oder iPad ist es der einzige Weg zu [Erinnerungen](reminders.md).
- Auf einem Computer kann Mitra `.ics`-Dateien und `webcal://`-Links für dich öffnen. Siehe [Kalenderdateien](calendar-files.md).

Die installierte App heißt immer Mitra und hat Mitras Symbol, auch wenn dein Server der Instanz [einen eigenen Namen](configuration.md#name-your-instance) gibt.

## Auf einem Computer

Öffne Mitra in Chrome, Edge oder einem anderen Chromium-Browser und klick auf das Installationssymbol am Ende der Adressleiste. Wenn der Browser anbietet, Mitra zu installieren, zeigt auch die Seitenleiste unten eine Schaltfläche **Als App installieren**. Du kannst auch über das Browsermenü gehen: in Chrome **Streamen, speichern und teilen → Seite als App installieren**, in Edge **Apps → Diese Website als App installieren**.

In Safari auf einem Mac wähl **Ablage → Zum Dock hinzufügen**.

Nach der Installation öffnet Mitra in einem eigenen Fenster. Wenn dieses Fenster schon offen ist, während du eine Kalenderdatei oder einen Link öffnest, holt Mitra es nach vorn, statt ein zweites zu öffnen.

## Auf Android

Öffne Mitra in Chrome, öffne das Browsermenü (**⋮**) und wähl **App installieren** oder **Zum Startbildschirm hinzufügen**. Mitra erscheint dann bei deinen anderen Apps.

Erinnerungen funktionieren auf Android auch im Browser, das Installieren ist also deine Entscheidung.

## Auf iPhone und iPad

Öffne Mitra in Safari, tipp auf die Teilen-Schaltfläche und dann auf **Zum Home-Bildschirm**. Öffne Mitra von da an über sein Symbol auf deinem Home-Bildschirm.

Auf iPhone und iPad funktionieren Benachrichtigungen ab iOS und iPadOS 16.4 nur in der installierten App. Erlaube sie in der installierten App selbst: Safari und die App sind getrennt, und nur die App kann Erinnerungen erhalten.

> [!NOTE]
> Wenn dein Server hinter einem Reverse Proxy steht, der dich per Cookie anmeldet, funktioniert das Installieren trotzdem. Mitra fragt seine App-Beschreibung (das Web-App-Manifest) mit deinen Cookies ab, damit der Proxy die Anfrage durchlässt.
