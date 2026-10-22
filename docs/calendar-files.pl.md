---
title: Pliki kalendarza
description: "Otwieraj pliki .ics i linki webcal:// w aplikacji Mitra i ustaw ją jako aplikację, której komputer używa do ich otwierania."
---

Pliki kalendarza (`.ics`) i linki subskrypcji (`webcal://`) to sposób, w jaki internet przekazuje wydarzenia: zaproszenie dołączone do e-maila, przycisk „Dodaj do kalendarza” na stronie rezerwacji, link „Subskrybuj” do terminarza meczów drużyny. Po zainstalowaniu aplikacja Mitra potrafi otwierać jedno i drugie, a ty możesz ustawić ją jako aplikację, której komputer używa do ich otwierania.

> [!NOTE]
> Otwieranie plików i linków wymaga [zainstalowania aplikacji Mitra](install-app.md) na komputerze z przeglądarki opartej na Chromium, takiej jak Chrome, Edge, Brave czy Opera. W każdej przeglądarce możesz natomiast przeciągnąć plik `.ics` na okno aplikacji Mitra.

## Ustawienie aplikacji Mitra jako domyślnej

Najpierw zainstaluj aplikację Mitra. Gdy po raz pierwszy otworzysz w niej plik lub link kalendarza, przeglądarka może zapytać, czy aplikacja Mitra może go obsłużyć: wybierz **Zezwól**. Potem ustaw w systemie, aby pliki `.ics` otwierały się w aplikacji Mitra.

W systemie Windows kliknij plik `.ics` prawym przyciskiem myszy w Eksploratorze plików i wybierz **Otwórz za pomocą → Wybierz inną aplikację**. Wybierz **Mitra**, a następnie **Zawsze**. Możesz to też zmienić później w sekcji **Ustawienia → Aplikacje → Aplikacje domyślne**.

W systemie macOS kliknij plik `.ics` w Finderze z wciśniętym klawiszem Control i wybierz **Pokaż informacje**. W sekcji **Otwórz za pomocą** wybierz **Mitra**, a następnie kliknij **Zmień wszystkie…** i potwierdź.

W systemie Linux kliknij plik `.ics` prawym przyciskiem myszy w menedżerze plików i otwórz **Właściwości → Otwórz za pomocą**. Wybierz **Mitra** i ustaw ją jako aplikację domyślną.

Jeśli aplikacja Mitra jest już otwarta, otwierany plik lub link trafi do tego okna, zamiast otwierać drugie.

## Dodawanie pliku kalendarza

Otwórz plik `.ics` w aplikacji Mitra albo przeciągnij go na nią z pulpitu lub menedżera plików. Przeciąganie działa też w zwykłej karcie przeglądarki, bez instalowania czegokolwiek. Kilka plików otwiera się po kolei.

Mitra zapyta, do którego kalendarza dodać wpisy. Zanim cokolwiek doda, pokaże, czego ten kalendarz nie może przechować: wpisy, które zostałyby pominięte, oraz szczegóły, które niektóre wpisy by utraciły, na przykład przypomnienia w kalendarzu, który ich nie obsługuje. Aby kontynuować, naciśnij przycisk z liczbą dodawanych wpisów, na przykład **Dodaj 12 wpisów**. Aby wybrać inny kalendarz, wróć strzałką. Sam plik nigdy się nie zmienia.

Każdy wpis jest dodawany jako nowa kopia, więc jeśli dodasz ten sam plik dwa razy, każdy wpis pojawi się dwukrotnie. Nic, co już jest w twoim kalendarzu, nie zostanie nadpisane.

Podzadania i zależności między wpisami z tego samego pliku pozostają po imporcie powiązane. Usunięte wystąpienia wpisu cyklicznego pozostają usunięte. Wpis cykliczny ze zmienionymi wystąpieniami, na przykład z jednym spotkaniem przeniesionym na inny dzień, zostaje pominięty, ponieważ Mitra nie potrafi dodać serii razem z jej zmianami.

Jeśli dodawanie przerwie się w połowie, Mitra usunie wpisy, które zdążyła dodać, więc nic z pliku nie zostanie zaimportowane tylko częściowo. Jeśli nie zdoła usunąć niektórych z nich, poda, ile wpisów trzeba usunąć ręcznie.

## Subskrypcja z linku webcal

Witryny, które pozwalają subskrybować kalendarz, na przykład terminarze rozgrywek sportowych, kalendarze roku szkolnego czy święta państwowe, zwykle podają link do adresu `webcal://`. Kliknij taki link, a Mitra otworzy formularz **Subskrypcja kalendarza** z wypełnionym adresem. Sprawdź adres, w razie potrzeby wypełnij pola **Nazwa użytkownika (opcjonalnie)** i **Hasło (opcjonalnie)** i naciśnij **Połącz**. Następnie włącz kalendarz i naciśnij **Zapisz**.

Kliknięcie linku nigdy samo nie tworzy subskrypcji: Mitra pobiera kanał dopiero wtedy, gdy naciśniesz **Połącz**.

Subskrypcja to jeden kalendarz tylko do odczytu, który Mitra na bieżąco aktualizuje na podstawie kanału. Jak to działa, opisuje strona [Subskrypcje kalendarzy](integrations/subscriptions.md).
