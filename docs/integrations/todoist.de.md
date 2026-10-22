---
title: Todoist
description: Hol deine Todoist-Projekte als Aufgabenkalender in Mitra, die in beide Richtungen synchronisieren.
---

Mitra verbindet sich mit Todoist für Aufgaben. Jedes deiner Todoist-Projekte wird in Mitra zu einem Kalender, der seine Aufgaben enthält. Titel, Beschreibung, Daten und Erledigung einer Aufgabe werden in beide Richtungen synchronisiert.

Du verbindest dich in der App mit deinem API-Token. Auf dem Server musst du nichts einrichten.

## Ein Konto verbinden

1. Öffne in Todoist **Einstellungen** → **Integrationen** → **Entwickler** und kopiere dein API-Token.
2. Wähle in Mitra unten in der Seitenleiste **Integration hinzufügen** und dann **Todoist**, und füge das Token bei **Todoist-API-Token** ein.
3. Drück auf **Verbinden**. Mitra listet deine Projekte auf, jedes in seiner Farbe aus Todoist. Ein Projekt in einem anderen heißt nach beiden, etwa „Arbeit · Launch“.
4. Wähle die Projekte, die du willst, und drück dann auf **Speichern**.

Du kannst mehr als ein Todoist-Konto verbinden. Archivierte Projekte werden nicht aufgelistet.

## Was synchronisiert wird

Titel, Beschreibung und Erledigung werden in beide Richtungen synchronisiert, ebenso die Daten:

| In Todoist | In Mitra |
| --- | --- |
| Datum | Der Zeitplan der Aufgabe: ein Tag oder eine Uhrzeit |
| Dauer | Wie lange die Aufgabe eingeplant ist, oder ihre [Schätzung](../planning.md#set-an-estimate), solange sie kein Datum hat |
| Deadline | Ihr [Fälligkeitsdatum](../planning.md#set-a-due-date) |
| Unteraufgabe | Eine [Teilaufgabe](../subtasks.md) |

Eine Aufgabe ohne Datum wartet in der Liste **Ohne Termin** im [Tab Planung](../planning.md#the-planning-tab). Aufgaben, die du in den letzten zwölf Wochen erledigt hast, kommen beim Verbinden mit, und danach jede Erledigung.

Todoist hält eine Uhrzeit entweder schwebend, also auf jeder Uhr gleich, wo du auch bist, oder fest in einer Zeitzone. Mitra behält beides, wie es ist: Eine schwebende Uhrzeit bleibt [überall dieselbe](../time-zones.md#same-time-everywhere), und eine feste behält ihre Zone.

Deadlines und Dauer gehören zu den Tarifen Pro und Business von Todoist. Bei einem kostenlosen Konto haben Todoist-Aufgaben in Mitra kein Fälligkeitsdatum, kein Ende und keine Schätzung: Eine Aufgabe mit Uhrzeit ist ein Zeitpunkt, und eine Aufgabe an einem Tag belegt nur diesen Tag. Wenn sich dein Tarif ändert, etwa wenn eine Testphase beginnt oder endet, liest Mitra alle Aufgaben erneut. Eine Deadline ist ein Tag, deshalb behält ein Fälligkeitsdatum, dem du in Mitra eine Uhrzeit gibst, nur seinen Tag.

Mitra zeigt Priorität, Labels, Abschnitt, Kommentare und Erinnerungen einer Aufgabe nicht an und lässt sie in Todoist, wie sie sind. Wenn du eine Aufgabe in einen anderen Todoist-Kalender verschiebst, landet sie in Todoist in diesem Projekt, mit all dem.

Um eine Aufgabe in Todoist zu öffnen, wähle **In Todoist öffnen** im **⋯**-Menü des Editors. Wenn du eine Aufgabe in Mitra löschst, wird sie auch in Todoist gelöscht.

Todoist begrenzt, wie oft Apps es aufrufen dürfen, deshalb synchronisiert Mitra es etwa einmal pro Minute (siehe [So funktioniert das Synchronisieren](README.md#how-syncing-works)).

## Wiederkehrende Aufgaben

Eine Aufgabe, die sich in Todoist wiederholt, erscheint wie in Todoist an ihrem nächsten Datum, ohne ihre Regel. Wenn du sie in Mitra erledigst, wird sie in Todoist erledigt, und Todoist rückt sie wie immer auf das folgende Datum vor. Verschiebst du sie auf einen anderen Tag, ändert sich nur ihr nächstes Datum, und ihre Regel bleibt, wie sie ist. Die Regel selbst änderst du in Todoist.

## Was in Mitra bleibt

Todoist kennt keine Abhängigkeiten, deshalb bleiben die [Abhängigkeiten](../dependencies.md) zwischen Todoist-Aufgaben nur in Mitra. Sie gehen verloren, wenn du das Konto trennst oder [einen Kalender neu importierst](../calendars.md#re-import-a-calendar). Die übergeordnete Aufgabe einer Teilaufgabe steht in beiden, solange sie eine Aufgabe desselben Todoist-Kontos ist. Todoist verschiebt die Teilaufgabe dann in das Projekt ihrer übergeordneten Aufgabe.

## Was Todoist nicht speichern kann

- Es enthält nur Aufgaben, also keine Termine und keine [Verfügbarkeit](../availability.md).
- Eine Aufgabe ist offen oder erledigt, deshalb gibt es keinen Status **In Arbeit** oder **Abgebrochen**. Eine Aufgabe, die anderswo in Arbeit ist, steht wieder auf **Zu erledigen**, wenn du sie nach Todoist verschiebst.
- Du kannst eine Aufgabe in Mitra nicht wiederholen lassen.
- Eine Aufgabe hat in Mitra keine Erinnerungen, keinen Ort, keine Teilnehmenden, keine Anhänge, keinen Fortschritt, kein Beschäftigt oder Frei und keine Sichtbarkeit.

Mitra blendet diese Felder bei Todoist-Aufgaben aus, damit nichts, was du dort eingibst, bei der nächsten Synchronisierung verschwindet. Um Einträge, die sie verwenden, nach Todoist zu verschieben, siehe [Alle Einträge in einen anderen Kalender verschieben oder kopieren](../calendars.md#move-or-copy-every-entry-to-another-calendar), das zuerst zeigt, was nicht mitkäme.

## Fehlerbehebung

- Wenn Mitra meldet, dass Todoist das API-Token abgelehnt hat, kopiere es erneut unter **Einstellungen** → **Integrationen** → **Entwickler**. Wenn du es in Todoist zurückgesetzt hast, öffne in Mitra **⋯ → Bearbeiten** des Kontos und füge das neue ein.
- Wenn ein Projekt fehlt, ist es vielleicht archiviert. Hol es in Todoist aus dem Archiv, öffne dann in Mitra **⋯ → Bearbeiten** des Kontos und drück auf **Aktualisieren**.
