---
title: Przypomnienia
description: Dodawaj przypomnienia do wydarzeń i zadań, wybierz przypomnienia, z którymi powstają nowe wpisy, i zarządzaj urządzeniami, na które trafiają.
---

Przypomnienie z wyprzedzeniem informuje cię o wydarzeniu lub zadaniu za pomocą powiadomienia systemowego, nawet gdy aplikacja Mitra nie jest otwarta. Wysyła je twój własny serwer Mitra, więc nie musisz zakładać konta w żadnej innej usłudze. Na iPhonie i iPadzie przypomnienia działają tylko po [zainstalowaniu aplikacji Mitra](install-app.md), a wszędzie indziej wystarczy przeglądarka.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/notifications-detail-dark.webp">
  <img src="../assets/screenshots/notifications-detail-light.webp" alt="Strona ustawień Powiadomienia z domyślnymi przypomnieniami, uprawnieniem przeglądarki i listą urządzeń" />
</picture>

## Dodawanie przypomnienia

Otwórz wpis i naciśnij **＋** w wierszu przypomnień, tym z dzwonkiem. Wybierz, kiedy przypomnienie ma się pojawić: **Na początku wydarzenia** (w przypadku zadania **O godzinie zadania**), 5 lub 10 minut, pół godziny, godzinę albo dzień wcześniej lub **Niestandardowe…**, aby ustawić dowolny inny czas. Wpis może mieć kilka przypomnień, a **✕** obok przypomnienia je usuwa.

Przypomnienie jest liczone wstecz od początku wpisu, a w przypadku zadania bez początku od jego terminu. Gdy dodasz pierwsze przypomnienie, przeglądarka zapyta, czy aplikacja Mitra może wyświetlać powiadomienia. Jeśli odmówisz, przypomnienie i tak zostanie zapisane we wpisie.

Wpis cykliczny przypomina o każdym wystąpieniu. Zadania oznaczone jako gotowe lub anulowane nie wysyłają przypomnień, ale ukryty kalendarz nadal je wysyła: aby go wyciszyć, wyłącz go w menu **⋯ → Edytuj** jego konta. Kalendarze [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) i [Tempo](integrations/tempo.md) nie obsługują przypomnień.

## Domyślne przypomnienia

Na stronie **Ustawienia → Powiadomienia** ustawisz przypomnienia, z którymi powstaje każdy nowy wpis: 30 minut wcześniej w przypadku wydarzenia i o godzinie zadania w przypadku zadania, chyba że je zmienisz albo wybierzesz **Brak**. Wpisy całodniowe powstają bez przypomnień.

## Gdy nadejdzie przypomnienie

Powiadomienie pokazuje tytuł wpisu, jego czas i lokalizację, w języku i strefie czasowej urządzenia. Pozostaje na ekranie, dopóki go nie zamkniesz, a stuknięcie powiadomienia otwiera wpis. Przycisk **Przypomnij za 10 min** pokaże je ponownie później, a w przypadku zadania przycisk **Gotowe** oznacza zadanie jako gotowe bez otwierania aplikacji Mitra. Safari i Firefox nie pokazują tych przycisków.

Jeśli urządzenie było offline, gdy wysłano przypomnienie, odrzuci je pięć minut po początku wpisu, zamiast pokazać je z opóźnieniem.

## Twoje urządzenia

Każda przeglądarka lub zainstalowana aplikacja, w której zezwolisz na powiadomienia, to osobne urządzenie, a każde urządzenie dostaje wszystkie twoje przypomnienia. Ich listę znajdziesz na stronie **Ustawienia → Powiadomienia**, a urządzenie, którego właśnie używasz, jest na niej oznaczone jako **to urządzenie**. Ołówkiem zmienisz nazwę urządzenia, przyciskiem **✕** je usuniesz, a przyciskiem **Wydarzenie testowe** lub **Zadanie testowe** wyślesz sobie przykładowe powiadomienie.

## Rozwiązywanie problemów

- Jeśli przypomnienie nie dociera, wyślij **Wydarzenie testowe**. Jeśli test dotrze, wpis jest prawdopodobnie w wyłączonym kalendarzu. Zgodę na powiadomienia daje się osobno w każdej przeglądarce i dla każdego adresu, więc zgoda dla aplikacji Mitra pod jednym adresem nie obejmuje innego.
- Jeśli na stronie **Ustawienia → Powiadomienia** nie ma wiersza **Powiadomienia o przypomnieniach**, ta przeglądarka nie może odbierać powiadomień z aplikacji Mitra. Na iPhonie lub iPadzie otwórz [zainstalowaną aplikację](install-app.md) zamiast Safari, a w pozostałych przypadkach aplikacja Mitra musi być dostępna przez HTTPS.
- Jeśli w wierszu widnieje **Zablokowane**, zezwól aplikacji Mitra na powiadomienia w ustawieniach witryny w przeglądarce.
- Jeśli w systemie Windows nic nie dociera, gdy Chrome jest zamknięty, włącz w ustawieniach Chrome opcję **Kontynuuj działanie aplikacji w tle po zamknięciu Google Chrome** albo zainstaluj aplikację Mitra z przeglądarki Edge.

## Na serwerze

Przypomnienia nie wymagają żadnej konfiguracji poza [HTTPS](configuration.md#put-it-behind-https). Mitra podpisuje powiadomienia kluczem, który tworzy przy pierwszym uruchomieniu i przechowuje w bazie danych, dlatego przywracaj folder danych z [kopii zapasowych](backups.md) w całości. Przy nowej bazie danych Mitra utworzy nowy klucz, a urządzenia zarejestrowane ze starym przestaną dostawać przypomnienia. Każde wysłane przypomnienie trafia do [logów](logging.md).
