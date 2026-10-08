---
title: Mitra-Kalender
description: Kalender, die in Mitra selbst auf deinem Server liegen, ganz ohne Konto dahinter.
---

Ein Mitra-Kalender liegt in Mitras eigener Datenbank statt bei einem Anbieter. Es gibt kein Konto zu verbinden und nichts zu synchronisieren: Du legst einen Kalender an und fügst Einträge hinzu. Das ist der einfachste Einstieg in Mitra und ein guter Ort für alles, was in keines deiner bestehenden Konten gehört.

Mitra-Kalender liegen auf deinem Server, nicht auf deinem Gerät, du hast sie also überall, wo du Mitra öffnest. Sie können alles enthalten, was Mitra kann: Termine und Aufgaben, Wiederholungen, Erinnerungen, [Verfügbarkeit](../availability.md), [Teilaufgaben](../subtasks.md), [Abhängigkeiten](../dependencies.md), Fälligkeitsdaten und Schätzungen.

## Mitra-Kalender hinzufügen

1. Wähle unten in der Seitenleiste **Integration hinzufügen** und dann **Mitra**.
2. Gib deinem ersten Kalender einen Namen.
3. Drück auf **Speichern**.

Der Kalender ist sofort bereit. Du fügst die Integration nur einmal hinzu: Sie enthält beliebig viele Kalender, deshalb verschwindet ihre Kachel danach aus **Integration hinzufügen**.

Um einen weiteren Kalender anzulegen, öffne das **⋯**-Menü an der Mitra-Überschrift in der Seitenleiste und wähle **Neuer Kalender**. Um einen zu löschen, wähle **Kalender löschen** im **⋯**-Menü dieses Kalenders. Umbenennen, Umfärben, Umsortieren und Ausblenden funktionieren wie bei jedem Kalender; siehe [Kalender](../calendars.md).

> [!CAUTION]
> Wenn du einen Mitra-Kalender löschst, werden alle seine Einträge endgültig gelöscht, denn es gibt keinen Anbieter, von dem sie sich zurückholen ließen. Mitra fragt vorher nach und bietet an, die [Einträge zu verschieben](../calendars.md#move-or-copy-every-entry-to-another-calendar), bevor etwas gelöscht wird.

## Einträge hinein- und herausverschieben

Einträge wechseln zwischen einem Mitra-Kalender und jedem anderen Kalender. Um einen zu verschieben, wähle in seinem Editor einen anderen Kalender. Um einen ganzen Kalender zu verschieben, nutze **⋯ → Einträge verschieben nach…**, das zuerst zeigt, was das Ziel nicht speichern kann.

Das geht auch andersherum: Du kannst in Mitra anfangen und später alles in einen CalDAV- oder Google-Kalender verschieben.

## Sichere sie

Ein verbundenes Konto hält eine eigene Kopie deiner Einträge. Ein Mitra-Kalender nicht: Seine Einträge existieren nur in Mitras Datenbank. Achte darauf, dass Mitras Datenordner Teil deiner [Backups](../backups.md) ist.

Wenn du später die [Anmeldung](../sso.md) einschalten willst, beachte, dass dann alle mit einem neuen, leeren Konto beginnen. Mitra-Kalender, die du vorher angelegt hast, bleiben beim alten Einzelnutzer-Konto.

## Was sie nicht können

- Teilnehmende werden als Vermerk gespeichert, wer beteiligt ist, aber niemand bekommt eine Einladung und es kommen keine Antworten zurück, denn es gibt keinen Kalenderserver, der sie verschickt. Wenn du eine Besprechung aus einem CalDAV-Kalender hierher verschiebst, wird das Original dort gelöscht, und manche Server teilen den Teilnehmenden dann mit, dass sie abgesagt wurde. Kopiere sie stattdessen, wenn sie davon nichts mitbekommen sollen.
- Andere Apps sehen sie nicht. Mitra veröffentlicht seine Kalender nicht über CalDAV. Nimm also einen [CalDAV](caldav.md)-Server für Kalender, die du auch in der Kalender-App deines Handys haben willst.
- Es gibt nichts erneut zu importieren, deshalb wird **Einträge neu importieren** nicht angeboten.
