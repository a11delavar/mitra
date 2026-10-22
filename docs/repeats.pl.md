---
title: Powtarzanie
description: "Ustaw powtarzanie wpisu, zmień lub usuń jedno wystąpienie albo całą serię i sprawdź, które kalendarze obsługują wpisy cykliczne."
---

Wpis cykliczny to jeden wpis z regułą powtarzania, na przykład spotkanie zespołu w każdy poniedziałek albo czynsz płatny do 1. dnia każdego miesiąca. Na tej stronie całość nazywamy serią, a każdą jej datę wystąpieniem. W widokach każde wystąpienie ma małą ikonę powtarzania.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-detail-dark.webp">
  <img src="../assets/screenshots/repeat-detail-light.webp" alt="Edytor cotygodniowego spotkania zespołu z otwartą listą Powtarzanie: Nie powtarza się, Codziennie, W dni robocze, Co tydzień we wtorek, Co 2 tygodnie, Co miesiąc 1. dnia, w 1. wtorek miesiąca, Co roku i Niestandardowe" />
</picture>

## Ustaw powtarzanie wpisu

Otwórz wpis i wybierz regułę w wierszu **Powtarzanie**. Wiersz pojawia się, gdy wpis ma już datę: początek albo, w przypadku niezaplanowanego zadania, termin.

Lista proponuje reguły zbudowane na podstawie daty rozpoczęcia serii, nawet jeśli otworzysz późniejsze wystąpienie. Dla wpisu we wtorek 13. dnia miesiąca proponuje: **Codziennie**, **W dni robocze** (od poniedziałku do piątku), **Co tydzień** we wtorek, **Co 2 tygodnie** we wtorek, **Co miesiąc** 13. dnia, **Co miesiąc** w 2. wtorek miesiąca i **Co roku** w tym samym dniu. Gdy początek wypada w ostatnich siedmiu dniach miesiąca, pojawia się też **Co miesiąc** w ostatni wtorek.

Aby wpis przestał się powtarzać, wybierz **Nie powtarza się**. Zmiana reguły zawsze dotyczy całej serii, więc Mitra nie pyta, o które wystąpienia chodzi.

### Reguły niestandardowe

Jeśli potrzebujesz czegoś innego, wybierz **Niestandardowe…**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/repeat-custom-detail-dark.webp">
  <img src="../assets/screenshots/repeat-custom-detail-light.webp" alt="Okno Powtarzanie: co 1 tydzień we wtorek, kończy się nigdy, w wybranym dniu lub po określonej liczbie wystąpień" />
</picture>

Obok **Powtarzaj co** wpisz liczbę i wybierz dni, tygodnie, miesiące lub lata. Przy regule tygodniowej pojawią się dni tygodnia: włącz każdy dzień, w który wpis ma się powtarzać. Co najmniej jeden musi pozostać włączony. Reguła miesięczna powtarza się w tym samym dniu miesiąca co początek, na przykład 13., albo w tym samym dniu tygodnia w miesiącu, na przykład w 2. wtorek. Gdy początek wypada w ostatnich siedmiu dniach miesiąca, wpis może się też powtarzać w ostatni wtorek.

W sekcji **Kończy się** wybierz **Nigdy**, **Dnia** z datą albo **Po** określonej liczbie wystąpień. Naciśnij **Gotowe**, a wiersz **Powtarzanie** pokaże regułę słowami, na przykład „Co 2 tygodnie w czw. do 18 gru”.

## Zmień lub usuń jedno wystąpienie

Gdy zmieniasz wystąpienie, Mitra pyta, o które wpisy chodzi. Pyta, gdy przeciągasz wystąpienie na inną godzinę, przeciągasz jego krawędź, usuwasz je albo zmieniasz w edytorze któreś pole, na przykład tytuł.

- **Ten wpis** zmienia tylko wybrane wystąpienie.
- **Ten i następne wpisy** zmienia to wystąpienie i wszystkie późniejsze. Seria kończy się tuż przed nim, a od niego zaczyna się nowa seria z twoją zmianą, więc wcześniejsze wystąpienia pozostają bez zmian. Pierwsze wystąpienie nie ma tej opcji, bo oznaczałaby ona całą serię.
- **Wszystkie wpisy** zmienia każde wystąpienie. Przesunięcie jednego o dzień przesuwa wszystkie, więc cotygodniowe spotkanie w poniedziałek staje się cotygodniowym spotkaniem we wtorek. Zmiana długości jednego nadaje nową długość wszystkim.

Usuwanie działa tak samo: **Ten wpis** usuwa jedną datę, **Ten i następne wpisy** kończy serię przed tym wystąpieniem, a **Wszystkie wpisy** usuwa całą serię.

Aby pominąć to pytanie i zmienić tylko to jedno wystąpienie, przytrzymaj <kbd>Ctrl</kbd> (<kbd>⌘</kbd> na Macu), gdy je upuszczasz, albo naciśnij <kbd>Ctrl</kbd> + <kbd>Delete</kbd>, gdy jest otwarte.

Przy niektórych zmianach Mitra nigdy nie pyta. Oznaczenie wystąpienia zadania jako gotowego dotyczy tylko tego wystąpienia, podobnie jak zaplanowanie jednego wystąpienia zadania, które powtarza się według terminu.

## Zmienione i usunięte wystąpienia

Wystąpienie zmienione opcją **Ten wpis** opuszcza serię i staje się osobnym wpisem. Seria pomija jego datę, więc nigdy nie wyświetla się ono dwa razy, a późniejsze zmiany całej serii do niego nie docierają.

Usunięte wystąpienie pozostaje usunięte. Nie wraca, gdy później przesuniesz lub zmienisz całą serię, a inne aplikacje korzystające z tego samego kalendarza również je pomijają.

## Przenieś serię do innego kalendarza

Wybierz inny kalendarz w edytorze wystąpienia, a to samo pytanie zdecyduje, czy przeniesione zostanie to wystąpienie, reszta serii czy cała seria, jak opisano w sekcji [Przenieś pojedynczy wpis](calendars.md#move-a-single-entry).

## Zadania cykliczne

Każde wystąpienie zadania cyklicznego jest osobnym zadaniem, które oznaczasz jako gotowe. Zadanie może też powtarzać się wyłącznie według terminu, jak zapłata czynszu do 1. dnia każdego miesiąca: zobacz [cykliczne terminy](planning.md#repeating-due-dates). Zadania cykliczne nigdy nie są zaległe i nie można cofnąć ich zaplanowania, bo to ich daty tworzą serię.

## Jak wyświetlają się wpisy cykliczne

To, co powtarza się często, na przykład codzienny trening, w widokach miesiąca i roku wyświetla się jako [rutyna](routines.md): rząd małych znaczników zamiast osobnego paska na każdy dzień. [Oś czasu](views/timeline.md) pokazuje tylko te wystąpienia zadania cyklicznego, których termin właśnie przypada, więc codzienne zadanie jej nie zapełnia.

## Które kalendarze obsługują powtarzanie

[Kalendarze przechowywane w aplikacji Mitra](integrations/mitra.md) i [serwery kalendarzy](integrations/caldav.md), w tym Google i Apple, obsługują wpisy cykliczne. Kalendarze [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) i [Tempo](integrations/tempo.md) ich nie obsługują, więc ich edytor nie ma wiersza **Powtarzanie**, a edytor serii nie proponuje ich jako kalendarza. Zadanie cykliczne z Todoist pojawia się pod swoją najbliższą datą: gdy je ukończysz, przesuwa się na kolejną, tak jak w Todoist, a jego regułę zmienia się tylko w Todoist.

Gdy [przenosisz wszystkie wpisy kalendarza](calendars.md#move-or-copy-every-entry-to-another-calendar) do takiego, który nie obsługuje powtarzania, Mitra pyta, co zrobić z wpisami cyklicznymi. **Zostaw je tutaj** zostawia je tam, gdzie są. **Rozbij na pojedyncze wpisy** zapisuje każde wystąpienie z nadchodzącego roku jako osobny wpis, który już się nie powtarza.

[Dostępność](availability.md) również jest wpisem cyklicznym i na początku powtarza się co tydzień. Z tego samego powodu nie może istnieć w kalendarzach Notion, Todoist ani Tempo.
