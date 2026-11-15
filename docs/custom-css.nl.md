---
title: Eigen CSS
description: "Geef Mitra een ander uiterlijk met je eigen CSS: een eigen stylesheet die je account volgt, en een voor iedereen op de server."
---

Het uiterlijk van Mitra is gewone CSS, en je kunt je eigen CSS eroverheen leggen. Verberg wat je nooit gebruikt, zet een rand om vandaag of geef de hele server jouw kleuren. Er zijn twee plekken voor: **Instellingen → Algemeen → Eigen CSS** voor jezelf en, waar mensen inloggen, **Instellingen → Beheer → Eigen CSS voor iedereen** voor iedereen op de server.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/custom-css-dark.webp">
  <img src="../assets/screenshots/custom-css-light.webp" alt="Mitra in het goud van zijn logo, met de regel onder Eigen CSS die dat doet open in de instellingen" />
</picture>

> [!WARNING]
> Tot Mitra 1.0 kan elke update de elementen, attributen en variabelen veranderen waar je regels op mikken. Een regel die vandaag werkt, kan na een update niet meer werken of iets gaan verbergen. Houd je stylesheet kort en bekijk Mitra na elke update.

## Je eigen stylesheet

Open **Instellingen → Algemeen** en typ CSS in het vak onder **Eigen CSS**. Mitra past het toe terwijl je typt, slaat het op een moment nadat je stopt, en het volgt je account naar elk apparaat en elke browser waarop je inlogt.

De schakelaar naast **Eigen CSS** zet je stylesheet uit zonder dat je het kwijtraakt, en het [opdrachtenpalet](shortcuts.md) biedt **Eigen CSS: Uit** en **Eigen CSS: Aan**.

`@import` wordt verwijderd als je stylesheet wordt opgeslagen: plak een heel stylesheet in plaats van ernaar te linken.

## Het stylesheet van de server

Waar mensen inloggen, kan een beheerder Mitra voor iedereen op de server een ander uiterlijk geven: open **Instellingen → Beheer** en typ CSS in het vak onder **Eigen CSS voor iedereen**. Jij ziet het terwijl je typt, alle anderen de volgende keer dat ze Mitra laden. De schakelaar zet het voor iedereen uit zonder dat je het kwijtraakt. Wie als eerste op een server inlogt, is de beheerder. Zonder inloggen bereikt je eigen stylesheet al iedereen die Mitra gebruikt, dus is dat de enige.

Het past bij wat een server van jou maakt, zoals de kleuren, het lettertype of de [naam](configuration.md#name-your-instance) die hij al draagt. Het eigen stylesheet van ieder persoon komt erna, dus dat van hen wint waar beide hetzelfde instellen.

## Jouw regel wint

De eigen regels van Mitra zitten in een cascadelaag met de naam `mitra`, en de jouwe niet, dus een regel van jou wint van die van Mitra, wat de selector ook is. Je hebt `!important` niet nodig. De paar `!important`-declaraties van Mitra zelf blijven bovenaan, omdat lagen ze andersom rangschikken: ze houden de opmaak bij elkaar.

Om iets weg te halen wat Mitra instelt, in plaats van eroverheen te schilderen, zet je de eigenschap op `revert`. Dit haalt het vlak van de dagen in de maandweergave weg:

```css
mitra-weeks mitra-day {
	background: revert;
}
```

## Voorbeelden

### De dagen buiten de maand verbergen

```css
mitra-weeks [data-outside] {
	visibility: hidden;
}
```

In de [maandweergave](views/month.md) verbergt dit de dagen voor en na de getoonde maand, hun datums en hun achtergrond. De items erop blijven staan. `visibility` houdt het raster op zijn plek, waar `display: none` het uit elkaar zou trekken. Zoom in om de dagen van de maand zelf meer ruimte te geven.

### Een rand om vandaag

```css
mitra-weeks mitra-day[today] {
	outline: 2px solid var(--color-accent);
	outline-offset: -2px;
}
```

`outline` in plaats van `border`: een rand zou de dag groter maken en het raster verschuiven.

### Je eigen kleuren

```css
:root {
	--color-accent: light-dark(#2e7d32, #81c784);
	--border-radius: 8px;
}
```

`light-dark()` neemt de kleur voor het lichte thema en daarna die voor het donkere. Alles wat Mitra met deze variabelen kleurt, volgt mee, ook de titelbalk van de [geïnstalleerde app](install-app.md):

| Variabele | Wat hij kleurt |
| --- | --- |
| `--color-accent` | Vandaag, wat geselecteerd is, focusringen en de hoofdknoppen |
| `--color-background-seed` | De ondergrond achter alles; dialogen leiden die van hen hiervan af |
| `--color-surface` | De dagen in de weergaven, en wat op de ondergrond ligt, zoals het opdrachtenpalet |
| `--color-text` | Tekst |
| `--color-text-muted` | Bijkomende tekst, zoals hints en tijden |
| `--color-error` | Fouten en waarschuwingen |
| `--border-radius` | De hoeken van knoppen, items en de meeste bedieningselementen |
| `--font-family` | Het lettertype van de tekst |

## Vinden waar je op mikt

De ontwikkelaarstools van je browser laten zien wat er op de pagina staat: klik met de rechtermuisknop op iets en kies **Inspecteren**. De eigen elementen van Mitra heten `mitra-…`, zoals de weergaven `mitra-days` (week), `mitra-weeks` (maand), `mitra-months` (jaar), `mitra-timeline` en `mitra-table`, een dag `mitra-day`, een item `mitra-entry-segment` en de zijbalk `mitra-sidebar`. Attributen noemen feiten, zoals `today`, `data-outside` en `data-date`.

Knoppen, velden, schakelaars, menu's en de andere bedieningselementen houden hun binnenkant voor zich. Je bereikt ze via hun onderdelen, zoals `mitra-switch::part(switch)`, en via de `--mitra-…`-variabelen die ze lezen. Moet je verder reiken, vraag dan om een onderdeel in een [issue](https://github.com/a11delavar/mitra/issues).

## Waar je beter vanaf blijft

Een paar dingen houden Mitra bij elkaar, en wie ze verandert, maakt het stuk:

- `display` of `position` op `mitra-day`, of op de `.entries` in een weergave: ze staan op een raster dat de hele weergave deelt, en zonder dat wordt de weekweergave erg traag.
- Variabelen die met `--_` beginnen: ze veranderen bij elk beeld van een zoom, en wie ze instelt, vecht ertegen.
- De grootte van een item: de kop kiest een opmaak op basis van de breedte, dus een grootte van buitenaf kan die omschakelen.
- `all: unset` heft ook het verbergen op, dus zet `[hidden] { display: none }` ernaast.

## Als een regel de weg terug verbergt

Voeg `?css=off` toe aan het adres, zoals `https://mitra.example.com/?css=off`. Mitra laadt dan één keer zonder beide stylesheets, zodat je **Instellingen** kunt openen en het jouwe kunt herstellen. Een beheerder herstelt dat voor iedereen op dezelfde manier.

## Voordat je plakt

Een stylesheet voert geen code uit, maar het kan adressen laden, en een stylesheet dat daarvoor geschreven is, kan wat op je scherm staat naar die adressen sturen. Plak alleen CSS die je begrijpt. Je eigen stylesheet bereikt alleen jou, dat van de server iedereen erop.

## Deel het jouwe

Onder het vak opent **Delen op GitHub** een nieuwe discussie in de categorie [Custom CSS](https://github.com/a11delavar/mitra/discussions/categories/custom-css) met je stylesheet er al in. Zeg wat het doet, voeg een schermafbeelding toe als het iets laat zien, en plaats het. Een stylesheet dat te lang is voor de link, wordt in plaats daarvan naar je klembord gekopieerd, zodat je het in de discussie kunt plakken. In de categorie vind je ook stylesheets die anderen hebben gedeeld: lees ze voordat je ze plakt.
