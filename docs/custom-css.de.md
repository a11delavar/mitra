---
title: Eigenes CSS
description: "Gestalte Mitra mit eigenem CSS um: ein eigenes Stylesheet, das deinem Konto folgt, und eines für alle auf dem Server."
---

Mitras Aussehen ist schlichtes CSS, und du kannst dein eigenes darüberlegen. Blende aus, was du nie brauchst, zieh einen Rahmen um heute oder gib dem ganzen Server deine Farben. Dafür gibt es zwei Orte: **Einstellungen → Allgemein → Eigenes CSS** für dich selbst und, wo man sich anmeldet, **Einstellungen → Verwaltung → Eigenes CSS für alle** für alle auf dem Server.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/custom-css-dark.webp">
  <img src="../assets/screenshots/custom-css-light.webp" alt="Mitra im Gold seines Logos, mit der Regel unter Eigenes CSS, die das macht, offen in den Einstellungen" />
</picture>

> [!WARNING]
> Bis Mitra 1.0 kann jedes Update die Elemente, Attribute und Variablen ändern, auf die deine Regeln zielen. Eine Regel, die heute funktioniert, kann nach einem Update nicht mehr greifen oder plötzlich etwas verstecken. Halte dein Stylesheet kurz und sieh dir Mitra nach jedem Update an.

## Dein eigenes Stylesheet

Öffne **Einstellungen → Allgemein** und tipp CSS in das Feld unter **Eigenes CSS**. Mitra wendet es an, während du tippst, speichert es einen Moment nachdem du aufhörst, und es folgt deinem Konto auf jedes Gerät und in jeden Browser, in dem du dich anmeldest.

Der Schalter neben **Eigenes CSS** schaltet dein Stylesheet aus, ohne es zu verlieren, und die [Befehlspalette](shortcuts.md) bietet **Eigenes CSS: Aus** und **Eigenes CSS: Ein** an.

`@import` wird beim Speichern entfernt: Füg ein ganzes Stylesheet ein, statt auf eines zu verlinken.

## Das Stylesheet des Servers

Wo man sich anmeldet, kann eine Administratorin oder ein Administrator Mitra für alle auf dem Server umgestalten: Öffne **Einstellungen → Verwaltung** und tippe CSS in das Feld unter **Eigenes CSS für alle**. Du siehst es beim Tippen, alle anderen, sobald sie Mitra das nächste Mal laden. Sein Schalter macht es für alle aus, ohne es zu verlieren. Wer sich als Erstes an einem Server anmeldet, verwaltet ihn. Ohne Anmeldung erreicht dein eigenes Stylesheet schon alle, die Mitra nutzen, also gibt es nur dieses.

Es passt zu dem, was einen Server zu deinem macht, etwa seinen Farben, seiner Schrift oder dem [Namen](configuration.md#name-your-instance), den er schon trägt. Das eigene Stylesheet jeder Person kommt danach, also gewinnt ihres, wo beide dasselbe festlegen.

## Deine Regel gewinnt

Mitras eigene Regeln liegen in einer Kaskadenebene namens `mitra`, deine nicht. Deshalb schlägt eine Regel von dir die von Mitra, ganz gleich, wie ihr Selektor aussieht. `!important` brauchst du nicht. Die wenigen `!important`-Angaben von Mitra selbst bleiben oben, weil Ebenen sie umgekehrt ordnen: Sie halten das Layout zusammen.

Um etwas wegzunehmen, das Mitra setzt, statt es zu übermalen, setz die Eigenschaft auf `revert`. Das entfernt die Fläche der Tage in der Monatsansicht:

```css
mitra-weeks mitra-day {
	background: revert;
}
```

## Beispiele

### Die Tage außerhalb des Monats ausblenden

```css
mitra-weeks [data-outside] {
	visibility: hidden;
}
```

In der [Monatsansicht](views/month.md) blendet das die Tage vor und nach dem gezeigten Monat aus, ihr Datum und ihren Hintergrund. Die Einträge darauf bleiben. `visibility` lässt das Raster stehen, wo `display: none` es auseinanderziehen würde. Zoom hinein, um den Tagen des Monats mehr Platz zu geben.

### Ein Rahmen um heute

```css
mitra-weeks mitra-day[today] {
	outline: 2px solid var(--color-accent);
	outline-offset: -2px;
}
```

`outline` statt `border`: Ein Rahmen würde den Tag vergrößern und das Raster verschieben.

### Deine eigenen Farben

```css
:root {
	--color-accent: light-dark(#2e7d32, #81c784);
	--border-radius: 8px;
}
```

`light-dark()` nimmt die Farbe für das helle Erscheinungsbild, dann die für das dunkle. Alles, was Mitra mit diesen Variablen einfärbt, zieht mit, auch die Titelleiste der [installierten App](install-app.md):

| Variable | Was sie einfärbt |
| --- | --- |
| `--color-accent` | Heute, Ausgewähltes, Fokusrahmen und die Hauptschaltflächen |
| `--color-background-seed` | Den Grund hinter allem; Dialoge leiten ihren davon ab |
| `--color-surface` | Die Tage in den Ansichten und was auf dem Grund liegt, etwa die Befehlspalette |
| `--color-text` | Text |
| `--color-text-muted` | Nebensächlichen Text, etwa Hinweise und Uhrzeiten |
| `--color-error` | Fehler und Warnungen |
| `--border-radius` | Die Ecken von Schaltflächen, Einträgen und den meisten Bedienelementen |
| `--font-family` | Die Schrift des Textes |

## Herausfinden, worauf du zielst

Die Entwicklerwerkzeuge deines Browsers zeigen, was auf der Seite steht: Klick mit der rechten Maustaste auf etwas und wähl **Untersuchen**. Mitras eigene Elemente heißen `mitra-…`, etwa die Ansichten `mitra-days` (Woche), `mitra-weeks` (Monat), `mitra-months` (Jahr), `mitra-timeline` und `mitra-table`, ein Tag `mitra-day`, ein Eintrag `mitra-entry-segment` und die Seitenleiste `mitra-sidebar`. Attribute nennen Tatsachen, etwa `today`, `data-outside` und `data-date`.

Schaltflächen, Felder, Schalter, Menüs und die anderen Bedienelemente behalten ihr Inneres für sich. Erreichen kannst du sie über ihre Teile, etwa `mitra-switch::part(switch)`, und über die `--mitra-…`-Variablen, die sie lesen. Wenn du weiter hineinreichen musst, bitte in einem [Issue](https://github.com/a11delavar/mitra/issues) um einen Teil.

## Was du in Ruhe lassen solltest

Ein paar Dinge halten Mitra zusammen, und wer sie ändert, bricht es:

- `display` oder `position` auf `mitra-day` oder auf den `.entries` in einer Ansicht: Sie liegen auf einem Raster, das die ganze Ansicht teilt, und ohne es wird die Wochenansicht sehr langsam.
- Variablen, die mit `--_` beginnen: Sie ändern sich in jedem Bild eines Zooms, und wer sie setzt, kämpft gegen ihn.
- Die Größe eines Eintrags: Seine Überschrift wählt ihr Layout nach seiner Breite, also kann eine Größe von außen es umschalten.
- `all: unset` hebt auch das Ausblenden auf, also schreib `[hidden] { display: none }` daneben.

## Wenn eine Regel den Weg zurück versteckt

Häng `?css=off` an die Adresse an, etwa `https://mitra.example.com/?css=off`. Mitra lädt dann einmal ohne beide Stylesheets, sodass du **Einstellungen** öffnen und deines reparieren kannst. Wer den Server verwaltet, repariert das für alle genauso.

## Bevor du etwas einfügst

Ein Stylesheet führt keinen Code aus, aber es kann Adressen laden, und eines, das dafür geschrieben ist, kann ihnen schicken, was auf deinem Bildschirm steht. Füg nur CSS ein, das du verstehst. Dein eigenes Stylesheet trifft nur dich, das des Servers alle auf ihm.

## Teile deines

Unter dem Feld öffnet **Auf GitHub teilen** eine neue Diskussion in der Kategorie [Custom CSS](https://github.com/a11delavar/mitra/discussions/categories/custom-css), in der dein Stylesheet schon steht. Schreib, was es macht, füg einen Screenshot hinzu, wenn man etwas sieht, und veröffentliche sie. Ein Stylesheet, das zu lang für den Link ist, wird stattdessen in deine Zwischenablage kopiert, damit du es in die Diskussion einfügst. In der Kategorie findest du auch Stylesheets, die andere geteilt haben: Lies sie, bevor du sie einfügst.
