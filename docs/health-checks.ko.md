---
title: 상태 확인
description: 오케스트레이터, 로드 밸런서, 가동 시간 모니터에 Mitra가 서비스 중인지 알려 주는 엔드포인트와, 이를 바탕으로 한 Docker 상태 확인입니다.
---

Mitra는 자신을 지켜보는 모든 것에 한 가지 질문에 답합니다. 이 인스턴스가 서비스 중인가? 로그인이 필요 없는 다음 주소로 물어보세요.

```text
GET /api/health
```

Mitra가 없으면 돌아갈 수 없는 단 하나, 데이터베이스를 확인합니다.

| 응답 | 의미 |
| --- | --- |
| `200` `{"status":"ok"}` | 서비스 중입니다. 데이터베이스가 응답합니다. |
| `503` `{"status":"error"}` | 서비스 중이 아닙니다. 데이터베이스가 응답하지 않았거나 너무 오래 걸렸습니다. |

응답은 일부러 최소한으로 만들었습니다. 낯선 사람에게 무엇을 돌리고 있는지 알려 줄 버전이나 빌드 정보가 없고, 캐시되지 않으므로 매번 현재 상태를 확인합니다.

CalDAV 서버, Notion, Google, 로그인 제공업체, 지오코더 같은 연결된 서비스는 확인 대상이 아닙니다. 그중 하나가 잠깐 멈췄다고 Mitra 자체를 비정상으로 표시해서는 안 되기 때문입니다.

## Docker

이미지에는 이 엔드포인트를 쓰는 Docker 상태 확인이 이미 들어 있으므로, 따로 설정하지 않아도 `docker ps`와 `docker inspect`에 Mitra의 실제 상태가 나옵니다. 새 컨테이너는 `starting`으로 표시되다가 데이터베이스가 준비되면 `healthy`가 됩니다. [`MITRA_PORT`](configuration.md)를 바꿨다면 그 값을 따릅니다.

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

활성 프로브와 준비 프로브를 모두 이 엔드포인트로 지정하세요.

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  periodSeconds: 10
```

## 가동 시간 모니터

Uptime Kuma, Healthchecks.io, 로드 밸런서 자체 확인 같은 HTTP 모니터라면 무엇이든 `/api/health`를 주기적으로 확인하고 `200`이 아니면 중단으로 처리할 수 있습니다. [로그인](sso.md)이 있든 없든 똑같이 작동합니다.
