---
title: Wpisy
description: "Otwórz edytor wpisu i zobacz wszystko, co może mieć wydarzenie lub zadanie: kalendarz, typ, kolor, status, opis i nie tylko."
---

Wszystko w twoim kalendarzu jest **wpisem**. Większość wpisów to **wydarzenia**, które odbywają się o określonej porze, albo **zadania**, które wykonujesz i odhaczasz. Trzeci rodzaj, [dostępność](availability.md), zaznacza cieniem czas zarezerwowany na coś konkretnego, za wydarzeniami i zadaniami.

Ta strona opisuje edytor wpisu: jego nagłówek, wiersze pod nim i opis.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/due-detail-dark.webp">
  <img src="../assets/screenshots/due-detail-light.webp" alt="Edytor zadania w kalendarzu Praca z polem wyboru statusu i tytułem, datą rozpoczęcia, zakończenia i terminem, linkiem i opisem, widocznością, przypomnieniami i powiązaniami" />
</picture>

## Otwórz edytor

Kliknij wpis, a obok niego otworzy się jego edytor. Aby utworzyć wpis, naciśnij <kbd>C</kbd> albo **Utwórz** u góry strony. Nowy wpis zaczyna się o najbliższej pełnej godzinie, trwa godzinę i trafia do twojego [domyślnego kalendarza](calendars.md#where-new-entries-land). W [widoku tygodnia](views/week.md) możesz też przeciągnąć po pustym czasie.

Każda zmiana zapisuje się od razu. Zamknij edytor przyciskiem **✕** albo kliknięciem poza nim. Na wąskim ekranie, na przykład na telefonie, edytor wysuwa się od dołu jako panel.

## Nagłówek

Górny wiersz edytora zawiera kolor wpisu, jego kalendarz, typ i menu **⋯**.

### Nadaj wpisowi własny kolor

Wpis ma kolor swojego kalendarza. Aby nadać jednemu wpisowi własny kolor, kliknij kropkę na początku nagłówka i wybierz kolor. **Przywróć kolor kalendarza** w tym samym selektorze przywraca wpisowi kolor kalendarza.

### Przenieś wpis do innego kalendarza

Obok kropki widnieje nazwa kalendarza wpisu. Kliknij ją i wybierz inny kalendarz, aby przenieść tam wpis. Na liście nie ma kalendarzy, które nie mogłyby zachować czegoś, co ma wpis, na przykład powtarzania albo statusu **Anulowane**. Zobacz [Przenieś pojedynczy wpis](calendars.md#move-a-single-entry).

### Zmień typ wpisu

Dalej w nagłówku widać typ wpisu: **Wydarzenie**, **Zadanie** lub **Dostępność**. Kliknij go i wybierz inny. Serwery kalendarzy przechowują wydarzenia i zadania osobno, więc Mitra zapisuje wpis na nowo jako drugi typ i usuwa stary. Edytor pozostaje otwarty na nowym wpisie.

Wszystko, czego nowy typ nie może przechować, zostaje pominięte. Zadanie zamienione w wydarzenie traci status, postęp, termin i szacowany czas. Wydarzenie zamienione w zadanie traci ustawienie „zajęty” lub „wolny”. Dostępność nie ma uczestników ani przypomnień.

Typu nie można zmienić we wpisie cyklicznym ani w kalendarzu, który obsługuje tylko jeden typ, takim jak kalendarz Notion. **Dostępność** pojawia się tylko tam, gdzie kalendarz może ją przechować.

### Menu ⋯

**Duplikuj** tworzy kopię w tym samym kalendarzu i ją otwiera. Jeśli podczas przeciągania wpisu przytrzymasz <kbd>Alt</kbd>, kopia powstanie tam, gdzie go upuścisz.

**Duplikuj na inne dni…** umieszcza kopię na kilku dniach naraz, dla pracy w dni, których żadne powtarzanie nie opisze, na przykład 1., 3. i 17. W kalendarzu, który się pojawi, kliknij każdy potrzebny dzień, a potem **Duplikuj na 3 dni**. Każda kopia zachowuje godzinę wpisu i jest osobnym wpisem. Aby wybrać kilka dni z rzędu, przytrzymaj <kbd>Shift</kbd>, klikając ostatni z nich. Dni, które wpis już zajmuje, mają kropkę i nie można ich wybrać.

**Usuń** usuwa wpis. Gdy edytor jest otwarty, to samo robią klawisze <kbd>Delete</kbd> i <kbd>Backspace</kbd>, o ile nie piszesz akurat w polu tekstowym. Jeśli wpis się powtarza albo ma podzadania, Mitra zapyta, o które chodzi.

Wpis z Notion, Todoist lub Tempo ma też polecenie **Otwórz w aplikacji Notion**, **Otwórz w aplikacji Todoist** lub **Otwórz w aplikacji Jira**, które otwiera go tam, skąd pochodzi.

## Tytuł i czas

Tytuł to duży wiersz pod nagłówkiem. Wiersze poniżej mówią, kiedy wpis się odbywa: jego początek, koniec, strefa czasowa i to, czy się powtarza. Aby przełączać między dniami a godzinami, naciśnij **Cały dzień** na końcu daty; przełącznik widać, gdy jesteś w tym wierszu.

Zadanie ma też termin, a dopóki jest niezaplanowane, również szacowany czas. Zobacz [Planowanie](planning.md). O strefach czasowych przeczytasz na stronie [Strefy czasowe](time-zones.md), a o powtarzaniu na stronie [Powtarzanie](repeats.md).

## Status zadania

Zadanie ma przed tytułem pole wyboru i jeden z czterech statusów: **Do zrobienia**, **W toku**, **Gotowe** lub **Anulowane**. Kliknij pole wyboru, aby oznaczyć zadanie jako gotowe, a kliknij ponownie, aby znów je otworzyć. Aby wybrać dowolny status, kliknij pole wyboru prawym przyciskiem myszy albo z wciśniętym klawiszem <kbd>Alt</kbd>. Działa to także w kalendarzu.

Gotowe i anulowane zadania są przekreślone. Kalendarz bez statusu „anulowane”, na przykład Notion, nie pokazuje w menu opcji **Anulowane**. Zadanie z podzadaniami lub listą kontrolną pokazuje swój postęp w polu wyboru; zobacz [Podzadania](subtasks.md#progress).

## Zajęty lub wolny oraz widoczność

Wiersz z okiem określa, czego inni dowiedzą się o wpisie, gdy zajrzą do twojego kalendarza.

Wydarzenia mogą być oznaczone jako **Zajęty** lub **Wolny**. Domyślne ustawienie „zajęty” oznacza czas jako zajęty, więc ktoś, kto sprawdza, kiedy możesz się spotkać, zobaczy go jako zablokowany. Ustawienie „wolny” pokazuje wpis, ale nie blokuje czasu, co pasuje do przypomnienia dla siebie albo do święta, w które nie bierzesz wolnego. Zadania nie mają tego ustawienia. Dostępność je ma i domyślnie jest wolna; zobacz [Dostępność](availability.md#busy-or-free).

Każdy wpis ma widoczność. **Domyślna widoczność** zostawia decyzję kalendarzowi. **Publiczne** pozwala każdemu, kto widzi twój kalendarz, przeczytać wpis. **Prywatne** prosi inne aplikacje, by osobom, którym udostępniasz kalendarz, pokazywały tylko, że czas jest zajęty, a nie czym. **Poufne** to najściślejsza opcja, dla wpisów, które mają zostać między tobą a zaproszonymi osobami. Mitra zapisuje twój wybór razem z wpisem, a o tym, co ukryć, decydują serwer i aplikacje, które go odczytują.

## Lokalizacja, osoby i nie tylko

- [Lokalizacja](location.md) zawiera miejsce z mapą albo link do spotkania online.
- [Uczestnicy](participants.md) to lista zaangażowanych osób i ich odpowiedzi.
- [Przypomnienia](reminders.md) powiadamiają cię przed rozpoczęciem wpisu albo przed terminem zadania.
- [Linki](links.md) zbierają linki z opisu powyżej.
- [Załączniki](attachments.md) to pliki dodane do wpisu.
- **Zadanie nadrzędne** i **Podzadania** tworzą drzewo zadań; zobacz [Podzadania](subtasks.md).
- **Blokowany przez** i **Blokuje** określają, co musi zostać ukończone wcześniej; zobacz [Zależności](dependencies.md).

## Opis

Kliknij opis, aby go edytować, a potem kliknij gdzie indziej, aby znów zobaczyć go sformatowanego. Opis pisze się w Markdownie, więc nagłówki, listy punktowane i numerowane, pogrubienie i kursywa, kod, tabele i linki wyświetlają się sformatowane. Cytat zaczynający się od `> [!NOTE]`, `> [!TIP]` lub `> [!WARNING]` staje się kolorową ramką z wyróżnieniem. Kliknięcie linku otwiera go, zamiast przechodzić do edycji.

Wiersze zaczynające się od `- [ ]` tworzą listę kontrolną, której punkty możesz odhaczać bez otwierania tekstu. Zobacz [Listy kontrolne](subtasks.md#checklists).

## Powiązania z innych aplikacji

Inne aplikacje kalendarza mogą łączyć wpisy w sposób, którego Mitra sama nie tworzy. Mitra pokazuje takie powiązania w osobnej sekcji: **Powiązany z** dla wpisów, które do siebie należą, a w przypadku rodzajów, których nie zna, w sekcji nazwanej od typu powiązania. Takie powiązanie możesz usunąć przyciskiem **✕**, ale nie możesz dodać nowego.

## Które kalendarze to obsługują

Każdy kalendarz przechowuje coś innego, a Mitra ukrywa wiersze, których dany kalendarz nie może przechować, więc nic, co wpiszesz, nie zniknie przy następnej synchronizacji. Na przykład kalendarz Notion zawiera tylko zadania, a kalendarz Google nie ma powiązań. Co przechowuje każdy z nich, opisuje strona [Integracje](integrations/README.md#what-each-one-holds).
