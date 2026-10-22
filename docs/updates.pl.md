---
title: Aktualizacje
description: Jak Mitra informuje o nowych wersjach, co wysyła przy sprawdzaniu, jak to wyłączyć i jak przeprowadzić aktualizację.
---

Mitra informuje cię, gdy pojawi się wersja nowsza od tej, której używasz. Nigdy nie aktualizuje się sama: pobranie nowej wersji należy do ciebie.

## Wskaźnik aktualizacji

Gdy dostępna jest nowsza wersja, na logo w panelu bocznym pojawia się mała kropka. Kliknij nazwę swojej instancji, aby otworzyć okno **O aplikacji**, które pokazuje uruchomioną wersję i commit oraz prowadzi do listy nowości. Przycisk **Kopiuj** kopiuje tam dane wersji, czyli to, czego potrzeba w zgłoszeniu błędu.

Polecenie **Co nowego** w [palecie poleceń](shortcuts.md#command-palette) pokazuje zmiany w każdej wersji. Po aktualizacji serwera w każdej karcie otwartej wcześniej pojawi się przycisk **Odśwież stronę, aby dokończyć aktualizację**.

Jeśli używasz wydania (`latest`, `0.6` lub konkretnej wersji), Mitra wskaże ci najnowsze wydanie. Jeśli używasz obrazu `dev`, wskaże najnowsze commity w gałęzi `main` i poda, o ile wyprzedzają twoją wersję.

## Co wysyła sprawdzanie

Kilka razy dziennie serwer, nigdy twoja przeglądarka, pyta GitHub, czy jest coś nowszego. O twojej instancji zapytanie mówi tylko tyle, co każde zapytanie: zawiera twój adres IP i, w nagłówku User-Agent, uruchomioną wersję. Nie ma w nim telemetrii, identyfikatorów ani liczników.

Jeśli serwer nie może połączyć się z GitHubem, zapisze to raz w logu i potem nie będzie o tym wspominał.

Aby całkowicie wyłączyć sprawdzanie, ustaw `MITRA_UPDATE_CHECK` na `off` (działają też `false`, `0` i `no`):

```yaml
environment:
  MITRA_UPDATE_CHECK: 'off'
```

## Wybór tagu obrazu

Tag decyduje o tym, jak szybko przechodzisz na nowe wersje.

| Tag | Co dostajesz |
| --- | --- |
| `latest` | Najnowsze wydanie. |
| `0.6` | Najnowsze wydanie `0.6.x`: poprawki, ale bez nowej wersji minor. |
| `0.6.0` | Dokładnie tę wersję. |
| `dev` | Najnowszy commit w gałęzi `main`, aby wypróbować zmiany przed wydaniem. |

Do wersji 1.0 nowa wersja minor (np. z 0.6 na 0.7) może zmienić rzeczy, na których polegasz. Jeśli wolisz samodzielnie decydować, kiedy to nastąpi, używaj tagu `0.6` i przejdź na nowszy, kiedy zechcesz. Wszystkie tagi znajdziesz na [GitHubie](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Aktualizacja aplikacji Mitra

Pobierz nowy obraz i utwórz kontener ponownie:

```bash
docker compose pull
docker compose up -d
```

Twoje dane są w zamontowanym folderze, więc przetrwają aktualizację. Jeśli nowa wersja zmienia bazę danych, Mitra zaktualizuje ją przy uruchomieniu, więc nigdy nie musisz tego robić ręcznie. Narzędzia takie jak [Watchtower](https://containrrr.dev/watchtower/) mogą robić to za ciebie według harmonogramu.

Wersja, którą dostaniesz, zależy od [tagu obrazu](#choose-an-image-tag). Zanim przejdziesz na nową wersję minor, warto przeczytać [informacje o wersji](https://github.com/a11delavar/mitra/releases).
