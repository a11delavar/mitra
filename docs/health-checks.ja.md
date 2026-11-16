---
title: ヘルスチェック
description: オーケストレーター、ロードバランサー、稼働監視に Mitra が応答しているかを伝えるエンドポイントと、それを使った Docker ヘルスチェック。
---

Mitra は監視するものすべてに対し、1つの質問に答えます。このサーバーは応答していますか? サインイン不要の次のアドレスに問い合わせます。

```text
GET /api/health
```

チェックするのは、Mitra が動くために欠かせない唯一のもの、データベースです。

| 応答 | 意味 |
| --- | --- |
| `200` `{"status":"ok"}` | 応答中。データベースが応答しています。 |
| `503` `{"status":"error"}` | 応答していません。データベースが応答しないか、時間がかかりすぎました。 |

応答は意図的に最小限です。あなたが何を動かしているかを第三者に教えるバージョンやビルドの情報は含まれず、キャッシュもされないので、チェックのたびに現在の状態が分かります。

CalDAV サーバー、Notion、Google、サインインプロバイダー、ジオコーダーなどの接続先サービスは、チェックには含まれません。これらの一時的な障害で、Mitra 自体が異常と見なされるべきではないからです。

## Docker

イメージにはこのエンドポイントを使う Docker ヘルスチェックが最初から組み込まれているので、設定なしで `docker ps` や `docker inspect` が Mitra の実際の状態を示します。新しいコンテナは `starting` と表示され、データベースが起動すると `healthy` になります。[`MITRA_PORT`](configuration.md)を変更した場合はそれに従います。

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

ライブネスプローブとレディネスプローブの両方をこのエンドポイントに向けます。

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

## 稼働監視

Uptime Kuma、Healthchecks.io、ロードバランサー自体のチェックなど、どんな HTTP モニターでも `/api/health` をポーリングし、`200` 以外をダウンと見なせます。[サインイン](sso.md)の有無に関わらず同じように動作します。
