---
title: Logowanie jednokrotne
description: Dziel jeden serwer Mitra z rodziną lub zespołem. Każdy loguje się przez dostawcę OpenID Connect kontem, które już ma.
---

Domyślnie Mitra jest przeznaczona dla jednej osoby i nie ma logowania, co wystarcza, dopóki tylko ty masz do niej dostęp. Aby dzielić jeden serwer z rodziną lub zespołem, połącz go z dostawcą OpenID Connect (OIDC). Wtedy każdy loguje się kontem, które już ma, i dostaje własne kalendarze, których nikt inny nie widzi.

Mitra współpracuje z każdym standardowym dostawcą OIDC. Użytkownicy łączą ją między innymi z takimi dostawcami jak Pocket ID, Authelia, Authentik, Keycloak i Google.

> [!CAUTION]
> Włączenie logowania daje każdej osobie nowe, puste konto, także tobie. Wszystko, co skonfigurowano, gdy Mitra służyła jednej osobie, zostaje przy tamtym starym koncie i nie zostanie przeniesione: połączone konta, ustawienia i wszystkie wpisy w [kalendarzach przechowywanych w aplikacji Mitra](integrations/mitra.md). Połączone konta można szybko dodać ponownie, ale wpisy z kalendarzy przechowywanych w aplikacji Mitra nie przejdą razem z tobą. Włącz logowanie, zanim zaczniesz wypełniać aplikację Mitra, albo najpierw przenieś te wpisy do połączonego kalendarza (**Przenieś wpisy do…** w menu **⋯** kalendarza), a potem ponownie połącz to konto.

## Włącz logowanie

Ustaw zmienne OIDC w kontenerze:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'          # the address people use to reach Mitra
      MITRA_OIDC_ISSUER: 'https://auth.example.com'   # your provider's issuer URL
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'                   # leave out for a public client
```

U swojego dostawcy zarejestruj jako adres przekierowania wartość `MITRA_URL`, a po niej `/auth/callback`:

```text
https://mitra.example.com/auth/callback
```

To wszystko, czego potrzebuje dostawca. Uruchom ponownie aplikację Mitra poleceniem `docker compose up -d`, a poprosi ona wszystkich o zalogowanie się.

Logowanie włącza się przez ustawienie zmiennej `MITRA_OIDC_ISSUER`, która wymaga też zmiennych `MITRA_OIDC_CLIENT_ID` i `MITRA_URL`. Jeśli którejś z nich brakuje, Mitra się nie uruchomi. Ciche działanie bez logowania byłoby znacznie gorsze.

## Klucz tajny klienta i zakresy

Jeśli u dostawcy zarejestrowano klucz tajny klienta, ustaw `MITRA_OIDC_CLIENT_SECRET`. Jeśli zarejestrowano klienta publicznego, pomiń tę zmienną; to w pełni obsługiwany wariant, bo Mitra zawsze korzysta z PKCE.

Mitra prosi o zakresy `openid profile email`. Zakres `openid` jest wymagany, a dwa pozostałe przekazują aplikacji Mitra imię i nazwisko oraz adres e-mail każdej osoby. Zmieniaj je za pomocą `MITRA_OIDC_SCOPES` tylko wtedy, gdy twój dostawca potrzebuje czegoś innego.

## Kto może się logować

Każdy, kogo przepuści twój dostawca, przy pierwszym logowaniu dostaje konto w aplikacji Mitra. W aplikacji Mitra nie ma listy użytkowników do zarządzania, więc o tym, kto może się logować, decydujesz u dostawcy: za pomocą grup, przypisań do aplikacji lub w inny sposób, w jaki dostawca zarządza dostępem. Imię i nazwisko oraz adres e-mail każdej osoby są aktualizowane na podstawie danych od dostawcy przy każdym logowaniu.

## Jak działa logowanie

Samo logowanie odbywa się na serwerze (przepływ kodu autoryzacji z PKCE). Przeglądarka dostaje tylko plik cookie, a w jej pamięci nie są przechowywane żadne tokeny, więc złośliwy skrypt na stronie nie ma czego ukraść.

Sesja trwa 30 dni od ostatniego użycia aplikacji Mitra. Plik cookie jest oznaczany jako bezpieczny (secure), gdy `MITRA_URL` zaczyna się od `https://`, a wystawca z adresem `http://` jest dozwolony dla dostawców w twojej sieci lokalnej, którzy nie mają HTTPS. Jeśli twój dostawca to obsługuje, wylogowanie z aplikacji Mitra wylogowuje cię również u niego.

## Rozwiązywanie problemów

- **Mitra się nie uruchamia i wskazuje brakującą zmienną.** Gdy ustawiona jest zmienna `MITRA_OIDC_ISSUER`, muszą być ustawione także `MITRA_OIDC_CLIENT_ID` i `MITRA_URL`.
- **Dostawca zgłasza błąd adresu przekierowania.** Musi to być dokładnie wartość `MITRA_URL`, a po niej `/auth/callback`.
- **W dzienniku widać, że wykrywanie dostawcy (discovery) się nie powiodło.** Mitra wyszukuje dostawcę przy pierwszym logowaniu i próbuje ponownie przy następnym, więc problem z dostawcą uruchomionym później niż Mitra rozwiąże się sam. Jeśli błąd się powtarza, sprawdź adres URL wystawcy i to, czy Mitra może się z nim połączyć, ustawiając [poziom szczegółowości dziennika](logging.md) na `debug`.
- **Po włączeniu logowania moje kalendarze zniknęły.** Tak ma być: każdy zaczyna z nowym kontem. Połącz ponownie swoje konta.
