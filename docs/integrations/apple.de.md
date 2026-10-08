---
title: Apple Calendar
description: Verbinde deine iCloud-Kalender mit einem app-spezifischen Passwort mit Mitra, ohne etwas auf dem Server einzurichten.
---

Mitra verbindet sich über CalDAV mit deinen iCloud-Kalendern und synchronisiert ihre Termine in beide Richtungen. Apple lässt andere Apps nicht mit deinem Apple-Passwort anmelden, deshalb legst du zuerst ein app-spezifisches Passwort für Mitra an. Das dauert eine Minute, und auf dem Server musst du nichts einrichten.

## Ein app-spezifisches Passwort erstellen

1. Melde dich bei [appleid.apple.com](https://appleid.apple.com/) an.
2. Wähle unter **Sign-In and Security** den Punkt **App-Specific Passwords**.
3. Erstelle ein neues Passwort, nenn es „Mitra“, damit du es später wiedererkennst, und kopiere es.

Apple bietet app-spezifische Passwörter nur an, wenn für dein Konto die Zwei-Faktor-Authentifizierung eingeschaltet ist.

## Dein Konto verbinden

1. Wähle unten in der Seitenleiste **Integration hinzufügen** und dann **Apple Kalender**.
2. Gib deine **Apple-ID** ein, die E-Mail-Adresse, mit der du dich bei Apple anmeldest, und das **App-spezifische Passwort**, das du für Mitra erstellt hast.
3. Drück auf **Verbinden**. Mitra listet deine iCloud-Kalender auf, alle eingeschaltet.
4. Schalte die aus, die du nicht willst, und drück dann auf **Speichern**.

Mitra importiert die Kalender, die du behalten hast, und synchronisiert sie alle 10 Sekunden, solange du es geöffnet hast (siehe [So funktioniert das Synchronisieren](README.md#how-syncing-works)).

## Was synchronisiert wird

Termine werden in beide Richtungen synchronisiert, mit allem, was [CalDAV](caldav.md#what-syncs) mitträgt.

> [!NOTE]
> Aufgaben sind anders. Aufgaben, die Mitra in einem iCloud-Kalender speichert, liegen in iCloud, und andere CalDAV-Apps können sie lesen, aber Apples Erinnerungen-App zeigt sie nicht an. Erinnerungen nutzt seit iOS 13 kein CalDAV mehr, und Apple bietet Apps wie Mitra keinen anderen Zugang.

[Verfügbarkeit](../availability.md), die du in einem iCloud-Kalender als beschäftigt markierst, wird diesem Kalender als Beschäftigt-Termin hinzugefügt, sodass die Zeit auf deinem iPhone und für alle, die dich einladen, als belegt erscheint. Das funktioniert wie bei [CalDAV](caldav.md#busy-availability) beschrieben.

## Dein Konto trennen

Wähle **Löschen** im **⋯**-Menü des Kontos in der Seitenleiste, um es aus Mitra zu entfernen. Um Mitras Zugriff auch auf Apples Seite zu entziehen, lösche das Passwort „Mitra“ auf der Seite **Sign-In and Security**, auf der du es erstellt hast. Dein Apple-Passwort und deine anderen Apps sind davon nicht betroffen.

## Fehlerbehebung

- Wenn das Verbinden wegen des Passworts fehlschlägt, prüfe, ob du das app-spezifische Passwort eingegeben hast, nicht dein Apple-Passwort.
- Wenn ein Kalender fehlt, ist er ausgeschaltet. Schalte ihn unter **⋯ → Bearbeiten** des Kontos ein und drück auf **Speichern**.
