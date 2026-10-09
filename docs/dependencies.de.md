---
title: Abhängigkeiten
description: "Lass einen Eintrag auf einen anderen warten, sieh die Reihenfolge als Linien im Kalender und verschiebe eine ganze Kette gemeinsam."
---

Eine **Abhängigkeit** sagt, dass ein Eintrag nicht beginnen kann, bevor ein anderer fertig ist: der Entwurf vor der Durchsicht, die Durchsicht vor der Veröffentlichung. Der Eintrag, der wartet, wird vom anderen blockiert.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/week-detail-dark.webp">
  <img src="../assets/screenshots/week-detail-light.webp" alt="Eine Woche mit drei Lernaufgaben, durch Linien verbunden, jede führt zur nächsten und weiter zur Prüfung" />
</picture>

## Eine Abhängigkeit hinzufügen

Öffne den Eintrag, der wartet, drück auf **＋** bei **Blockiert von** und tippe einen Teil des Titels des Eintrags, der zuerst fertig sein muss. Die Suche umfasst alle deine Kalender, ein Eintrag kann also auf einen in einem anderen Kalender oder Konto warten. Der andere Eintrag führt diesen dann unter **Blockiert** auf, was nur Verknüpfungen auflistet: Du legst sie immer an dem Eintrag an, der wartet.

Klick im Editor auf den Titel eines verknüpften Eintrags, um ihn zu öffnen, oder drück auf das **✕** daneben, um die Verknüpfung zu entfernen, von beiden Seiten aus. Mitra lehnt eine Verknüpfung ab, die im Kreis führen würde, etwa zwei Einträge, die jeweils auf den anderen warten.

Mit der Maus kannst du eine Abhängigkeit auch in der Wochen- oder Monatsansicht zeichnen. Zeig auf den Eintrag, der zuerst kommt, greif die kurze Linie an seinem Ende und lass sie auf dem Eintrag fallen, der auf ihn warten soll. Beim Ziehen färbt sich die Linie rot über einem Eintrag, der schon zu früh beginnt.

## Linien im Kalender

Wochenansicht, Monatsansicht und Zeitleiste zeichnen vom Ende jedes Eintrags eine Linie zum Beginn des Eintrags, der auf ihn wartet. Zeig auf einen Eintrag, um seine Linien in den Vordergrund zu holen. Die Linien jeder Ansicht lassen sich unter **Einstellungen → Kalender** abschalten, mit **Verbindungslinien in der Wochenansicht**, **Verbindungslinien in der Monatsansicht** und **Verbindungslinien in der Zeitleiste**.

## Gebrochene Abhängigkeiten

Wenn ein Eintrag beginnt, bevor der, auf den er wartet, fertig ist, ist die Abhängigkeit gebrochen. Ihre Linie im Kalender wird rot, und in den Zeilen **Blockiert von** und **Blockiert** des Editors wird der Eintrag auf der anderen Seite rot benannt. Bring einen der beiden Einträge wieder in die Reihenfolge, und die Warnung verschwindet.

## Eine Kette verschieben

Wenn du einen Eintrag oder einen seiner Ränder ziehst und andere Einträge von ihm abhängen, fragt Mitra **Abhängige Einträge mitverschieben?**. Die Auswahlmöglichkeiten, die andere Einträge verschieben, nennen ihre Anzahl:

- **Nur dieser Eintrag** verschiebt diesen und lässt die übrigen, wo sie sind.
- **Die Kette zusammenhalten** verschiebt die anderen nur so weit, wie nötig ist, um die Reihenfolge zu wahren. Einträge nach diesem rücken später, und wenn du diesen früher gelegt hast, rücken die Einträge davor früher. Ein Eintrag mit genug Spielraum bleibt, wo er ist.
- **Alle um denselben Betrag verschieben** verschiebt die ganze Kette, vor und nach diesem Eintrag, um dieselbe Zeitspanne, sodass die Abstände zwischen ihnen gleich bleiben.

Mitra fragt nur, wenn die Möglichkeiten zu unterschiedlichen Ergebnissen führen würden. Das Ändern von Zeiten im Editor verschiebt nie andere Einträge.

Wenn ein Eintrag als Teil einer Kette verschoben wird, wandern seine Teilaufgaben mit. Wiederkehrende Einträge und Aufgaben ohne Termin in einer Kette werden nie verschoben.

> [!TIP]
> Halte <kbd>Ctrl</kbd> (auf dem Mac <kbd>⌘</kbd>) gedrückt, während du ablegst, um die Frage zu überspringen und nur diesen Eintrag zu verschieben. Siehe [Tastenkürzel](shortcuts.md).

## Welche Kalender das unterstützen

Eine Verknüpfung wird bei dem Eintrag gespeichert, der wartet, im eigenen Kalender dieses Eintrags. [Kalenderserver](integrations/caldav.md), [Apple Calendar](integrations/apple.md) und [Mitra-Kalender](integrations/mitra.md) nehmen jede Verknüpfung auf, und auf einem Kalenderserver wird sie im Standard-Kalenderformat geschrieben, sodass andere Apps, die denselben Kalender nutzen, sie lesen können.

- In [Notion](integrations/notion.md) kommt eine Verknüpfung zu einer Aufgabe in derselben Datenbank in die passende Relationseigenschaft, etwa „Blocked by“. Verknüpfungen zu allem anderen behält Mitra selbst.
- [Google Calendar](integrations/google.md) verwirft Verknüpfungen, deshalb lässt sich einem Eintrag in einem Google-Kalender nichts geben, worauf er wartet. Einträge in anderen Kalendern können weiterhin auf ihn verweisen.
- [Kalenderabonnements](integrations/subscriptions.md) sind schreibgeschützt, und [Tempo](integrations/tempo.md) kennt keine Verknüpfungen.
