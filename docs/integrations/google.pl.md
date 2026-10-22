---
title: Kalendarz Google
description: Raz skonfiguruj logowanie przez Google na swoim serwerze Mitra, a potem łącz konta Google z poziomu aplikacji i synchronizuj ich kalendarze w obie strony.
---

Mitra łączy się z Kalendarzem Google przez CalDAV, tak samo jak z każdym innym serwerem kalendarzy. Różnica tkwi w logowaniu: Google nie przyjmuje hasła, tylko prosi o udzielenie dostępu na własnej stronie. Do tego Google musi znać twój serwer Mitra, więc osoba, która go prowadzi, rejestruje go raz w Google i przekazuje aplikacji Mitra identyfikator klienta i klucz tajny wydane przez Google.

Potem każdy użytkownik aplikacji Mitra łączy w niej swoje konto Google i sam udziela dostępu. Konfiguracja składa się z trzech kroków:

1. [Zarejestruj aplikację Mitra w Google](#register-mitra-with-google).
2. [Przekaż aplikacji Mitra identyfikator klienta i klucz tajny](#give-mitra-the-client-id-and-secret).
3. [Połącz konto](#connect-an-account).

Pierwsze dwa kroki wykonujesz raz dla każdego serwera Mitra.

## Zarejestruj aplikację Mitra w Google

1. Utwórz projekt w [Google Cloud console](https://console.cloud.google.com) i w sekcji **APIs & Services** włącz **CalDAV API**.
2. Skonfiguruj **OAuth consent screen**. Dodaj siebie i wszystkie inne osoby, które będą łączyć konto, jako **test user** albo opublikuj aplikację.
3. Utwórz **OAuth client** typu **Web application**. Jako **authorized redirect URI** wpisz adres swojego serwera Mitra, a po nim `/api/integrations/google/callback`:

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Skopiuj **client ID** i **client secret**, które pokaże ci Google.

> [!CAUTION]
> Dopóki ekran zgody jest w trybie testowym, Google unieważnia każdy udzielony dostęp po 7 dniach i wszyscy muszą co tydzień ponownie łączyć swoje konta. Opublikuj aplikację, aby dostęp pozostał na stałe.

## Przekaż aplikacji Mitra identyfikator klienta i klucz tajny

Ustaw je jako zmienne środowiskowe, razem z `MITRA_URL`, czyli adresem twojego serwera:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'
    # …
```

Następnie uruchom ponownie aplikację Mitra:

```bash
docker compose up -d
```

Ustaw obie zmienne albo żadnej. Mitra nie uruchomi się z identyfikatorem klienta bez klucza tajnego, więc niedokończona konfiguracja nigdy nie przejdzie niezauważona.

`MITRA_URL` musi się zgadzać z adresem w identyfikatorze URI przekierowania. Bez tej zmiennej Mitra używa adresu, pod którym ją otworzono, co wystarcza, aby wypróbować ją na `localhost`. Poza `localhost` Google akceptuje tylko adresy przekierowania zaczynające się od `https://`, więc prawdziwy serwer potrzebuje [HTTPS](../configuration.md#put-it-behind-https) i zmiennej `MITRA_URL`. Wszystkie zmienne znajdziesz w sekcji [Konfiguracja](../configuration.md#all-variables).

## Połącz konto

1. Wybierz **Dodaj integrację** u dołu panelu bocznego, a potem **Kalendarz Google**.
2. Naciśnij **Kontynuuj z Google**. Google poprosi cię o wybranie konta i zezwolenie aplikacji Mitra na wyświetlanie i zmienianie twoich kalendarzy.
3. Po powrocie do aplikacji Mitra zobaczysz listę kalendarzy z tego konta, wszystkie włączone. Wyłącz te, których nie chcesz, i naciśnij **Zapisz**.

Ponowne połączenie tego samego konta Google odnawia udzielony dostęp, zamiast dodawać konto drugi raz.

Google ogranicza, jak często aplikacje mogą się z nim komunikować, dlatego Mitra synchronizuje konta Google mniej więcej raz na minutę (zobacz, [jak działa synchronizacja](README.md#how-syncing-works)).

## Kalendarze udostępnione przez innych

Kalendarze, których jesteś właścicielem, pojawiają się od razu po połączeniu. Kalendarze, które udostępnili ci inni, na przykład kalendarz zespołu albo współpracownika, trafiają do innych aplikacji dopiero wtedy, gdy zezwolisz na to w ustawieniach Google:

1. Zaloguj się w Google i otwórz [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect).
2. W sekcji **Shared Calendars** zaznacz każdy kalendarz, który chcesz mieć w aplikacji Mitra, i naciśnij **Save**.
3. W aplikacji Mitra otwórz menu **⋯** konta w panelu bocznym, wybierz **Edytuj** i naciśnij **Odśwież**.
4. Włącz kalendarze, które się pojawią, i naciśnij **Zapisz**.

Kalendarz udostępniony ci z uprawnieniem **See all event details** jest w aplikacji Mitra tylko do odczytu: widzisz w nim wszystko, ale nie możesz dodawać, zmieniać ani usuwać wydarzeń. Jeśli właściciel nada ci później uprawnienie **Make changes to events**, edycja włączy się przy następnej synchronizacji. Zobacz [Kalendarze tylko do odczytu](../calendars.md#read-only-calendars).

## Co jest synchronizowane

Wszystko synchronizuje się tak samo jak w przypadku [CalDAV](caldav.md#what-syncs), z wyjątkiem powiązań między wpisami. Google usuwa je ze swojej kopii wydarzenia, dlatego Mitra nie oferuje ich w kalendarzach Google.

[Załączniki](../attachments.md) w kalendarzu Google to pliki z Dysku Google, które dołączasz w aplikacji Kalendarz Google. Mitra je pokazuje i każdy otwiera na Dysku, ale nie może ich dodawać ani usuwać: Google przechowuje tylko pliki z Dysku i odrzuca załączniki dodane przez inne aplikacje.

[Dostępność](../availability.md) oznaczona jako zajęta w kalendarzu Google trafia do tego kalendarza jako wydarzenia z ustawieniem „zajęty”, więc inni widzą, że ten czas jest zajęty. Działa to tak, jak opisano dla [CalDAV](caldav.md#busy-availability).

## Twój token Google

Token wydany przez Google nigdy nie opuszcza serwera. Twoja przeglądarka tylko przechodzi przez stronę Google, aby udzielić dostępu. Mitra przechowuje token razem z kontem i przy każdej synchronizacji używa go do uzyskania krótkotrwałego dostępu.

## Odłącz konto

Wybierz **Usuń** w menu **⋯** konta, aby usunąć je z aplikacji Mitra razem z tokenem. Aby odebrać aplikacji Mitra dostęp także po stronie Google, usuń ją z listy [połączeń z aplikacjami innych firm na swoim koncie Google](https://myaccount.google.com/permissions). Już samo to zatrzymuje synchronizację: konto zostaje w aplikacji Mitra, ale każda synchronizacja kończy się błędem, dopóki nie połączysz go ponownie.

## Rozwiązywanie problemów

- Jeśli po wybraniu **Kalendarz Google** zamiast przycisku **Kontynuuj z Google** pojawia się informacja, że integracja nie jest skonfigurowana na tym serwerze, oznacza to, że zmienne `MITRA_GOOGLE_CLIENT_ID` i `MITRA_GOOGLE_CLIENT_SECRET` nie są ustawione albo Mitra nie została uruchomiona ponownie od czasu ich ustawienia.
- Jeśli Google odpowiada błędem `redirect_uri_mismatch`, identyfikator URI przekierowania w Google Cloud console nie zgadza się z wartością `MITRA_URL`, po której następuje `/api/integrations/google/callback`. Musi się zgadzać dokładnie, łącznie z `https://` i bez ukośnika na końcu.
- Jeśli konta przestają się synchronizować po 7 dniach, twój ekran zgody jest wciąż w trybie testowym. Opublikuj aplikację, a potem ponownie połącz konta.
