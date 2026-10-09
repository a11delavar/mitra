---
title: Erinnerungen
description: Füge Terminen und Aufgaben Erinnerungen hinzu, wähle die Erinnerungen, mit denen neue Einträge beginnen, und verwalte die Geräte, die sie bekommen.
---

Eine Erinnerung weist dich vorab auf einen Termin oder eine Aufgabe hin, als Benachrichtigung deines Systems, auch wenn Mitra nicht geöffnet ist. Sie kommt von deinem eigenen Mitra-Server, du musst dich also bei keinem anderen Dienst anmelden. Auf einem iPhone oder iPad brauchen Erinnerungen Mitra [als installierte App](install-app.md), überall sonst genügt der Browser.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/notifications-detail-dark.webp">
  <img src="../assets/screenshots/notifications-detail-light.webp" alt="Die Einstellungsseite Benachrichtigungen mit den Standarderinnerungen, der Browserberechtigung und der Geräteliste" />
</picture>

## Eine Erinnerung hinzufügen

Öffne einen Eintrag und drück auf **＋** in seiner Erinnerungszeile, der mit der Glocke. Wähle, wann sie ausgelöst werden soll: **Zu Beginn des Termins** (**Zum Zeitpunkt der Aufgabe** bei einer Aufgabe), 5 oder 10 Minuten, eine halbe Stunde, eine Stunde oder einen Tag vorher oder **Benutzerdefiniert…** für jede andere Zeit. Ein Eintrag kann mehrere haben, und das **✕** daneben entfernt eine.

Eine Erinnerung zählt vom Beginn des Eintrags zurück oder, bei einer Aufgabe ohne Beginn, von ihrem Fälligkeitsdatum. Beim ersten Hinzufügen fragt dein Browser, ob Mitra Benachrichtigungen anzeigen darf. Sagst du nein, wird die Erinnerung trotzdem beim Eintrag gespeichert.

Ein wiederkehrender Eintrag erinnert dich für jedes Vorkommen. Aufgaben, die du als erledigt oder abgebrochen markiert hast, bleiben still, ein ausgeblendeter Kalender aber nicht: Um einen stummzuschalten, schalte ihn unter **⋯ → Bearbeiten** seines Kontos aus. [Notion](integrations/notion.md)- und [Tempo](integrations/tempo.md)-Kalender können keine Erinnerungen aufnehmen.

## Standarderinnerungen

Unter **Einstellungen → Benachrichtigungen** legst du fest, mit welchen Erinnerungen neue Einträge beginnen: 30 Minuten vorher bei einem Termin und zum Zeitpunkt der Aufgabe bei einer Aufgabe, solange du sie nicht änderst oder **Keine** wählst. Ganztägige Einträge beginnen ohne Erinnerungen.

## Wenn eine Erinnerung ausgelöst wird

Die Benachrichtigung zeigt den Titel des Eintrags, wann er stattfindet, und seinen Ort, in der Sprache und Zeitzone des Geräts. Sie bleibt, bis du sie schließt, und ein Tippen darauf öffnet den Eintrag. **10 Min. später** holt sie später zurück, und bei einer Aufgabe markiert **Fertig** die Aufgabe als erledigt, ohne Mitra zu öffnen. Safari und Firefox zeigen diese Schaltflächen nicht.

Ein Gerät, das offline war, als eine Erinnerung verschickt wurde, verwirft sie fünf Minuten nach dem Beginn des Eintrags, statt sie verspätet anzuzeigen.

## Deine Geräte

Jeder Browser und jede installierte App, in dem du Benachrichtigungen erlaubst, ist ein Gerät, und jedes Gerät bekommt alle deine Erinnerungen. **Einstellungen → Benachrichtigungen** listet sie auf, das, auf dem du gerade bist, ist mit **dieses Gerät** markiert. Benenne eines mit dem Stift um, entferne eines mit dem **✕** und schick dir mit **Testtermin** oder **Testaufgabe** eine Probe.

## Fehlerbehebung

- Wenn eine Erinnerung nicht ankommt, schick einen **Testtermin**. Kommt der Test an, liegt der Eintrag wahrscheinlich in einem Kalender, der ausgeschaltet ist. Die Berechtigung gilt pro Browser und pro Adresse, Mitra an einer Adresse zu erlauben, deckt also keine andere ab.
- Wenn unter **Einstellungen → Benachrichtigungen** keine Zeile **Erinnerungsbenachrichtigungen** steht, kann dieser Browser keine Benachrichtigungen von Mitra bekommen: Öffne auf einem iPhone oder iPad die [installierte App](install-app.md) statt Safari, und überall sonst muss Mitra über HTTPS ausgeliefert werden.
- Wenn die Zeile **Blockiert** zeigt, erlaube Benachrichtigungen für Mitra in den Website-Einstellungen des Browsers.
- Wenn unter Windows nichts ankommt, solange Chrome geschlossen ist, schalte in den Einstellungen von Chrome **Hintergrundanwendungen weiter ausführen, wenn Google Chrome geschlossen ist** ein oder installiere Mitra über Edge.

## Auf dem Server

Erinnerungen brauchen keine Einrichtung, nur [HTTPS](configuration.md#put-it-behind-https). Mitra signiert seine Benachrichtigungen mit einem Schlüssel, den es beim ersten Start erzeugt und in seiner Datenbank aufbewahrt. Stelle den Datenordner deshalb vollständig aus deinen [Backups](backups.md) wieder her: Bei einer frischen Datenbank erzeugt Mitra einen neuen Schlüssel, und Geräte, die mit dem alten registriert wurden, bekommen keine Erinnerungen mehr. Die [Protokolle](logging.md) halten jede Erinnerung fest, sobald sie verschickt wird.
