---
title: Uczestnicy
description: "Dodawaj osoby związane z wpisem i śledź ich odpowiedzi. To, czy dostaną zaproszenie, zależy od kalendarza."
---

Wpis może mieć **uczestników**, czyli osoby, których dotyczy. Mitra zapisuje ich razem z wpisem w standardowym formacie kalendarza, więc każda inna aplikacja korzystająca z tego samego kalendarza widzi tę samą listę, a odpowiedzi udzielone w Kalendarzu Apple, Thunderbirdzie czy poczcie internetowej pojawiają się także w aplikacji Mitra.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/participants-detail-dark.webp">
  <img src="../assets/screenshots/participants-detail-light.webp" alt="Wpis z trzema uczestnikami, których odpowiedzi widać jako plakietki na ich awatarach" />
</picture>

## Kto wysyła zaproszenia

Mitra nigdy sama nie wysyła e-maili. To, co się dzieje po dodaniu osoby, zależy od kalendarza, w którym jest wpis.

Gdy wpis jest w kalendarzu z [serwera kalendarzy](integrations/caldav.md), [Kalendarza Google](integrations/google.md) lub [Kalendarza Apple](integrations/apple.md), wysyłką zajmuje się ten serwer: wysyła zaproszenie, aktualizację, gdy wpis się zmieni, i odwołanie, gdy kogoś usuniesz albo usuniesz wpis. Zbiera też odpowiedzi i właśnie tą drogą trafiają one do aplikacji Mitra. Robi tak większość serwerów, w tym Google, iCloud, Nextcloud, Fastmail, mailbox.org i Zimbra. Serwer, który tylko przechowuje kalendarze, niczego nie wysyła, więc nikt nie dowie się o wpisie, a wszystkie odpowiedzi pozostaną oczekujące.

W [kalendarzu przechowywanym w aplikacji Mitra](integrations/mitra.md) za kalendarzem nie stoi żaden serwer, więc lista jest tylko zapisem tego, kogo dotyczy wpis. Nikt nie dostaje zaproszenia i nie przychodzą żadne odpowiedzi.

Kalendarze [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) i [Tempo](integrations/tempo.md) nie mogą przechowywać uczestników, więc ich wpisy nie mają wiersza uczestników. W [subskrypcji kalendarza](integrations/subscriptions.md) widzisz uczestników, ale nie możesz ich zmieniać, bo kalendarz jest tylko do odczytu.

## Dodaj osoby

Otwórz wpis, wpisz adres e-mail w polu **Dodaj uczestników** i naciśnij Enter. Możesz dodać kilka osób naraz, oddzielając adresy przecinkami, średnikami lub spacjami. Aby dodać kolejne osoby później, naciśnij **＋** obok liczby uczestników.

W kalendarzu powiązanym z kontem po dodaniu pierwszej osoby stajesz się **organizatorem**: twój własny adres trafia na listę z oznaczeniem **Organizator** i z przyjętym zaproszeniem. Kalendarz przechowywany w aplikacji Mitra nie ma twojego adresu, którego mógłby użyć, więc jego listy nie mają organizatora.

Przy każdej osobie widać jej inicjał, adres e-mail, imię i nazwisko, jeśli kalendarz je zna, oraz oznaczenie **Organizator** lub **Opcjonalnie**, jeśli ma zastosowanie. Adresy e-mail można zaznaczać, więc pojedynczy adres skopiujesz prosto z jego wiersza. Gdy na liście jest więcej niż pięć osób, widać pierwsze cztery, a pozostałe są zwinięte za wierszem „jeszcze …”.

Wskaż osobę, aby ją zmienić. Jeden przycisk oznacza jej obecność jako opcjonalną albo z powrotem jako wymaganą, a **✕** usuwa ją z listy. Na ekranie dotykowym te przyciski są zawsze widoczne.

## Odpowiedzi

Plakietka na inicjale każdej osoby pokazuje jej odpowiedź: zielony znacznik oznacza akceptację, czerwony krzyżyk odmowę, a żółta kreska odpowiedź „może”. Brak plakietki oznacza, że osoba jeszcze nie odpowiedziała. Wiersz pod liczbą uczestników podsumowuje odpowiedzi, na przykład „2 tak, 1 nie i 3 bez odpowiedzi”.

Odpowiedzi docierają do aplikacji Mitra przez serwer kalendarzy, więc nowa odpowiedź pojawia się przy następnej synchronizacji, a nie od razu.

Mitra pokazuje odpowiedzi wszystkich, ale nie wysyła twojej. Aby przyjąć lub odrzucić zaproszenie wysłane przez kogoś innego, odpowiedz w aplikacji pocztowej albo w innej aplikacji kalendarza, a twoja odpowiedź zsynchronizuje się z powrotem z aplikacją Mitra.

## Działaj na wszystkich naraz

Menu **⋯** obok liczby uczestników działa na całej liście:

- **Wyślij e-mail do uczestników** otwiera aplikację pocztową z wiadomością do wszystkich pozostałych osób.
- **Kopiuj adresy e-mail uczestników** kopiuje wszystkie adresy.
- **Oznacz wszystkich jako wymaganych** i **Oznacz wszystkich jako opcjonalnych** zmieniają rolę wszystkich naraz.
- **Usuń wszystkich** opróżnia listę.

## Tylko organizator zmienia listę

We wpisie zorganizowanym przez kogoś innego nie możesz dodawać, usuwać ani zmieniać osób: przycisk **＋** jest ukryty, a menu pozwala tylko wysłać e-mail i skopiować adresy. Tak stanowi standard planowania spotkań, którego przestrzegają aplikacje kalendarza, a serwer Mitra również odrzuca takie zmiany. Nadal możesz edytować resztę wpisu, na przykład tytuł, godzinę i opis.

> [!CAUTION]
> Przeniesienie wpisu z uczestnikami do innego kalendarza usuwa go z pierwszego, a niektóre serwery informują wtedy uczestników, że wpis został odwołany. Jeśli nie powinni się o tym dowiedzieć, [skopiuj go](calendars.md#move-or-copy-every-entry-to-another-calendar) zamiast przenosić.

## Rozwiązywanie problemów

- Jeśli wszyscy wciąż mają status oczekujący i nie dotarło żadne zaproszenie, wpis jest w kalendarzu przechowywanym w aplikacji Mitra albo jego serwer kalendarzy nie wysyła zaproszeń. Aby sprawdzić serwer, zaproś te same osoby z własnej aplikacji dostawcy.
- Jeśli odpowiedź przyszła, ale plakietka się nie zmieniła, poczekaj na następną synchronizację aplikacji Mitra, bo odpowiedzi docierają przez serwer kalendarzy.
- Jeśli nie da się dodać osób, wpis organizuje ktoś inny albo kalendarz jest tylko do odczytu.
- Jeśli wpis nie ma wiersza uczestników, jego kalendarz nie może ich przechowywać, tak jak w Notion, Todoist i Tempo.
- Jeśli na liście brakuje sali konferencyjnej, to celowe: sale i sprzęt to nie osoby, więc Mitra je pomija.
