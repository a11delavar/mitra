---
title: Podzadania
description: "Podziel zadanie na podzadania lub listę kontrolną, śledź jego postęp oraz kończ, przenoś i usuwaj całe drzewo zadań za jednym razem."
---

Zadanie może mieć **podzadania**: mniejsze zadania, które razem się na nie składają. Podzadanie może być w innym kalendarzu, a nawet na innym koncie, może mieć własne podzadania i może być [niezaplanowane](planning.md#the-planning-tab).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/hierarchy-detail-dark.webp">
  <img src="../assets/screenshots/hierarchy-detail-light.webp" alt="Zadanie z listą kontrolną w opisie i jednym ukończonym podzadaniem, liczone jako 1/1" />
</picture>

## Dodaj podzadanie

Otwórz mniejsze zadanie, naciśnij **＋** w wierszu **Zadanie nadrzędne** i wpisz fragment tytułu większego zadania. Wyszukiwanie obejmuje wszystkie twoje kalendarze, a wpisy z ukrytych przyciemnia. Mniejsze zadanie pojawi się wtedy w wierszu **Podzadania** większego zadania, obok liczby gotowych podzadań, na przykład 1/3. Powiązanie zawsze dodajesz od strony podzadania: wiersz **Podzadania** w większym zadaniu tylko je wyświetla.

Każde podzadanie na liście ma pole wyboru w [kolorze swojego kalendarza](calendars.md#recolor), więc możesz je odhaczyć, nie wychodząc z większego zadania. Gotowe i anulowane podzadania są przekreślone. Kliknij tytuł, aby otworzyć to zadanie, albo naciśnij **✕** obok niego, aby usunąć powiązanie; działa to z obu stron. W kalendarzu linia łączy zadanie z każdym jego podzadaniem, gdy oba są widoczne.

Mitra nie pozwala utworzyć powiązania, które tworzyłoby pętlę, na przykład takiego, przez które zadanie stałoby się podzadaniem samego siebie.

## Listy kontrolne

Opis zadania może też zawierać listę kontrolną zapisaną w formacie Markdown:

```markdown
- [ ] Book the venue
- [x] Send the invitations
```

Zaznacz pole bezpośrednio w opisie, aby odhaczyć punkt. Mitra zmienia w tekście `[ ]` na `[x]`, więc widzą to także inne aplikacje korzystające z tego kalendarza. Zaznaczanie pól nigdy samo nie zmienia statusu zadania. Listy kontrolne liczą się tylko w zadaniach: w wydarzeniu też można zaznaczać pola, ale nie wpływają one na nic.

## Postęp

Zadanie z podzadaniami lub listą kontrolną pokazuje swój postęp. Każde podzadanie i każde pole to jeden krok, wszystkie o tej samej wadze, więc zadanie z trzema polami i dwoma podzadaniami ma pięć kroków.

Częściowo ukończone podzadanie liczy się częściowo, niezależnie od tego, czy ma własny postęp, czy własne podzadania. Jeśli zadanie ma trzy podzadania, z których dwa są gotowe, a trzecie ma 80%, postęp zadania wynosi 93%. Anulowane podzadania się nie liczą, więc porzucona praca nigdy nie blokuje postępu zadania. Wydarzenia powiązane jako podzadania również się nie liczą.

W kalendarzu obrys pola wyboru zadania wypełnia się w miarę postępu. Wskaż pole, aby zobaczyć liczbę, na przykład „Gotowe: 2 z 3 podzadań” albo „Gotowe: 2 z 4 kroków”, gdy pola i podzadania liczą się razem. Kliknij je prawym przyciskiem myszy lub kliknij z <kbd>Alt</kbd>, aby otworzyć menu statusu z dokładnym procentem.

## Ustaw postęp ręcznie

Zadanie bez podzadań i bez listy kontrolnej może mieć postęp ustawiony przez ciebie. Kliknij jego pole wyboru prawym przyciskiem myszy lub kliknij je z <kbd>Alt</kbd> i przeciągnij suwak **Postęp** w krokach co 5%. Przy 100% zadanie zmienia status na **Gotowe**. Poniżej 100% gotowe zadanie wraca do statusu **W toku**, a przy 0% do statusu **Do zrobienia**. **✕** obok wartości ją czyści.

Kalendarz musi umieć przechowywać postęp: potrafią to [serwery kalendarzy](integrations/caldav.md), [Kalendarz Apple](integrations/apple.md) i [kalendarze przechowywane w aplikacji Mitra](integrations/mitra.md). Kalendarz Google, Notion, Todoist i Tempo tego nie potrafią, więc ich zadania nie mają suwaka **Postęp**.

## Zakończ całe drzewo zadań

Gdy odhaczysz ostatnie otwarte podzadanie, Mitra zapyta, czy oznaczyć jako gotowe również większe zadanie. Jeśli to zakończy kolejne zadania wyżej, zaproponuje oznaczenie ich wszystkich jako gotowe. Pyta jednak dopiero wtedy, gdy lista kontrolna większego zadania też jest w całości odhaczona.

Gdy oznaczysz zadanie jako gotowe lub anulowane, a część jego podzadań jest wciąż otwarta, Mitra zapyta, co z nimi zrobić: **Oznacz jako gotowe** czy **Oznacz jako anulowane**. Zamknij pytanie, aby zostawić je otwarte. Możesz do tego wrócić później: w menu statusu zadania liczba podzadań prowadzi do tego samego pytania.

## Przenieś lub usuń zadanie z podzadaniami

Gdy przeciągniesz zadanie z podzadaniami na inną godzinę, Mitra zapyta: **Przenieść też podzadania?**. Wybierz **Tylko ten wpis** albo przesuń zadanie razem ze wszystkimi podzadaniami o ten sam czas. Usunięcie takiego zadania wywołuje w ten sam sposób pytanie **Usunąć też podzadania?**.

> [!TIP]
> Przytrzymaj <kbd>Ctrl</kbd> (<kbd>⌘</kbd> na Macu), upuszczając lub usuwając zadanie, aby pominąć pytanie i zmienić tylko to zadanie. Zobacz [skróty klawiszowe](shortcuts.md).

## Które kalendarze to obsługują

Powiązanie jest zapisywane razem z podzadaniem, w kalendarzu tego wpisu. [Serwery kalendarzy](integrations/caldav.md), [Kalendarz Apple](integrations/apple.md) i [kalendarze przechowywane w aplikacji Mitra](integrations/mitra.md) przechowują dowolne powiązania, a na serwerze kalendarzy są one zapisywane w standardowym formacie kalendarza, więc mogą je odczytać inne aplikacje korzystające z tego samego kalendarza.

- W [Notion](integrations/notion.md) powiązanie z zadaniem z tej samej bazy danych trafia do odpowiedniej właściwości typu Relation, na przykład „Parent task”. Powiązania z czymkolwiek innym Mitra przechowuje sama.
- W [Todoist](integrations/todoist.md) zadanie nadrzędne, które jest zadaniem z tego samego konta Todoist, zapisuje się też w Todoist, a podzadanie trafia wtedy do projektu swojego zadania nadrzędnego. Powiązania z czymkolwiek innym Mitra przechowuje sama.
- [Kalendarz Google](integrations/google.md) usuwa powiązania, więc wpisowi w kalendarzu Google nie można przypisać zadania nadrzędnego. Wpisy w innych kalendarzach mogą się jednak do niego odwoływać.
- [Subskrypcje kalendarzy](integrations/subscriptions.md) są tylko do odczytu, a [Tempo](integrations/tempo.md) nie obsługuje powiązań.
