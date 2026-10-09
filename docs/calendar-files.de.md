---
title: Kalenderdateien
description: "Öffne .ics-Dateien und webcal://-Links mit Mitra und mach es zur Kalender-App, die dein Computer dafür verwendet."
---

Kalenderdateien (`.ics`) und Abonnement-Links (`webcal://`) sind der Weg, auf dem das Web Termine verteilt: eine Einladung als E-Mail-Anhang, ein Knopf „Zum Kalender hinzufügen“ auf einer Buchungsseite, ein Link „Abonnieren“ für den Spielplan eines Teams. Sobald Mitra installiert ist, kann es beides öffnen, und du kannst es zur App machen, die dein Computer dafür verwendet.

> [!NOTE]
> Zum Öffnen von Dateien und Links muss Mitra [als App installiert](install-app.md) sein, in einem Chromium-Browser auf einem Computer, etwa Chrome, Edge, Brave oder Opera. In jedem Browser kannst du aber weiterhin eine `.ics`-Datei auf Mitra ziehen.

## Mitra zum Standard machen

Installiere zuerst Mitra. Beim ersten Mal, wenn eine Kalenderdatei oder ein Link es öffnet, fragt dein Browser vielleicht, ob Mitra sie behandeln darf: Wähl **Erlauben**. Sag dann deinem System, dass es `.ics`-Dateien mit Mitra öffnen soll.

Unter Windows klick im Datei-Explorer mit der rechten Maustaste auf eine `.ics`-Datei und wähl **Öffnen mit → Andere App auswählen**. Wähl **Mitra** und dann **Immer**. Du kannst es später auch unter **Einstellungen → Apps → Standard-Apps** ändern.

Unter macOS klick im Finder mit gedrückter Control-Taste auf eine `.ics`-Datei und wähl **Informationen**. Wähl unter **Öffnen mit** **Mitra**, klick auf **Alle ändern…** und bestätige.

Unter Linux klick im Dateimanager mit der rechten Maustaste auf eine `.ics`-Datei und öffne **Eigenschaften → Öffnen mit**. Wähl **Mitra** und setz es als Standard.

Wenn Mitra schon offen ist, geht eine Datei oder ein Link, den du öffnest, an dieses Fenster, statt ein zweites zu öffnen.

## Eine Kalenderdatei hinzufügen

Öffne eine `.ics`-Datei mit Mitra oder zieh sie von deinem Desktop oder Dateimanager auf Mitra. Das Ziehen funktioniert auch in einem normalen Browser-Tab, ganz ohne Installation. Mehrere Dateien öffnen nacheinander.

Mitra fragt, zu welchem Kalender die Einträge hinzugefügt werden sollen. Bevor es etwas hinzufügt, zeigt es, was dieser Kalender nicht speichern kann: die Einträge, die es auslassen würde, und die Angaben, die manche Einträge verlieren würden, etwa Erinnerungen in einem Kalender, der keine hat. Um fortzufahren, drück die Schaltfläche, die nennt, wie viele Einträge hinzugefügt werden, etwa **12 Einträge hinzufügen**. Um einen anderen Kalender zu wählen, geh mit dem Pfeil zurück. Die Datei selbst ändert sich nie.

Jeder Eintrag wird als neue Kopie hinzugefügt. Fügst du dieselbe Datei zweimal hinzu, hast du also jeden Eintrag doppelt. Nichts, was schon in deinem Kalender steht, wird überschrieben.

Teilaufgaben und Abhängigkeiten zwischen Einträgen derselben Datei bleiben nach dem Import verknüpft. Eine Wiederholungsserie behält ihre gelöschten Termine als gelöscht. Eine Serie mit bearbeiteten Terminen, etwa einer Besprechung, die auf einen anderen Tag verschoben wurde, wird ausgelassen, weil Mitra eine Serie nicht zusammen mit ihren Änderungen hinzufügen kann.

Wenn das Hinzufügen auf halbem Weg scheitert, entfernt Mitra die Einträge, die es schon hinzugefügt hatte, damit nichts aus der Datei halb importiert bleibt. Wenn es einige nicht entfernen kann, sagt es dir, wie viele du von Hand löschen musst.

## Von einem webcal-Link abonnieren

Websites, auf denen du einen Kalender abonnieren kannst, etwa Spielpläne, Schulferien oder Feiertage, verlinken meist eine `webcal://`-Adresse. Klick auf eine, und Mitra öffnet das Formular **Kalenderabonnement** mit eingetragener Adresse. Prüf sie, füll **Benutzername (optional)** und **Passwort (optional)** aus, falls der Feed sie braucht, und drück **Verbinden**. Schalte dann den Kalender ein und drück **Speichern**.

Der Klick auf den Link abonniert nie von selbst: Mitra ruft den Feed erst ab, wenn du **Verbinden** drückst.

Ein Abonnement ist ein schreibgeschützter Kalender, den Mitra anhand des Feeds aktuell hält. Wie das funktioniert, steht unter [Kalenderabonnements](integrations/subscriptions.md).
