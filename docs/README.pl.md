---
title: Pierwsze kroki
description: Zainstaluj aplikację Mitra za pomocą Docker Compose, dodaj pierwszy kalendarz i wypróbuj kilka rzeczy.
sidebar:
  label: Pierwsze kroki
---

Mitra to samodzielnie hostowany kalendarz na twoje wydarzenia i zadania. Jeśli chcesz się najpierw rozejrzeć, [wypróbuj wersję demo](https://demo.mitracal.com).

## Instalacja aplikacji Mitra

Jeśli masz [Dockera](https://docs.docker.com/get-docker/) z wtyczką Compose, utwórz plik `compose.yaml`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
```

Uruchom `docker compose up -d` i otwórz [http://localhost:3000](http://localhost:3000).

Zanim zaczniesz polegać na aplikacji Mitra, [zadbaj o kopię zapasową](backups.md) folderu `~/mitra` i [udostępnij ją przez HTTPS](configuration.md#put-it-behind-https). Jeśli będą z niej korzystać inne osoby, najpierw włącz [logowanie](sso.md), ponieważ jeśli włączysz je później, każdy zacznie od nowa z pustym kontem.

## Pierwszy kalendarz

Przy pierwszym uruchomieniu Mitra zaproponuje dodanie kalendarza. Może to być [kalendarz Mitra](integrations/mitra.md) przechowywany na twoim serwerze albo konto, które już masz, na przykład [CalDAV](integrations/caldav.md) lub [Kalendarz Google](integrations/google.md).

## Co wypróbować

- Przeciągnij po pustej godzinie w [widoku tygodnia](views/week.md), aby utworzyć wydarzenie.
- Naciśnij **Dodaj zadanie** na karcie [Planowanie](planning.md) w panelu bocznym, a później przeciągnij zadanie do swojego tygodnia.
- Naciśnij <kbd>/</kbd> i uruchom polecenie **Dodaj dostępność**, aby zacienić swoje [godziny pracy](availability.md).
- [Zainstaluj aplikację Mitra na telefonie](install-app.md), aby dostawać [przypomnienia](reminders.md).
- Naciśnij <kbd>?</kbd>, aby zobaczyć wszystkie [skróty klawiszowe](shortcuts.md).
