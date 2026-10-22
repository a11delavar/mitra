---
title: Zależności
description: "Każ wpisowi czekać na inny, zobacz kolejność jako linie w kalendarzu i przesuwaj cały łańcuch naraz."
---

**Zależność** oznacza, że wpis nie może się zacząć, dopóki inny się nie skończy: najpierw szkic, potem recenzja, a po recenzji wydanie. Wpis, który czeka, jest blokowany przez ten drugi.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/week-detail-dark.webp">
  <img src="../assets/screenshots/week-detail-light.webp" alt="Tydzień z trzema zadaniami do nauki połączonymi liniami, z których każde prowadzi do następnego, a ostatnie do egzaminu" />
</picture>

## Dodaj zależność

Otwórz wpis, który ma czekać, naciśnij **＋** w wierszu **Blokowany przez** i wpisz fragment tytułu wpisu, który musi się skończyć wcześniej. Wyszukiwanie obejmuje wszystkie twoje kalendarze, także ukryte, więc wpis może czekać na wpis z innego kalendarza lub konta. Wpisy z ukrytych kalendarzy są przyciemnione. Drugi wpis wyświetla wtedy ten wpis w wierszu **Blokuje**, który tylko pokazuje powiązania: zawsze dodajesz je od strony wpisu, który czeka.

W edytorze kliknij tytuł powiązanego wpisu, aby go otworzyć, albo naciśnij **✕** obok niego, aby usunąć powiązanie; działa to z obu stron. Mitra nie pozwala utworzyć powiązania, które tworzyłoby pętlę, na przykład takiego, w którym dwa wpisy czekają na siebie nawzajem.

Za pomocą myszy możesz też narysować zależność w widoku tygodnia lub miesiąca. Wskaż wpis, który ma być pierwszy, chwyć krótką linię na jego końcu i upuść ją na wpisie, który ma na niego czekać. Podczas przeciągania linia robi się czerwona nad wpisem, który już teraz zaczyna się za wcześnie.

## Linie w kalendarzu

Widok tygodnia, widok miesiąca i oś czasu rysują linię od końca każdego wpisu do początku wpisu, który na niego czeka. Wskaż wpis, aby wysunąć jego linie na pierwszy plan. Linie w każdym z widoków możesz wyłączyć w **Ustawienia → Kalendarz** za pomocą opcji **Linie połączeń w widoku tygodnia**, **Linie połączeń w widoku miesiąca** i **Linie połączeń na osi czasu**.

## Naruszone zależności

Gdy wpis zaczyna się, zanim skończy się ten, na który czeka, zależność jest naruszona. Jej linia w kalendarzu robi się czerwona, a w wierszach **Blokowany przez** i **Blokuje** w edytorze wpis po drugiej stronie jest wyróżniony na czerwono. Przesuń jeden z wpisów tak, aby znów były we właściwej kolejności, a ostrzeżenie zniknie.

## Przesuń łańcuch

Gdy przeciągasz wpis lub jedną z jego krawędzi, a inne wpisy od niego zależą, Mitra pyta: **Przenieść też wpisy zależne?**. Opcje, które przesuwają inne wpisy, podają, ile ich jest:

- **Tylko ten wpis** przesuwa tylko ten wpis, a pozostałe zostawia na miejscu.
- **Zachowaj łańcuch zależności** przesuwa pozostałe wpisy tylko na tyle, na ile trzeba, aby zachowały kolejność. Wpisy po tym wpisie przesuwają się na później, a jeśli ten wpis został przesunięty na wcześniej, wpisy przed nim przesuwają się na wcześniej. Wpis, który ma wystarczający zapas czasu, zostaje na miejscu.
- **Przesuń wszystkie o tyle samo** przesuwa cały łańcuch, przed tym wpisem i po nim, o ten sam czas, więc odstępy między wpisami pozostają takie same.

Mitra pyta tylko wtedy, gdy poszczególne opcje dałyby różne wyniki. Zmiana godzin w edytorze nigdy nie przesuwa innych wpisów.

Gdy wpis przesuwa się jako część łańcucha, jego podzadania przesuwają się razem z nim. Wpisy cykliczne i niezaplanowane zadania w łańcuchu nigdy nie są przesuwane.

> [!TIP]
> Przytrzymaj <kbd>Ctrl</kbd> (<kbd>⌘</kbd> na Macu), upuszczając wpis, aby pominąć pytanie i przesunąć tylko ten wpis. Zobacz [skróty klawiszowe](shortcuts.md).

## Które kalendarze to obsługują

Powiązanie jest zapisywane razem z wpisem, który czeka, w kalendarzu tego wpisu. [Serwery kalendarzy](integrations/caldav.md), [Kalendarz Apple](integrations/apple.md) i [kalendarze przechowywane w aplikacji Mitra](integrations/mitra.md) przechowują dowolne powiązania, a na serwerze kalendarzy są one zapisywane w standardowym formacie kalendarza, więc mogą je odczytać inne aplikacje korzystające z tego samego kalendarza.

- W [Notion](integrations/notion.md) powiązanie z zadaniem z tej samej bazy danych trafia do odpowiedniej właściwości typu Relation, na przykład „Blocked by”. Powiązania z czymkolwiek innym Mitra przechowuje sama.
- [Todoist](integrations/todoist.md) nie obsługuje zależności, więc Mitra przechowuje je sama. Przepadają, gdy odłączysz konto albo ponownie zaimportujesz kalendarz.
- [Kalendarz Google](integrations/google.md) usuwa powiązania, więc wpis w kalendarzu Google nie może na nic czekać. Wpisy w innych kalendarzach mogą jednak na niego czekać.
- [Subskrypcje kalendarzy](integrations/subscriptions.md) są tylko do odczytu, a [Tempo](integrations/tempo.md) nie obsługuje powiązań.
