---
title: Конфигурация
description: Как настроить Mitra с помощью переменных окружения, какие из них нужны большинству серверов и полный список переменных со значениями по умолчанию.
---

Mitra настраивается только через переменные окружения. Файла конфигурации, который нужно монтировать, нет: вы задаёте переменные для контейнера, и Mitra считывает их при запуске. Все переменные необязательны, а для незаданной используется значение по умолчанию из списка [ниже](#all-variables).

В Docker Compose они указываются в блоке `environment`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

Файл `.env` или секреты Docker подойдут ничуть не хуже, если вы не хотите хранить секреты в файле compose. Изменения вступают в силу при следующем запуске Mitra:

```bash
docker compose up -d
```

## Что нужно настроить на сервере

Почти ничего. [Календари Mitra](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Календарь Apple](integrations/apple.md), [подписки на календари](integrations/subscriptions.md), [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) и [Tempo](integrations/tempo.md) пользователи добавляют сами, прямо в приложении.

Только для двух вещей нужны учётные данные, которые сначала нужно зарегистрировать у стороннего сервиса: для [Google Календаря](integrations/google.md) (`MITRA_GOOGLE_*`) и для [входа в систему](sso.md) (`MITRA_OIDC_*`).

## Подключите HTTPS

Как только Mitra можно открыть не только с вашего компьютера, разместите его за обратным прокси, например Caddy, Traefik или nginx, и поручите прокси работу с HTTPS. Внутри контейнера Mitra работает по обычному HTTP. Некоторые функции работают только по HTTPS:

- Браузеры разрешают [напоминания](reminders.md) и [установку приложения](install-app.md) только на адресах `https://` (и на `http://localhost`).
- Файлы cookie для [входа в систему](sso.md) помечаются как защищённые только на `https://`, а большинство провайдеров удостоверений требуют адрес перенаправления `https://`.
- [Google Календарь](integrations/google.md) требует адрес перенаправления `https://`.

Затем укажите в [`MITRA_URL`](#set-the-public-url) публичный адрес.

С [Caddy](https://caddyserver.com/) для этого достаточно следующего:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

С [Traefik](https://traefik.io/) направьте запросы в Mitra с помощью меток сервиса:

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

## Укажите публичный адрес

`MITRA_URL` означает адрес, который пользователи вводят в браузере, чтобы открыть Mitra, а не внутренний адрес контейнера:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

По нему Mitra строит адреса возврата для Google Календаря и входа в систему, а если он начинается с `https://`, помечает файлы cookie как защищённые. Пока вы пробуете Mitra на `http://localhost`, переменную можно не задавать. Задайте её, как только у Mitra появится настоящий адрес; для включения входа в систему она обязательна.

## Назовите свой экземпляр

`MITRA_NAME` заменяет «Mitra» на боковой панели и во вкладке браузера:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

Если нажать на название, откроется окно **О приложении** с версией и коммитом, которые у вас запущены. [Установленное приложение](install-app.md) сохраняет название и значок «Mitra», потому что они задаются при сборке приложения.

## Все переменные

### Основные

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `MITRA_URL` | *(не задано)* | [Публичный адрес](#set-the-public-url), по которому пользователи открывают Mitra, например `https://mitra.example.com`. От него зависят адреса возврата для входа в систему и Google Календаря, а также то, защищены ли файлы cookie. Необязателен, пока вы пробуете Mitra на localhost, обязателен для [входа в систему](sso.md) и рекомендуется для [Google Календаря](integrations/google.md) и любого публичного сервера. |
| `MITRA_NAME` | *(Mitra на языке каждого пользователя)* | [Название](#name-your-instance) на боковой панели и во вкладке браузера. [Установленное приложение](install-app.md) по-прежнему называется «Mitra». |
| `MITRA_PORT` | `3000` | Порт, который слушает сервер. В Docker вместо этого измените порт на стороне хоста в сопоставлении портов; задавайте эту переменную, только если сам процесс должен слушать другой порт. Встроенная проверка работоспособности следует за ней. |
| `MITRA_LOG_LEVEL` | `info` | [Насколько подробно Mitra ведёт журнал](logging.md): `error`, `warn`, `info`, `debug` или `trace`. Каждый уровень включает всё, что пишут менее подробные. |
| `MITRA_UPDATE_CHECK` | *(включено)* | Задайте `off` (или `false`, `0`, `no`), чтобы отключить [проверку обновлений](updates.md). |
| `MITRA_MCP` | *(включено)* | Задайте `off` (или `false`, `0`, `no`), чтобы закрыть [адрес, к которому подключаются ИИ-инструменты](ai-connectors.md). |

### Напоминания

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | Контакт, который push-сервисы видят для [напоминаний](reminders.md) вашего сервера, обычно адрес `mailto:`. Пользователи Mitra его не видят. Ключи подписи создаются автоматически, так что больше ничего задавать не нужно. |

### Место

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | [Геокодер Photon](location.md), на котором работает поле места. Укажите свой экземпляр Photon вместо общедоступного от komoot. |

### Вложения

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `MITRA_FILE_MAX_SIZE` | `25M` | Наибольший размер файла, который пользователь может [прикрепить](attachments.md) к записи, в байтах или с суффиксом `k`, `M` или `G`. Задайте `0`, чтобы запретить добавлять файлы. |
| `MITRA_FILE_QUOTA` | *(не задано)* | Сколько всего каждый пользователь может хранить во вложенных файлах; записывается так же. Если не задано, ограничения нет. |

### Google Календарь

Задайте обе переменные, чтобы пользователи могли подключать [Google Календарь](integrations/google.md). Если задать только ID, Mitra не запустится.

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(не задано)* | ID клиента OAuth из консоли Google Cloud. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(не задано)* | Секрет клиента OAuth. Обязателен, если задан `MITRA_GOOGLE_CLIENT_ID`. |

### Единый вход

Переменная `MITRA_OIDC_ISSUER` включает [вход в систему](sso.md). Если нужных ей переменных нет, Mitra не запускается.

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(не задано)* | URL издателя (issuer) вашего провайдера OIDC. Требует `MITRA_OIDC_CLIENT_ID` и `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(не задано)* | ID клиента, зарегистрированного у провайдера. |
| `MITRA_OIDC_CLIENT_SECRET` | *(не задано)* | Секрет клиента. Не задавайте его для публичного клиента; Mitra всегда использует PKCE. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Области доступа, которые запрашивает Mitra, через пробел. `openid` обязательна; `profile` и `email` дают Mitra имя и адрес электронной почты каждого пользователя. |

### Задаются при сборке

Эти переменные не нужно задавать на сервере. Их задаёт сборка или образ, либо они нужны для разработки самого Mitra.

| Переменная | Кем задаётся | Описание |
| --- | --- | --- |
| `MITRA_VERSION` | Сборка | Версия, встроенная в образ. |
| `MITRA_COMMIT` | Сборка | Коммит, встроенный в образ. |
| `MITRA_DEV` | Разработка | Предлагает интеграцию **Демо**, набор демонстрационных календарей, при разработке Mitra. |
| `NODE_ENV` | Образ | `production` в образе контейнера. |

### Пример

Сервер со входом в систему, Google Календарём и собственным геокодером:

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
