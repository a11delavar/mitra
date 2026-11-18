---
title: 싱글 사인온
description: Mitra 서버 하나를 가족이나 팀과 함께 쓰세요. 모두가 이미 가진 계정으로 OpenID Connect 제공자를 통해 로그인합니다.
---

기본 상태의 Mitra는 한 사람용이고 로그인이 없습니다. 본인만 접속할 수 있다면 그래도 괜찮습니다. 서버 하나를 가족이나 팀과 함께 쓰려면 OpenID Connect(OIDC) 제공자에 연결하세요. 그러면 모두가 이미 가진 계정으로 로그인하고, 다른 사람에게는 보이지 않는 자기만의 캘린더를 갖게 됩니다.

Mitra는 표준을 따르는 OIDC 제공자라면 어느 것과도 함께 동작합니다. Pocket ID, Authelia, Authentik, Keycloak, Google 등과 함께 쓰는 사람들이 있습니다.

> [!CAUTION]
> 로그인을 켜면 본인을 포함해 모든 사람이 비어 있는 새 계정을 받습니다. Mitra를 혼자 쓰던 동안 설정한 것은 예전 계정에 남고 넘어오지 않습니다. 연결한 계정, 설정, [Mitra 캘린더](integrations/mitra.md)의 모든 항목이 여기에 해당합니다. 연결한 계정은 금방 다시 추가할 수 있지만 Mitra 캘린더의 항목은 따라올 수 없습니다. Mitra를 채우기 시작하기 전에 로그인을 켜거나, 먼저 그 항목들을 연결된 캘린더로 옮긴 뒤(캘린더 **⋯** 메뉴의 **다른 캘린더로 항목 옮기기…**) 나중에 그 계정을 다시 연결하세요.

## 로그인 켜기

컨테이너에 OIDC 변수를 설정하세요.

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

제공자에서 `MITRA_URL` 뒤에 `/auth/callback`을 붙인 주소를 리디렉션 주소로 등록하세요.

```text
https://mitra.example.com/auth/callback
```

제공자에 필요한 것은 이것뿐입니다. `docker compose up -d`로 Mitra를 다시 시작하면 모든 사람에게 로그인을 요청합니다.

`MITRA_OIDC_ISSUER`를 설정하면 로그인이 켜지며, `MITRA_OIDC_CLIENT_ID`와 `MITRA_URL`도 함께 필요합니다. 그중 하나라도 빠지면 Mitra는 시작을 거부합니다. 조용히 로그인 없이 실행되는 편이 훨씬 위험하기 때문입니다.

## 클라이언트 시크릿과 스코프

제공자에서 클라이언트 시크릿을 등록했다면 `MITRA_OIDC_CLIENT_SECRET`을 설정하세요. 공개 클라이언트로 등록했다면 설정하지 마세요. Mitra는 항상 PKCE를 사용하므로 이 방식도 완전히 지원됩니다.

Mitra는 `openid profile email` 스코프를 요청합니다. `openid`는 필수이고, 나머지 두 개로 각 사람의 이름과 이메일을 받습니다. 제공자가 다른 것을 요구할 때만 `MITRA_OIDC_SCOPES`로 바꾸세요.

## 로그인할 수 있는 사람

제공자가 통과시킨 사람은 누구나 처음 로그인할 때 Mitra 계정을 받습니다. Mitra에는 관리할 사용자 목록이 없으므로, 누가 로그인할 수 있는지는 제공자에서 그룹, 앱 할당 등 제공자가 접근을 다루는 방식으로 정하세요. 각 사람의 이름과 이메일은 로그인할 때마다 제공자에서 갱신됩니다.

## 로그인 방식

로그인 과정 자체는 서버에서 이루어집니다(PKCE를 사용한 인가 코드 흐름). 브라우저는 쿠키만 받고 브라우저 저장소에는 어떤 토큰도 보관하지 않으므로, 페이지에 악성 스크립트가 있어도 훔칠 것이 없습니다.

세션은 Mitra를 마지막으로 사용한 때부터 30일 동안 유지됩니다. `MITRA_URL`이 `https://`로 시작하면 쿠키에 보안 표시가 붙고, HTTPS 없이 자체 네트워크에서 돌아가는 제공자를 위해 `http://` 발급자도 허용됩니다. 제공자가 지원하면 Mitra에서 로그아웃할 때 제공자에서도 함께 로그아웃됩니다.

## 문제 해결

- **Mitra가 시작되지 않고 빠진 변수 이름을 알려 줍니다.** `MITRA_OIDC_ISSUER`를 설정했다면 `MITRA_OIDC_CLIENT_ID`와 `MITRA_URL`도 설정해야 합니다.
- **제공자가 리디렉션 주소에 문제가 있다고 합니다.** 리디렉션 주소는 정확히 `MITRA_URL` 뒤에 `/auth/callback`을 붙인 것이어야 합니다.
- **로그에 검색(discovery)이 실패했다고 나옵니다.** Mitra는 첫 로그인 때 제공자를 찾고, 실패하면 다음 로그인 때 다시 시도합니다. 그래서 제공자가 Mitra보다 늦게 시작되어도 저절로 해결됩니다. 계속 실패하면 [로그 수준](logging.md)을 `debug`로 두고 발급자 URL이 맞는지, Mitra가 거기에 접속할 수 있는지 확인하세요.
- **로그인을 켠 뒤 캘린더가 사라졌습니다.** 예상된 동작입니다. 모두가 새 계정으로 시작합니다. 계정을 다시 연결하세요.
