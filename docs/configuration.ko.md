---
title: 구성
description: 환경 변수로 Mitra를 구성하는 방법, 대부분의 서버에 필요한 변수, 그리고 모든 변수와 기본값을 설명합니다.
---

Mitra는 전부 환경 변수로 구성합니다. 마운트할 설정 파일은 없습니다. 컨테이너에 변수를 설정하면 Mitra가 시작할 때 읽습니다. 모든 변수는 선택 사항이며, 설정하지 않은 변수에는 [아래](#all-variables)에 나온 기본값이 쓰입니다.

Docker Compose에서는 `environment` 블록에 넣습니다.

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

비밀 값을 compose 파일 밖에 두고 싶다면 `.env` 파일이나 Docker secrets를 써도 됩니다. 변경 사항은 Mitra가 다음에 시작할 때 적용됩니다.

```bash
docker compose up -d
```

## 서버에서 설정해야 하는 것

거의 없습니다. [Mitra 캘린더](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Apple 캘린더](integrations/apple.md), [캘린더 구독](integrations/subscriptions.md), [Notion](integrations/notion.md), [Todoist](integrations/todoist.md), [Tempo](integrations/tempo.md)는 사용자가 앱에서 직접 추가합니다.

두 가지는 먼저 다른 곳에 등록해서 받은 자격 증명이 필요합니다. [Google 캘린더](integrations/google.md)(`MITRA_GOOGLE_*`)와 [로그인](sso.md)(`MITRA_OIDC_*`)입니다.

## HTTPS 뒤에 두기

Mitra에 내 컴퓨터가 아닌 다른 곳에서 접속할 수 있게 되면 Caddy, Traefik, nginx 같은 리버스 프록시 뒤에 두고 HTTPS는 프록시가 처리하게 하세요. Mitra 자체는 컨테이너 안에서 일반 HTTP로 통신합니다. 일부 기능은 HTTPS에서만 작동합니다.

- 브라우저는 [알림](reminders.md)과 [앱 설치](install-app.md)를 `https://` 주소(그리고 `http://localhost`)에서만 허용합니다.
- [로그인](sso.md) 쿠키는 `https://`에서만 보안 쿠키로 표시되며, 대부분의 ID 공급자는 `https://` 리디렉션 주소를 요구합니다.
- [Google 캘린더](integrations/google.md)는 `https://` 리디렉션 주소가 필요합니다.

그다음 [`MITRA_URL`](#set-the-public-url)을 공개 주소로 설정하세요.

[Caddy](https://caddyserver.com/)라면 이것만 있으면 됩니다.

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

[Traefik](https://traefik.io/)이라면 서비스에 레이블을 달아 Mitra로 라우팅합니다.

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

## 공개 URL 설정하기

`MITRA_URL`은 사람들이 Mitra에 접속하려고 브라우저에 입력하는 주소이며, 컨테이너의 내부 주소가 아닙니다.

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Mitra는 이 값으로 Google 캘린더와 로그인의 반환 주소를 만들고, 값이 `https://`로 시작하면 쿠키를 보안 쿠키로 표시합니다. `http://localhost`에서 Mitra를 시험해 보는 동안에는 생략해도 됩니다. Mitra에 실제 주소가 생기면 바로 설정하세요. 로그인을 켜려면 반드시 설정해야 합니다.

## 인스턴스 이름 정하기

`MITRA_NAME`은 사이드바, 브라우저 탭, [설치한 앱](install-app.md)에 나오는 "Mitra"를 바꿉니다.

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

이름을 클릭하면 **정보** 대화상자가 열리고, 실행 중인 버전과 커밋이 나옵니다. [설치한 앱](install-app.md)은 이름과 아이콘으로 계속 "Mitra"를 씁니다. 이 둘은 앱을 빌드할 때 정해지기 때문입니다.

## 모든 변수

### 핵심

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MITRA_URL` | *(설정 안 됨)* | 사람들이 Mitra에 접속하는 [공개 주소](#set-the-public-url)입니다. 예: `https://mitra.example.com`. 로그인과 Google 캘린더의 반환 주소, 그리고 쿠키를 보안 쿠키로 표시할지가 이 값으로 정해집니다. localhost에서 시험해 보는 동안에는 선택 사항이고, [로그인](sso.md)에는 필수이며, [Google 캘린더](integrations/google.md)와 모든 공개 서버에는 설정을 권장합니다. |
| `MITRA_NAME` | *(Mitra, 각 사용자의 언어로)* | 사이드바, 브라우저 탭, 설치한 앱에 나오는 [이름](#name-your-instance)입니다. |
| `MITRA_PORT` | `3000` | 서버가 수신하는 포트입니다. Docker에서는 대신 포트 매핑의 호스트 쪽을 바꾸세요. 프로세스 자체가 다른 포트에서 수신해야 할 때만 설정합니다. 내장 상태 확인도 이 값을 따릅니다. |
| `MITRA_LOG_LEVEL` | `info` | [Mitra가 남기는 로그의 양](logging.md)입니다. `error`, `warn`, `info`, `debug`, `trace` 중 하나입니다. 각 수준은 자신보다 조용한 수준의 내용을 모두 포함합니다. |
| `MITRA_UPDATE_CHECK` | *(켜짐)* | `off`(또는 `false`, `0`, `no`)로 설정하면 [업데이트 확인](updates.md)이 꺼집니다. |
| `MITRA_MCP` | *(켜짐)* | `off`(또는 `false`, `0`, `no`)로 설정하면 [AI 도구가 연결하는 주소](ai-connectors.md)가 닫힙니다. |

### 알림

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | 서버의 [알림](reminders.md)에 대해 푸시 서비스가 보게 되는 연락처로, 보통 `mailto:` 주소입니다. Mitra 사용자에게는 보이지 않습니다. 서명 키는 자동으로 생성되므로 따로 설정할 것은 없습니다. |

### 위치

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | 위치 필드에 쓰이는 [Photon 지오코더](location.md)입니다. komoot의 공개 인스턴스 대신 직접 운영하는 Photon 인스턴스를 가리키게 할 수 있습니다. |

### 첨부 파일

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MITRA_FILE_MAX_SIZE` | `25M` | 한 사람이 항목에 [첨부](attachments.md)할 수 있는 가장 큰 파일 크기입니다. 바이트 단위로 쓰거나 `k`, `M`, `G` 접미사를 붙입니다. `0`으로 설정하면 파일 추가가 꺼집니다. |
| `MITRA_FILE_QUOTA` | *(설정 안 됨)* | 한 사람이 첨부 파일로 저장할 수 있는 전체 용량이며, 같은 방식으로 씁니다. 설정하지 않으면 제한이 없습니다. |

### Google 캘린더

사람들이 [Google 캘린더](integrations/google.md)를 연결할 수 있게 하려면 둘 다 설정하세요. ID만 설정하면 Mitra가 시작하지 않습니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(설정 안 됨)* | Google Cloud 콘솔에서 받은 OAuth 클라이언트 ID입니다. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(설정 안 됨)* | OAuth 클라이언트 보안 비밀입니다. `MITRA_GOOGLE_CLIENT_ID`를 설정했다면 반드시 필요합니다. |

### 통합 로그인

`MITRA_OIDC_ISSUER`를 설정하면 [로그인](sso.md)이 켜집니다. 함께 필요한 변수가 빠져 있으면 Mitra가 시작하지 않습니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(설정 안 됨)* | OIDC 공급자의 발급자(issuer) URL입니다. `MITRA_OIDC_CLIENT_ID`와 `MITRA_URL`이 필요합니다. |
| `MITRA_OIDC_CLIENT_ID` | *(설정 안 됨)* | 공급자에 등록한 클라이언트 ID입니다. |
| `MITRA_OIDC_CLIENT_SECRET` | *(설정 안 됨)* | 클라이언트 보안 비밀입니다. 공개 클라이언트라면 생략하세요. Mitra는 항상 PKCE를 씁니다. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Mitra가 요청하는 범위(scope)로, 공백으로 구분합니다. `openid`는 필수이고, `profile`과 `email`은 Mitra에 각 사용자의 이름과 이메일을 알려 줍니다. |

### 빌드에서 설정

서버에서 설정하는 변수가 아닙니다. 빌드나 이미지가 설정하거나, Mitra 자체를 개발할 때 쓰는 변수입니다.

| 변수 | 설정 주체 | 설명 |
| --- | --- | --- |
| `MITRA_VERSION` | 빌드 | 이미지에 포함된 버전입니다. |
| `MITRA_COMMIT` | 빌드 | 이미지에 포함된 커밋입니다. |
| `MITRA_DEV` | 개발 | Mitra를 개발하는 동안 샘플 캘린더 묶음인 **데모** 연동을 제공합니다. |
| `NODE_ENV` | 이미지 | 컨테이너 이미지에서는 `production`입니다. |

### 예시

로그인, Google 캘린더, 직접 운영하는 지오코더를 쓰는 서버입니다.

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
