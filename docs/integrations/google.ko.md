---
title: Google 캘린더
description: Mitra 서버에 Google 로그인을 한 번만 설정해 두면, 앱에서 Google 계정을 연결하고 그 캘린더를 양방향으로 동기화할 수 있습니다.
---

Mitra는 다른 캘린더 서버와 마찬가지로 CalDAV를 통해 Google 캘린더에 연결합니다. 다른 점은 로그인 방식입니다. Google은 비밀번호를 받지 않고, 자체 페이지에서 접근 권한을 허용하도록 요청합니다. 이를 위해 Google이 Mitra 서버를 알고 있어야 하므로, 서버 운영자가 한 번 Google에 서버를 등록하고 Google이 발급한 클라이언트 ID와 보안 비밀을 Mitra에 넣어 둡니다.

그다음부터는 Mitra를 쓰는 사람마다 앱에서 각자의 권한 허용으로 Google 계정을 연결합니다. 설정은 세 단계입니다.

1. [Google에 Mitra 등록하기](#register-mitra-with-google)
2. [Mitra에 클라이언트 ID와 보안 비밀 넣기](#give-mitra-the-client-id-and-secret)
3. [계정 연결하기](#connect-an-account)

처음 두 단계는 Mitra 서버마다 한 번만 하면 됩니다.

## Google에 Mitra 등록하기

1. [Google Cloud 콘솔](https://console.cloud.google.com)에서 프로젝트를 만들고, **API 및 서비스**(APIs & Services)에서 **CalDAV API**를 사용 설정하세요.
2. **OAuth 동의 화면**(OAuth consent screen)을 구성하세요. 본인과 계정을 연결할 다른 모든 사람을 **테스트 사용자**(test user)로 추가하거나, 앱을 게시하세요.
3. 유형이 **웹 애플리케이션**(Web application)인 **OAuth 클라이언트**(OAuth client)를 만드세요. **승인된 리디렉션 URI**(authorized redirect URI)에는 Mitra 서버 주소 뒤에 `/api/integrations/google/callback`을 붙여 입력하세요.

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Google이 보여 주는 **클라이언트 ID**(client ID)와 **클라이언트 보안 비밀번호**(client secret)를 복사하세요.

> [!CAUTION]
> 동의 화면이 테스트 중인 동안에는 Google이 각 권한 허용을 7일 뒤에 끝내므로, 모두가 매주 계정을 다시 연결해야 합니다. 권한 허용을 계속 유지하려면 앱을 게시하세요.

## Mitra에 클라이언트 ID와 보안 비밀 넣기

서버 주소인 `MITRA_URL`과 함께 환경 변수로 설정하세요.

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

그런 다음 Mitra를 다시 시작하세요.

```bash
docker compose up -d
```

두 변수는 모두 설정하거나 모두 비워 두세요. 클라이언트 ID만 있고 보안 비밀이 없으면 Mitra가 시작을 거부하므로, 설정을 반만 해 두고 모르고 지나치는 일이 없습니다.

`MITRA_URL`은 리디렉션 URI의 주소와 일치해야 합니다. 설정하지 않으면 Mitra는 접속한 주소를 사용하며, `localhost`에서 시험해 보기에는 이것으로 충분합니다. Google은 `localhost`가 아니면 `https://` 리디렉션 주소만 받으므로, 실제 서버에는 [HTTPS](../configuration.md#put-it-behind-https)와 `MITRA_URL`이 필요합니다. 모든 변수는 [구성](../configuration.md#all-variables)에 나와 있습니다.

## 계정 연결하기

1. 사이드바 아래쪽에서 **연동 추가**를 고른 다음 **Google 캘린더**를 고르세요.
2. **Google로 계속하기**를 누르세요. Google이 계정을 고르고 Mitra가 캘린더를 보고 변경하도록 허용할지 묻습니다.
3. Mitra로 돌아오면 계정의 캘린더가 모두 켜진 채로 나열됩니다. 원하지 않는 캘린더를 끈 다음 **저장**을 누르세요.

같은 Google 계정을 다시 연결하면 두 번 추가되지 않고 권한 허용이 갱신됩니다.

Google은 앱이 호출할 수 있는 빈도를 제한하므로, Mitra는 Google 계정을 약 1분에 한 번 동기화합니다([동기화 방식](README.md#how-syncing-works) 참고).

## 공유받은 캘린더

본인 소유의 캘린더는 연결하자마자 나타납니다. 팀 캘린더나 동료의 캘린더처럼 다른 사람이 공유한 캘린더는 Google 설정에서 허용해야 다른 앱에 전달됩니다.

1. Google에 로그인한 상태에서 [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect)를 여세요.
2. **공유 캘린더**(Shared Calendars)에서 Mitra에 표시할 캘린더를 모두 체크하고 **저장**을 누르세요.
3. Mitra의 사이드바에서 계정의 **⋯** 메뉴를 열고 **편집**을 고른 다음 **새로 고침**을 누르세요.
4. 나타난 캘린더를 켠 다음 **저장**을 누르세요.

**모든 일정 세부정보 보기**(See all event details) 권한으로 공유받은 캘린더는 Mitra에서 읽기 전용입니다. 모든 내용을 볼 수 있지만 일정을 추가, 변경, 삭제할 수는 없습니다. 나중에 소유자가 **일정 변경**(Make changes to events) 권한을 주면 다음 동기화 때 편집이 켜집니다. [읽기 전용 캘린더](../calendars.md#read-only-calendars)를 참고하세요.

## 동기화되는 항목

모든 것이 [CalDAV](caldav.md#what-syncs)와 같이 동기화됩니다. 단, 항목 간 관계는 예외입니다. Google이 자신이 보관하는 일정 사본에서 관계를 버리므로, Mitra는 Google 캘린더에서 관계 기능을 제공하지 않습니다.

Google 캘린더의 [첨부 파일](../attachments.md)은 Google 캘린더에서 첨부한 Google Drive 파일입니다. Mitra는 이 파일들을 보여 주고 각각 Drive에서 열 수 있게 하지만, 추가하거나 제거할 수는 없습니다. Google은 Drive 파일만 보관하고 다른 앱이 추가한 첨부 파일은 버리기 때문입니다.

Google 캘린더에서 바쁨으로 표시한 [가용 시간](../availability.md)은 그 캘린더에 바쁨 일정으로 추가되므로, 다른 사람에게 그 시간이 이미 찬 것으로 보입니다. 동작 방식은 [CalDAV](caldav.md#busy-availability)에서 설명한 것과 같습니다.

## Google 토큰

Google이 발급한 토큰은 서버를 벗어나지 않습니다. 브라우저는 접근 권한을 허용하려고 Google 페이지를 거쳐 갈 뿐입니다. Mitra는 토큰을 계정과 함께 보관하고, 동기화할 때마다 이를 사용해 짧은 시간 동안 유효한 접근 권한을 얻습니다.

## 계정 연결 해제하기

계정의 **⋯** 메뉴에서 **삭제**를 고르면 계정과 토큰이 Mitra에서 제거됩니다. Google 쪽에서도 Mitra의 접근 권한을 거두려면 [Google 계정의 서드 파티 연결](https://myaccount.google.com/permissions)에서 Mitra를 삭제하세요. 이것만 해도 동기화가 멈춥니다. 계정은 Mitra에 남아 있지만, 다시 연결할 때까지 모든 동기화가 실패합니다.

## 문제 해결

- **Google 캘린더**를 골랐을 때 **Google로 계속하기** 버튼 대신 이 서버에 구성되지 않았다는 안내가 나오면, `MITRA_GOOGLE_CLIENT_ID`와 `MITRA_GOOGLE_CLIENT_SECRET`이 설정되지 않았거나 설정한 뒤 Mitra를 다시 시작하지 않은 것입니다.
- Google이 `redirect_uri_mismatch`로 응답하면, Google Cloud 콘솔의 리디렉션 URI가 `MITRA_URL` 뒤에 `/api/integrations/google/callback`을 붙인 주소와 일치하지 않는 것입니다. `https://`를 포함하고 끝에 슬래시 없이 정확히 일치해야 합니다.
- 7일이 지나 계정 동기화가 멈춘다면 동의 화면이 아직 테스트 중인 것입니다. 앱을 게시한 다음 계정을 다시 연결하세요.
