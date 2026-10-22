---
title: Konfiguracja
description: Jak skonfigurować aplikację Mitra zmiennymi środowiskowymi, które z nich są potrzebne na większości serwerów i jakie wartości domyślne mają wszystkie zmienne.
---

Aplikację Mitra konfiguruje się wyłącznie zmiennymi środowiskowymi. Nie ma pliku konfiguracyjnego do zamontowania: ustawiasz zmienne w kontenerze, a Mitra odczytuje je przy uruchomieniu. Każda zmienna jest opcjonalna, a te, których nie ustawisz, przyjmują wartości domyślne podane [niżej](#all-variables).

W Docker Compose zmienne trafiają do bloku `environment`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

Równie dobrze sprawdzi się plik `.env` albo sekrety Dockera, jeśli wolisz trzymać poufne dane poza plikiem Compose. Zmiana zaczyna działać przy następnym uruchomieniu aplikacji Mitra:

```bash
docker compose up -d
```

## Co trzeba skonfigurować na serwerze

Prawie nic. [Kalendarze Mitra](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Kalendarz Apple](integrations/apple.md), [subskrypcje kalendarzy](integrations/subscriptions.md), [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) i [Tempo](integrations/tempo.md) użytkownicy dodają sami, w aplikacji.

Dwie rzeczy wymagają danych uwierzytelniających, które trzeba najpierw zarejestrować u kogoś innego: [Kalendarz Google](integrations/google.md) (`MITRA_GOOGLE_*`) i [logowanie](sso.md) (`MITRA_OIDC_*`).

## Udostępnij aplikację przez HTTPS

Gdy tylko Mitra ma być dostępna z innych urządzeń niż twój komputer, umieść ją za odwrotnym serwerem proxy, takim jak Caddy, Traefik lub nginx, i powierz mu obsługę HTTPS. Sama Mitra mówi wewnątrz kontenera zwykłym HTTP. Niektóre funkcje działają tylko przez HTTPS:

- Przeglądarki pozwalają na [przypomnienia](reminders.md) i [instalowanie aplikacji](install-app.md) tylko pod adresami `https://` (oraz `http://localhost`).
- Pliki cookie [logowania](sso.md) są oznaczane jako bezpieczne tylko pod adresem `https://`, a większość dostawców tożsamości wymaga adresu przekierowania `https://`.
- [Kalendarz Google](integrations/google.md) wymaga adresu przekierowania `https://`.

Następnie ustaw w [`MITRA_URL`](#set-the-public-url) adres publiczny.

Z [Caddy](https://caddyserver.com/) wystarczy tyle:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

Z [Traefikiem](https://traefik.io/) kieruj ruch do aplikacji Mitra za pomocą etykiet usługi:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    volumes:
      - ~/mitra:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mitra.rule=Host(`mitra.example.com`)"
      - "traefik.http.services.mitra.loadbalancer.server.port=3000"
    environment:
      MITRA_URL: 'https://mitra.example.com'
```

## Ustaw publiczny adres URL

`MITRA_URL` to adres, który użytkownicy wpisują w przeglądarce, aby otworzyć aplikację Mitra, a nie wewnętrzny adres kontenera:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Na jego podstawie Mitra tworzy adresy zwrotne dla Kalendarza Google i logowania, a gdy zaczyna się od `https://`, oznacza swoje pliki cookie jako bezpieczne. Możesz go pominąć, dopóki testujesz aplikację Mitra pod adresem `http://localhost`. Ustaw go, gdy tylko Mitra dostanie prawdziwy adres. Bez niego nie włączysz logowania.

## Nazwij swoją instancję

`MITRA_NAME` zastępuje nazwę „Mitra” w panelu bocznym i na karcie przeglądarki:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

Kliknięcie nazwy otwiera okno **O aplikacji**, które pokazuje uruchomioną wersję i commit. [Zainstalowana aplikacja](install-app.md) zachowuje nazwę i ikonę „Mitra”, bo są one ustalane podczas budowania aplikacji.

## Wszystkie zmienne

### Podstawowe

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `MITRA_URL` | *(nieustawiona)* | [Publiczny adres](#set-the-public-url), pod którym użytkownicy otwierają aplikację Mitra, na przykład `https://mitra.example.com`. Wynikają z niego adresy zwrotne logowania i Kalendarza Google oraz to, czy pliki cookie są bezpieczne. Opcjonalna, dopóki testujesz aplikację Mitra na localhost, wymagana do [logowania](sso.md) i zalecana dla [Kalendarza Google](integrations/google.md) oraz każdego publicznego serwera. |
| `MITRA_NAME` | *(Mitra, w języku każdego użytkownika)* | [Nazwa](#name-your-instance) wyświetlana w panelu bocznym i na karcie przeglądarki. [Zainstalowana aplikacja](install-app.md) pozostaje „Mitra”. |
| `MITRA_PORT` | `3000` | Port, na którym nasłuchuje serwer. W Dockerze zmień raczej port po stronie hosta w mapowaniu portów; tę zmienną ustawiaj tylko wtedy, gdy sam proces musi nasłuchiwać na innym porcie. Wbudowana kontrola stanu się do niej dostosowuje. |
| `MITRA_LOG_LEVEL` | `info` | [Ile Mitra zapisuje w logach](logging.md): `error`, `warn`, `info`, `debug` lub `trace`. Każdy poziom obejmuje wszystko, co zapisują poziomy cichsze od niego. |
| `MITRA_UPDATE_CHECK` | *(włączone)* | Ustaw `off` (albo `false`, `0`, `no`), aby wyłączyć [sprawdzanie aktualizacji](updates.md). |
| `MITRA_MCP` | *(włączone)* | Ustaw `off` (albo `false`, `0`, `no`), aby zamknąć [adres, z którym łączą się narzędzia AI](ai-connectors.md). |

### Przypomnienia

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | Kontakt, który widzą usługi push przy [przypomnieniach](reminders.md) z twojego serwera, zwykle adres `mailto:`. Użytkownicy aplikacji Mitra go nie widzą. Klucze podpisu są generowane automatycznie, więc nic więcej nie trzeba ustawiać. |

### Lokalizacja

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | [Geokoder Photon](location.md), z którego korzysta pole lokalizacji. Możesz wskazać własną instancję Photon zamiast publicznej instancji komoot. |

### Załączniki

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `MITRA_FILE_MAX_SIZE` | `25M` | Największy plik, jaki można [załączyć](attachments.md) do wpisu, w bajtach albo z przyrostkiem `k`, `M` lub `G`. Ustaw `0`, aby wyłączyć dodawanie plików. |
| `MITRA_FILE_QUOTA` | *(nieustawiona)* | Ile łącznie każda osoba może przechowywać w załączonych plikach, zapisane w ten sam sposób. Bez niej nie ma limitu. |

### Kalendarz Google

Ustaw obie zmienne, aby użytkownicy mogli łączyć [Kalendarz Google](integrations/google.md). Jeśli ustawisz tylko identyfikator, Mitra się nie uruchomi.

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(nieustawiona)* | Identyfikator klienta OAuth z konsoli Google Cloud. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(nieustawiona)* | Tajny klucz klienta OAuth. Wymagany zawsze, gdy ustawiono `MITRA_GOOGLE_CLIENT_ID`. |

### Logowanie jednokrotne

Ustawienie `MITRA_OIDC_ISSUER` włącza [logowanie](sso.md). Jeśli brakuje zmiennych, których ono wymaga, Mitra odmawia uruchomienia.

| Zmienna | Domyślnie | Opis |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(nieustawiona)* | Adres URL wystawcy (issuer) twojego dostawcy OIDC. Wymaga `MITRA_OIDC_CLIENT_ID` i `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(nieustawiona)* | Identyfikator klienta zarejestrowanego u dostawcy. |
| `MITRA_OIDC_CLIENT_SECRET` | *(nieustawiona)* | Tajny klucz klienta. Pomiń go w przypadku klienta publicznego; Mitra zawsze używa PKCE. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Zakresy, o które prosi Mitra, rozdzielone spacjami. `openid` jest wymagany; `profile` i `email` przekazują aplikacji Mitra imię i nazwisko oraz adres e-mail każdego użytkownika. |

### Ustawiane przy budowaniu

Tych zmiennych nie ustawia się na serwerze. Ustawia je proces budowania lub obraz albo służą do pracy nad samą aplikacją Mitra.

| Zmienna | Ustawia | Opis |
| --- | --- | --- |
| `MITRA_VERSION` | Budowanie | Wersja wbudowana w obraz. |
| `MITRA_COMMIT` | Budowanie | Commit wbudowany w obraz. |
| `MITRA_DEV` | Środowisko deweloperskie | Udostępnia integrację **Demo**, czyli zestaw przykładowych kalendarzy, podczas pracy nad aplikacją Mitra. |
| `NODE_ENV` | Obraz | `production` w obrazie kontenera. |

### Przykład

Serwer z logowaniem, Kalendarzem Google i własnym geokoderem:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'

      # Sign-in
      MITRA_OIDC_ISSUER: 'https://auth.example.com'
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'

      # Google Calendar
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'

      # Your own geocoder
      MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```
