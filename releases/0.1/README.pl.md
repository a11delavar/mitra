---
title: Mitra, twój własny kalendarz
---
Pierwsze wydanie aplikacji Mitra: kalendarz, który układa zadania na tej samej osi czasu co wydarzenia i synchronizuje się w obie strony z kalendarzami, które już prowadzisz.

## Dlaczego Mitra
Są dobre aplikacje kalendarza i są kalendarze, które możesz postawić na własnym serwerze. Przez długi czas nie były to te same programy.

Dopracowane aplikacje działają na cudzych serwerach i czytają wszystko, co w nich zapiszesz. Te, które możesz uruchomić w domu, to przeważnie same serwery: wiernie przechowują twoje kalendarze, a oglądać je musisz w jakiejkolwiek aplikacji, którą uda ci się znaleźć. Projekt Mitra zaczął się od chęci, by mieć jedno i drugie naraz: kalendarz, w którym przyjemnie spędza się cały dzień, działający na twoim własnym sprzęcie i niezależny od nikogo innego.

Nie musisz się nigdzie przenosić. Mitra to warstwa nad kalendarzami, które już prowadzisz, a nie kolejne miejsce, w którym trzeba je trzymać. Każde źródło twojego czasu to integracja, która dołącza do pozostałych: najpierw serwer CalDAV, a od tamtej pory wiele innych. Wszystkie spotykają się na jednej osi czasu, a każda zostawia swoje dane tam, gdzie są. Na tej samej osi czasu spotykają się też twoje wydarzenia i zadania, więc dopasowywanie jednych do drugich nie odbywa się już w twojej głowie.

To także zakład o internet taki, jaki jest dziś, a nie taki, jaki był dziesięć lat temu. Mitra powstała z myślą o współczesnych przeglądarkach i korzysta z tego, co potrafią one same: układów dopasowujących się do dostępnego miejsca, okienek zakotwiczonych tam, gdzie trzeba, przejść między widokami i prawdziwego modelu dat i stref czasowych. Bez warstw zgodności i ciężkiego frameworka pozostaje lekka i szybka, daje się zainstalować jako aplikacja i na telefonie czuje się równie swobodnie jak na komputerze. Ceną jest to, że wymaga aktualnej przeglądarki, i tak już zostanie.

U podstaw leży proste przekonanie: twój czas to najbardziej osobisty zapis, jaki prowadzisz. To, gdzie się znajduje, kto może go czytać i jak spokojnie się na niego patrzy, powinno zależeć od ciebie. Mitra to próba, by było to proste.

[@a11delavar](https://github.com/a11delavar)

## Widok tygodnia
Dzień to kolumna 24 godzin z linią w miejscu bieżącej godziny, a tydzień to siedem takich kolumn obok siebie. Do dzisiejszego dnia wracasz jednym przyciskiem.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="week-dark.webp">
	<img src="week-light.webp" alt="Widok tygodnia z linią bieżącej godziny">
</picture>

Dokumentacja: [Widok tygodnia](../../docs/views/week.md)

## Widok miesiąca
Miesiąc przewija się bez końca: każdy tydzień to wiersz, a każdy wpis to pasek rozciągnięty na jego dni. Między miesiącem a tygodniem przełączasz się w nagłówku.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="month-dark.webp">
	<img src="month-light.webp" alt="Widok miesiąca, w którym każdy tydzień to osobny wiersz">
</picture>

Dokumentacja: [Widok miesiąca](../../docs/views/month.md)

## Wydarzenia i zadania
Zadanie zajmuje miejsce w dniu tak samo jak wydarzenie, a gdy je wykonasz, wystarczy zaznaczyć pole obok. Przeciągnij po siatce, by utworzyć wpis, przeciągnij wpis, by go przenieść, i nadaj każdemu kalendarzowi własny kolor.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="entries-dark.webp">
	<img src="entries-light.webp" alt="Wydarzenia i zadania obok siebie w jednym dniu">
</picture>

Dokumentacja: [Wpisy](../../docs/entries.md)

## CalDAV
Połącz serwer CalDAV, wybierz, które z jego kalendarzy chcesz widzieć, a Mitra będzie je synchronizować w obie strony. Zmiany wprowadzone gdzie indziej pojawiają się na bieżąco.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="caldav-dark.webp">
	<img src="caldav-light.webp" alt="Łączenie z serwerem CalDAV">
</picture>

Dokumentacja: [CalDAV](../../docs/integrations/caldav.md)

## Notatki w Markdownie
Opis wpisu to Markdown: nagłówki, listy i linki wyglądają tak, jak powinny, a dla każdej innej aplikacji pozostają zwykłym tekstem.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="markdown-dark.webp">
	<img src="markdown-light.webp" alt="Agenda spotkania w opisie wpisu, zapisana w Markdownie">
</picture>

## Współtwórcy
- [@a11delavar](https://github.com/a11delavar)
