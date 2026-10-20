---
title: KI-Konnektoren, Anhänge, Regionen und Sprachen
---
Mitra 0.7 arbeitet mit den KI-Assistenten zusammen, die du schon nutzt, sodass sie deine Zeit direkt in deinem Kalender planen können. Du kannst jetzt Dateien an deine Einträge anhängen, Mitra schreibt Daten so, wie man es in deiner Region tut, und die Zeitzone deines Zuhauses bleibt auf Reisen bei dir. Mitra gibt es jetzt auch auf Chinesisch, und was sich geändert hat, liest du, ohne die App zu verlassen. Außerdem gehen Ziehen, Zoomen und Laden schneller, und dazu kommen viele kleinere Verbesserungen und Korrekturen.

## KI-Konnektoren
KI-Assistenten wie Claude und Cursor können jetzt mit deinem Kalender arbeiten. Verbinde einen über die Adresse unter Einstellungen → KI und bitte ihn um das, was du sonst von Hand erledigen würdest, etwa deine Woche ansehen, einen Eintrag finden, eine Reise planen oder ein Treffen verschieben. Was er schreibt, landet wie jede andere Änderung in deinen Kalendern und wird von dort aus synchronisiert. Auf einem Server, an dem man sich anmeldet, bekommt jeder Assistent ein eigenes Zugriffstoken, das sich aufs Lesen beschränken und jederzeit widerrufen lässt.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="connectors-dark.webp">
	<img src="connectors-light.webp" alt="Ein KI-Assistent trägt eine geplante Reise nach Paris in die Woche ein: Die alten Pläne verschwinden, die Reise kommt hinzu, und der Eiffelturm öffnet sich mit Foto und Ticket">
</picture>

Foto des Eiffelturms: David McSpadden, Wikimedia Commons, CC BY 2.0.

Doku: [KI-Konnektoren](../../docs/ai-connectors.md)

## Regionen & Sprachen
Wähle zusammen mit deiner Sprache dein Land. Mitra schreibt Daten, Uhrzeiten und Zahlen dann so, wie man es dort tut. Deine Woche beginnt an dem Tag, an dem sie dort beginnt, und das Wochenende fällt auf die Tage, an denen du frei hast. Eine Vorschau zeigt dir, wie alles aussehen wird, bevor du dich entscheidest. Tastenkürzel funktionieren jetzt auch, wenn deine Tastatur eine andere Schrift schreibt, etwa Persisch.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="locales-dark.webp">
	<img src="locales-light.webp" alt="Die Einstellung Sprache, geöffnet auf ihren Sprachen, Italienisch aufgeklappt zu den Ländern, in denen es geschrieben wird">
</picture>

Doku: [Einstellungen](../../docs/settings.md)

## Zeitzone deines Zuhauses
Mitra kennt jetzt die Zeitzone deines Zuhauses und bewahrt sie in deinem Konto auf. Wenn du verreist, folgt der Kalender deinem Gerät, und dein Zuhause bleibt in der Spalte daneben. Deine Liste der Zonen bleibt dabei, wie sie war, sodass du nach deiner Rückkehr wieder eine einzige Spalte siehst. Die Zonen, die du hinzufügst, und die Namen, die du ihnen gibst, sind auf jedem Gerät dieselben. Über jeder Spalte steht der kurze Name, den die Leute für diese Zone wirklich benutzen.

Auch die Auswahl der Zeitzonen ist neu gestaltet. Zonen mit demselben Namen und derselben Uhrzeit sind in einer Zeile zusammengefasst, und die Zonen deines eigenen Landes stehen zuerst. Ein Haus markiert dein Zuhause, und eine Stecknadel markiert die Zone, in der du dich auf Reisen befindest.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="time-zones-dark.webp">
	<img src="time-zones-light.webp" alt="Die Auswahl der Zeitzonen, geöffnet beim Zuhause zwischen den gruppierten Zonen um es herum">
</picture>

> [!NOTE]
> Wenn du der Zeitzone, in der du bist, einen eigenen Namen gegeben hast, gib ihr diesen Namen bitte noch einmal. Bisher blieben solche Namen auf dem Gerät, auf dem du sie vergeben hast. Ab jetzt folgt dir ein Name auf jedes Gerät.

Doku: [Zeitzonen](../../docs/time-zones.md)

## Anhänge
Du kannst jetzt Dateien an einen Eintrag anhängen, zum Beispiel ein Ticket, eine Tagesordnung oder ein Foto vom Whiteboard. Füge sie mit der Büroklammer im Editor des Eintrags hinzu oder zieh sie auf den geöffneten Eintrag. Mit einem Klick öffnest du eine Datei. Du kannst eine Datei auch in die Beschreibung einfügen: Ein Bild erscheint dort als Bild, jede andere Datei als Link. Wenn du die Datei später entfernst, entfernt Mitra sie auch aus der Beschreibung.

Anhänge werden mit deinem Kalender synchronisiert. In einem CalDAV-Kalender sehen andere Apps, die denselben Kalender nutzen, die Dateien, die du anhängst, und Mitra zeigt die Dateien, die sie angehängt haben. In Google Kalender zeigt Mitra die Google-Drive-Dateien eines Termins an, kann aber keine hinzufügen oder entfernen, weil Google nur Drive-Dateien behält. Bilder in einer Notion-Seite erscheinen jetzt in der Beschreibung der Aufgabe.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="attachments-dark.webp">
	<img src="attachments-light.webp" alt="Eine geöffnete Aufgabe neben ihrem Eintrag in der Woche, dessen Büroklammer zeigt, dass sie Dateien trägt: Der Editor listet ein PDF, eine Skizze und eine Tabelle über der Beschreibung, die die Skizze zeigt">
</picture>

> [!NOTE]
> Mitra speichert die Dateien, die du anhängst, in seinem Datenordner. Wenn du diesen Ordner sicherst, sicherst du also auch deine Dateien. Mit `MITRA_FILE_MAX_SIZE` begrenzt du die Größe einer einzelnen Datei, mit `MITRA_FILE_QUOTA`, wie viel jede Person insgesamt speichern darf.

Doku: [Anhänge](../../docs/attachments.md)

## Release Notes in der App
Du kannst jetzt sehen, was sich geändert hat, ohne Mitra zu verlassen. Der Dialog Über zeigt jedes Release so, wie es die Website tut. Er enthält die Notizen und Bilder der Version, die du nutzt, zusammen mit den Korrekturen, die danach kamen. Auch jeder Commit ist aufgeführt, eingeklappt, bis du ihn brauchst.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="about-dark.webp">
	<img src="about-light.webp" alt="Der Dialog Über, geöffnet auf den Notizen und Bildern eines Releases">
</picture>

## Chinesisch
Mitra spricht jetzt Chinesisch, in vereinfachten Schriftzeichen. Die App, der Beispielkalender, die Doku und die Website sind übersetzt, und chinesischer Text erscheint in einer Schrift, die dafür gemacht ist.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="chinese-detail-dark.webp">
	<img src="chinese-detail-light.webp" alt="Der Eintragseditor auf Chinesisch, seine Datumsauswahl auf dem Monat geöffnet">
</picture>

Doku: [Einstellungen](../../docs/settings.md)

## Mitwirkende
- [@a11delavar](https://github.com/a11delavar)
- [@d8monx](https://github.com/d8monx)
