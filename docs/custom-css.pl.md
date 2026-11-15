---
title: Własny CSS
description: "Zmień wygląd aplikacji Mitra własnym CSS: własny arkusz stylów, który podąża za twoim kontem, i jeden dla wszystkich na serwerze."
---

Wygląd aplikacji Mitra to zwykły CSS, a ty możesz dodać na nim własny. Ukryj to, czego nigdy nie używasz, obrysuj dzisiejszy dzień ramką albo nadaj całemu serwerowi swoje kolory. Są na to dwa miejsca: **Ustawienia → Ogólne → Własny CSS** dla ciebie i, tam gdzie ludzie się logują, **Ustawienia → Administracja → Własny CSS dla wszystkich** dla wszystkich na serwerze.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/custom-css-dark.webp">
  <img src="../assets/screenshots/custom-css-light.webp" alt="Mitra w złocie swojego logo, z otwartą w ustawieniach regułą Własny CSS, która to robi" />
</picture>

> [!WARNING]
> Do wersji Mitra 1.0 każda aktualizacja może zmienić elementy, atrybuty i zmienne, w które celują twoje reguły. Reguła, która działa dziś, po aktualizacji może przestać działać albo zacząć coś ukrywać. Trzymaj arkusz stylów krótki i przyjrzyj się aplikacji Mitra po każdej aktualizacji.

## Twój własny arkusz stylów

Otwórz **Ustawienia → Ogólne** i wpisz CSS w pole pod **Własny CSS**. Mitra stosuje go w trakcie pisania, zapisuje chwilę po tym, jak przestaniesz, a on podąża za twoim kontem na każde urządzenie i do każdej przeglądarki, w której się logujesz.

Przełącznik obok **Własny CSS** wyłącza arkusz stylów bez jego utraty, a [paleta poleceń](shortcuts.md) oferuje **Własny CSS: wyłącz** i **Własny CSS: włącz**.

`@import` jest usuwany przy zapisie arkusza stylów: wklej cały arkusz zamiast linku do niego.

## Arkusz stylów serwera

Tam gdzie ludzie się logują, administrator może zmienić wygląd aplikacji Mitra dla wszystkich na serwerze: otwórz **Ustawienia → Administracja** i wpisz CSS w pole pod **Własny CSS dla wszystkich**. Ty widzisz zmiany w trakcie pisania, a wszyscy inni przy następnym wczytaniu aplikacji Mitra. Jego przełącznik wyłącza go dla wszystkich bez utraty. Pierwsza osoba, która zaloguje się na serwer, jest jego administratorem. Bez logowania twój własny arkusz stylów i tak dociera do wszystkich, którzy używają aplikacji Mitra, więc jest jedyny.

Pasuje do tego, co czyni serwer twoim, na przykład jego kolorów, czcionki albo [nazwy](configuration.md#name-your-instance), którą już nosi. Własny arkusz każdej osoby jest stosowany po nim, więc wygrywa jej arkusz tam, gdzie oba ustawiają to samo.

## Twoja reguła wygrywa

Własne reguły aplikacji Mitra leżą w warstwie kaskady o nazwie `mitra`, a twoje nie, więc twoja reguła wygrywa z regułą aplikacji Mitra bez względu na selektor. Nie potrzebujesz `!important`. Nieliczne deklaracje `!important` samej aplikacji Mitra zostają na górze, bo warstwy szeregują je odwrotnie: trzymają układ w całości.

Aby usunąć coś, co ustawia Mitra, zamiast to zamalowywać, ustaw właściwość na `revert`. To usuwa powierzchnię dni w widoku miesiąca:

```css
mitra-weeks mitra-day {
	background: revert;
}
```

## Przykłady

### Ukryj dni spoza miesiąca

```css
mitra-weeks [data-outside] {
	visibility: hidden;
}
```

W [widoku miesiąca](views/month.md) ukrywa to dni przed pokazanym miesiącem i po nim, ich daty i ich tło. Wpisy na nich zostają. `visibility` trzyma siatkę na miejscu, a `display: none` by ją rozerwało. Powiększ widok, aby dać dniom samego miesiąca więcej miejsca.

### Ramka wokół dzisiejszego dnia

```css
mitra-weeks mitra-day[today] {
	outline: 2px solid var(--color-accent);
	outline-offset: -2px;
}
```

`outline` zamiast `border`: ramka powiększyłaby dzień i przesunęła siatkę.

### Twoje własne kolory

```css
:root {
	--color-accent: light-dark(#2e7d32, #81c784);
	--border-radius: 8px;
}
```

`light-dark()` przyjmuje kolor dla jasnego motywu, a potem kolor dla ciemnego. Wszystko, co Mitra koloruje tymi zmiennymi, idzie za nimi, łącznie z paskiem tytułu [zainstalowanej aplikacji](install-app.md):

| Zmienna | Co koloruje |
| --- | --- |
| `--color-accent` | Dzisiejszy dzień, zaznaczenie, obwódki fokusu i główne przyciski |
| `--color-background-seed` | Podłoże za wszystkim; okna dialogowe biorą z niego swoje |
| `--color-surface` | Dni w widokach i to, co leży na podłożu, na przykład paletę poleceń |
| `--color-text` | Tekst |
| `--color-text-muted` | Tekst drugorzędny, na przykład podpowiedzi i godziny |
| `--color-error` | Błędy i ostrzeżenia |
| `--border-radius` | Rogi przycisków, wpisów i większości kontrolek |
| `--font-family` | Krój pisma tekstu |

## Znajdź, w co celować

Narzędzia deweloperskie przeglądarki pokazują, co jest na stronie: kliknij coś prawym przyciskiem i wybierz **Zbadaj**. Własne elementy aplikacji Mitra nazywają się `mitra-…`, na przykład widoki `mitra-days` (tydzień), `mitra-weeks` (miesiąc), `mitra-months` (rok), `mitra-timeline` i `mitra-table`, dzień `mitra-day`, wpis `mitra-entry-segment` i pasek boczny `mitra-sidebar`. Atrybuty podają fakty, na przykład `today`, `data-outside` i `data-date`.

Przyciski, pola, przełączniki, menu i inne kontrolki trzymają swoje wnętrze dla siebie. Docieraj do nich przez ich części, na przykład `mitra-switch::part(switch)`, i przez zmienne `--mitra-…`, które odczytują. Jeśli musisz sięgnąć dalej, poproś o część w [zgłoszeniu](https://github.com/a11delavar/mitra/issues).

## Czego nie ruszać

Kilka rzeczy trzyma aplikację Mitra w całości, a ich zmiana ją psuje:

- `display` lub `position` na `mitra-day` albo na `.entries` w widoku: leżą na siatce wspólnej dla całego widoku, a bez niej widok tygodnia staje się bardzo wolny.
- Zmienne zaczynające się od `--_`: zmieniają się w każdej klatce powiększania, a ich ustawianie z nim walczy.
- Rozmiar wpisu: jego nagłówek wybiera układ według jego szerokości, więc rozmiar narzucony z zewnątrz może go przełączyć.
- `all: unset` znosi też ukrywanie, więc dopisz obok `[hidden] { display: none }`.

## Gdy reguła ukryje drogę powrotu

Dodaj `?css=off` do adresu, na przykład `https://mitra.example.com/?css=off`. Mitra wczyta się wtedy raz bez obu arkuszy stylów, więc możesz otworzyć **Ustawienia** i naprawić swój. Administrator naprawia arkusz dla wszystkich w ten sam sposób.

## Zanim wkleisz

Arkusz stylów nie uruchamia kodu, ale może wczytywać adresy, a arkusz napisany w tym celu może wysłać im to, co jest na twoim ekranie. Wklejaj tylko CSS, który rozumiesz. Twój własny arkusz stylów dociera tylko do ciebie, a arkusz serwera do wszystkich na nim.

## Udostępnij swój

Pod polem przycisk **Udostępnij na GitHubie** otwiera nową dyskusję w kategorii [Custom CSS](https://github.com/a11delavar/mitra/discussions/categories/custom-css) z twoim arkuszem stylów już w środku. Napisz, co robi, dodaj zrzut ekranu, jeśli coś pokazuje, i opublikuj. Arkusz stylów zbyt długi na link zostaje zamiast tego skopiowany do schowka, abyś wkleił go do dyskusji. W tej kategorii znajdziesz też arkusze stylów udostępnione przez innych: przeczytaj je, zanim je wkleisz.
