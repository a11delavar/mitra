---
title: 시작하기
description: Docker Compose로 Mitra를 설치하고, 첫 캘린더를 만들고, 몇 가지를 해 보세요.
sidebar:
  label: 시작하기
---

Mitra는 일정과 작업을 위한 셀프 호스팅 캘린더입니다. 먼저 둘러보고 싶다면 [데모를 사용해 보세요](https://demo.mitracal.com).

## Mitra 설치하기

[Docker](https://docs.docker.com/get-docker/)와 Compose 플러그인을 준비한 뒤 `compose.yaml`을 만드세요.

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

`docker compose up -d`를 실행하고 [http://localhost:3000](http://localhost:3000)을 여세요.

본격적으로 쓰기 전에 `~/mitra`를 [백업](backups.md)하고 [HTTPS 뒤에 두세요](configuration.md#put-it-behind-https). 다른 사람도 쓸 예정이라면 먼저 [로그인](sso.md)을 켜세요. 나중에 켜면 모두가 빈 계정으로 다시 시작하게 됩니다.

## 캘린더 만들기

Mitra를 처음 열면 캘린더를 추가하라고 안내합니다. 서버에 보관되는 [Mitra 캘린더](integrations/mitra.md)를 만들거나, [CalDAV](integrations/caldav.md)나 [Google 캘린더](integrations/google.md)처럼 이미 가진 계정을 연결할 수 있습니다.

## 해 볼 것

- [주 보기](views/week.md)에서 빈 시간대를 가로질러 끌어 일정을 만들어 보세요.
- 사이드바의 [계획](planning.md) 탭에서 **작업 추가**를 누르고, 나중에 그 작업을 주 보기로 끌어 오세요.
- <kbd>/</kbd>를 누르고 **가용 시간 추가**를 실행해 [근무 시간](availability.md)에 음영을 넣어 보세요.
- [휴대폰에 Mitra를 설치](install-app.md)하면 [알림](reminders.md)을 받을 수 있습니다.
- <kbd>?</kbd>를 누르면 모든 [키보드 단축키](shortcuts.md)를 볼 수 있습니다.
