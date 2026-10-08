---
title: Teilnehmende
description: "Füge die Personen hinzu, die an einem Eintrag beteiligt sind, und verfolge ihre Antworten. Ob sie eine Einladung bekommen, hängt vom Kalender ab."
---

Ein Eintrag kann **Teilnehmende** haben: die Personen, die an ihm beteiligt sind. Mitra speichert sie im Standard-Kalenderformat beim Eintrag, sodass jede andere App, die denselben Kalender nutzt, dieselbe Liste sieht und Antworten aus Apple Calendar, Thunderbird oder einem Webmailer auch in Mitra erscheinen.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/participants-detail-dark.webp">
  <img src="../assets/screenshots/participants-detail-light.webp" alt="Ein Eintrag mit drei Teilnehmenden, ihre Antworten als Abzeichen auf ihren Avataren" />
</picture>

## Wer die Einladungen verschickt

Mitra verschickt nie selbst E-Mails. Was geschieht, wenn du jemanden hinzufügst, hängt vom Kalender ab, in dem der Eintrag liegt.

Liegt der Eintrag in einem Kalender von einem [Kalenderserver](integrations/caldav.md), [Google Calendar](integrations/google.md) oder [Apple Calendar](integrations/apple.md), verschickt dieser Server: die Einladung, eine Aktualisierung, wenn sich der Eintrag ändert, und eine Absage, wenn du jemanden entfernst oder den Eintrag löschst. Er sammelt auch die Antworten, und so gelangen sie zu Mitra. Die meisten Server tun das, darunter Google, iCloud, Nextcloud, Fastmail, mailbox.org und Zimbra. Ein Server, der Kalender nur speichert, verschickt nichts, sodass niemand vom Eintrag erfährt und jede Antwort ausstehend bleibt.

In einem [Mitra-Kalender](integrations/mitra.md) steckt kein Server hinter dem Kalender, die Liste ist also nur ein Verzeichnis der Beteiligten. Niemand wird eingeladen, und es kommen keine Antworten.

[Notion](integrations/notion.md)- und [Tempo](integrations/tempo.md)-Kalender können keine Teilnehmenden aufnehmen, ihre Einträge haben deshalb keine Zeile für Teilnehmende. In einem [Kalenderabonnement](integrations/subscriptions.md) siehst du die Teilnehmenden, kannst sie aber nicht ändern, da der Kalender schreibgeschützt ist.

## Personen hinzufügen

Öffne den Eintrag, tippe eine E-Mail-Adresse in **Teilnehmer hinzufügen** und drück die Eingabetaste. Du kannst mehrere auf einmal hinzufügen, getrennt durch Kommas, Semikolons oder Leerzeichen. Um später weitere hinzuzufügen, drück auf **＋** neben der Zahl der Teilnehmenden.

In einem Kalender mit einem Konto dahinter machst du dich mit der ersten hinzugefügten Person zum **Organisator**: Deine eigene Adresse kommt in die Liste, als **Organisator** markiert, mit Zusage. Ein Mitra-Kalender hat keine Adresse von dir, die er verwenden könnte, seine Listen haben also keinen Organisator.

Jede Person erscheint mit ihrem Anfangsbuchstaben, ihrer E-Mail-Adresse, ihrem Namen, wenn der Kalender ihn kennt, und **Organisator** oder **Optional**, wenn das zutrifft. E-Mail-Adressen lassen sich markieren, sodass du eine einzelne Adresse aus ihrer Zeile kopieren kannst. Hat die Liste mehr als fünf Personen, zeigt sie die ersten vier und klappt den Rest hinter einer Zeile „weitere“ zusammen.

Zeig auf eine Person, um sie zu ändern. Eine Schaltfläche macht sie optional oder wieder erforderlich, und das **✕** entfernt sie. Auf einem Touchscreen sind diese Schaltflächen immer sichtbar.

## Antworten

Ein Abzeichen auf dem Anfangsbuchstaben jeder Person zeigt ihre Antwort: ein grüner Haken für zugesagt, ein rotes Kreuz für abgesagt und ein gelber Strich für vielleicht. Kein Abzeichen heißt, es gibt noch keine Antwort. Eine Zeile unter der Zahl fasst sie zusammen, etwa „2 Zusagen, 1 Absage, 3 ausstehend“.

Antworten erreichen Mitra über den Kalenderserver, eine neue erscheint also bei der nächsten Synchronisierung, nicht sofort.

Mitra zeigt die Antworten aller, schickt aber deine nicht. Um eine Einladung anzunehmen oder abzulehnen, die jemand anderes verschickt hat, antworte in deiner Mail-App oder einer anderen Kalender-App, und deine Antwort wird zurück zu Mitra synchronisiert.

## Für alle handeln

Das Menü **⋯** neben der Zahl wirkt auf die ganze Liste:

- **E-Mail an Teilnehmer** öffnet deine Mail-App mit einer E-Mail an alle anderen.
- **E-Mail-Adressen der Teilnehmer kopieren** kopiert jede Adresse.
- **Alle als erforderlich markieren** und **Alle als optional markieren** ändern die Rolle aller auf einmal.
- **Alle entfernen** leert die Liste.

## Nur der Organisator ändert die Liste

Bei einem Eintrag, den jemand anderes organisiert hat, kannst du Personen nicht hinzufügen, entfernen oder ändern: Das **＋** ist ausgeblendet, und das Menü kann nur E-Mails schreiben und kopieren. Das ist die Regel des Terminplanungsstandards, dem Kalender-Apps folgen, und der Server von Mitra lehnt eine solche Änderung ebenfalls ab. Den Rest des Eintrags, etwa Titel, Zeit und Beschreibung, kannst du weiterhin bearbeiten.

> [!CAUTION]
> Wenn du einen Eintrag mit Teilnehmenden in einen anderen Kalender verschiebst, wird er im ersten gelöscht, und manche Server teilen den Teilnehmenden dann mit, dass er abgesagt wurde. [Kopiere ihn](calendars.md#move-or-copy-every-entry-to-another-calendar) stattdessen, wenn sie nichts davon erfahren sollen.

## Fehlerbehebung

- Wenn alle ausstehend bleiben und keine Einladung ankam, liegt der Eintrag in einem Mitra-Kalender, oder sein Kalenderserver verschickt keine Einladungen. Um den Server zu prüfen, lade dieselben Personen über die eigene App des Anbieters ein.
- Wenn eine Antwort kam, ihr Abzeichen sich aber nicht geändert hat, warte auf die nächste Synchronisierung von Mitra, denn Antworten kommen über den Kalenderserver.
- Wenn es keine Möglichkeit gibt, Personen hinzuzufügen, organisiert jemand anderes den Eintrag, oder der Kalender ist schreibgeschützt.
- Wenn der Eintrag keine Zeile für Teilnehmende hat, kann sein Kalender keine Teilnehmenden aufnehmen, wie bei Notion und Tempo.
- Wenn ein Besprechungsraum in der Liste fehlt, ist das Absicht: Räume und Geräte sind keine Personen, deshalb lässt Mitra sie weg.
