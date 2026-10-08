---
title: Notion
description: Hol die Ansichten deiner Notion-Aufgabendatenbanken als Aufgabenkalender in Mitra, die in beide Richtungen synchronisieren.
---

Mitra verbindet sich mit Notion für Aufgaben. Jede Ansicht einer Aufgabendatenbank, etwa „All tasks“, „My tasks“ oder ein Sprint-Board, wird in Mitra zu einem Kalender, der genau die Aufgaben enthält, die die Ansicht zeigt: Notion wendet die Filter der Ansicht an, und Mitra legt das Ergebnis in deinen Kalender. Titel, Status, Daten und Beschreibung einer Aufgabe werden in beide Richtungen synchronisiert.

Du verbindest dich in der App mit einem Integrations-Token. Auf dem Server musst du nichts einrichten.

## Einen Workspace verbinden

1. Erstelle eine Integration unter [notion.so/profile/integrations](https://www.notion.so/profile/integrations). Eine interne Integration genügt.
2. Teile deine Aufgabendatenbanken mit ihr. Öffne jede Datenbank in Notion, wähle **•••** → **Connections** und füge deine Integration hinzu.
3. Wähle in Mitra unten in der Seitenleiste **Integration hinzufügen** und dann **Notion**, und füge das Secret der Integration, das mit `ntn_` beginnt, bei **Integrations-Token** ein.
4. Drück auf **Verbinden**. Mitra listet die Ansichten der Datenbanken auf, die du geteilt hast, benannt nach Datenbank und Ansicht.
5. Wähle die Ansichten, die du willst, und drück dann auf **Speichern**.

Mitra schaltet zunächst eine Ansicht pro Datenbank ein. Eine Aufgabe gehört zu jeder Ansicht, deren Filter sie erfüllt, mit zwei eingeschalteten Ansichten derselben Datenbank würde sie also doppelt erscheinen. Du kannst bewusst weitere einschalten.

Mitra bietet Tabellen-, Board-, Listen-, Kalender-, Zeitleisten- und Galerieansichten an. Andere Arten von Ansichten werden nicht aufgelistet.

## Welche Datenbanken funktionieren

Eine Datenbank erscheint, wenn sie eine Eigenschaft vom Typ Status und eine vom Typ Date hat. Notions eigene Aufgabenvorlagen haben beide.

Mitra liest den Status einer Aufgabe aus der Gruppe, zu der ihr Notion-Status gehört:

| Notion-Statusgruppe | Status in Mitra |
| --- | --- |
| To-do | Zu erledigen |
| In progress | In Arbeit |
| Complete | Fertig |

Wenn du in Mitra einen Status änderst, bekommt Notion die erste Option der passenden Gruppe.

Die Date-Eigenschaft ist der Ort, an dem Mitra die Aufgabe platziert, sie ist also der Termin der Aufgabe. Wenn eine Datenbank mehrere Date-Eigenschaften hat, bevorzugt Mitra eine, deren Name mit „Due“ beginnt, dann eine namens „Date“, „When“, „Deadline“, „Scheduled“ oder „Do date“, und nimmt sonst die erste.

## Was synchronisiert wird

Titel, Status und Datum werden in beide Richtungen synchronisiert, als ganztägige Daten oder mit Uhrzeit. Uhrzeiten erscheinen in deiner eigenen Zeitzone. Eine Aufgabe ohne Datum wartet in der Liste **Ohne Termin** im [Tab Planung](../planning.md#the-planning-tab).

Die Beschreibung einer Aufgabe ist der Inhalt ihrer Notion-Seite, als Markdown geschrieben, einschließlich To-do-Listen und Callouts. Wenn du die Beschreibung in Mitra bearbeitest, ersetzt Mitra nur, was die Beschreibung zeigt. Bilder, Einbettungen, Unterseiten und synchronisierte Blöcke bleiben in Notion unverändert, und Mitra zeigt sie nicht an.

Relation-Eigenschaften, die Aufgaben innerhalb derselben Datenbank verknüpfen, werden in Mitra zu Verknüpfungen, in beide Richtungen. Eine Eigenschaft namens „Parent task“ oder „Sub-tasks“ ergibt [Teilaufgaben](../subtasks.md), eine namens „Blocked by“ oder „Depends on“ ergibt [Abhängigkeiten](../dependencies.md), und andere Relationen erscheinen unter ihrem eigenen Namen. Relationen zu anderen Datenbanken werden nicht angezeigt.

Um eine Aufgabe in Notion zu öffnen, wähle **In Notion öffnen** im **⋯**-Menü des Editors. Wenn du eine Aufgabe in Mitra löschst, landet ihre Seite im Papierkorb von Notion, wo du sie noch wiederherstellen kannst.

Notion begrenzt, wie oft Apps es aufrufen dürfen, deshalb synchronisiert Mitra es etwa einmal pro Minute (siehe [So funktioniert das Synchronisieren](README.md#how-syncing-works)). Eine neue Aufgabe verschwindet nie kurz, während Notion nachzieht.

## Was Notion nicht speichern kann

Eine Notion-Datenbank enthält Aufgaben mit je einem Datum, und das prägt, was ein Notion-Kalender enthalten kann:

- Er enthält nur Aufgaben, also keine Termine und keine [Verfügbarkeit](../availability.md).
- Das eine Datum einer Aufgabe ist ihr Termin, es gibt also kein Fälligkeitsdatum und keine Schätzung.
- Aufgaben können sich nicht wiederholen und haben keine Erinnerungen, keinen Ort und keine Teilnehmenden.
- Es gibt keinen Status **Abgebrochen**, denn Notion hat dafür keine Gruppe.
- Eine Aufgabe kann keine eigene Zeitzone, keinen Fortschrittsprozentsatz, kein Beschäftigt oder Verfügbar und keine Sichtbarkeit haben.

Mitra blendet diese Felder bei Notion-Aufgaben aus, damit beim nächsten Synchronisieren nichts verschwindet, was du dort eingibst. Wie du Einträge, die sie nutzen, nach Notion verschiebst, steht unter [Alle Einträge in einen anderen Kalender verschieben oder kopieren](../calendars.md#move-or-copy-every-entry-to-another-calendar), das zuerst zeigt, was nicht ankäme.

## Ansichten und Filter

Ein Kalender zeigt, was seine Notion-Ansicht zeigt, und eine Aufgabe, die du darin anlegst, bekommt die Filterwerte der Ansicht, damit sie in der Ansicht landet. Eine Aufgabe, die du zu einer Ansicht „University“ hinzufügst, bekommt „Area = University“, als hättest du die Zeile in Notion hinzugefügt.

Mitra füllt die Filter aus, die ein einzelner Wert erfüllen kann: ein Select, ein Status, ein Multi-Select, eine Checkbox oder eine Relation zu einer bestimmten Seite. Manche Filter kann kein einzelner Wert erfüllen, etwa eine Formel, ein Datumsbereich oder eine von mehreren Optionen. Eine Aufgabe, die du in einer solchen Ansicht anlegst, passt nicht zu ihr und erscheint deshalb, wie in Notion, dort nicht. Sie ist trotzdem in der Datenbank, und eine Ansicht mit weniger Filtern, etwa „All tasks“, zeigt sie.

> [!TIP]
> Wenn eine Ansicht nach einer Relation zu einer anderen Datenbank filtert, zum Beispiel Aufgaben, deren „Area“ auf eine Seite „University“ in einer Datenbank „Areas“ zeigt, teile diese Datenbank ebenfalls mit deiner Integration. Sonst kann Mitra die Relation bei neuen Aufgaben nicht setzen, und sie erscheinen nicht in der Ansicht.

## Fehlerbehebung

- Wenn eine Datenbank nicht aufgelistet ist, fehlt ihr eine Status- oder Date-Eigenschaft, oder sie ist nicht mit deiner Integration geteilt (**•••** → **Connections** in Notion). Öffne nach dem Teilen in Mitra **⋯ → Bearbeiten** des Kontos und drück auf **Aktualisieren**.
- Wenn eine Aufgabe doppelt erscheint, hast du zwei Ansichten derselben Datenbank eingeschaltet, die sie beide enthalten. Schalte eine davon unter **⋯ → Bearbeiten** des Kontos aus.
