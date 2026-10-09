---
title: Kalender
description: Wähle, welche Kalender Mitra importiert, benenne sie um, färbe sie ein, ordne sie neu und blende sie aus, bestimme, wohin neue Einträge kommen, und verschiebe Einträge zwischen Kalendern.
---

Jede Zeile im Tab **Kalender** der Seitenleiste ist ein Kalender. Einige sind [in Mitra gespeichert](integrations/mitra.md), andere stammen aus einem Konto, das du verbunden hast. Sie stehen unter der Überschrift der Integration, zu der sie gehören, und alles auf dieser Seite funktioniert für alle gleich, sofern nichts anderes dasteht.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/calendars-detail-dark.webp">
  <img src="../assets/screenshots/calendars-detail-light.webp" alt="Die Seitenleiste mit einem Konto und seinen fünf Kalendern, jeder in seiner eigenen Farbe" />
</picture>

Ein Kalender ist eine Zeile, auch wenn er Termine und Aufgaben enthält, wie die meisten CalDAV-Kalender. Ob ein bestimmter Eintrag ein Termin oder eine Aufgabe ist, gehört zum Eintrag.

## Wählen, was importiert wird

Wenn du ein Konto verbindest, findet Mitra seine Kalender und listet sie auf, alle angehakt, und jeder sagt, was er enthält, etwa „Termine · Aufgaben“. Entferne vor dem Speichern das Häkchen bei denen, die du nicht willst. Du kannst es dir später unter **⋯ → Bearbeiten** des Kontos anders überlegen, wo Kalender, die dem Konto seither hinzugekommen sind, ohne Häkchen warten. Mitra synchronisiert und speichert nur die eingeschalteten Kalender, die anderen kosten also nichts.

## Einen Kalender hinzufügen oder löschen

Ein Kalender aus einem verbundenen Konto wird beim Anbieter angelegt und gelöscht, und Mitra bemerkt das bei der nächsten Synchronisierung. Mitra-Kalender sind die Ausnahme: Füge einen mit **Neuer Kalender** im Menü **⋯** an der Überschrift von Mitra hinzu und lösche einen mit **Kalender löschen** in seinem eigenen Menü **⋯**. Hat er noch Einträge, bietet Mitra **Zuerst die Einträge verschieben…** an, damit nichts versehentlich verloren geht.

## Einen Kalender ausblenden

Das Auge am Ende einer Zeile blendet die Einträge dieses Kalenders aus. Ausblenden betrifft nur, was du siehst: Der Kalender wird weiter synchronisiert, und seine Einträge sind sofort wieder da, wenn du ihn einblendest.

Ausblenden schaltet einen Kalender nicht stumm, seine [Erinnerungen](reminders.md) gehen also weiter los. Um einen Kalender ganz anzuhalten, schalte ihn unter **⋯ → Bearbeiten** seines Kontos aus.

### Nur einen Kalender anzeigen

Um alles andere wegzuräumen, wähle im Menü **⋯** eines Kalenders **Nur diesen Kalender anzeigen** oder klick bei gedrückter <kbd>Alt</kbd>-Taste auf sein Auge. Alle anderen Kalender werden ausgeblendet, und Mitra merkt sich, welche du eingeblendet hattest. Derselbe Menüpunkt heißt dann **Zuvor sichtbare Kalender anzeigen** und holt sie zurück.

Kalender, die vorher schon ausgeblendet waren, bleiben ausgeblendet. Ein Kalender, den du in der Zwischenzeit verbunden hast, wird angezeigt, da er nicht zu dem gehörte, was du weggeräumt hast. Auch wenn du einen Kalender von Hand einblendest, geht dir der Weg zurück zu den übrigen nicht verloren. Beides geht auch über die [Befehlspalette](shortcuts.md), indem du nach dem Namen eines Kalenders suchst.

## Umbenennen

Doppelklick auf den Namen eines Kalenders oder wähle **Umbenennen** in seinem Menü **⋯**. Der Name gehört dir: Die Synchronisierung überschreibt ihn nie. Mitra übernimmt den Namen des Anbieters nur dann wieder, wenn der Kalender dort tatsächlich umbenannt wird.

## Umfärben

Wähle eine Farbe im Menü **⋯** des Kalenders. Bis dahin nutzt ein Kalender die Farbe, die sein Anbieter ihm gibt. Gibt der Anbieter keine, wählt Mitra eine anhand der Adresse des Kalenders, damit er auf jedem Gerät gleich aussieht. Einträge übernehmen die Farbe ihres Kalenders, sofern sie keine eigene haben.

## Neu anordnen

Kalender beginnen in der Reihenfolge, in der Mitra sie gefunden hat, und Konten in der Reihenfolge, in der du sie verbunden hast. Um sie selbst zu ordnen, zieh einen Kalender innerhalb seines Kontos nach oben oder unten, oder zieh ein Konto an seiner Überschrift, um es mit allen seinen Kalendern zu verschieben. Auf einem Touchscreen halte einen Moment gedrückt, bevor du ziehst, denn ein einfaches Wischen scrollt die Liste. **Nach oben** und **Nach unten** im Menü **⋯** tun dasselbe ohne Ziehen.

Ein Kalender bewegt sich nur innerhalb seines eigenen Kontos. Ein Kalender, den du später einschaltest, reiht sich am Ende seines Kontos ein, sodass er die Reihenfolge, die du festgelegt hast, nicht durcheinanderbringt.

## Wohin neue Einträge kommen

Der Kalender mit dem gefüllten Symbol ist dein Standard: Neue Einträge landen dort, sofern du keinen anderen wählst. Klick auf das Symbol eines Kalenders, um ihn zum Standard zu machen, und klick noch einmal auf das Symbol des Standards, um ihn zu löschen. Ohne Standard landen neue Einträge im ersten Kalender der Liste, wer einen Kalender nach oben schiebt, macht ihn also auch zum Standard. Dieselbe Auswahl gibt es unter **Einstellungen → Einträge**.

Neue Einträge sind Termine, es sei denn, der Kalender kann nur Aufgaben aufnehmen, wie eine Notion-Ansicht. Solange ein Eintrag neu ist, hat sein Editor einen Schalter **Termin** / **Aufgabe**. Sobald er gespeichert ist, ändere ihn mit **Typ** im Editor, solange sein Kalender die andere Art aufnehmen kann. Ein wiederkehrender Eintrag behält seinen Typ.

## Alle Einträge in einen anderen Kalender verschieben oder kopieren

**Einträge verschieben nach…** im Menü **⋯** eines Kalenders oder **Einträge aus … verschieben** in der Befehlspalette verschiebt alles darin auf einmal in einen anderen Kalender. Wähle, wohin sie sollen, und bevor etwas passiert, zeigt dir Mitra, was der Umzug kosten würde:

```
19 of 21 entries move to Personal
✓ 15 arrive with everything they carry
! 4 lose their reminders
⨯ 2 repeat and stay here
```

Der Bericht hängt davon ab, was das Ziel aufnehmen kann, er liest sich also für einen CalDAV-Kalender anders als für eine Notion-Ansicht. Einträge, die das Ziel gar nicht aufnehmen kann, etwa ein wiederkehrender Eintrag auf dem Weg nach Notion, bleiben, wo sie sind, und werden namentlich aufgelistet.

**Stattdessen kopieren** lässt die Originale, wo sie sind, und legt eine Kopie von jedem im Ziel ab. So nimmst du auch Einträge aus einem schreibgeschützten Kalender, etwa einem Abonnement: Er lässt sich kopieren, aber nichts daraus verschieben.

Verknüpfungen zwischen den Einträgen, die du verschiebst, kommen mit, sogar nach Notion, das jeder Seite eine neue ID gibt. Verknüpfungen von Einträgen, die zurückbleiben, zeigen weiter auf die, die umgezogen sind.

Kann das Ziel keine Wiederholungen aufnehmen, fragt Mitra, was mit den wiederkehrenden Einträgen geschehen soll: hier lassen oder in einzelne Einträge auflösen, einen für jede Wiederholung im kommenden Jahr, die sich nicht mehr wiederholen. Es löst nie ohne Rückfrage auf.

> [!NOTE]
> Mitra kopiert zuerst und löscht die Originale erst, wenn ihre Kopien angekommen sind. Über zwei Anbieter hinweg gibt es kein Rückgängigmachen, deshalb ist diese Reihenfolge das Sicherheitsnetz: Geht etwas schief, hast du vielleicht einen Eintrag in beiden Kalendern, aber nie einen, der fehlt. Schlägt das Kopieren fehl, bricht der ganze Umzug ab und nichts wird gelöscht.

### Einen einzelnen Eintrag verschieben

Um einen Eintrag zu verschieben, öffne ihn und wähle in seinem Editor einen anderen Kalender. Bei einem wiederkehrenden Eintrag fragt Mitra, welche du meinst. **Dieser Eintrag** verschiebt nur diese eine Wiederholung, **Dieser und folgende Einträge** verschiebt den Rest der Serie und lässt die früheren Wiederholungen zurück, und **Alle Einträge** verschiebt die ganze Serie samt Wiederholungsregel.

## Schreibgeschützte Kalender

Manche Kalender lassen sich in Mitra nicht ändern: [Kalenderabonnements](integrations/subscriptions.md) und Kalender, die jemand nur zum Ansehen mit dir geteilt hat. Mitra bemerkt das von selbst und markiert sie als schreibgeschützt.

Du kannst ihre Einträge öffnen und alles darin lesen, auswählen und kopieren, aber du kannst dort keine Einträge erstellen, ändern, verschieben oder löschen, und ein Eintrag lässt sich nicht in einen hinein verschieben. Umbenennen, Umfärben, Neuanordnen und Ausblenden funktionieren weiterhin, denn das ist deine eigene Sicht auf den Kalender. Erlaubt dir der Besitzer später Änderungen, bemerkt Mitra das bei der nächsten Synchronisierung.

## Einen Kalender erneut importieren

**Einträge neu importieren** im Menü **⋯** eines Kalenders oder eines ganzen Kontos verwirft Mitras Kopie der Einträge und importiert sie noch einmal vom Anbieter. Beim Anbieter ändert sich nichts. Du solltest es im Alltag nicht brauchen, denn die [Synchronisierung](integrations/README.md#how-syncing-works) erledigt sich von selbst. Es ist für den Fall da, dass ein Kalender nach einem Update falsch oder veraltet aussieht. Mitra-Kalender bieten es nicht an, da es keinen Anbieter gibt, von dem importiert werden könnte.
