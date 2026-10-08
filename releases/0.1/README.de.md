---
title: Mitra, ein Kalender ganz für dich
---
Das erste Release von Mitra: ein Kalender, der deine Aufgaben auf dieselbe Zeitleiste legt wie deine Termine und in beide Richtungen mit den Kalendern synchronisiert, die du schon führst.

## Warum Mitra
Es gibt gute Kalender-Apps, und es gibt Kalender, die du selbst hosten kannst. Lange waren das nicht dieselben.

Die gelungenen Apps laufen auf fremden Servern und lesen alles mit, was du hineinschreibst. Die, die du zu Hause betreiben kannst, sind meist reine Server: Sie bewahren deine Kalender treu auf und überlassen es dir, sie mit irgendeiner App anzuschauen, die du findest. Mitra begann mit dem Wunsch, beides zu haben: einen Kalender, in dem man gern den Tag verbringt, auf einem eigenen Rechner und ohne jemandem Rechenschaft zu schulden.

Du musst dafür nicht umziehen. Mitra ist eine Ebene über den Kalendern, die du schon führst, und kein weiterer Ort, an dem du sie führen musst. Jede Quelle deiner Zeit ist eine Integration, die sich neben die anderen steckt, zuerst ein CalDAV-Server und seither viele mehr. Alle treffen sich auf einer Zeitleiste, und jede behält ihre Daten dort, wo sie liegen. Auch deine Termine und deine Aufgaben teilen sich diese Zeitleiste, sodass die Mühe, das eine ins andere zu fügen, nicht mehr in deinem Kopf stattfindet.

Es ist außerdem eine Wette auf das Web, wie es heute ist, nicht wie vor zehn Jahren. Mitra ist für aktuelle Browser geschrieben und stützt sich auf das, was sie von Haus aus können: Layouts, die sich an ihren eigenen Platz anpassen, Popovers, die an ihrer Stelle verankert sind, Übergänge zwischen Ansichten, ein echtes Modell für Daten und Zeitzonen. Weil es keine Kompatibilitätsschichten und kein schweres Framework mit sich trägt, bleibt es klein und schnell, lässt sich als App installieren und fühlt sich auf dem Handy so zu Hause an wie am Computer. Der Preis ist, dass es einen aktuellen Browser verlangt, und das wird so bleiben.

Darunter liegt eine einfache Überzeugung: Deine Zeit ist die persönlichste Aufzeichnung, die du führst. Wo sie liegt, wer sie lesen kann und wie ruhig es sich anfühlt, sie anzusehen, sollte deine Entscheidung sein. Mitra ist der Versuch, das leicht zu machen.

[@a11delavar](https://github.com/a11delavar)

## Wochenansicht
Ein Tag ist eine Spalte mit 24 Stunden und einer Linie bei der aktuellen Uhrzeit, eine Woche sind sieben davon nebeneinander. Mit einer Schaltfläche kommst du zurück zu heute.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="week-dark.webp">
	<img src="week-light.webp" alt="Die Wochenansicht mit der Linie bei der aktuellen Uhrzeit">
</picture>

Doku: [Wochenansicht](../../docs/views/week.md)

## Monatsansicht
Der Monat scrollt endlos weiter, mit einer Zeile für jede Woche und einem Balken für jeden Eintrag über seine Tage. Wechsle über die Kopfzeile zwischen ihm und der Woche.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="month-dark.webp">
	<img src="month-light.webp" alt="Die Monatsansicht, eine Zeile für jede Woche">
</picture>

Doku: [Monatsansicht](../../docs/views/month.md)

## Termine und Aufgaben
Eine Aufgabe steht im Tag wie ein Termin, mit einem Kästchen zum Abhaken, wenn sie erledigt ist. Zieh im Raster, um einen Eintrag anzulegen, zieh ihn, um ihn zu verschieben, und gib jedem Kalender seine Farbe.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="entries-dark.webp">
	<img src="entries-light.webp" alt="Termine und Aufgaben nebeneinander in einem Tag">
</picture>

Doku: [Einträge](../../docs/entries.md)

## CalDAV
Verbinde einen CalDAV-Server, wähle, welche seiner Kalender angezeigt werden, und Mitra hält sie in beide Richtungen auf dem gleichen Stand, wobei Änderungen von anderswo sofort erscheinen.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="caldav-dark.webp">
	<img src="caldav-light.webp" alt="Einen CalDAV-Server verbinden">
</picture>

Doku: [CalDAV](../../docs/integrations/caldav.md)

## Markdown-Notizen
Die Beschreibung eines Eintrags ist Markdown: Überschriften, Listen und Links werden als solche gelesen und bleiben für jede andere App einfacher Text.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="markdown-dark.webp">
	<img src="markdown-light.webp" alt="Eine Tagesordnung in der Beschreibung eines Eintrags, in Markdown geschrieben">
</picture>

## Mitwirkende
- [@a11delavar](https://github.com/a11delavar)
