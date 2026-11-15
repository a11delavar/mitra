---
title: Rutyny
description: "Jak Mitra liczy to, co robisz często, na przykład codzienny lek albo siłownię, i pokazuje to jako małe znaczniki w widokach miesiąca i roku."
---

Niektóre rzeczy zdarzają się tak często, że osobny pasek dla każdej z nich zapełniłby miesiąc kopiami: codzienny trening, leki, poranne spotkanie zespołu w dni robocze. W widokach miesiąca i roku Mitra rysuje je zamiast tego jako **rutynę**: cienką linię pod dniami ze znacznikiem w każdym dniu, w którym rutyna występuje. Karta **Rutyny** na pasku bocznym liczy, jak poszła każda rutyna.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/month-detail-dark.webp">
  <img src="../assets/screenshots/month-detail-light.webp" alt="Widok miesiąca z rutynami w postaci małych znaczników pod każdym dniem" />
</picture>

W widoku roku, w którym każdy dzień jest mały, rutyny widać najwyraźniej: każda kolorowa linia to rutyna biegnąca przez kolejne miesiące.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/year-detail-dark.webp">
  <img src="../assets/screenshots/year-detail-light.webp" alt="Widok roku z rutynami w postaci cienkich kolorowych linii pod dniami każdego miesiąca" />
</picture>

## Co staje się rutyną

Wpisy tworzą rutynę, gdy są w tym samym kalendarzu i mają ten sam tytuł. Mitra rozpoznaje rutynę, gdy wpisy są zapisywane lub synchronizowane, i ją zapamiętuje.

- Wpis cykliczny jest rutyną od początku, niezależnie od tego, jak często się powtarza, o ile ma co najmniej cztery daty.
- Wpisy, które się nie powtarzają, stają się rutyną, gdy jest ich co najmniej cztery i zachowują regularny rytm, na przykład co kilka dni, co tydzień albo raz w roku. Dlatego osobne wpisy o tytule „Bieganie” tworzą rutynę tak samo jak codzienna seria, a kilka blisko siebie, a potem długa przerwa, jak loty z dwóch podróży, już nie.

Kalendarze, które możesz tylko odczytywać, takie jak subskrypcje, nie tworzą rutyn.

Gdy wpis należy już do rutyny, pozostaje w niej: gdy zmienisz jego nazwę, odhaczysz go, przeniesiesz jedno z jego wystąpień albo przeniesiesz go do innego kalendarza. Późniejsze wpisy o tym samym tytule dołączają do niej, bez względu na to, jak daleko są od siebie. Kopia w innym kalendarzu dołącza ze swoim tytułem do rutyny tamtego kalendarza. Wpis bez tytułu nigdy nie łączy się z innymi; jeśli jest cykliczny, sam tworzy rutynę.

To, jak często rutyna występuje, decyduje o tym, jak pokazują ją widoki:

- W widoku miesiąca rutyna występująca częściej niż raz w tygodniu wyświetla się jako znaczniki. Wpis cotygodniowy pozostaje paskiem.
- W widoku roku rutyna występująca mniej więcej co pięć tygodni lub częściej wyświetla się jako znaczniki, więc także cotygodniowe i comiesięczne. Rzadsza, na przykład urodziny, pozostaje paskiem.

## Karta Rutyny

Otwórz **Rutyny** na pasku bocznym, obok Kalendarzy i Planowania, albo wpisz jej nazwę w palecie poleceń. **Dzisiaj** pokazuje rutyny przypadające na dziś, według godziny, a **Trwające** pozostałe, według najbliższego terminu. Rutyny, które nie wystąpiły w ostatnich trzech miesiącach i nie mają nic przed sobą, zwijają się pod **Minione**, od najnowszej. Aby pominąć rutyny kalendarza, na przykład kalendarza pracy, wybierz **Ukryj jego rutyny** w jego menu na pasku bocznym. Każdy wiersz pokazuje nazwę rutyny, kiedy występuje, oraz jej serię: płomień w kolorze jej kalendarza z liczbą wystąpień wykonanych z rzędu. Pominięte lub anulowane wystąpienie kończy serię, a płomień robi się szary.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/routines-detail-dark.webp">
  <img src="../assets/screenshots/routines-detail-light.webp" alt="Karta Rutyny na pasku bocznym, każda rutyna ze swoją serią, obok otwarte szczegóły siłowni" />
</picture>

Szczegóły rutyny pokazują jej ostatnie tygodnie jako siatkę, jedno pole na dzień:

- Pełne pole jest wykonane: wydarzenie, które się odbyło, albo zadanie, które odhaczyłeś.
- Puste pole jest pominięte: zadanie, które po swoim dniu zostało otwarte.
- Kreska jest anulowana i liczy się jako niewykonana, tak jak pominięta.
- Pole w obwódce to dzisiejsze, jeszcze otwarte.
- Blade pole to dzień, w którym rutyna nie występuje.

Mitra liczy tylko to, co jest w twoim kalendarzu. Usunięte wystąpienie znika i nie jest liczone, więc aby zachować opuszczony raz w historii, anuluj go zamiast usuwać; zobacz [Status wydarzenia](entries.md#event-status). Wydarzeń nie trzeba odhaczać: wydarzenie się odbyło, chyba że zostało anulowane.

Dzisiejszy status jest na końcu wiersza rutyny: pole wyboru zadania, które odhacza je tak samo jak to w kalendarzu, oraz status wydarzenia, gdy je anulujesz, aby można go było zmienić z powrotem. Licznik na karcie podaje, ile zadań z rutyn jest dziś jeszcze otwartych. Kalendarz, który ukryjesz, zabiera swoje rutyny z karty.

## Szczegóły rutyny

Kliknij wiersz, aby zobaczyć więcej: od kiedy trwa rutyna, jej ostatnie tygodnie jako siatkę dni, a pod nią trzy kafelki: jej serię z nagłówkiem mówiącym, jak idzie, na przykład **Na dobrej drodze** albo **Słabnie**, **Nic w planach**, gdy nie ma zaplanowanej żadnej daty, albo **Zakończona**, gdy trafiła do **Minione**, i twoim rekordem; ile z ostatniego roku wykonałeś; oraz w który dzień tygodnia najczęściej odpada. Jej menu **⋯** ma **Zrobione dziś** dla zadania, **Anulowane**, aby anulować dzisiejsze wystąpienie, i **Pokaż w kalendarzu**, aby otworzyć następne. Odznacz tam **Śledź, jak idzie** przy rutynie, której tylko dotrzymujesz, jak rachunek czy spotkanie: nie pokazuje wtedy serii, a jej szczegóły tylko siatkę.

## Poprawianie rutyny

Mitra sama znajduje rutyny, a menu **⋯** w szczegółach poprawia ją tam, gdzie się pomyliła. **Zmień nazwę…** nadaje rutynie własną nazwę; możesz też kliknąć jej nazwę i pisać. Przycisk obok własnej nazwy albo ponowne wpisanie tytułu jej wpisów przywraca nazwę według wpisów. **Scal z** otwiera pozostałe rutyny tego samego kalendarza; wybranie jednej łączy obie, gdy jeden nawyk ma dwa tytuły, na przykład „Tabletki rano” i „Tabletki wieczorem”. **To nie rutyna** usuwa ją z karty na dobre: wpisy o jej tytule nie są już łączone w rutynę i zostają w twoim kalendarzu. To, co oznaczyłeś jako nie rutynę, czeka zwinięte na końcu karty w **To nie rutyny**; rozwiń je, aby znowu zrobić z tego rutynę.

Edytor wpisu ma po datach wiersz **Rutyna**, widoczny, gdy wpis należy do rutyny albo mógłby do niej należeć. Wybierz tam inną rutynę z jego kalendarza, **Nowa rutyna**, aby zacząć ją od tego wpisu, do której dołączą późniejsze wpisy o jego tytule, albo **To nie rutyna**, aby wyjąć go z niej na dobre, na przykład lunch, który tylko dzieli tytuł z nawykiem. Wiersz pokazuje serię rutyny obok jej nazwy.

## Korzystanie z rutyny

Wskaż rutynę, aby zobaczyć jej tytuł oraz, jeśli to wpis cykliczny, jak często się powtarza. Kliknij ją, aby otworzyć jej pierwszy wpis w danym wierszu: w tygodniu w widoku miesiąca albo w miesiącu w widoku roku.

Widok tygodnia zawsze pokazuje każdy wpis w całości, z godzinami.
