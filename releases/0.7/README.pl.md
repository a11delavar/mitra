---
title: Konektory AI, załączniki, regiony i języki
---
Mitra 0.7 współpracuje z asystentami AI, z których już korzystasz, więc mogą one planować twój czas bezpośrednio w kalendarzu. Możesz teraz dołączać pliki do wpisów, Mitra zapisuje daty tak, jak robi się to w twoim regionie, a domowa strefa czasowa zostaje z tobą, gdy podróżujesz. Mitra jest teraz dostępna w języku chińskim, a o tym, co się zmieniło, przeczytasz bez wychodzenia z aplikacji. Przeciąganie, powiększanie i wczytywanie działają szybciej, a do tego pojawiło się wiele mniejszych ulepszeń i poprawek.

## Konektory AI
Asystenci AI, tacy jak Claude i Cursor, mogą teraz pracować z twoim kalendarzem. Połącz jednego z nich za pomocą adresu z sekcji Ustawienia → AI i poproś go o to, co zwykle robisz ręcznie: niech przejrzy twój tydzień, znajdzie wpis, zaplanuje podróż albo przesunie spotkanie. To, co zapisze, trafia do twoich kalendarzy jak każda inna zmiana i stamtąd się synchronizuje. Na serwerze, na którym użytkownicy się logują, każdy asystent dostaje własny token dostępu, który można ograniczyć do odczytu i w każdej chwili unieważnić.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="connectors-dark.webp">
	<img src="connectors-light.webp" alt="Asystent AI wpisuje do tygodnia zaplanowaną podróż do Paryża: dawne plany znikają, pojawia się podróż, a wieża Eiffla otwiera się ze zdjęciem i biletem">
</picture>

Zdjęcie wieży Eiffla: David McSpadden, Wikimedia Commons, CC BY 2.0.

Dokumentacja: [Konektory AI](../../docs/ai-connectors.md)

## Regiony i języki
Oprócz języka wybierz też swój kraj. Mitra zapisuje wtedy daty, godziny i liczby tak, jak robi się to w tym kraju. Tydzień zaczyna się w tym dniu, w którym zaczyna się tam, a weekend wypada w dni, w które masz wolne. Podgląd pokazuje, jak wszystko będzie wyglądać, zanim podejmiesz decyzję. Skróty klawiszowe działają teraz także wtedy, gdy twoja klawiatura pisze w innym alfabecie, na przykład perskim.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="locales-dark.webp">
	<img src="locales-light.webp" alt="Ustawienie „Język” z otwartą listą języków, a pod włoskim kraje, w których się nim pisze">
</picture>

Dokumentacja: [Ustawienia](../../docs/settings.md)

## Domowa strefa czasowa
Mitra zna teraz twoją domową strefę czasową i zapisuje ją na twoim koncie. Gdy podróżujesz, kalendarz podąża za strefą urządzenia, a strefa domowa zostaje w kolumnie obok. Twoja lista stref się nie zmienia, więc po powrocie znowu widzisz jedną kolumnę. Dodane strefy i nadane im nazwy są takie same na każdym urządzeniu. Nad każdą kolumną widnieje krótka nazwa, której ludzie naprawdę używają dla tej strefy.

Selektor stref czasowych też ma nowy wygląd. Strefy o tej samej nazwie i tym samym czasie są zgrupowane w jednym wierszu, a strefy z twojego kraju są na początku listy. Domek oznacza strefę domową, a pinezka strefę, w której jesteś w czasie podróży.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="time-zones-dark.webp">
	<img src="time-zones-light.webp" alt="Selektor stref czasowych otwarty na strefie domowej wśród zgrupowanych stref">
</picture>

> [!NOTE]
> Jeśli strefa czasowa, w której jesteś, miała nadaną przez ciebie nazwę, nadaj ją jeszcze raz. Do tej pory takie nazwy zostawały na urządzeniu, na którym je ustawiono. Od teraz nazwa podąża za tobą na każde urządzenie.

Dokumentacja: [Strefy czasowe](../../docs/time-zones.md)

## Załączniki
Możesz teraz dołączać pliki do wpisu, na przykład bilet, plan spotkania albo zdjęcie tablicy. Dodaj je spinaczem w edytorze wpisu albo przeciągnij na otwarty wpis. Kliknij plik, aby go otworzyć. Plik możesz też dodać do opisu: obraz pojawi się tam jako grafika, a każdy inny plik jako link. Jeśli później usuniesz plik, Mitra usunie go także z opisu.

Załączniki synchronizują się z twoim kalendarzem. W kalendarzu CalDAV inne aplikacje korzystające z tego samego kalendarza widzą pliki, które dołączasz, a Mitra pokazuje pliki dołączone w nich. W Kalendarzu Google Mitra pokazuje pliki z Dysku Google dołączone do wydarzenia, ale nie może ich dodawać ani usuwać, bo Google przechowuje tylko pliki z Dysku. Obrazy ze strony w Notion pojawiają się teraz w opisie zadania.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="attachments-dark.webp">
	<img src="attachments-light.webp" alt="Otwarte zadanie obok swojego wpisu w widoku tygodnia, którego spinacz pokazuje, że ma pliki: edytor wymienia nad opisem plik PDF, szkic i arkusz kalkulacyjny, a opis pokazuje szkic">
</picture>

> [!NOTE]
> Mitra przechowuje dołączone pliki w swoim folderze danych, więc kopia zapasowa tego folderu obejmuje też twoje pliki. Rozmiar pojedynczego pliku możesz ograniczyć zmienną `MITRA_FILE_MAX_SIZE`, a to, ile łącznie może przechowywać każda osoba, zmienną `MITRA_FILE_QUOTA`.

Dokumentacja: [Załączniki](../../docs/attachments.md)

## Informacje o wersji w aplikacji
Teraz zobaczysz, co się zmieniło, bez wychodzenia z aplikacji Mitra. Okno „O aplikacji” pokazuje każde wydanie tak samo jak strona internetowa: z opisem i zrzutami ekranu wersji, której używasz, oraz z poprawkami, które wyszły po niej. Jest tam też lista wszystkich commitów, zwinięta, dopóki jej nie potrzebujesz.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="about-dark.webp">
	<img src="about-light.webp" alt="Okno „O aplikacji” otwarte na opisie i zrzutach ekranu wydania">
</picture>

## Chiński
Mitra mówi teraz po chińsku, w wersji ze znakami uproszczonymi. Przetłumaczone są aplikacja, kalendarz przykładowy, dokumentacja i strona internetowa, a chiński tekst jest składany krojem pisma stworzonym specjalnie z myślą o nim.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="chinese-detail-dark.webp">
	<img src="chinese-detail-light.webp" alt="Edytor wpisu po chińsku, z selektorem daty otwartym na bieżącym miesiącu">
</picture>

Dokumentacja: [Ustawienia](../../docs/settings.md)

## Współtwórcy
- [@a11delavar](https://github.com/a11delavar)
- [@d8monx](https://github.com/d8monx)
