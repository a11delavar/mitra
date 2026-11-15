---
title: Routinen & Serien, Todoist, Terminstatus und Fälligkeiten auf einen Blick
---
Mitra 0.8 gibt deinen Routinen einen eigenen Platz, an dem du siehst, wie es um jede steht, und ihre Serie am Laufen hältst. Außerdem verbindet sich Mitra mit Todoist, zeigt, wann eine Aufgabe fällig ist und ob ein Termin noch stattfindet, und gibt es in vier weiteren Sprachen, dazu viele kleinere Verbesserungen und Fehlerbehebungen.

## Routinen & Serien
Mitra fasst schon jetzt zu Routinen zusammen, was du oft tust, etwa das Fitnessstudio oder einen Haarschnitt alle fünf Wochen. Jetzt bekommen sie einen eigenen Platz, an dem eine Flamme die Serie jeder Routine auf einen Blick zeigt und ihre Details die Tage, die du eingehalten, abgesagt oder verpasst hast. Du kannst eine Routine umbenennen, zwei zusammengehörige zusammenführen oder Mitra sagen, dass etwas gar keine Routine ist. Routinen bleiben außerdem in der Monats- und Jahresansicht stabil, egal wie weit du scrollst, und dein KI-Konnektor kann dir sagen, wie es um sie steht. Der Tab zeigt zuerst die Routinen von **Heute**, dann die **Laufend**en, und klappt die, die lange zurückliegen, unter **Vergangen** weg. Um die Routinen eines Kalenders auszulassen, etwa die deines Arbeitskalenders, wähle in seinem Menü **Routinen ausblenden**.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="routines-dark.webp">
	<img src="routines-light.webp" alt="Der Tab Routinen neben der Monatsansicht, jede Routine mit ihrer Serie, daneben die Details des Fitnessstudios">
</picture>

Doku: [Routinen](../../docs/routines.md)

## Überall dieselbe Uhrzeit
Manches hängt nicht von deiner Zeitzone ab: Ein Medikament um 7:30 Uhr ist um 7:30 Uhr dran, zu Hause wie auf Reisen. Wähle oben in den Zeitzonen eines Eintrags **Überall dieselbe Uhrzeit**, und er bleibt bei dieser Uhrzeit, wo du auch bist, markiert mit einem durchgestrichenen Globus. Einträge, die ohne Zeitzone aus anderen Apps kommen, zeigen es ebenfalls. Bevor du einen davon in einen Kalender verschiebst, der solche Zeiten nicht kennt, etwa Google Calendar, sagt dir Mitra, dass er eine feste Zeitzone bekommt.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="same-time-dark.webp">
	<img src="same-time-light.webp" alt="Der Editor eines Eintrags beim Morgenmedikament, seine Zeitzonen geöffnet auf Überall dieselbe Uhrzeit">
</picture>

Doku: [Überall dieselbe Uhrzeit](../../docs/time-zones.md#same-time-everywhere)

## Terminstatus
Ein Termin hat jetzt einen eigenen Status, wie eine Aufgabe: **Bestätigt**, **Vielleicht** oder **Abgebrochen**. Ein abgesagter Termin behält seinen Platz, durchgestrichen, sodass festgehalten bleibt, was nicht stattgefunden hat, und deine Routinen zählen ihn mit. Ein Vielleicht bleibt blass, bis du dich entscheidest. Der Status wird mit anderen CalDAV-Apps abgeglichen, und die Tabelle zeigt ihn neben dem der Aufgaben. **Erledigte Aufgaben ausblenden** blendet jetzt nur erledigte Aufgaben aus, und das neue **Abgebrochenes ausblenden** blendet abgebrochene Aufgaben und Termine aus.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="event-status-dark.webp">
	<img src="event-status-light.webp" alt="Der Editor eines Termins mit geöffnetem Statusmenü: Bestätigt, Vielleicht und Abgebrochen">
</picture>

Doku: [Terminstatus](../../docs/entries.md#event-status)

## Fälligkeiten auf einen Blick
Eine geplante Aufgabe zeigt jetzt direkt auf ihrer Fahne, wann sie fällig ist, je nachdem wie bald als Uhrzeit, Wochentag oder Datum. Zeigst du in der Wochen- oder Monatsansicht oder in der Zeitleiste auf eine Aufgabe, streckt sie sich bis zu ihrem Fälligkeitsdatum, und du siehst, wie viel Luft noch bleibt. Hast du eine Aufgabe so geplant, dass sie erst nach ihrem Fälligkeitsdatum fertig wird, wird die Fahne rot. Und die Tabelle hat eine neue Spalte für Fälligkeitsdaten.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="due-stretch-dark.webp">
	<img src="due-stretch-light.webp" alt="Der Zeiger auf der Aufgabe vom Dienstag streckt sie bis zu ihrem Fälligkeitsdatum, wenn am Mittwoch die Planungsbesprechung beginnt">
</picture>

Doku: [Ein Fälligkeitsdatum setzen](../../docs/planning.md#set-a-due-date)

## Personalisierung
Gib jedem Kalender eine von zwei weiteren Farben oder eine ganz eigene. Benenne die Überschrift eines Kontos per Doppelklick um und blende alle seine Kalender auf einmal aus.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="personalization-dark.webp">
	<img src="personalization-light.webp" alt="Das Menü eines Kalenders in der Seitenleiste, seine Farben neben den Kalendern, die sie einfärben">
</picture>

## Eigenes CSS
Mitras Aussehen ist schlichtes CSS, und jetzt kannst du dein eigenes darüberlegen. Öffne **Einstellungen → Allgemein → Eigenes CSS** und tippe eine Regel: Mitra wendet sie beim Tippen an und speichert sie in deinem Konto, sodass sie dir auf jedes Gerät folgt. Gib Mitra deine Lieblingsfarbe, mach alle Ecken eckig oder blende aus, was du nie brauchst. Wo man sich anmeldet, findet, wer den Server verwaltet, unter **Verwaltung** außerdem **Eigenes CSS für alle**, um dem ganzen Server sein Aussehen zu geben.

**Auf GitHub teilen** unter dem Feld beginnt einen Beitrag in den [Custom-CSS-Diskussionen](https://github.com/a11delavar/mitra/discussions/categories/custom-css), in dem dein Stylesheet schon steht, und dort findest du auch, was andere gemacht haben. Bis Mitra 1.0 kann ein Update ändern, worauf deine Regeln zielen, also schau nach einem Update kurz nach.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="custom-css-dark.webp">
	<img src="custom-css-light.webp" alt="Mitra im Gold seines Logos, mit der Regel unter Eigenes CSS, die das macht, offen in den Einstellungen">
</picture>

Doku: [Eigenes CSS](../../docs/custom-css.md)

## Auf andere Tage duplizieren
Manches findet an Tagen statt, die keine Wiederholung beschreiben kann. Ein Rezept über acht Physiotherapie-Termine verteilt sich auf die freien Zeiten der Praxis, und ein Kunde bucht dich für den 3., 9. und 17. Lege den ersten Termin an, wähle in seinem ⋯-Menü **Auf andere Tage duplizieren** und wähle die übrigen in den zwei angezeigten Monaten aus. Halte die Umschalttaste gedrückt, um mehrere Tage am Stück zu wählen. Jeder Tag bekommt eine Kopie zur selben Uhrzeit, einen eigenen Eintrag, den du wie jeden anderen verschieben oder ändern kannst.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="duplicate-days-dark.webp">
	<img src="duplicate-days-light.webp" alt="Der Dialog „Auf andere Tage duplizieren“ für eine Physiotherapie, sieben weitere Termine im Oktober und November gewählt">
</picture>

Doku: [Auf andere Tage duplizieren](../../docs/entries.md#the--menu)

## Todoist
Verbinde deine Todoist-Projekte, und ihre Aufgaben stehen auf derselben Zeitleiste wie deine Termine, in beide Richtungen synchronisiert. Jedes Projekt wird zu einem Kalender in seiner Farbe aus Todoist. Datum, Dauer und Deadline einer Aufgabe werden zu ihrem Termin, ihrer Länge und ihrem Fälligkeitsdatum. Eine Aufgabe, die sich in Todoist wiederholt, erscheint an ihrem nächsten Datum, und wenn du sie in Mitra erledigst, rückt sie weiter, wie in Todoist. Priorität, Labels und Abschnitte bleiben, wie sie sind.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="todoist-dark.webp">
	<img src="todoist-light.webp" alt="Der Dialog „Integration hinzufügen“, der Zeiger auf Todoist zwischen den anderen Anbietern">
</picture>

Doku: [Todoist](../../docs/integrations/todoist.md)

## Mehr Sprachen
Mitra lernt Arabisch, Russisch, Polnisch und Niederländisch. Mit jeder Version funktioniert Mitra besser in anderen Sprachen, Schriften und Kalendern. Jede neue Sprache kommt vollständig übersetzt, einschließlich der Dokumentation und der Website.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="arabic-week-dark.webp">
	<img src="arabic-week-light.webp" alt="Die Wochenansicht auf Arabisch, von rechts nach links ausgerichtet, mit einem Termin, der im Editor geöffnet ist">
</picture>

## Mitwirkende
- [@a11delavar](https://github.com/a11delavar)
- [@jkngale](https://github.com/jkngale)
- [@d8monx](https://github.com/d8monx)
- [@libnewton](https://github.com/libnewton)
