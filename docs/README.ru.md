---
title: Начало работы
description: Установите Mitra с помощью Docker Compose, заведите первый календарь и попробуйте несколько возможностей.
sidebar:
  label: Начало работы
---

Mitra представляет собой календарь для событий и задач, который работает на вашем собственном сервере. Чтобы сначала осмотреться, [попробуйте демо](https://demo.mitracal.com).

## Установка Mitra

Если у вас есть [Docker](https://docs.docker.com/get-docker/) с плагином Compose, создайте файл `compose.yaml`:

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

Выполните `docker compose up -d` и откройте [http://localhost:3000](http://localhost:3000).

Прежде чем полагаться на Mitra, настройте [резервное копирование](backups.md) папки `~/mitra` и [доступ по HTTPS](configuration.md#put-it-behind-https). Если Mitra будут пользоваться и другие, сначала включите [вход](sso.md): если включить его позже, каждый начнёт заново с пустого аккаунта.

## Первый календарь

При первом запуске Mitra предложит добавить календарь: [календарь Mitra](integrations/mitra.md) на вашем сервере или уже существующий аккаунт, например [CalDAV](integrations/caldav.md) или [Google Календарь](integrations/google.md).

## Что попробовать

- Проведите по свободному часу в [виде недели](views/week.md), чтобы создать событие.
- Нажмите **Добавить задачу** на вкладке [Планирование](planning.md) боковой панели, а позже перетащите задачу в свою неделю.
- Нажмите <kbd>/</kbd> и выполните команду **Добавить доступность**, чтобы закрасить [рабочие часы](availability.md).
- [Установите Mitra на телефон](install-app.md), чтобы получать [напоминания](reminders.md).
- Нажмите <kbd>?</kbd>, чтобы увидеть все [быстрые клавиши](shortcuts.md).
