---
title: Todoist
description: Przenieś swoje projekty z Todoist do aplikacji Mitra jako kalendarze zadań synchronizowane w obie strony.
---

Mitra korzysta z Todoist jako źródła zadań. Każdy twój projekt w Todoist staje się w aplikacji Mitra kalendarzem z jego zadaniami. Tytuł, opis, daty i ukończenie zadania synchronizują się w obie strony.

Łączysz się z poziomu aplikacji za pomocą swojego tokenu API. Na serwerze nie trzeba niczego konfigurować.

## Połącz konto

1. W Todoist otwórz **Ustawienia** → **Integracje** → **Programista** i skopiuj swój token API.
2. W aplikacji Mitra wybierz **Dodaj integrację** u dołu panelu bocznego, a potem **Todoist**, i wklej token w pole **Token API Todoist**.
3. Naciśnij **Połącz**. Mitra wyświetli listę twoich projektów, każdy w kolorze z Todoist. Projekt umieszczony w innym nosi nazwy obu, na przykład „Praca · Premiera”.
4. Wybierz projekty, które chcesz, i naciśnij **Zapisz**.

Możesz połączyć więcej niż jedno konto Todoist. Zarchiwizowanych projektów nie ma na liście.

## Co jest synchronizowane

Tytuł, opis i ukończenie synchronizują się w obie strony, podobnie jak daty:

| W Todoist | W aplikacji Mitra |
| --- | --- |
| Data | Zaplanowany czas zadania: dzień albo godzina |
| Czas trwania | Czas, na jaki zadanie jest zaplanowane, albo jego [szacowany czas](../planning.md#set-an-estimate), dopóki nie ma daty |
| Deadline | Jego [termin](../planning.md#set-a-due-date) |
| Podzadanie | [Podzadanie](../subtasks.md) |

Zadanie bez daty czeka na liście **Niezaplanowane** na [karcie Planowanie](../planning.md#the-planning-tab). Zadania ukończone w ciągu ostatnich dwunastu tygodni trafiają do aplikacji Mitra przy łączeniu, a potem każde kolejne ukończenie.

Todoist przechowuje godzinę albo jako pływającą, czyli taką samą na każdym zegarze, gdziekolwiek jesteś, albo jako przypisaną do strefy czasowej. Mitra zachowuje obie takie, jakie są: pływająca godzina pozostaje [wszędzie taka sama](../time-zones.md#same-time-everywhere), a przypisana zachowuje swoją strefę.

Pole Deadline i czas trwania należą do planów Pro i Business w Todoist. Na darmowym koncie zadania z Todoist nie mają w aplikacji Mitra terminu, końca ani szacowanego czasu: zadanie z godziną jest momentem, a zadanie przypisane do dnia zajmuje tylko ten dzień. Gdy twój plan się zmienia, na przykład gdy zaczyna się lub kończy okres próbny, Mitra odczytuje wszystkie zadania od nowa. Deadline w Todoist to sam dzień, więc jeśli w aplikacji Mitra nadasz terminowi godzinę, zostanie z niego tylko dzień.

Mitra nie pokazuje priorytetu, etykiet, sekcji, komentarzy ani przypomnień zadania i zostawia je w Todoist bez zmian. Przeniesienie zadania do innego kalendarza Todoist przenosi je do tamtego projektu, a wszystkie te dane zostają zachowane.

Aby otworzyć zadanie w Todoist, wybierz **Otwórz w aplikacji Todoist** w menu **⋯** edytora. Usunięcie zadania w aplikacji Mitra usuwa je też w Todoist.

Todoist ogranicza, jak często aplikacje mogą się z nim komunikować, dlatego Mitra synchronizuje go mniej więcej raz na minutę (zobacz, [jak działa synchronizacja](README.md#how-syncing-works)).

## Zadania cykliczne

Zadanie, które powtarza się w Todoist, pojawia się pod swoją najbliższą datą, tak jak przechowuje je Todoist, bez reguły powtarzania. Gdy ukończysz je w aplikacji Mitra, zostaje ukończone w Todoist, a Todoist jak zawsze przesuwa je na kolejną datę. Przeniesienie go na inny dzień zmienia tylko jego najbliższą datę, a reguła pozostaje bez zmian. Aby zmienić samą regułę, edytuj zadanie w Todoist.

## Co zostaje w aplikacji Mitra

Todoist nie obsługuje zależności, więc [zależności](../dependencies.md) między zadaniami z Todoist są przechowywane tylko w aplikacji Mitra. Przepadają, gdy odłączysz konto albo [ponownie zaimportujesz kalendarz](../calendars.md#re-import-a-calendar). Zadanie nadrzędne podzadania zapisuje się w obu miejscach, o ile jest zadaniem z tego samego konta Todoist. Todoist przenosi wtedy podzadanie do projektu jego zadania nadrzędnego.

## Czego Todoist nie przechowuje

- Zawiera tylko zadania, więc nie ma w nim wydarzeń ani [dostępności](../availability.md).
- Zadanie jest otwarte albo ukończone, więc nie ma statusów **W toku** ani **Anulowane**. Zadanie, które gdzie indziej jest w toku, po przeniesieniu do Todoist wraca do statusu **Do zrobienia**.
- Z poziomu aplikacji Mitra nie można ustawić powtarzania zadania.
- Zadanie nie ma w aplikacji Mitra przypomnień, lokalizacji, uczestników, załączników, postępu, ustawienia „zajęty lub wolny” ani widoczności.

Mitra ukrywa te pola w zadaniach z Todoist, więc nic, co tam wpiszesz, nie zniknie przy następnej synchronizacji. Jeśli chcesz przenieść do Todoist wpisy, które z nich korzystają, zajrzyj do sekcji [Przenieś lub skopiuj wszystkie wpisy do innego kalendarza](../calendars.md#move-or-copy-every-entry-to-another-calendar): Mitra najpierw pokazuje tam, co nie przetrwa przeniesienia.

## Rozwiązywanie problemów

- Jeśli Mitra informuje, że Todoist odrzucił token API, skopiuj go ponownie w Todoist: **Ustawienia** → **Integracje** → **Programista**. Jeśli token został zresetowany w Todoist, otwórz w aplikacji Mitra menu konta **⋯ → Edytuj** i wklej nowy token.
- Jeśli brakuje projektu, może być zarchiwizowany. Przywróć go z archiwum w Todoist, a potem otwórz w aplikacji Mitra menu konta **⋯ → Edytuj** i naciśnij **Odśwież**.
