---
title: CalDAV
description: Połącz dowolny serwer CalDAV, na przykład Nextcloud, Radicale, Fastmail lub mailbox.org, i synchronizuj jego wydarzenia i zadania w obie strony.
---

CalDAV to otwarty standard, którym posługuje się większość serwerów kalendarzy. Konto CalDAV łączysz z poziomu aplikacji, bez żadnej konfiguracji na serwerze, a Mitra synchronizuje jego wydarzenia i zadania w obie strony.

Twoje kalendarze zostają na twoim serwerze, więc każda inna aplikacja CalDAV, z której korzystasz, na przykład kalendarz w telefonie, widzi te same wpisy. Tym różnią się od [kalendarzy Mitra](mitra.md), które może otworzyć tylko aplikacja Mitra.

## Połącz konto

1. Wybierz **Dodaj integrację** na dole panelu bocznego, a potem **CalDAV**.
2. Wypełnij formularz:
   - **Adres URL serwera** to adres CalDAV twojego serwera, na przykład `https://caldav.example.com`. Adresy popularnych dostawców znajdziesz w [tabeli poniżej](#server-urls-for-common-providers).
   - **Nazwa użytkownika** to zwykle nazwa twojego konta albo adres e-mail.
   - **Hasło** to hasło do twojego konta albo hasło do aplikacji, jeśli twój dostawca je udostępnia.
3. Naciśnij **Połącz**. Mitra wyświetli kalendarze konta, wszystkie włączone, z informacją, co zawiera każdy z nich, na przykład „Wydarzenia · Zadania”.
4. Wyłącz te, których nie chcesz, i naciśnij **Zapisz**.

Mitra importuje pozostawione kalendarze, a potem, dopóki aplikacja jest otwarta, synchronizuje je co 10 sekund (zobacz, [jak działa synchronizacja](README.md#how-syncing-works)).

Aby później zmienić hasło, otwórz menu **⋯** konta w panelu bocznym, wybierz **Edytuj**, wpisz nowe hasło i naciśnij **Zapisz**. Adres URL serwera i nazwa użytkownika pozostają bez zmian. Inne konto połącz osobno.

## Adresy URL serwerów popularnych dostawców

Podaj adres CalDAV dostawcy, a Mitra sama znajdzie pod nim kalendarze.

Jeśli adres wskazuje konkretnego użytkownika, na przykład `https://<your-radicale>/<user>/`, Mitra pokaże kalendarze tego użytkownika zamiast twoich, o ile serwer ci je udostępnia. Każdy taki adres połącz osobno.

| Dostawca | Adres URL serwera |
| --- | --- |
| Nextcloud | `https://<your-nextcloud>/remote.php/dav` |
| Radicale | `https://<your-radicale>/` (lub `.../<user>/`) |
| Fastmail | `https://caldav.fastmail.com/` |
| mailbox.org | `https://dav.mailbox.org/` |
| Baïkal | `https://<your-baikal>/dav.php` |

Kalendarz Google i iCloud również obsługują CalDAV, ale nie przyjmują zwykłego hasła: Google loguje cię na własnej stronie, a Apple wymaga hasła do aplikacji. Użyj zamiast tego ich własnych kafelków, jak opisano na stronach [Kalendarz Google](google.md) i [Kalendarz Apple](apple.md).

## Co jest synchronizowane

Każdy kalendarz na serwerze to jeden kalendarz w aplikacji Mitra. Zawiera wydarzenia, zadania albo jedno i drugie, w zależności od tego, na co pozwala serwer. Większość serwerów pozwala na oba rodzaje; w kalendarzu, który przyjmuje tylko jeden rodzaj, nowe wpisy zawsze są tego rodzaju.

Synchronizuje się wszystko, co Mitra przechowuje o wpisie, o ile twój serwer to zachowuje:

- Wpisy całodniowe i wielodniowe, lokalizacje, opisy, kolory i przypomnienia.
- To, czy wpis jest wyświetlany jako zajęty czy wolny, oraz jego widoczność.
- Status i postęp zadania.
- [Uczestnicy](../participants.md). Zaproszenia wysyła i odpowiedzi zbiera twój serwer.
- [Podzadania](../subtasks.md) i [zależności](../dependencies.md).
- [Załączniki](../attachments.md). Inne aplikacje korzystające z tego samego kalendarza widzą te pliki, a Mitra pokazuje pliki, które one dodały.

Wpis cykliczny pozostaje na serwerze jedną serią. Gdy zmieniasz pojedyncze wystąpienie, Mitra pyta, czy chodzi ci o **Ten wpis**, **Ten i następne wpisy** czy **Wszystkie wpisy**, i odpowiednio zmienia serię.

Zadanie zachowuje swój zaplanowany czas, [termin i szacowany czas](../planning.md#schedule-constraints-and-planning). Na serwerze zapisują się tak:

- Początek jako `DTSTART`.
- Długość jako `ESTIMATED-DURATION`: czas, na jaki zadanie jest zaplanowane, albo jego szacowany czas, dopóki nie ma początku.
- Termin jako `DUE`.

Zadanie z początkiem, ale bez długości, jest momentem.

Kalendarze udostępnione ci tylko do wglądu są oznaczone jako tylko do odczytu. Nadal możesz zmieniać ich nazwę, kolor i kolejność oraz je ukrywać; zobacz [Kalendarze tylko do odczytu](../calendars.md#read-only-calendars).

## Dostępność oznaczona jako zajęta

[Dostępność](../availability.md) oznaczona jako **Zajęty** trafia do swojego kalendarza jako zajęte wydarzenia, więc w telefonie i dla każdego, kto cię zaprasza, ten czas jest widoczny jako zajęty. Nie trzeba niczego konfigurować.

- Każda zajęta dostępność staje się wydarzeniem cyklicznym z tymi samymi godzinami i regułą powtarzania, oznaczonym jako zajęte. Wydarzenie dostaje nazwę dostępności albo, jeśli jej nie ma, nazwę „Zajęty”, a także jej miejsce i widoczność, na przykład **Prywatne**.
- W aplikacji Mitra zamiast tych wydarzeń widzisz samą dostępność, więc ten czas nie wyświetla się dwa razy.
- Mitra dba o to, by wydarzenia odpowiadały twojej dostępności. Jeśli któreś z nich zostanie zmienione, przesunięte lub usunięte w innej aplikacji, Mitra przywróci je przy następnej synchronizacji.
- Ponowne oznaczenie dostępności jako **Wolny**, jej usunięcie, wyłączenie jej kalendarza albo usunięcie konta usuwa te wydarzenia. Przeniesienie dostępności do innego kalendarza przenosi razem z nią jej wydarzenia.
- Kalendarz, który zawiera tylko zadania, albo taki, w którym nie możesz zapisywać, nie dostaje żadnych wydarzeń.

> [!NOTE]
> Zmiany pojedynczego dnia zajętej dostępności nie są przenoszone. Wydarzenie nadal trzyma się reguły powtarzania, więc dzień, który przesunięto lub skrócono, pokazuje innym zwykłe godziny.

Tak samo działa to w przypadku [Kalendarza Google](google.md) i [Kalendarza Apple](apple.md), z którymi Mitra również łączy się przez CalDAV.

## Rozwiązywanie problemów

- Jeśli brakuje kalendarza, jest on wyłączony. Dotyczy to kalendarzy, które wyłączono przy łączeniu konta, a także kalendarzy utworzonych później na serwerze, które Mitra dodaje jako wyłączone. Włącz go w menu konta **⋯ → Edytuj** i naciśnij **Zapisz**. Przycisk **Odśwież** w tym samym miejscu wyświetla kalendarze utworzone na serwerze od ostatniej synchronizacji.
- Jeśli Mitra wyświetla komunikat „This account is already connected”, to konto jest już w twoim panelu bocznym. Zmień je w jego menu **⋯ → Edytuj**, na przykład aby wpisać nowe hasło.
- Jeśli połączenie się nie udaje, sprawdź, czy adres URL serwera zaczyna się od `https://` i wskazuje adres CalDAV, a nie stronę, na której się logujesz. Aby zobaczyć każde żądanie, które Mitra wysyła do serwera, ustaw [poziom logowania](../logging.md) na `debug`.
- Jeśli po aktualizacji aplikacji Mitra kalendarz wygląda nieprawidłowo, użyj polecenia **Importuj wpisy ponownie** w jego menu **⋯**. Synchronizacja pobiera tylko to, co zmieniło się na serwerze, więc niezmienione wpisy nigdy nie są odczytywane ponownie; ponowny import odczytuje je wszystkie. Zobacz [Zaimportuj kalendarz ponownie](../calendars.md#re-import-a-calendar).
