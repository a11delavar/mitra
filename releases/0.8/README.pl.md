---
title: Śledzenie rutyn, Todoist, status wydarzeń i terminy na pierwszy rzut oka
---
Mitra 0.8 pomaga ci wytrwać w tym, co robisz regularnie, i zapisuje, co się nie odbyło.

## Śledzenie rutyn
Mitra już wcześniej zbierała w rutyny to, co robisz często, na przykład siłownię albo strzyżenie co pięć tygodni. Teraz rutyny mają własne miejsce, w którym na pierwszy rzut oka widzisz ostatnie dni każdej z nich: ile razy się udało, a które wystąpienia zostały anulowane lub pominięte. Możesz zmienić nazwę rutyny, połączyć dwie, które do siebie należą, albo zaznaczyć, że coś wcale nie jest rutyną. W widokach miesiąca i roku rutyny wyglądają tak samo bez względu na to, jak daleko przewiniesz, a twój konektor AI potrafi podsumować, jak ci idą.

## Wszędzie ta sama godzina
Niektóre rzeczy nie zależą od strefy czasowej: lek o 7:30 bierzesz o 7:30, w domu i w podróży. Wybierz **Wszędzie ta sama godzina** na początku listy stref czasowych wpisu, a wpis pozostanie o tej godzinie, gdziekolwiek jesteś. Oznacza go przekreślony globus. To ustawienie mają też wpisy, które trafiają z innych aplikacji bez strefy czasowej. Zanim przeniesiesz taki wpis do kalendarza, który nie obsługuje takich godzin, na przykład do Kalendarza Google, Mitra uprzedzi cię, że otrzyma on stałą strefę czasową.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="same-time-dark.webp">
	<img src="same-time-light.webp" alt="Edytor wpisu z porannym lekiem, z listą stref czasowych otwartą na opcji Wszędzie ta sama godzina">
</picture>

Dokumentacja: [Wszędzie ta sama godzina](../../docs/time-zones.md#same-time-everywhere)

## Status wydarzenia
Wydarzenie ma teraz własny status, tak jak zadanie: **Potwierdzone**, **Być może** lub **Anulowane**. Anulowane wydarzenie zachowuje swoje miejsce, przekreślone, więc zostaje ślad tego, co się nie odbyło, a twoje rutyny je liczą. Wydarzenie oznaczone jako być może jest przygaszone, dopóki nie zdecydujesz. Status synchronizuje się z innymi aplikacjami CalDAV, a tabela pokazuje go obok statusu zadań. **Ukryj gotowe zadania** ukrywa teraz tylko gotowe zadania, a nowe **Ukryj anulowane** ukrywa anulowane zadania i wydarzenia.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="event-status-dark.webp">
	<img src="event-status-light.webp" alt="Edytor wydarzenia z otwartym menu statusu: Potwierdzone, Być może i Anulowane">
</picture>

Dokumentacja: [Status wydarzenia](../../docs/entries.md#event-status)

## Terminy na pierwszy rzut oka
Zaplanowane zadanie pokazuje teraz termin wprost na swojej fladze, jako godzinę, dzień tygodnia albo datę, zależnie od tego, jak blisko jest. Wskaż zadanie w widoku tygodnia lub miesiąca albo na osi czasu, a rozciągnie się do swojego terminu, więc od razu widać, ile zostało zapasu. Jeśli zaplanujesz zadanie tak, że skończy się po terminie, flaga zrobi się czerwona. A tabela ma nową kolumnę z terminami.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="due-stretch-dark.webp">
	<img src="due-stretch-light.webp" alt="Wskazanie wtorkowego zadania rozciąga je do terminu, gdy w środę zaczyna się spotkanie planistyczne">
</picture>

Dokumentacja: [Ustawianie terminu](../../docs/planning.md#set-a-due-date)

## Personalizacja
Nadaj każdemu kalendarzowi jeden z dwóch nowych kolorów albo dowolny własny. Zmień nazwę nagłówka konta dwukrotnym kliknięciem i ukryj wszystkie jego kalendarze naraz. Do całej reszty zmień wygląd aplikacji Mitra za pomocą własnych stylów CSS: dla siebie w Ustawieniach albo dla wszystkich na twoim serwerze za pomocą pliku w jego folderze danych. Osoba, która zarządza serwerem, ma w Ustawieniach osobną sekcję.

## Duplikowanie na inne dni
Niektóre rzeczy wypadają w dni, których żadne powtarzanie nie opisze. Skierowanie na osiem zabiegów fizjoterapii rozkłada się na wolne terminy gabinetu, a klient rezerwuje cię na 3., 9. i 17. Dodaj pierwszy, wybierz **Duplikuj na inne dni** w jego menu ⋯ i zaznacz pozostałe w dwóch pokazanych miesiącach. Przytrzymaj Shift, aby wybrać od razu kilka dni z rzędu. Każdy dzień dostaje kopię o tej samej godzinie, osobny wpis, który możesz przesunąć lub zmienić jak każdy inny.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="duplicate-days-dark.webp">
	<img src="duplicate-days-light.webp" alt="Okno Duplikuj na inne dni dla wizyty u fizjoterapeuty, z siedmioma kolejnymi wizytami wybranymi w październiku i listopadzie">
</picture>

Dokumentacja: [Duplikowanie na inne dni](../../docs/entries.md#the--menu)

## Todoist
Połącz swoje projekty w Todoist, a ich zadania znajdą się na tej samej osi czasu co twoje wydarzenia i będą synchronizowane w obie strony. Każdy projekt staje się kalendarzem w swoim kolorze z Todoist. Data, czas trwania i deadline zadania stają się jego zaplanowanym czasem, długością i terminem. Zadanie cykliczne z Todoist pojawia się pod swoją najbliższą datą, a gdy ukończysz je w aplikacji Mitra, przesuwa się na kolejną, tak jak w Todoist. Priorytety, etykiety i sekcje pozostają bez zmian.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="todoist-dark.webp">
	<img src="todoist-light.webp" alt="Okno Dodaj integrację z kursorem na Todoist wśród innych dostawców">
</picture>

Dokumentacja: [Todoist](../../docs/integrations/todoist.md)

## Więcej języków
Mitra uczy się arabskiego, rosyjskiego, polskiego i niderlandzkiego. Każde kolejne wydanie poprawiało działanie aplikacji Mitra w innych językach, systemach pisma i kalendarzach. Każdy nowy język jest przetłumaczony w całości, łącznie z dokumentacją i stroną internetową.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="arabic-week-dark.webp">
	<img src="arabic-week-light.webp" alt="Widok tygodnia po arabsku, ułożony od prawej do lewej, z wydarzeniem otwartym w edytorze">
</picture>

## Współtwórcy
- [@jkngale](https://github.com/jkngale): podstawy integracji z Todoist
