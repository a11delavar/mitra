---
title: Einträge
description: "Öffne den Eintragseditor und sieh, was ein Termin oder eine Aufgabe alles enthalten kann: Kalender, Typ, Farbe, Status, Beschreibung und mehr."
---

Alles in deinem Kalender ist ein **Eintrag**. Die meisten Einträge sind **Termine**, die zu einer bestimmten Zeit stattfinden, oder **Aufgaben**, die du erledigst und abhakst. Eine dritte Art, die [Verfügbarkeit](availability.md), schattiert die Zeit, die du für etwas reservierst, hinter deinen Terminen und Aufgaben.

Diese Seite behandelt den Eintragseditor: seine Kopfzeile, die Zeilen darunter und die Beschreibung.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/due-detail-dark.webp">
  <img src="../assets/screenshots/due-detail-light.webp" alt="Der Editor einer Aufgabe im Kalender Arbeit, mit Status-Kontrollkästchen und Titel, Start, Ende und Fälligkeitsdatum, einem Link und einer Beschreibung, ihrer Sichtbarkeit, Erinnerungen und Beziehungen" />
</picture>

## Den Editor öffnen

Klick auf einen Eintrag, um seinen Editor daneben zu öffnen. Um einen zu erstellen, drück <kbd>C</kbd> oder **Erstellen** oben auf der Seite. Der neue Eintrag beginnt zur nächsten vollen Stunde, dauert eine Stunde und landet in deinem [Standardkalender](calendars.md#where-new-entries-land). In der [Wochenansicht](views/week.md) kannst du auch über freie Zeit ziehen.

Jede Änderung wird beim Machen gespeichert. Schließ den Editor mit seinem **✕** oder indem du außerhalb klickst. Auf einem schmalen Bildschirm, etwa einem Handy, fährt der Editor als Sheet von unten hoch.

## Die Kopfzeile

Die oberste Zeile des Editors enthält die Farbe des Eintrags, seinen Kalender, seinen Typ und das Menü **⋯**.

### Einem Eintrag eine eigene Farbe geben

Ein Eintrag trägt die Farbe seines Kalenders. Um einem Eintrag eine eigene Farbe zu geben, klick auf den Punkt am Anfang der Kopfzeile und wähle eine. **Auf Kalenderfarbe zurücksetzen** in derselben Auswahl gibt ihm die Farbe des Kalenders zurück.

### Einen Eintrag in einen anderen Kalender verschieben

Neben dem Punkt steht der Name des Kalenders des Eintrags. Klick darauf und wähle einen anderen Kalender, um den Eintrag dorthin zu verschieben. Die Liste lässt Kalender aus, die etwas nicht behalten könnten, das der Eintrag hat, etwa eine Wiederholung oder den Status **Abgebrochen**. Siehe [Einen einzelnen Eintrag verschieben](calendars.md#move-a-single-entry).

### Den Typ eines Eintrags ändern

Weiter hinten zeigt die Kopfzeile den Typ des Eintrags: **Termin**, **Aufgabe** oder **Verfügbarkeit**. Klick darauf und wähle einen anderen. Kalenderserver halten Termine und Aufgaben getrennt, deshalb speichert Mitra den Eintrag neu als den anderen Typ und löscht den alten. Der Editor bleibt beim Ergebnis geöffnet.

Was der neue Typ nicht aufnehmen kann, entfällt. Eine Aufgabe, die zum Termin wird, verliert ihren Status, ihren Fortschritt, ihr Fälligkeitsdatum und ihre Schätzung. Ein Termin, der zur Aufgabe wird, verliert Beschäftigt oder Verfügbar. Verfügbarkeit hat keine Teilnehmenden und keine Erinnerungen.

Der Typ lässt sich bei einem wiederkehrenden Eintrag nicht ändern, ebenso wenig in einem Kalender, der nur einen Typ aufnimmt, etwa einem Notion-Kalender. **Verfügbarkeit** wird nur angeboten, wo der Kalender sie aufnehmen kann.

### Das Menü ⋯

**Duplizieren** macht eine Kopie im selben Kalender und öffnet sie. Hältst du beim Ziehen eines Eintrags <kbd>Alt</kbd> gedrückt, entsteht eine Kopie dort, wo du ihn ablegst.

**Löschen** entfernt den Eintrag. Solange der Editor offen ist, tun das auch <kbd>Delete</kbd> oder <kbd>Backspace</kbd>, sofern du nicht gerade in einem Feld tippst. Wiederholt sich der Eintrag oder hat er Teilaufgaben, fragt Mitra, welche du meinst.

Ein Eintrag aus Notion oder Tempo bietet außerdem **In Notion öffnen** oder **In Jira öffnen**, was ihn dort öffnet, wo er herkommt.

## Titel und Zeit

Der Titel ist die große Zeile unter der Kopfzeile. Die Zeilen darunter sagen, wann der Eintrag stattfindet: Start, Ende, Zeitzone und ob er sich wiederholt. Um zwischen Tagen und Uhrzeiten zu wechseln, drück am Ende eines Datums auf **Ganztägig**, das erscheint, solange du in dieser Zeile bist.

Eine Aufgabe hat außerdem ein Fälligkeitsdatum und, solange sie keinen Termin hat, eine Schätzung. Siehe [Planung](planning.md). Zu Zeitzonen siehe [Zeitzonen](time-zones.md), zu Wiederholungen [Wiederholungen](repeats.md).

## Aufgabenstatus

Eine Aufgabe hat vor ihrem Titel ein Kontrollkästchen und einen von vier Status: **Zu erledigen**, **In Arbeit**, **Fertig** oder **Abgebrochen**. Klick auf das Kontrollkästchen, um die Aufgabe als fertig zu markieren, und klick noch einmal, um sie wieder zu öffnen. Um einen beliebigen Status zu wählen, klick mit der rechten Maustaste auf das Kontrollkästchen oder klick mit gedrückter <kbd>Alt</kbd>-Taste darauf. Das geht auch im Kalender.

Fertige und abgebrochene Aufgaben sind durchgestrichen. Ein Kalender ohne Status „Abgebrochen“, etwa Notion, lässt **Abgebrochen** im Menü weg. Eine Aufgabe mit Teilaufgaben oder einer Checkliste zeigt ihren Fortschritt im Kontrollkästchen, siehe [Teilaufgaben](subtasks.md#progress).

## Beschäftigt oder verfügbar und Sichtbarkeit

Die Zeile mit dem Auge sagt, was andere über den Eintrag erfahren, wenn sie in deinen Kalender schauen.

Bei Terminen wählst du zwischen **Beschäftigt** und **Verfügbar**. Beschäftigt, die Voreinstellung, markiert die Zeit als belegt, wer also nachsieht, wann du Zeit für ein Treffen hast, sieht sie als blockiert. Verfügbar zeigt den Eintrag, ohne die Zeit zu blockieren, das passt zu einer Erinnerung an dich selbst oder einem Feiertag, für den du dir nicht freinimmst. Aufgaben haben kein Beschäftigt oder Verfügbar. Verfügbarkeit hat es und beginnt als verfügbar, siehe [Verfügbarkeit](availability.md#busy-or-free).

Jeder Eintrag hat eine Sichtbarkeit. **Standardsichtbarkeit** überlässt es dem Kalender. **Öffentlich** lässt jeden, der deinen Kalender sehen kann, den Eintrag lesen. **Privat** bittet andere Apps, Leuten, mit denen du den Kalender teilst, nur zu zeigen, dass die Zeit belegt ist, nicht wofür. **Vertraulich** ist die strengste Stufe, für Einträge, die zwischen dir und den Eingeladenen bleiben sollen. Mitra speichert deine Wahl mit dem Eintrag, und der Server und die Apps, die ihn lesen, entscheiden, was sie verbergen.

## Ort, Personen und mehr

- [Ort](location.md) enthält einen Ort mit Karte oder einen Meeting-Link.
- [Teilnehmende](participants.md) listet die Beteiligten und ihre Antworten auf.
- [Erinnerungen](reminders.md) benachrichtigen dich vor dem Beginn des Eintrags oder vor dem Fälligkeitsdatum einer Aufgabe.
- [Links](links.md) sammelt die Links aus der Beschreibung darüber.
- **Teilaufgabe von** und **Teilaufgaben** bauen einen Baum aus Aufgaben, siehe [Teilaufgaben](subtasks.md).
- **Blockiert von** und **Blockiert** sagen, was zuerst fertig sein muss, siehe [Abhängigkeiten](dependencies.md).

## Die Beschreibung

Klick auf die Beschreibung, um sie zu bearbeiten, und klick woanders hin, um sie wieder formatiert zu sehen. Sie ist in Markdown geschrieben, deshalb werden Überschriften, Aufzählungen und nummerierte Listen, fetter und kursiver Text, Code, Tabellen und Links dargestellt. Ein Zitat, das mit `> [!NOTE]`, `> [!TIP]` oder `> [!WARNING]` beginnt, wird zu einem farbigen Hinweis. Ein Klick auf einen Link öffnet ihn, statt zu bearbeiten.

Zeilen, die mit `- [ ]` beginnen, werden zu einer Checkliste, die du abhaken kannst, ohne den Text zu öffnen. Siehe [Checklisten](subtasks.md#checklists).

## Beziehungen aus anderen Apps

Andere Kalender-Apps können Einträge auf Arten verknüpfen, die Mitra selbst nicht erzeugt. Mitra zeigt diese Verknüpfungen in einem eigenen Abschnitt: **Verknüpft mit** für Einträge, die zusammengehören, und einen Abschnitt, der nach dem Typ der Verknüpfung benannt ist, für Arten, die es nicht kennt. Du kannst so eine Verknüpfung mit ihrem **✕** entfernen, aber keine hinzufügen.

## Welche Kalender das unterstützen

Jeder Kalender speichert andere Dinge, und Mitra blendet die Zeilen aus, die ein Kalender nicht speichern kann, damit nichts, was du tippst, bei der nächsten Synchronisierung verschwindet. Ein Notion-Kalender enthält zum Beispiel nur Aufgaben, und ein Google-Kalender kennt keine Beziehungen. Was jeder enthält, steht unter [Integrationen](integrations/README.md#what-each-one-holds).
