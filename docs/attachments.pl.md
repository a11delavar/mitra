---
title: Załączniki
description: "Dodawaj pliki do wydarzeń i zadań. Mitra przechowuje je na twoim serwerze i zapisuje razem z wpisem, więc widzą je też inne aplikacje kalendarza."
---

Wpis może mieć **załączniki**: pliki, takie jak bilet, zdjęcie tablicy albo przepis. Mitra przechowuje plik na twoim serwerze i zapisuje go razem z wpisem w standardowym formacie kalendarza, więc inne aplikacje korzystające z tego samego kalendarza, na przykład Nextcloud czy Kalendarz Apple, pokazują ten sam plik przy tym samym wydarzeniu.

## Dodaj plik

Otwórz wpis i naciśnij **＋** w wierszu ze spinaczem albo, dopóki wiersz jest pusty, słowo **Załączniki**, a potem wybierz jeden lub kilka plików. Przy każdym załączniku widać ikonę jego rodzaju, nazwę i rozmiar. Kliknij załącznik, aby otworzyć go w nowej karcie, albo naciśnij jego **✕**, aby usunąć go z wpisu.

Spinacz na wpisie w kalendarzu pokazuje, które wpisy mają pliki.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/attachments-detail-dark.webp">
  <img src="../assets/screenshots/attachments-detail-light.webp" alt="Otwarte zadanie obok swojego wpisu w widoku tygodnia, którego spinacz pokazuje, że ma pliki: edytor wymienia nad opisem plik PDF, szkic i arkusz kalkulacyjny, a opis pokazuje szkic" />
</picture>

Linki nie są załącznikami. Aby dodać link do wpisu, wpisz go w opisie, a pokaże go wiersz [Linki](links.md).

## Gdzie przechowywane są pliki

Dodane pliki trafiają do folderu `files` w folderze danych aplikacji Mitra, obok jej bazy danych, więc [kopia zapasowa](backups.md) tego folderu je obejmuje. Każdy plik jest zapisywany pod losową nazwą zamiast własnej, a ten sam plik dodany dwa razy jest przechowywany tylko raz.

> [!IMPORTANT]
> Każdy, kto zna adres pliku, może go otworzyć bez logowania w aplikacji Mitra. Właśnie dzięki temu inne aplikacje kalendarza mogą otworzyć plik: Mitra zapisuje jego adres w twoim kalendarzu, a te aplikacje nie mogą zalogować się w aplikacji Mitra. Adres zawiera losową część, której nie da się odgadnąć, ale traktuj go jak każdy link do udostępniania. Aby uzyskać nowy adres, usuń załącznik i dodaj plik ponownie.

Obrazy, filmy, nagrania dźwiękowe, pliki PDF i zwykły tekst otwierają się w przeglądarce. Każdy inny rodzaj pliku jest pobierany, więc żaden plik nie może uruchomić kodu w aplikacji Mitra.

## Limity

Pojedynczy plik może mieć do 25 MB, a łączna ilość danych, jaką może przechowywać jedna osoba, nie jest ograniczona. Osoba, która prowadzi serwer, może zmienić oba limity albo całkiem wyłączyć dodawanie plików; zobacz [Konfiguracja](configuration.md#attachments). W [wersji demonstracyjnej](https://demo.mitracal.com) dodawanie plików jest zawsze wyłączone.

Plik, którego nie używa już żaden wpis, jest usuwany mniej więcej dzień po dodaniu. Do tego czasu możesz go jeszcze dodać do wpisu, którego nie zapisano, albo dodać z powrotem, jeśli usunięto go przez pomyłkę.

## Które kalendarze to obsługują

Załączniki przechowują kalendarze z [serwera CalDAV](integrations/caldav.md) i z [Kalendarza Apple](integrations/apple.md), a także [kalendarze Mitra](integrations/mitra.md). W [subskrypcji kalendarza](integrations/subscriptions.md) widzisz załączniki, które zawiera kanał, ale nie możesz ich zmieniać.

Plik może też pojawić się w opisie: przycisk obrazu lub linku w jego wierszu dodaje go na końcu tekstu: obraz jako grafikę, a każdy inny plik jako link. Usunięcie załącznika usuwa go także z opisu.

W [kalendarzu Google](integrations/google.md) załącznikami są pliki z Dysku Google dołączone w aplikacji Kalendarz Google: Mitra je pokazuje, ale nie może ich dodawać ani usuwać. Kalendarze [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) i [Tempo](integrations/tempo.md) nie mają wiersza załączników. Przeniesienie wpisu z załącznikami do któregoś z nich usuwa jego pliki, a Mitra uprzedza cię o tym, zanim cokolwiek zostanie przeniesione.

> [!NOTE]
> Załączniki dodane przez inne aplikacje również pojawiają się w aplikacji Mitra, w tym pliki, które przechowuje sam twój serwer kalendarza i które otwierają się pod jego własnym adresem. Mitra zostawia załączniki, których nie rozpoznaje, dokładnie takimi, jakie są, więc edycja wpisu w aplikacji Mitra nigdy nie zmienia załączników innej aplikacji.
