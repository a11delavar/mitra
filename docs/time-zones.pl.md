---
title: Strefy czasowe
description: Jak Mitra pokazuje własną strefę czasową wpisu i jak dodać do widoku tygodnia godziny w innych strefach czasowych.
---

Mitra pokazuje godziny w twojej strefie czasowej, czyli tej, która jest ustawiona na twoim urządzeniu. Gdy podróżujesz i urządzenie zmienia strefę, Mitra robi to samo. W edytorze ta strefa nazywa się **bieżącą** strefą czasową. Twoja strefa **domowa** to ta, do której należysz. Podczas podróży pozostaje widoczna obok bieżącej.

Wpis może też mieć własną strefę czasową, jak lot z Nowego Jorku o 9:00. A widok tygodnia potrafi pokazać obok twoich godzin godziny w innych strefach czasowych.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zone-detail-dark.webp">
  <img src="../assets/screenshots/time-zone-detail-light.webp" alt="Edytor nowego wpisu ze strefą czasową GMT+1 Lizbona, pokazujący 11:00 w Lizbonie, podczas gdy w tle, w berlińskim tygodniu, wpis stoi o 12:00" />
</picture>

## Strefa czasowa wpisu

Każdy wpis z godzinami ma strefę czasową. Wpisy, które tworzysz, dostają twoją, a wpisy z innych aplikacji zachowują strefę, w której je utworzono.

Otwórz wpis, a jego strefę zobaczysz w wierszu z globusem pod datami, zapisaną jako przesunięcie i miasto, na przykład „GMT-4 Nowy Jork”. Wpisy całodniowe nie mają strefy czasowej ani takiego wiersza, bo dla każdego obejmują te same dni.

### Zmień strefę czasową wpisu

Kliknij strefę i wybierz inną. Lista zaczyna się od stref kraju wybranego w ustawieniu [języka](settings.md#general), a dalej zawiera wszystkie strefy. Twoją strefę domową oznacza domek, a bieżącą, gdy jesteś poza domem, pinezka. Strefy, które przez cały rok mają tę samą nazwę i ten sam czas, dzielą jeden wiersz, reprezentowany przez jedno z ich miast: miasto twojej strefy albo twojego kraju, jeśli takie jest, na przykład czas środkowoeuropejski dla Berlina w Niemczech. Strzałka na końcu wiersza rozwija pozostałe miasta, na przykład Paryż i Amsterdam, a wyszukiwanie rozwija wiersze, w których coś znajdzie. Aby znaleźć strefę, wpisz miasto, kraj, nazwę strefy albo przesunięcie.

Wpis zachowuje w nowej strefie swoje godziny na zegarze: spotkanie o 9:00 w Berlinie staje się spotkaniem o 9:00 w Nowym Jorku. Jeśli błędna była tylko strefa, a samo spotkanie się nie przesunęło, popraw potem jego godziny.

### Twój czas czy czas wpisu

Gdy strefa wpisu różni się od twojej, edytor pokazuje jego godziny w twojej strefie, więc spotkanie o 9:00 w Nowym Jorku wyświetla się jako 15:00, jeśli jesteś w Berlinie. Przycisk obok strefy przełącza na czas wpisu i z powrotem. Gdy widzisz swój czas, przycisk pokazuje pinezkę, a gdy czas wpisu, globus. Po najechaniu na niego dowiesz się, na który czas patrzysz.

Godziny możesz edytować w obu trybach. Aby zmienić samą strefę, najpierw przełącz na czas wpisu.

### Wszędzie ta sama godzina

Niektóre wpisy trafiają z innych aplikacji bez żadnej strefy czasowej i mają ustawienie **Wszędzie ta sama godzina**. Ich godziny nie są przypisane do żadnego miejsca: budzik o 7:00 ma zadzwonić o 7:00 wszędzie, gdzie jesteś, i edytor pokazuje go o 7:00 w każdej strefie czasowej. Przypomnienia takiego wpisu włączają się o tej godzinie na zegarze każdego urządzenia.

Wybranie strefy dla takiego wpisu przypisuje mu tę strefę i zachowuje jego godziny. W kalendarzu, który przechowuje takie godziny, może je mieć każdy wpis: wybierz **Wszędzie ta sama godzina** na początku listy, a jego godziny również się nie zmienią.

### Które kalendarze to obsługują

- **Kalendarze przechowywane w aplikacji Mitra**, [serwery kalendarzy](integrations/caldav.md) i [Kalendarz Google](integrations/google.md) zachowują strefę czasową każdego wpisu, a inne aplikacje ją widzą. Kalendarze Mitra i serwery kalendarzy przechowują też godziny, które są wszędzie takie same. Kalendarz Google tego nie potrafi, więc przeniesienie tam takiego wpisu przypisuje mu stałą strefę.
- **[Notion](integrations/notion.md)** nie ma stref czasowych. Godziny wyświetlają się w twojej strefie, a edytor nie ma wiersza strefy czasowej.
- **[Todoist](integrations/todoist.md)** zachowuje strefę czasową każdego zadania, a godziny, które Todoist nazywa pływającymi, pozostają [wszędzie takie same](#same-time-everywhere).
- **[Tempo](integrations/tempo.md)** odczytuje wpisy z dziennika pracy w strefie czasowej ustawionej w twoim profilu Jira, a edytor również nie ma wiersza strefy czasowej.
- **[Subskrypcje](integrations/subscriptions.md)** są tylko do odczytu: widzisz strefę wpisu i możesz przełączać się między oboma czasami, ale nie możesz jej zmienić.

## Strefy czasowe w widoku tygodnia

[Widok tygodnia](views/week.md) może pokazywać godziny innych stref czasowych w kolumnach obok twojej, dzięki czemu przy każdej godzinie twojego dnia widzisz, która jest tam.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/time-zones-detail-dark.webp">
  <img src="../assets/screenshots/time-zones-detail-light.webp" alt="Widok tygodnia z kolumną EDT z godzinami Nowego Jorku obok kolumny GMT+2, w której 07:00 w Berlinie odpowiada 01:00 w Nowym Jorku" />
</picture>

### Dodaj strefę czasową do tygodnia

Najedź na górę kolumny godzin i naciśnij **＋** (**Dodaj strefę czasową**). Lista ma zaznaczone strefy, które już masz, z domkiem przy strefie domowej i pinezką przy bieżącej, gdy jesteś poza domem. Wybierz strefę, aby dodać jej kolumnę, albo zaznaczoną strefę, aby kolumnę usunąć. Lista pozostaje otwarta, więc możesz wybrać kolejne. Bieżąca strefa zawsze jest kolumną najbliżej dni i strefa domowa również zostaje.

Nad każdą kolumną widnieje krótka nazwa: skrót, którym zwykle się tę strefę określa, na przykład „PDT” albo „BST”, a jeśli żaden nie jest w użyciu, jej miejsce, na przykład „Iran”. Skrót zależy od twojego [języka](settings.md#general): Berlin to „CEST” po angielsku i „MESZ” po niemiecku, a jeśli w twoim regionie dana strefa nie ma skrótu, używany jest skrót z jej własnego regionu. Najedź na nazwę, aby zobaczyć pełną.

### Zmień nazwę strefy czasowej lub ją usuń

Kliknij nazwę strefy i wybierz **Zmień nazwę**, aby nadać jej własną etykietę, na przykład „Mama”, **Ustaw jako strefę domową**, aby uczynić ją swoją strefą domową, albo **Usuń**, aby usunąć jej kolumnę. Aby wrócić do automatycznej nazwy, usuń całą nazwę przy jej zmianie.

Bieżącej i domowej strefie możesz zmienić nazwę, ale nie możesz ich usunąć. Aby zastąpić strefę domową, ustaw jako domową inną strefę.

### Zwiń dodatkowe kolumny

Dodatkowe kolumny zabierają miejsce dniom. Aby je ukryć, najedź na górę kolumny godzin i naciśnij strzałkę pod **＋**. Naciśnij ją ponownie, aby je pokazać. Kolumny możesz też rozwinąć, przeciągając kolumnę godzin w stronę dni, i zwinąć, przeciągając ją z powrotem. Tak robi się to na ekranie dotykowym.

Na wąskim ekranie kolumny są na początku zwinięte, dopóki ich ręcznie nie rozwiniesz lub nie zwiniesz. Dodanie strefy zawsze je rozwija.

### Na wszystkich urządzeniach

Strefa domowa, dodane strefy i wszystkie nadane im nazwy należą do twojego konta, więc widzisz je na każdym urządzeniu, z którego korzystasz. To, czy kolumny są zwinięte, zapisuje się osobno na każdym urządzeniu.

Strefą domową zostaje strefa pierwszego urządzenia, na którym otworzysz aplikację Mitra. W podróży strefa, w której jesteś, staje się kolumną najbliżej dni, a strefa domowa zostaje obok niej, bez dodawania czegokolwiek do twojej listy, więc po powrocie do domu znów jest jedna kolumna. Jeśli nadasz nazwę strefie, w której jesteś, zostanie ona na twojej liście. Jeśli się przeprowadzisz, wybierz **Ustaw jako strefę domową** przy strefie, w której teraz mieszkasz, a dawna strefa domowa zostanie jako kolumna, dopóki jej nie usuniesz.
