---
title: Teilaufgaben
description: "Teile eine Aufgabe in Teilaufgaben oder eine Checkliste auf, verfolge ihren Fortschritt und schließe, verschiebe oder lösche einen ganzen Aufgabenbaum auf einmal."
---

Eine Aufgabe kann **Teilaufgaben** haben: kleinere Aufgaben, die zusammen sie ergeben. Eine Teilaufgabe kann in einem anderen Kalender liegen, sogar in einem anderen Konto, kann selbst Teilaufgaben haben und lässt sich [ausplanen](planning.md#the-planning-tab).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/hierarchy-detail-dark.webp">
  <img src="../assets/screenshots/hierarchy-detail-light.webp" alt="Eine Aufgabe mit einer Checkliste in der Beschreibung und einer erledigten Teilaufgabe, gezählt als 1/1" />
</picture>

## Eine Teilaufgabe hinzufügen

Öffne die kleinere Aufgabe, drück auf **＋** bei **Teilaufgabe von** und tippe einen Teil des Titels der größeren Aufgabe. Die Suche umfasst alle deine Kalender. Die größere Aufgabe führt sie dann unter **Teilaufgaben** auf, mit einer Zahl, wie viele erledigt sind, etwa 1/3. Die Verknüpfung legst du immer an der Teilaufgabe an: Die Zeile **Teilaufgaben** der größeren Aufgabe listet sie nur auf.

Jede Teilaufgabe in der Liste zeigt ihr Kästchen in der [Farbe ihres Kalenders](calendars.md#recolor), sodass du sie abhaken kannst, ohne die größere Aufgabe zu verlassen. Erledigte und abgebrochene Teilaufgaben sind durchgestrichen. Klick auf einen Titel, um diese Aufgabe zu öffnen, oder drück auf das **✕** daneben, um die Verknüpfung zu entfernen, von beiden Seiten aus. Im Kalender verbindet eine Linie eine Aufgabe mit ihren Teilaufgaben, wenn beide in der Ansicht liegen.

Mitra lehnt eine Verknüpfung ab, die im Kreis führen würde, etwa eine Aufgabe, die zur Teilaufgabe ihrer selbst wird.

## Checklisten

Die Beschreibung einer Aufgabe kann auch eine Checkliste enthalten, in Markdown geschrieben:

```markdown
- [ ] Book the venue
- [x] Send the invitations
```

Hak ein Kästchen direkt in der Beschreibung ab. Mitra ändert im Text `[ ]` zu `[x]`, sodass andere Apps, die den Kalender nutzen, es ebenfalls sehen. Das Abhaken ändert nie von selbst den Status der Aufgabe. Nur Aufgaben zählen ihre Checklisten: Die Kästchen eines Termins lassen sich abhaken, zählen aber für nichts.

## Fortschritt

Eine Aufgabe mit Teilaufgaben oder einer Checkliste zeigt ihren Fortschritt. Jede Teilaufgabe und jedes Kästchen zählt als ein Schritt, alle mit gleichem Gewicht, eine Aufgabe mit drei Kästchen und zwei Teilaufgaben hat also fünf Schritte.

Eine Teilaufgabe, die teilweise erledigt ist, zählt anteilig, egal ob sie einen eigenen Fortschritt oder eigene Teilaufgaben hat. Hat eine Aufgabe drei Teilaufgaben, zwei davon erledigt und die dritte bei 80 %, steht die Aufgabe bei 93 %. Abgebrochene Teilaufgaben zählen nicht, sodass fallengelassene Arbeit die Aufgabe nie aufhält. Als Teilaufgaben verknüpfte Termine zählen ebenfalls nicht.

Im Kalender füllt sich der Rand des Kästchens einer Aufgabe, während sie voranschreitet. Zeig auf das Kästchen, um die Zahl zu sehen, etwa „2 von 3 Teilaufgaben erledigt“, oder „2 von 4 Schritten erledigt“, wenn Kästchen und Teilaufgaben zusammen zählen. Klick es mit rechts an oder mit <kbd>Alt</kbd>-Klick, um das Statusmenü mit dem genauen Prozentwert zu öffnen.

## Den Fortschritt von Hand setzen

Eine Aufgabe ohne Teilaufgaben und ohne Checkliste kann einen Fortschritt tragen, den du selbst setzt. Klick ihr Kästchen mit rechts an oder mit <kbd>Alt</kbd>-Klick und zieh **Fortschritt** in 5-%-Schritten. Bei 100 % wird die Aufgabe **Fertig**. Unter 100 % geht eine erledigte Aufgabe zurück auf **In Arbeit**, bei 0 % auf **Zu erledigen**. Das **✕** neben dem Wert löscht ihn.

Der Kalender muss den Fortschritt speichern können: [Kalenderserver](integrations/caldav.md), [Apple Calendar](integrations/apple.md) und [Mitra-Kalender](integrations/mitra.md) können das. Google Calendar, Notion und Tempo können es nicht, ihre Aufgaben haben also keinen **Fortschritt**-Regler.

## Einen Aufgabenbaum abschließen

Wenn du die letzte offene Teilaufgabe abhakst, fragt Mitra, ob auch die größere Aufgabe als erledigt markiert werden soll. Wenn damit weiter oben weitere Aufgaben fertig werden, bietet es an, sie alle als erledigt zu markieren. Es fragt erst, wenn auch die Checkliste der größeren Aufgabe vollständig abgehakt ist.

Wenn du eine Aufgabe als erledigt oder abgebrochen markierst, während einige ihrer Teilaufgaben noch offen sind, fragt Mitra, was damit geschehen soll: **Als erledigt markieren** oder **Als abgebrochen markieren**. Schließ die Frage, um sie offen zu lassen. Du kannst später darauf zurückkommen: Im Statusmenü der Aufgabe führt die Zahl der Teilaufgaben zur selben Frage.

## Eine Aufgabe mit Teilaufgaben verschieben oder löschen

Wenn du eine Aufgabe mit Teilaufgaben auf eine andere Zeit ziehst, fragt Mitra **Teilaufgaben mitverschieben?**. Wähle **Nur dieser Eintrag** oder verschiebe die Aufgabe mit allen Teilaufgaben um dieselbe Zeitspanne. Das Löschen einer solchen Aufgabe fragt auf dieselbe Weise **Teilaufgaben mitlöschen?**.

> [!TIP]
> Halte <kbd>Ctrl</kbd> (auf dem Mac <kbd>⌘</kbd>) gedrückt, während du ablegst oder löschst, um die Frage zu überspringen und nur diese Aufgabe zu ändern. Siehe [Tastenkürzel](shortcuts.md).

## Welche Kalender das unterstützen

Eine Verknüpfung wird bei der Teilaufgabe gespeichert, im eigenen Kalender dieses Eintrags. [Kalenderserver](integrations/caldav.md), [Apple Calendar](integrations/apple.md) und [Mitra-Kalender](integrations/mitra.md) nehmen jede Verknüpfung auf, und auf einem Kalenderserver wird sie im Standard-Kalenderformat geschrieben, sodass andere Apps, die denselben Kalender nutzen, sie lesen können.

- In [Notion](integrations/notion.md) kommt eine Verknüpfung zu einer Aufgabe in derselben Datenbank in die passende Relationseigenschaft, etwa „Übergeordnete Aufgabe“. Verknüpfungen zu allem anderen behält Mitra selbst.
- [Google Calendar](integrations/google.md) verwirft Verknüpfungen, deshalb lässt sich einem Eintrag in einem Google-Kalender kein übergeordneter Eintrag geben. Einträge in anderen Kalendern können weiterhin auf ihn verweisen.
- [Kalenderabonnements](integrations/subscriptions.md) sind schreibgeschützt, und [Tempo](integrations/tempo.md) kennt keine Verknüpfungen.
