---
title: Notion
description: Przenieś widoki swoich baz danych z zadaniami w Notion do aplikacji Mitra jako kalendarze zadań synchronizowane w obie strony.
---

Mitra korzysta z Notion jako źródła zadań. Każdy widok bazy danych z zadaniami, na przykład „All tasks”, „My tasks” albo tablica sprintu, staje się w aplikacji Mitra kalendarzem, który zawiera dokładnie te zadania, które pokazuje widok: Notion stosuje filtry widoku, a Mitra umieszcza wynik w twoim kalendarzu. Tytuł, status, daty i opis zadania synchronizują się w obie strony.

Łączysz się z poziomu aplikacji za pomocą tokenu integracji. Na serwerze nie trzeba niczego konfigurować.

## Połącz obszar roboczy

1. Utwórz integrację na stronie [notion.so/profile/integrations](https://www.notion.so/profile/integrations). Wystarczy integracja wewnętrzna.
2. Udostępnij jej swoje bazy danych z zadaniami. Otwórz każdą bazę w Notion, wybierz **•••** → **Connections** i dodaj swoją integrację.
3. W aplikacji Mitra wybierz **Dodaj integrację** u dołu panelu bocznego, a potem **Notion**, i wklej w pole **Token integracji** klucz tajny integracji, który zaczyna się od `ntn_`.
4. Naciśnij **Połącz**. Mitra wyświetli listę widoków udostępnionych baz danych, nazwanych od bazy i widoku.
5. Wybierz widoki, które chcesz, i naciśnij **Zapisz**.

Na początek Mitra włącza po jednym widoku z każdej bazy danych. Zadanie należy do każdego widoku, którego filtry spełnia, więc przy dwóch włączonych widokach tej samej bazy pojawiłoby się dwa razy. Jeśli chcesz, możesz świadomie włączyć więcej.

Mitra oferuje widoki tabeli, tablicy, listy, kalendarza, osi czasu i galerii. Innych rodzajów widoków nie ma na liście.

## Które bazy danych działają

Baza danych pojawia się na liście, jeśli ma właściwość typu Status i właściwość typu Date. Własne szablony zadań Notion mają obie.

Mitra odczytuje status zadania z grupy, do której należy jego status w Notion:

| Grupa statusów w Notion | Status w aplikacji Mitra |
| --- | --- |
| To-do | Do zrobienia |
| In progress | W toku |
| Complete | Gotowe |

Gdy zmienisz status w aplikacji Mitra, Notion otrzyma pierwszą opcję z odpowiedniej grupy.

Właściwość Date określa, gdzie Mitra umieszcza zadanie, więc to ona jest zaplanowanym czasem zadania. Jeśli baza danych ma kilka właściwości typu Date, Mitra wybiera najpierw tę, której nazwa zaczyna się od „Due”, potem tę o nazwie „Date”, „When”, „Deadline”, „Scheduled” lub „Do date”, a gdy takiej nie ma, po prostu pierwszą.

## Co jest synchronizowane

Tytuł, status i data synchronizują się w obie strony, zarówno jako daty całodniowe, jak i z godziną. Godziny są wyświetlane w twojej strefie czasowej. Zadanie bez daty czeka na liście **Niezaplanowane** na [karcie Planowanie](../planning.md#the-planning-tab).

Opis zadania to treść jego strony w Notion zapisana w formacie Markdown, łącznie z listami do zrobienia, objaśnieniami (callouts) i obrazami. Gdy edytujesz opis w aplikacji Mitra, zastępowana jest tylko ta część strony, którą pokazuje opis. Osadzone treści, podstrony i bloki synchronizowane zostają w Notion bez zmian, a Mitra ich nie pokazuje. Obraz dodany w Notion jest widoczny w aplikacji Mitra i zostaje w Notion bez zmian; po edycji w aplikacji Mitra przesuwa się nad tekst, bo Notion pozwala innym aplikacjom dopisywać tekst tylko za tym, co zachowuje.

Właściwości typu Relation, które łączą zadania z tej samej bazy danych, stają się w aplikacji Mitra powiązaniami, w obie strony. Właściwość o nazwie „Parent task” lub „Sub-tasks” tworzy [podzadania](../subtasks.md), właściwość „Blocked by” lub „Depends on” tworzy [zależności](../dependencies.md), a pozostałe relacje pojawiają się pod własną nazwą. Relacje z innymi bazami danych nie są wyświetlane.

Aby otworzyć zadanie w Notion, wybierz **Otwórz w aplikacji Notion** w menu **⋯** edytora. Usunięcie zadania w aplikacji Mitra przenosi jego stronę do kosza Notion, skąd nadal możesz ją przywrócić.

Notion ogranicza, jak często aplikacje mogą się z nim komunikować, dlatego Mitra synchronizuje go mniej więcej raz na minutę (zobacz, [jak działa synchronizacja](README.md#how-syncing-works)). Nowe zadanie nigdy nie znika na chwilę, gdy Notion nadrabia zaległości.

## Czego Notion nie przechowuje

Baza danych w Notion przechowuje zadania z jedną datą każde, a to wyznacza, co może zawierać kalendarz z Notion:

- Zawiera tylko zadania, więc nie ma w nim wydarzeń ani [dostępności](../availability.md).
- Jedyna data zadania to jego zaplanowany czas, więc nie ma terminu ani szacowanego czasu.
- Zadania nie mogą się powtarzać i nie mają przypomnień, lokalizacji ani uczestników.
- Nie ma statusu **Anulowane**, bo Notion nie ma dla niego grupy.
- Zadanie nie może mieć własnej strefy czasowej, postępu w procentach, ustawienia „zajęty lub wolny” ani widoczności.

Mitra ukrywa te pola w zadaniach z Notion, więc nic, co tam wpiszesz, nie zniknie przy następnej synchronizacji. Jeśli chcesz przenieść do Notion wpisy, które z nich korzystają, zajrzyj do sekcji [Przenieś lub skopiuj wszystkie wpisy do innego kalendarza](../calendars.md#move-or-copy-every-entry-to-another-calendar): Mitra najpierw pokazuje tam, co nie przetrwa przeniesienia.

## Widoki i filtry

Kalendarz pokazuje to, co pokazuje jego widok w Notion, a zadanie utworzone w tym kalendarzu dostaje wartości z filtrów widoku, więc trafia do tego widoku. Zadanie dodane w widoku „University” dostaje „Area = University”, tak jakby wiersz został dodany w Notion.

Mitra wypełnia filtry, które da się spełnić jedną wartością: wybór (select), status, wielokrotny wybór (multi-select), pole wyboru albo relację z konkretną stroną. Niektórych filtrów nie spełni żadna pojedyncza wartość, na przykład formuły, zakresu dat albo jednej z kilku opcji. Zadanie utworzone w takim widoku nie pasuje do jego filtrów, więc, tak jak w Notion, nie pojawia się w nim. Nadal jest jednak w bazie danych i widać je w widoku z mniejszą liczbą filtrów, na przykład „All tasks”.

> [!TIP]
> Jeśli widok filtruje według relacji z inną bazą danych, na przykład pokazuje zadania, których „Area” wskazuje na stronę „University” w bazie „Areas”, udostępnij swojej integracji również tę bazę. W przeciwnym razie Mitra nie ustawi relacji w nowych zadaniach i nie pojawią się one w widoku.

## Rozwiązywanie problemów

- Jeśli bazy danych nie ma na liście, brakuje jej właściwości typu Status lub Date albo nie jest udostępniona twojej integracji (**•••** → **Connections** w Notion). Po jej udostępnieniu otwórz w aplikacji Mitra **⋯ → Edytuj** przy koncie i naciśnij **Odśwież**.
- Jeśli zadanie pojawia się dwa razy, masz włączone dwa widoki tej samej bazy danych, które oba je zawierają. Wyłącz jeden z nich w **⋯ → Edytuj** przy koncie.
