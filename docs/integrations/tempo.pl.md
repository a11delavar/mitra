---
title: Tempo
description: Zobacz w kalendarzu godziny zarejestrowane w Tempo, a także rejestruj, przesuwaj, skracaj, wydłużaj i usuwaj je z poziomu aplikacji Mitra.
---

[Tempo](https://www.tempo.io/) to aplikacja do śledzenia czasu pracy w Jira. Mitra pokazuje twoje **worklogi**, czyli godziny zarejestrowane w zgłoszeniach Jira, jako wpisy z godziną w kalendarzu, obok spotkań i zadań, na które ten czas poszedł.

Worklogi synchronizują się w obie strony. Przesuń wpis albo zmień jego rozmiar, aby zmienić godzinę i czas pracy. Zmień opis, aby zmienić notatkę worklogu. Usuń wpis, aby usunąć worklog, albo utwórz nowy, aby zarejestrować kolejny czas.

Łączysz się z poziomu aplikacji za pomocą dwóch tokenów API. Na serwerze nie trzeba niczego konfigurować.

## Połącz swoją kartę czasu pracy

Mitra potrzebuje tokenu z Tempo i tokenu z Atlassian: Tempo przechowuje godziny, a Jira zna zgłoszenia i wie, kim jesteś.

1. Utwórz token API Tempo. W Jira otwórz **Settings** w Tempo (ikona koła zębatego) → **Data Access** → **API integration**, wybierz **New Token**, nazwij go „Mitra” i skopiuj token.
2. Utwórz token API Atlassian na stronie [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens), klikając **Create API token**, i skopiuj go. Oba tokeny utwórz jako ten sam użytkownik Jira.
3. W aplikacji Mitra wybierz **Dodaj integrację** u dołu panelu bocznego, a potem **Tempo**, i wypełnij pola:
   - **Adres URL witryny**: twój adres Atlassian, na przykład `https://your-company.atlassian.net`.
   - **Token API Tempo**: token z kroku 1.
   - **E-mail konta Atlassian**: adres e-mail twojego konta Atlassian.
   - **Token API Atlassian**: token z kroku 2.
4. Naciśnij **Połącz**. Mitra wyświetli jeden kalendarz: **My worklogs**.
5. Pozostaw go włączony i naciśnij **Zapisz**.

Tempo ogranicza, jak często aplikacje mogą się z nim komunikować, dlatego Mitra synchronizuje go mniej więcej raz na minutę (zobacz, [jak działa synchronizacja](README.md#how-syncing-works)).

## Jak wyglądają worklogi

Tytułem wpisu jest zgłoszenie Jira, w którym zarejestrowano czas, czyli jego klucz i podsumowanie:

```text
ACME-1234 Code review for auth migration
```

Notatka worklogu to opis wpisu. Własna aplikacja Tempo pokazuje je tak samo, bo to zgłoszenie mówi, czego dotyczył czas, a notatka jest często tylko etykietą czynności, na przykład „Review”, albo tekstem, który Jira wpisała za ciebie, na przykład „Working on work item ACME-1234”.

Tytuł należy do zgłoszenia, więc w zapisanym worklogu nie można go edytować: Mitra nie zmienia nazwy zgłoszenia Jira tylko dlatego, że edytujesz wpis w kalendarzu. Aby opisać wykonaną pracę, edytuj opis. Jeśli Jira nie potrafi podać nazwy zgłoszenia, bo zostało usunięte albo nie masz już do niego dostępu, tytuł pokazuje `#` i identyfikator zgłoszenia, a wpis nadal działa.

Tempo zapisuje worklogi jako zwykłe godziny zegarowe, bez strefy czasowej. Mitra odczytuje je w strefie czasowej z twojego profilu Jira, więc wyświetla je o tych samych godzinach co Tempo.

Niektóre witryny Tempo mają wyłączone godziny rozpoczęcia. Wtedy wszystkie worklogi z danego dnia zaczynają się o tej samej godzinie, więc nakładają się na siebie, ale ich długość jest prawidłowa.

## Rejestruj czas z aplikacji Mitra

Utwórz wpis z godziną w kalendarzu **My worklogs** i umieść klucz zgłoszenia Jira w dowolnym miejscu jego tytułu:

| Wpisujesz | Czas trafia do |
| --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` |
| `Investigating ACME-1234 regression` | `ACME-1234` |
| `ACME-1234` | `ACME-1234` |

Mitra sprawdza klucz w projektach Jira, które widzisz. Jeśli w tytule nie ma takiego klucza albo Jira nie ma takiego zgłoszenia, Mitra niczego nie rejestruje i wyjaśnia dlaczego.

Notatką worklogu staje się treść opisu, a jeśli opis jest pusty, cały tytuł w takiej postaci, w jakiej go wpisano. Po zarejestrowaniu czasu tytuł zmienia się na klucz i podsumowanie zgłoszenia. Ta zamiana następuje tylko raz, przy rejestrowaniu, i dlatego tytuł można edytować w trakcie pisania, ale już nie później.

> [!TIP]
> Aby zarejestrować czas w zgłoszeniu, w którym już wcześniej był rejestrowany, zduplikuj jeden z jego wpisów: przytrzymaj <kbd>Alt</kbd> (<kbd>⌥</kbd> na Macu) i przeciągnij wpis na nową godzinę albo wybierz **Duplikuj** w menu **⋯** jego edytora.

## Zmień worklog

Przesunięcie, zmiana rozmiaru, usunięcie i edycja opisu trafiają prosto do Tempo. Warto wiedzieć kilka rzeczy:

- Worklog zostaje w swoim zgłoszeniu. Tempo nie potrafi przenieść worklogu do innego zgłoszenia, więc aby zarejestrować czas gdzie indziej, usuń wpis i utwórz nowy z właściwym kluczem.
- Przy zmianie worklogu Mitra zachowuje jego szczegóły, którymi zarządza Tempo, na przykład czas rozliczany (billable) i atrybuty pracy.
- Gdy okres karty czasu pracy zostanie w Tempo zamknięty lub zatwierdzony, Tempo nie pozwala dodawać, zmieniać ani usuwać w nim worklogów.

Aby otworzyć zgłoszenie w Jira, wybierz **Otwórz w aplikacji Jira** w menu **⋯** edytora.

## Czego worklog nie przechowuje

Worklog to odcinek czasu w jednym dniu, zarejestrowany w jednym zgłoszeniu. Dlatego kalendarz Tempo zawiera wyłącznie wpisy z godziną: nie ma w nim wpisów całodniowych, powtarzania, przypomnień, lokalizacji, uczestników, [załączników](../attachments.md), powiązań, ustawienia „zajęty lub wolny”, widoczności ani [dostępności](../availability.md). Mitra ukrywa te pola w worklogach.

## Rozwiązywanie problemów

- Jeśli Mitra wyświetla komunikat „Tempo rejected the API token”, utwórz nowy token API Tempo i wpisz go w **⋯ → Edytuj** przy koncie.
- Jeśli Mitra wyświetla komunikat „Jira rejected the e-mail and API token”, sprawdź, czy adres e-mail należy do konta Atlassian, na którym utworzono token API.
- Jeśli worklogi wyświetlają się o złej porze dnia, sprawdź strefę czasową w swoim profilu Jira (**Account settings** → **Time zone**). Po jej zmianie użyj polecenia **Importuj wpisy ponownie** w menu **⋯** kalendarza **My worklogs**, aby przesunęły się również worklogi, które już masz.
- Jeśli worklogi każdego dnia nakładają się na siebie o tej samej godzinie, twoja witryna Tempo ma wyłączone godziny rozpoczęcia. Liczba godzin nadal się zgadza.
