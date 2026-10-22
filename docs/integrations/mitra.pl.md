---
title: Kalendarze Mitra
description: Kalendarze przechowywane w samej aplikacji Mitra, na twoim serwerze, bez żadnego konta.
---

Kalendarz Mitra jest przechowywany we własnej bazie danych aplikacji Mitra, a nie u dostawcy. Nie trzeba łączyć żadnego konta ani niczego synchronizować: tworzysz kalendarz i zaczynasz dodawać wpisy. To najprostszy sposób, by zacząć korzystać z aplikacji Mitra, i dobre miejsce na wszystko, co nie pasuje do żadnego z twoich dotychczasowych kont.

Kalendarze Mitra są przechowywane na twoim serwerze, a nie na urządzeniu, więc masz je wszędzie, gdzie otworzysz aplikację Mitra. Mogą zawierać wszystko, co obsługuje Mitra: wydarzenia i zadania, powtarzanie, przypomnienia, [dostępność](../availability.md), [podzadania](../subtasks.md), [zależności](../dependencies.md), terminy i szacowany czas.

## Dodawanie kalendarzy Mitra

1. Wybierz **Dodaj integrację** na dole panelu bocznego, a następnie **Mitra**.
2. Nadaj nazwę pierwszemu kalendarzowi.
3. Naciśnij **Zapisz**.

Kalendarz jest od razu gotowy. Integrację dodajesz tylko raz: mieści dowolnie wiele kalendarzy, więc potem jej kafelek znika z okna **Dodaj integrację**.

Aby dodać kolejny kalendarz, otwórz menu **⋯** przy nagłówku Mitra w panelu bocznym i wybierz **Nowy kalendarz**. Aby usunąć kalendarz, wybierz **Usuń kalendarz** w jego menu **⋯**. Zmiana nazwy, koloru i kolejności oraz ukrywanie działają tak samo jak w każdym innym kalendarzu; zobacz [Kalendarze](../calendars.md).

> [!CAUTION]
> Usunięcie kalendarza Mitra trwale usuwa wszystkie jego wpisy, bo nie ma dostawcy, od którego można by je pobrać ponownie. Mitra najpierw prosi o potwierdzenie i proponuje [przeniesienie wpisów](../calendars.md#move-or-copy-every-entry-to-another-calendar) do innego kalendarza, zanim cokolwiek usunie.

## Przenoszenie wpisów

Wpisy można przenosić między kalendarzem Mitra a dowolnym innym kalendarzem. Aby przenieść jeden wpis, wybierz inny kalendarz w jego edytorze. Aby przenieść cały kalendarz, użyj polecenia **⋯ → Przenieś wpisy do…**, które najpierw pokazuje, czego kalendarz docelowy nie może przechować.

Działa to też w drugą stronę: możesz zacząć w aplikacji Mitra, a później przenieść wszystko do kalendarza CalDAV lub Google.

## Kopie zapasowe

Połączone konto przechowuje własną kopię twoich wpisów. Kalendarz Mitra nie: jego wpisy istnieją tylko w bazie danych aplikacji Mitra. Upewnij się, że folder danych aplikacji Mitra jest objęty twoimi [kopiami zapasowymi](../backups.md).

Jeśli planujesz później włączyć [logowanie](../sso.md), pamiętaj, że każdy zaczyna wtedy z nowym, pustym kontem. Kalendarze Mitra utworzone wcześniej zostają na dotychczasowym koncie jedynego użytkownika.

## Czego nie potrafią

- Uczestnicy są zapisywani jako informacja o tym, kto bierze udział, ale nikt nie dostaje zaproszenia i nie przychodzą żadne odpowiedzi, bo nie ma serwera kalendarza, który mógłby je wysłać. Jeśli przeniesiesz tu spotkanie z kalendarza CalDAV, oryginał zostanie tam usunięty, a niektóre serwery powiadomią wtedy uczestników, że spotkanie odwołano. Jeśli nie powinni się o tym dowiedzieć, skopiuj spotkanie zamiast je przenosić.
- Inne aplikacje ich nie widzą. Mitra nie udostępnia swoich kalendarzy przez CalDAV, więc kalendarze, które chcesz mieć też w aplikacji kalendarza na telefonie, trzymaj na serwerze [CalDAV](caldav.md).
- Nie ma czego importować ponownie, więc polecenie **Importuj wpisy ponownie** jest niedostępne.
