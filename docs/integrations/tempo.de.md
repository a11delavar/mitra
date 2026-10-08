---
title: Tempo
description: Sieh die Stunden, die du in Tempo buchst, in deinem Kalender, und buche, verschiebe, ändere und lösche sie von Mitra aus.
---

[Tempo](https://www.tempo.io/) ist eine Zeiterfassungs-App für Jira. Mitra zeigt deine **Worklogs**, die Stunden, die du auf Jira-Vorgänge gebucht hast, als Einträge mit Uhrzeit in deinem Kalender, neben den Besprechungen und Aufgaben, in die die Zeit geflossen ist.

Worklogs werden in beide Richtungen synchronisiert. Verschiebe oder ändere die Länge eines Eintrags, um zu ändern, wann und wie lange du gearbeitet hast, bearbeite seine Beschreibung, um die Notiz des Worklogs zu ändern, lösche ihn, um das Worklog zu löschen, oder lege einen an, um neue Zeit zu buchen.

Du verbindest dich in der App mit zwei API-Tokens. Auf dem Server musst du nichts einrichten.

## Deine Zeiterfassung verbinden

Mitra braucht ein Token von Tempo und eines von Atlassian: Tempo hält die Stunden, und Jira kennt die Vorgänge und weiß, wer du bist.

1. Erstelle ein Tempo-API-Token. Öffne in Jira Tempos **Settings** (das Zahnrad) → **Data Access** → **API integration**, wähle **New Token**, nenn es „Mitra“ und kopiere das Token.
2. Erstelle ein Atlassian-API-Token unter [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) mit **Create API token** und kopiere es. Erstelle beide Tokens als derselbe Jira-Benutzer.
3. Wähle in Mitra unten in der Seitenleiste **Integration hinzufügen** und dann **Tempo**, und fülle aus:
   - **Site-URL**, deine Atlassian-Adresse, etwa `https://your-company.atlassian.net`.
   - **Tempo-API-Token**, das Token aus Schritt 1.
   - **Atlassian-Konto-E-Mail**, die E-Mail-Adresse deines Atlassian-Kontos.
   - **Atlassian-API-Token**, das Token aus Schritt 2.
4. Drück auf **Verbinden**. Mitra listet einen Kalender auf, **My worklogs**.
5. Lass ihn eingeschaltet und drück auf **Speichern**.

Tempo begrenzt, wie oft Apps es aufrufen dürfen, deshalb synchronisiert Mitra es etwa einmal pro Minute (siehe [So funktioniert das Synchronisieren](README.md#how-syncing-works)).

## So sehen Worklogs aus

Der Titel eines Eintrags ist der Jira-Vorgang, auf den die Zeit gebucht ist, sein Schlüssel und seine Zusammenfassung:

```text
ACME-1234 Code review for auth migration
```

Die Notiz des Worklogs ist die Beschreibung des Eintrags. Tempos eigene App zeigt sie genauso, denn der Vorgang sagt, worum es bei der Zeit ging, während die Notiz oft eine Tätigkeitsbezeichnung wie „Review“ ist oder Text, den Jira für dich geschrieben hat, etwa „Working on work item ACME-1234“.

Der Titel gehört zum Vorgang, deshalb kannst du ihn bei einem gespeicherten Worklog nicht bearbeiten: Mitra benennt keinen Jira-Vorgang um, nur weil du einen Kalendereintrag bearbeitet hast. Bearbeite die Beschreibung, um zu sagen, was du getan hast. Wenn Jira den Vorgang nicht benennen kann, weil er gelöscht wurde oder du ihn nicht mehr sehen darfst, zeigt der Titel `#` und die ID des Vorgangs, und der Eintrag funktioniert weiter.

Tempo speichert Worklogs als einfache Uhrzeiten ohne Zeitzone. Mitra liest sie in der Zeitzone deines Jira-Profils, sodass sie zu denselben Zeiten erscheinen wie in Tempo.

Manche Tempo-Sites schalten Startzeiten aus. Dort beginnt jedes Worklog eines Tages zur selben Zeit, sie stapeln sich also, aber ihre Längen stimmen.

## Zeit von Mitra aus buchen

Lege in **My worklogs** einen Eintrag mit Uhrzeit an und setze den Jira-Vorgangsschlüssel irgendwo in seinen Titel:

| Du tippst | Gebucht auf |
| --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` |
| `Investigating ACME-1234 regression` | `ACME-1234` |
| `ACME-1234` | `ACME-1234` |

Mitra prüft den Schlüssel gegen die Jira-Projekte, die du sehen kannst. Wenn der Titel keinen solchen Schlüssel enthält oder Jira keinen solchen Vorgang kennt, bucht Mitra nichts und sagt dir, warum.

Die Notiz des Worklogs ist das, was du in die Beschreibung geschrieben hast, oder, wenn du sie leer gelassen hast, der ganze Titel, wie du ihn getippt hast. Sobald die Zeit gebucht ist, wird der Titel zu Schlüssel und Zusammenfassung des Vorgangs. Dieser Tausch geschieht einmal, beim Buchen, deshalb kannst du den Titel beim Schreiben bearbeiten und danach nicht mehr.

> [!TIP]
> Um Zeit auf einen Vorgang zu buchen, auf den du schon gebucht hast, dupliziere einen seiner Einträge: Halte <kbd>Alt</kbd> (<kbd>⌥</kbd> auf dem Mac) gedrückt, während du ihn auf die neue Zeit ziehst, oder wähle **Duplizieren** im **⋯**-Menü seines Editors.

## Ein Worklog ändern

Verschieben, Länge ändern, Löschen und das Bearbeiten der Beschreibung gehen direkt an Tempo. Ein paar Dinge solltest du wissen:

- Ein Worklog bleibt bei seinem Vorgang. Tempo kann ein Worklog nicht auf einen anderen Vorgang verschieben. Um die Zeit woanders zu buchen, lösche den Eintrag und lege einen neuen mit dem richtigen Schlüssel an.
- Mitra behält Tempos eigene Angaben zu einem Worklog, etwa seine abrechenbare Zeit und Arbeitsattribute, wenn es das Worklog ändert.
- Wenn ein Zeiterfassungszeitraum in Tempo geschlossen oder genehmigt ist, lehnt Tempo es ab, darin Worklogs hinzuzufügen, zu ändern oder zu löschen.

Um den Vorgang in Jira zu öffnen, wähle **In Jira öffnen** im **⋯**-Menü des Editors.

## Was ein Worklog nicht speichern kann

Ein Worklog ist eine Zeitspanne an einem Tag, auf einen Vorgang gebucht. Ein Tempo-Kalender enthält also nur Einträge mit Uhrzeit: keine ganztägigen Einträge, Wiederholungen, Erinnerungen, Orte, Teilnehmenden, Beziehungen, kein Beschäftigt oder Verfügbar, keine Sichtbarkeit und keine [Verfügbarkeit](../availability.md). Mitra blendet diese Felder bei Worklogs aus.

## Fehlerbehebung

- Wenn Mitra „Tempo rejected the API token“ meldet, erstelle ein neues Tempo-API-Token und gib es unter **⋯ → Bearbeiten** des Kontos ein.
- Wenn Mitra „Jira rejected the e-mail and API token“ meldet, prüfe, ob die E-Mail-Adresse zu dem Atlassian-Konto gehört, das das API-Token erstellt hat.
- Wenn Worklogs zur falschen Tageszeit erscheinen, prüfe die Zeitzone in deinem Jira-Profil (**Account settings** → **Time zone**). Nutze nach der Änderung **Einträge neu importieren** im **⋯**-Menü von **My worklogs**, damit auch die Worklogs, die du schon hast, mitwandern.
- Wenn Worklogs jeden Tag zur selben Zeit gestapelt erscheinen, hat deine Tempo-Site Startzeiten ausgeschaltet. Die Stunden stimmen trotzdem.
