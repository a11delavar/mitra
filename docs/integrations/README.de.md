---
title: Integrationen
description: Halte Kalender in Mitra selbst oder verbinde CalDAV, Google Calendar, Apple Calendar, Kalenderabonnements, Notion und Tempo, und sieh, wie das Synchronisieren funktioniert.
sidebar:
  label: Übersicht
---

Du kannst einen Kalender auf zwei Arten in Mitra führen. Entweder speicherst du ihn in Mitra selbst, auf deinem Server, ganz ohne Konto dahinter. Oder du verbindest ein Konto, das du schon hast, und Mitra hält dessen Kalender in beide Richtungen synchron. Die meisten landen bei einer Mischung, und Einträge wechseln frei zwischen beiden.

Um eines von beiden hinzuzufügen, wähle unten in der Seitenleiste **Integration hinzufügen**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/integrations-detail-dark.webp">
  <img src="../../assets/screenshots/integrations-detail-light.webp" alt="Der Dialog Integration hinzufügen mit Mitra, CalDAV, Google Calendar, Apple Calendar, Kalenderabonnements, Notion und Tempo" />
</picture>

## Was jede enthält

| Integration | Was sie enthält | Einrichtung auf dem Server |
| --- | --- | --- |
| [Mitra](mitra.md) | Termine und Aufgaben, in Mitra gespeichert | Keine |
| [CalDAV](caldav.md) | Termine und Aufgaben von jedem CalDAV-Server | Keine |
| [Google Calendar](google.md) | Die Kalender eines Google-Kontos | Eine einmalige OAuth-Einrichtung |
| [Apple Calendar](apple.md) | Die Kalender eines iCloud-Kontos | Keine |
| [Kalenderabonnements](subscriptions.md) | Ein veröffentlichter `webcal://`- oder `.ics`-Feed, schreibgeschützt | Keine |
| [Notion](notion.md) | Aufgaben aus Ansichten von Notion-Datenbanken | Keine |
| [Tempo](tempo.md) | Die Stunden, die du auf Jira-Vorgänge buchst | Keine |

Jeder Anbieter speichert andere Dinge. Notion-Aufgaben können sich zum Beispiel nicht wiederholen, und ein Tempo-Worklog hat keinen Ort. Mitra blendet die Felder aus, die ein Kalender nicht speichern kann, damit beim nächsten Synchronisieren nichts verschwindet, was du eingegeben hast.

## So funktioniert das Synchronisieren

Wenn du ein Konto verbindest, findet Mitra dessen Kalender und listet sie auf, alle angehakt. Entferne vor dem Speichern den Haken bei denen, die du nicht willst, und Mitra importiert den Rest. Kalender, die später im Konto auftauchen, kommen ohne Haken an, damit nichts Neues in deinem Kalender landet, ohne dass du es auswählst. Mitra lädt nie einen Kalender herunter, der ausgeschaltet ist.

Danach synchronisiert der Server von selbst im Hintergrund. Er prüft häufiger, solange jemand Mitra geöffnet hat, und seltener, wenn niemand es offen hat:

| | Solange Mitra offen ist | Solange niemand es offen hat |
| --- | --- | --- |
| CalDAV und Apple Calendar | alle 10 Sekunden | alle 5 Minuten |
| Google Calendar, Notion und Tempo | etwa einmal pro Minute | alle 5 Minuten |
| Kalenderabonnements | alle 15 Minuten | alle 15 Minuten |
| Mitra-Kalender | nichts zu synchronisieren | nichts zu synchronisieren |

Google, Notion und Tempo begrenzen, wie oft Apps sie aufrufen dürfen, deshalb sind sie langsamer. Wenn du Mitra öffnest, synchronisiert sofort jedes Konto, das an der Reihe ist, einen Knopf zum Aktualisieren gibt es also nicht.

Änderungen laufen in beide Richtungen. Wenn du einen Eintrag anlegst, bearbeitest, verschiebst oder löschst, schreibt Mitra das in den Kalender zurück, zu dem er gehört. Ein Konto, das ausfällt, hält die anderen nicht auf: Mitra versucht es eine Minute später erneut.

Manche Kalender lassen sich in Mitra nicht ändern, etwa Abonnements und Kalender, die nur zum Ansehen mit dir geteilt wurden. Du kannst sie trotzdem umbenennen, umfärben und ausblenden; siehe [Schreibgeschützte Kalender](../calendars.md#read-only-calendars).

> [!NOTE]
> Beim Synchronisieren wird nur geholt, was sich geändert hat. Wenn ein Kalender einmal falsch aussieht, verwirft **Einträge neu importieren** in seinem **⋯**-Menü Mitras Kopie und importiert ihn erneut vom Anbieter; siehe [Einen Kalender neu importieren](../calendars.md#re-import-a-calendar). Beim Anbieter ändert sich in beiden Fällen nichts.

## Ein Konto ändern

Jedes Konto lässt sich nur einmal verbinden. Um sein Passwort zu ändern oder die Kalender, die Mitra anzeigt, wähle im **⋯**-Menü **Bearbeiten**, statt es erneut hinzuzufügen. Google Calendar ist die Ausnahme: Wenn du dasselbe Google-Konto erneut verbindest, wird Mitras Zugriff darauf erneuert.
