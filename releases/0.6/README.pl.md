---
title: Kalendarze w aplikacji Mitra, widok tabeli, terminy
---
To wydanie daje aplikacji Mitra własne kalendarze, pokazuje wpisy w formie tabeli i daje zadaniom ograniczenia, których im brakowało: termin, szacowany czas i godziny, które zostawiasz wolne. Mitra mówi też po persku, razem z kalendarzem perskim.

## Kalendarze Mitra
Kalendarz może istnieć w samej aplikacji Mitra, bez żadnego konta i bez logowania gdziekolwiek. Zainstaluj aplikację Mitra, dodaj kalendarz i zacznij planować. Kalendarz pojawia się na każdym urządzeniu, którego używasz, a jego wpisy możesz przenieść na połączone konto, kiedy tylko takie dodasz.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="calendars-detail-dark.webp">
	<img src="calendars-detail-light.webp" alt="Kalendarze w panelu bocznym">
</picture>

Dokumentacja: [Kalendarze Mitra](../../docs/integrations/mitra.md)

## Widok tabeli
Każdy wpis jako wiersz. Wybierz zakres dni, od ostatniego miesiąca po wszystko, co masz, przeszukuj tytuły, miejsca i opisy, sortuj po kilku kolumnach naraz i filtruj według statusu, kalendarza, typu albo powtarzania. Zaznacz wiersze, by zmienić wiele wpisów naraz. Tytuł wygląda tak samo jak wpis w kalendarzu, więc wpis otwiera się od razu w tabeli.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="table-detail-dark.webp">
	<img src="table-detail-light.webp" alt="Widok tabeli z kolumnami na czas, kalendarz, status i uczestników">
</picture>

Dokumentacja: [Widok tabeli](../../docs/views/table.md)

## Terminy i szacowany czas
Zadanie może mieć termin i szacowany czas, zanim dostanie konkretną godzinę. Zadania niezaplanowane ustawiają się w zakładce „Planowanie” według najbliższego terminu, a gdy przeciągniesz jedno z nich na tydzień, szacowany czas staje się jego długością. Zadania, których dzień już minął, zbierają się nad nimi w sekcji „Zaległe”.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="plan-task-dark.webp">
	<img src="plan-task-light.webp" alt="Zadanie przeciągnięte z zakładki „Planowanie” na tydzień, gdzie szacowany czas staje się jego długością">
</picture>

Dokumentacja: [Planowanie](../../docs/planning.md)

## Listy kontrolne w opisach
Opis zadania może zawierać listę kontrolną zapisaną w Markdownie, a jej pola naprawdę działają: zaznacz jedno w edytorze, a Mitra zapisze to w tekście, więc zobaczy to też każda inna aplikacja korzystająca z tego kalendarza. Pola i podzadania liczą się razem, każde jako jeden krok: zadanie z trzema polami i jednym podzadaniem ma cztery kroki. Gdy jedno pole jest zaznaczone, a podzadanie gotowe, menu statusu pokazuje „Gotowe: 2 z 4 kroków”, a pierścień przy zadaniu w kalendarzu wypełnia się do połowy.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="checklist-dark.webp">
	<img src="checklist-light.webp" alt="Lista kontrolna zadania i jego podzadanie, liczone razem w menu statusu jako 2 z 4 kroków">
</picture>

Dokumentacja: [Podzadania](../../docs/subtasks.md)

## Dostępność
Zaznacz w dowolnym kalendarzu godziny, w których pracujesz, trenujesz albo które chcesz mieć wolne. Zacieniają one widok tygodnia, dzięki czemu od razu widać, które godziny są jeszcze otwarte. Godziny oznaczone jako zajęte widzą jako zajęte osoby, z którymi dzielisz kalendarz, a wolne pozostają twoją sprawą.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="availability-detail-dark.webp">
	<img src="availability-detail-light.webp" alt="Okna dostępności zacieniające tydzień">
</picture>

Dokumentacja: [Dostępność](../../docs/availability.md)

## Linki w jednym wierszu
Wszystkie linki z opisu i lokalizacji wpisu trafiają do jednego wiersza w edytorze, a każdy jest nazwany według tego, dokąd prowadzi: strona według witryny, spotkanie według usługi, notatka według aplikacji. Lokalizacja, która jest linkiem, wyświetla się jako ten link.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="links-detail-dark.webp">
	<img src="links-detail-light.webp" alt="Wiersz z linkami we wpisie">
</picture>

Dokumentacja: [Linki](../../docs/links.md)

## Kalendarz perski
Mitra mówi po persku, a razem z językiem przychodzi jego kalendarz: perskie miesiące i tygodnie w nagłówkach i selektorach dat, a daty wpisuje się tak, jak zapisuje się je po persku. Twoje wpisy zostają tam, gdzie były. Zmienia się tylko sposób, w jaki się je odczytuje.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="persian-calendar-detail-dark.webp">
	<img src="persian-calendar-detail-light.webp" alt="Edytor wpisu po persku, z selektorem daty otwartym na perskim miesiącu">
</picture>

Dokumentacja: [Ustawienia](../../docs/settings.md)

## Współtwórcy
- [@a11delavar](https://github.com/a11delavar)
