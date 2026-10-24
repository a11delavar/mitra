---
title: Routinen-Tracker, Todoist, Teilaufgaben und Fälligkeiten auf einen Blick
---
Mitra 0.8 hilft dir, bei den Dingen dranzubleiben, die du immer wieder tust, und zeigt, wie größere Vorhaben zusammenkommen.

## Routinen-Tracker
Mitra fasst schon jetzt zu Routinen zusammen, was du oft tust, etwa das Fitnessstudio oder einen Haarschnitt alle fünf Wochen. Jetzt bekommen sie einen eigenen Platz, an dem du die letzten Tage jeder Routine auf einen Blick siehst: wie viele du eingehalten hast und welche abgesagt oder verpasst wurden. Du kannst eine Routine umbenennen, zwei zusammengehörige zusammenführen oder Mitra sagen, dass etwas gar keine Routine ist. Routinen bleiben außerdem in der Monats- und Jahresansicht stabil, egal wie weit du scrollst, und dein KI-Konnektor kann dir sagen, wie es um sie steht.

## Überall dieselbe Uhrzeit
Manches hängt nicht von deiner Zeitzone ab: Ein Medikament um 7:30 Uhr ist um 7:30 Uhr dran, zu Hause wie auf Reisen. Wähle oben in den Zeitzonen eines Eintrags **Überall dieselbe Uhrzeit**, und er bleibt bei dieser Uhrzeit, wo du auch bist, markiert mit einem durchgestrichenen Globus. Einträge, die ohne Zeitzone aus anderen Apps kommen, zeigen es ebenfalls. Bevor du einen davon in einen Kalender verschiebst, der solche Zeiten nicht kennt, etwa Google Calendar, sagt dir Mitra, dass er eine feste Zeitzone bekommt.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="same-time-dark.webp">
	<img src="same-time-light.webp" alt="Der Editor eines Eintrags beim Morgenmedikament, seine Zeitzonen geöffnet auf Überall dieselbe Uhrzeit">
</picture>

Doku: [Überall dieselbe Uhrzeit](../../docs/time-zones.md#same-time-everywhere)

## Bessere Teilaufgaben
Die Teilaufgaben eines Eintrags teilen sich in der Monats- und Jahresansicht eine Spur, sodass sich ein Vorhaben als eine Linie liest, in die seine kurzen Teilaufgaben eingeklappt sind. Die Tabelle ordnet Teilaufgaben unter ihrem übergeordneten Eintrag ein, und die Jahresansicht kann sie ausblenden. Der Fortschritt einer Aufgabe gewichtet jede Teilaufgabe nach ihrem Umfang, sodass ein großes Stück Arbeit mehr zählt als ein schnelles.

## Fälligkeiten auf einen Blick
Der Fälligkeitstag einer Aufgabe steht auf ihrer Fahne, und wenn du auf die Aufgabe zeigst, wird dieser Tag im Kalender markiert. Die Zeitleiste markiert ihn ebenfalls, und die Tabelle bekommt eine Spalte dafür. Eine Teilaufgabe ohne eigenes Fälligkeitsdatum übernimmt das ihres übergeordneten Eintrags.

## Eigenes CSS
Gestalte Mitra mit eigenem CSS: für dich selbst in den Einstellungen oder für alle auf deinem Server über eine Datei in seinem Datenordner. Wer den Server betreibt, bekommt in den Einstellungen einen eigenen Bereich.

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
- [@jkngale](https://github.com/jkngale): die Vorarbeit für Todoist
