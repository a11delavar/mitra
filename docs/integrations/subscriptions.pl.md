---
title: Subskrypcje kalendarzy
description: "Subskrybuj opublikowany link do kalendarza, na przykład adres webcal:// lub kanał .ics, i oglądaj jego wpisy w aplikacji Mitra, w trybie tylko do odczytu."
---

Wiele kalendarzy jest publikowanych, a nie udostępnianych: święta państwowe, terminarze rozgrywek sportowych, kalendarz roku szkolnego, kanał z narzędzia używanego w pracy albo prywatny adres twojego własnego kalendarza Google lub Outlook. Do takich kalendarzy się nie logujesz, tylko subskrybujesz je za pomocą linku.

**Subskrypcja kalendarza** przenosi jeden taki link do aplikacji Mitra jako osobny kalendarz, z wydarzeniami i ewentualnymi zadaniami.

Subskrypcje są tylko do odczytu. Kanał znajduje się na innym serwerze, który nie przyjmuje zmian, więc Mitra pokazuje to, co on publikuje, i nigdy niczego do niego nie zapisuje. Nadal możesz zmienić nazwę, kolor i kolejność kalendarza albo go ukryć; zobacz [Kalendarze tylko do odczytu](../calendars.md#read-only-calendars). Aby mieć kopię jego wpisów, którą możesz edytować, użyj polecenia **Skopiuj wpisy do…** w jego menu **⋯**.

## Subskrybuj kalendarz

1. Wybierz **Dodaj integrację** u dołu panelu bocznego, a potem **Subskrypcja kalendarza**.
2. Wklej link w pole **Adres URL kalendarza**. Jest to albo adres `webcal://`, jaki często dają przyciski „Subskrybuj”, albo adres `https://`, zwykle zakończony na `.ics`.
3. Zostaw puste pola **Nazwa użytkownika (opcjonalnie)** i **Hasło (opcjonalnie)**, chyba że kanał ich wymaga (zobacz [kanały chronione hasłem](#feeds-with-a-password)).
4. Naciśnij **Połącz**. Mitra odczyta kanał i wyświetli jego kalendarz.
5. Pozostaw go włączony i naciśnij **Zapisz**.

Jeden link to jeden kalendarz. Aby subskrybować kilka, dodaj osobną subskrypcję dla każdego z nich.

Kalendarz przejmuje z kanału nazwę, a także kolor, jeśli kanał go określa. Możesz zmienić jego nazwę w panelu bocznym, a twoja nazwa pozostanie, dopóki sam kanał nie zmieni nazwy kalendarza.

Jeśli [ustawisz aplikację Mitra jako domyślną aplikację kalendarza](../calendar-files.md), kliknięcie linku `webcal://` na stronie internetowej otworzy ten formularz z już wpisanym linkiem.

### Gdzie znaleźć link do kalendarza

| Usługa | Gdzie szukać |
| --- | --- |
| Kalendarz Google | W ustawieniach kalendarza: **Integrate calendar** → **Secret address in iCal format** |
| Outlook i Microsoft 365 | **Share** → **Publish a calendar**, a potem skopiuj link ICS |
| iCloud | Kliknij kalendarz prawym przyciskiem myszy → **Share Calendar** → **Public Calendar** |
| Nextcloud | Menu **⋯** kalendarza → **Copy subscription link** |
| Kalendarze publiczne | Większość stron ze świętami, wydarzeniami sportowymi i kalendarzami szkolnymi udostępnia link `.ics` |

> [!CAUTION]
> Adres tajny to hasło w postaci linku: każdy, kto go zna, może czytać kalendarz. Zachowaj go dla siebie, a jeśli kiedykolwiek wycieknie, zresetuj go w ustawieniach swojej usługi.

### Kanały chronione hasłem

Większość opublikowanych kanałów ma klucz dostępu w samym linku i nie potrzebuje niczego więcej. Jeśli kanał, na przykład na serwerze firmowym lub prywatnym, wymaga nazwy użytkownika i hasła (uwierzytelnianie HTTP Basic), wpisz je podczas subskrybowania. Mitra przechowuje hasło na serwerze i nigdy nie odsyła go do przeglądarki.

## Jak kalendarz pozostaje aktualny

Mitra synchronizuje każdą subskrypcję co 15 minut, niezależnie od tego, czy ktoś ma aplikację otwartą, więc otwarcie aplikacji Mitra nie przyspiesza pobrania kanału (zobacz, [jak działa synchronizacja](README.md#how-syncing-works)). Synchronizacja niewiele kosztuje: Mitra pyta serwer kanału, czy coś się zmieniło, i pobiera kalendarz tylko wtedy, gdy odpowiedź brzmi „tak”.

Kalendarz jest lustrzanym odbiciem kanału. Wpisy dodane do kanału pojawiają się w aplikacji Mitra, a wpisy z niego usunięte znikają.

Jeśli kalendarz zacznie kiedyś wyglądać nieprawidłowo, polecenie **Importuj wpisy ponownie** w jego menu **⋯** odczyta kanał ponownie od początku. Sam kanał pozostaje nietknięty. Zobacz [Zaimportuj kalendarz ponownie](../calendars.md#re-import-a-calendar).

## Rozwiązywanie problemów

- Jeśli Mitra wyświetla komunikat „The calendar requires a username and password”, kanał jest chroniony. Wpisz wymaganą nazwę użytkownika i hasło.
- Jeśli Mitra wyświetla komunikat „No calendar was found at that address”, sprawdź, czy w linku nie ma literówek. Adres tajny przestaje też działać, gdy właściciel go zresetuje.
- Jeśli Mitra wyświetla komunikat „The address did not return a calendar”, link prowadzi do strony internetowej, a nie do kanału. Poszukaj linku z napisem iCal, ICS lub „Subskrybuj”.
- Jeśli Mitra wyświetla komunikat „The calendar is too large to subscribe to”, kanał jest większy niż 20 MB, a Mitra nie odczytuje tak dużych kanałów.
