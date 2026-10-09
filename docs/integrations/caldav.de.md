---
title: CalDAV
description: Verbinde jeden CalDAV-Server, etwa Nextcloud, Radicale, Fastmail oder mailbox.org, und synchronisiere seine Termine und Aufgaben in beide Richtungen.
---

CalDAV ist der offene Standard, den die meisten Kalenderserver sprechen. Du verbindest ein CalDAV-Konto in der App, ohne etwas auf dem Server einzurichten, und Mitra synchronisiert seine Termine und Aufgaben in beide Richtungen.

Deine Kalender bleiben auf deinem Server, deshalb sieht jede andere CalDAV-App, die du nutzt, etwa der Kalender auf deinem Handy, dieselben Einträge. Das unterscheidet sie von [Mitra-Kalendern](mitra.md), die nur Mitra öffnen kann.

## Ein Konto verbinden

1. Wähle unten in der Seitenleiste **Integration hinzufügen** und dann **CalDAV**.
2. Fülle das Formular aus:
   - **Server-URL** ist die CalDAV-Adresse deines Servers, etwa `https://caldav.example.com`. Die [Tabelle unten](#server-urls-for-common-providers) nennt sie für gängige Anbieter.
   - **Benutzername** ist meist dein Kontoname oder deine E-Mail-Adresse.
   - **Passwort** ist dein Kontopasswort, oder ein App-Passwort, wenn dein Anbieter eines vergibt.
3. Drück auf **Verbinden**. Mitra listet die Kalender des Kontos auf, alle eingeschaltet, und sagt, was jeder enthält, etwa „Termine · Aufgaben“.
4. Schalte die aus, die du nicht willst, und drück dann auf **Speichern**.

Mitra importiert die Kalender, die du behalten hast, und synchronisiert sie dann alle 10 Sekunden, solange du es geöffnet hast (siehe [So funktioniert das Synchronisieren](README.md#how-syncing-works)).

Um das Passwort später zu ändern, öffne das **⋯**-Menü des Kontos in der Seitenleiste, wähle **Bearbeiten**, gib das neue Passwort ein und drück auf **Speichern**. Server-URL und Benutzername bleiben, wie sie sind; für ein anderes Konto verbindest du es separat.

## Server-URLs für gängige Anbieter

Gib Mitra die CalDAV-Adresse des Anbieters, und es findet von dort aus die Kalender.

| Anbieter | Server-URL |
| --- | --- |
| Nextcloud | `https://<your-nextcloud>/remote.php/dav` |
| Radicale | `https://<your-radicale>/` (oder `.../<user>/`) |
| Fastmail | `https://caldav.fastmail.com/` |
| mailbox.org | `https://dav.mailbox.org/` |
| Baïkal | `https://<your-baikal>/dav.php` |

Google Calendar und iCloud sprechen ebenfalls CalDAV, nehmen aber nicht dein normales Passwort: Google meldet dich auf seiner eigenen Seite an, und Apple braucht ein app-spezifisches Passwort. Nutze stattdessen ihre eigenen Kacheln, wie in [Google Calendar](google.md) und [Apple Calendar](apple.md) beschrieben.

## Was synchronisiert wird

Jeder Kalender auf dem Server ist ein Kalender in Mitra. Er enthält Termine, Aufgaben oder beides, so wie der Server es zulässt. Die meisten Server erlauben beides; in einem Kalender, der nur eine Art aufnimmt, sind neue Einträge immer von dieser Art.

Alles, was Mitra zu einem Eintrag speichert, wird synchronisiert, soweit dein Server es behält:

- Ganztägige und mehrtägige Einträge, Orte, Beschreibungen, Farben und Erinnerungen.
- Ob ein Eintrag als beschäftigt oder verfügbar angezeigt wird, und seine Sichtbarkeit.
- Status und Fortschritt einer Aufgabe.
- [Teilnehmende](../participants.md). Dein Server verschickt die Einladungen und sammelt die Antworten.
- [Teilaufgaben](../subtasks.md) und [Abhängigkeiten](../dependencies.md).

Ein sich wiederholender Eintrag bleibt auf dem Server eine Serie. Wenn du ein einzelnes Vorkommen änderst, fragt Mitra, ob du **Dieser Eintrag**, **Dieser und folgende Einträge** oder **Alle Einträge** meinst, und ändert die Serie entsprechend.

Eine Aufgabe behält ihren Termin, ihr [Fälligkeitsdatum und ihre Schätzung](../planning.md#schedule-constraints-and-planning). Falls du dich fragst, wie: Der Beginn wird als `DTSTART` gespeichert, die Länge des Termins (oder die Schätzung, solange die Aufgabe keinen Termin hat) als `ESTIMATED-DURATION` und das Fälligkeitsdatum als `DUE`, sodass andere Apps Beginn und Fälligkeitsdatum sehen. Eine Aufgabe, die eine andere App oder eine ältere Mitra-Version mit Beginn und `DUE`, aber ohne Länge gespeichert hat, wird als von einem zum anderen geplant gelesen, ohne Fälligkeitsdatum.

Kalender, die nur zum Ansehen mit dir geteilt wurden, sind als schreibgeschützt markiert. Du kannst sie trotzdem umbenennen, umfärben, umsortieren und ausblenden; siehe [Schreibgeschützte Kalender](../calendars.md#read-only-calendars).

## Beschäftigt-Verfügbarkeit

[Verfügbarkeit](../availability.md), die du als **Beschäftigt** markierst, wird ihrem Kalender als Beschäftigt-Termin hinzugefügt, sodass die Zeit auf deinem Handy und für alle, die dich einladen, als belegt erscheint. Du musst nichts einrichten.

- Jede Beschäftigt-Verfügbarkeit wird zu einem sich wiederholenden Termin mit denselben Zeiten und derselben Wiederholungsregel, als beschäftigt markiert. Er übernimmt den Namen der Verfügbarkeit, oder „Beschäftigt“, wenn sie keinen hat, sowie ihren Ort und ihre Sichtbarkeit, etwa **Privat**.
- In Mitra siehst du statt dieser Termine die Verfügbarkeit selbst, damit die Zeit nicht doppelt erscheint.
- Mitra hält die Termine im Einklang mit deiner Verfügbarkeit. Wenn einer in einer anderen App geändert, verschoben oder gelöscht wird, stellt Mitra ihn bei der nächsten Synchronisierung wieder her.
- Wenn du die Verfügbarkeit wieder auf **Verfügbar** setzt, löschst, ihren Kalender ausschaltest oder das Konto löschst, werden die Termine entfernt. Wenn du die Verfügbarkeit in einen anderen Kalender verschiebst, ziehen ihre Termine mit um.
- Ein Kalender, der nur Aufgaben enthält, oder einer, in den du nicht schreiben kannst, bekommt keine Termine.

> [!NOTE]
> Änderungen an einem einzelnen Tag einer Beschäftigt-Verfügbarkeit werden nicht übernommen. Der Termin folgt weiter der Wiederholungsregel, sodass ein Tag, den du verschoben oder verkürzt hast, anderen weiterhin seine übliche Zeit zeigt.

Das funktioniert genauso für [Google Calendar](google.md) und [Apple Calendar](apple.md), die Mitra ebenfalls über CalDAV verbindet.

## Fehlerbehebung

- Wenn ein Kalender fehlt, ist er ausgeschaltet. Das trifft Kalender, die du beim Verbinden ausgeschaltet hast, und Kalender, die später auf dem Server angelegt wurden, die Mitra ausgeschaltet hinzufügt. Schalte ihn unter **⋯ → Bearbeiten** des Kontos ein und drück auf **Speichern**. **Aktualisieren** dort listet Kalender auf, die seit der letzten Synchronisierung auf dem Server angelegt wurden.
- Wenn Mitra „This account is already connected“ meldet, ist das Konto schon in deiner Seitenleiste. Ändere es stattdessen über sein **⋯ → Bearbeiten**, zum Beispiel, um ein neues Passwort einzugeben.
- Wenn das Verbinden fehlschlägt, prüfe, ob die Server-URL mit `https://` beginnt und auf die CalDAV-Adresse zeigt, nicht auf die Webseite, auf der du dich anmeldest. Um jede Anfrage zu sehen, die Mitra an den Server schickt, setze das [Log-Level](../logging.md) auf `debug`.
- Wenn ein Kalender nach einem Update von Mitra falsch aussieht, nutze **Einträge neu importieren** in seinem **⋯**-Menü. Beim Synchronisieren wird nur geholt, was sich auf dem Server geändert hat, Einträge, die sich nicht geändert haben, werden also nie wieder gelesen; ein erneuter Import liest sie alle. Siehe [Einen Kalender neu importieren](../calendars.md#re-import-a-calendar).
