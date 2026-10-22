---
title: Kalendarze
description: Wybierz, które kalendarze Mitra importuje, zmieniaj ich nazwy, kolory i kolejność, ukrywaj je, decyduj, gdzie trafiają nowe wpisy, i przenoś wpisy między kalendarzami.
---

Każdy wiersz na karcie **Kalendarze** w panelu bocznym to jeden kalendarz. Niektóre są [przechowywane w aplikacji Mitra](integrations/mitra.md), inne pochodzą z połączonych kont. Stoją pod nagłówkiem integracji, do której należą, a wszystko, co opisuje ta strona, działa tak samo dla każdego z nich, chyba że zaznaczono inaczej.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/calendars-detail-dark.webp">
  <img src="../assets/screenshots/calendars-detail-light.webp" alt="Panel boczny z kontem i jego pięcioma kalendarzami, każdym w innym kolorze" />
</picture>

Kalendarz to jeden wiersz, nawet jeśli zawiera i wydarzenia, i zadania, jak większość kalendarzy CalDAV. To, czy dany wpis jest wydarzeniem, czy zadaniem, zależy od samego wpisu.

## Wybierz, co zostanie zaimportowane

Gdy łączysz konto, Mitra wyszukuje jego kalendarze i wyświetla je na liście, wszystkie zaznaczone, z informacją, co zawierają, na przykład „Wydarzenia · Zadania”. Przed zapisaniem odznacz te, których nie chcesz. Później możesz zmienić zdanie w menu konta **⋯ → Edytuj**, gdzie kalendarze dodane do konta w międzyczasie czekają odznaczone. Mitra synchronizuje i przechowuje tylko włączone kalendarze, więc pozostałe nic nie kosztują.

## Dodaj lub usuń kalendarz

Kalendarz z połączonego konta tworzy się i usuwa u dostawcy, a Mitra zauważa zmianę przy następnej synchronizacji. Wyjątkiem są kalendarze Mitra: nowy dodasz poleceniem **Nowy kalendarz** w menu **⋯** przy nagłówku Mitra, a istniejący usuniesz poleceniem **Usuń kalendarz** w jego własnym menu **⋯**. Jeśli kalendarz wciąż zawiera wpisy, Mitra zaproponuje **Najpierw przenieś wpisy…**, żeby nic nie przepadło przez przypadek.

## Ukryj kalendarz

Oko na końcu wiersza ukrywa wpisy tego kalendarza. Ukrycie dotyczy tylko tego, co widzisz: kalendarz nadal się synchronizuje, a jego wpisy wracają od razu, gdy znów go pokażesz. Wyszukiwanie nadal je znajduje, przyciemnione.

Ukrycie nie wycisza kalendarza, więc jego [przypomnienia](reminders.md) nadal działają. Aby całkowicie wyłączyć kalendarz, odznacz go w menu konta **⋯ → Edytuj**.

### Pokaż tylko jeden kalendarz

Aby usunąć z widoku wszystko inne, wybierz **Pokaż tylko ten kalendarz** w menu **⋯** kalendarza albo kliknij jego oko z wciśniętym klawiszem <kbd>Alt</kbd>. Wszystkie pozostałe kalendarze zostaną ukryte, a Mitra zapamięta, które z nich były widoczne. To samo polecenie menu zmieni się wtedy w **Pokaż kalendarze widoczne wcześniej** i przywróci je.

Kalendarze, które były ukryte już wcześniej, pozostaną ukryte. Kalendarz połączony w międzyczasie będzie widoczny, bo nie należał do tego, co schowano. Ręczne pokazanie któregoś kalendarza też nie odbiera ci możliwości przywrócenia pozostałych. Obie rzeczy możesz zrobić także z [palety poleceń](shortcuts.md), wyszukując nazwę kalendarza.

## Zmień nazwę

Kliknij dwukrotnie nazwę kalendarza albo wybierz **Zmień nazwę** w jego menu **⋯**. Nazwa należy do ciebie: synchronizacja nigdy jej nie nadpisuje. Mitra przejmie nazwę od dostawcy dopiero wtedy, gdy kalendarz faktycznie zostanie tam przemianowany.

## Zmień kolor

Wybierz kolor w menu **⋯** kalendarza. Dopóki tego nie zrobisz, kalendarz ma kolor nadany przez dostawcę. Jeśli dostawca go nie podaje, Mitra dobiera kolor na podstawie adresu kalendarza, więc na każdym urządzeniu wygląda on tak samo. Wpisy mają kolor swojego kalendarza, chyba że mają własny.

## Zmień kolejność

Kalendarze są początkowo ułożone w kolejności, w jakiej je wykryto, a konta w kolejności połączenia. Aby ułożyć je po swojemu, przeciągnij kalendarz w górę lub w dół w obrębie konta albo przeciągnij konto za nagłówek, aby przenieść je razem ze wszystkimi kalendarzami. Na ekranie dotykowym przed przeciągnięciem przytrzymaj palec przez chwilę, bo zwykłe przesunięcie przewija listę. Polecenia **Przenieś wyżej** i **Przenieś niżej** w menu **⋯** robią to samo bez przeciągania.

Kalendarz można przesuwać tylko w obrębie jego konta. Kalendarz włączony później trafia na koniec listy swojego konta, więc nie burzy ustalonej przez ciebie kolejności.

## Gdzie trafiają nowe wpisy

Kalendarz z wypełnioną ikoną jest domyślny: trafiają do niego nowe wpisy, chyba że wybierzesz inny. Kliknij ikonę kalendarza, aby ustawić go jako domyślny, a ponowne kliknięcie ikony domyślnego kalendarza tę opcję wyłącza. Bez domyślnego kalendarza, albo gdy jest ukryty, nowe wpisy trafiają do pierwszego widocznego kalendarza i to on dostaje wypełnioną ikonę, więc przeniesienie kalendarza na górę również czyni go domyślnym. To samo ustawienie znajdziesz w **Ustawienia → Wpisy**.

Nowe wpisy są wydarzeniami, chyba że kalendarz obsługuje tylko zadania, jak widok Notion. Dopóki wpis jest nowy, w edytorze jest przełącznik **Wydarzenie** / **Zadanie**. Po zapisaniu typ zmienisz polem **Typ** w edytorze, o ile kalendarz obsługuje też drugi rodzaj wpisów. Wpis cykliczny zachowuje swój typ.

## Przenieś lub skopiuj wszystkie wpisy do innego kalendarza

Polecenie **Przenieś wpisy do…** w menu **⋯** kalendarza albo **Przenieś wpisy z kalendarza …** w palecie poleceń przenosi od razu całą zawartość do innego kalendarza. Wybierz miejsce docelowe, a zanim cokolwiek się stanie, Mitra pokaże, co przeniesienie będzie kosztować:

```
19 of 21 entries move to Personal
✓ 15 arrive with everything they carry
! 4 lose their reminders
⨯ 2 repeat and stay here
```

Podsumowanie zależy od tego, co może przechowywać kalendarz docelowy, więc dla kalendarza CalDAV wygląda inaczej niż dla widoku Notion. Wpisy, których kalendarz docelowy w ogóle nie przyjmie, na przykład wpis cykliczny przenoszony do Notion, zostają na miejscu i są wymienione z nazwy.

**Zamiast tego skopiuj** zostawia oryginały na miejscu i umieszcza kopię każdego wpisu w kalendarzu docelowym. W ten sposób możesz też wydobyć wpisy z kalendarza tylko do odczytu, na przykład z subskrypcji: można z niego kopiować, ale nie można z niego niczego przenieść.

Powiązania między przenoszonymi wpisami przenoszą się razem z nimi, nawet do Notion, które nadaje każdej stronie nowy identyfikator. Powiązania wpisów, które zostają na miejscu, nadal wskazują przeniesione wpisy.

Jeśli kalendarz docelowy nie obsługuje powtarzania, Mitra zapyta, co zrobić z wpisami cyklicznymi: zostawić je na miejscu albo rozbić na pojedyncze wpisy, po jednym na każde wystąpienie w nadchodzącym roku, które już się nie powtarzają. Nigdy nie rozbija ich bez pytania.

> [!NOTE]
> Mitra najpierw kopiuje, a oryginały usuwa dopiero wtedy, gdy kopie są już na miejscu. Między dwoma dostawcami nie da się niczego cofnąć, więc ta kolejność jest zabezpieczeniem: jeśli coś pójdzie nie tak, wpis może się znaleźć w obu kalendarzach, ale nigdy nie zniknie. Jeśli kopiowanie się nie powiedzie, całe przenoszenie zostaje przerwane i nic nie zostaje usunięte.

### Przenieś pojedynczy wpis

Aby przenieść jeden wpis, otwórz go i wybierz w edytorze inny kalendarz. W przypadku wpisu cyklicznego Mitra zapyta, o które wystąpienia chodzi. **Ten wpis** przenosi samo to wystąpienie, **Ten i następne wpisy** przenosi resztę serii, a wcześniejsze wystąpienia zostawia na miejscu, natomiast **Wszystkie wpisy** przenosi całą serię razem z regułą powtarzania.

## Kalendarze tylko do odczytu

Niektórych kalendarzy nie można zmieniać z poziomu aplikacji Mitra: to [subskrypcje kalendarzy](integrations/subscriptions.md) i kalendarze udostępnione ci tylko do wglądu. Mitra sama to rozpoznaje i oznacza je jako tylko do odczytu.

Możesz otwierać ich wpisy oraz czytać, zaznaczać i kopiować całą ich treść, ale nie możesz w nich tworzyć, zmieniać, przenosić ani usuwać wpisów, nie da się też przenieść do nich żadnego wpisu. Zmiana nazwy, koloru i kolejności oraz ukrywanie nadal działają, bo dotyczą tylko twojego widoku kalendarza. Jeśli właściciel pozwoli ci później wprowadzać zmiany, Mitra zauważy to przy następnej synchronizacji.

## Zaimportuj kalendarz ponownie

Polecenie **Importuj wpisy ponownie** w menu **⋯** kalendarza lub całego konta odrzuca kopię wpisów przechowywaną w aplikacji Mitra i importuje je od nowa od dostawcy. U dostawcy nic się nie zmienia. Na co dzień nie powinno być potrzebne, bo [synchronizacja](integrations/README.md#how-syncing-works) dba o wszystko sama. Przydaje się, gdy po aktualizacji kalendarz wygląda nieprawidłowo lub jest nieaktualny. Kalendarze Mitra go nie mają, bo nie ma dostawcy, od którego można by importować.
