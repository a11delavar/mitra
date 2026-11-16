---
title: 設定
description: 環境変数で Mitra を設定する方法、ほとんどのサーバーが必要とする変数、そして全変数とその既定値。
---

Mitra はすべて環境変数で設定します。マウントする設定ファイルはありません。コンテナに変数を設定すれば、Mitra が起動時にそれを読みます。すべての変数は任意で、設定しない変数は[後述](#all-variables)の既定値を使います。

Docker Compose では、`environment` ブロックに書きます:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

シークレットを compose ファイルに書きたくなければ、`.env` ファイルや Docker secrets でも同じです。変更は Mitra を次に起動したときに反映されます:

```bash
docker compose up -d
```

## サーバーで必要な設定

ほとんど何もありません。[Mitra カレンダー](integrations/mitra.md)、[CalDAV](integrations/caldav.md)、[Apple カレンダー](integrations/apple.md)、[カレンダー購読](integrations/subscriptions.md)、[Notion](integrations/notion.md)、[Todoist](integrations/todoist.md)、[Tempo](integrations/tempo.md) は、利用者がアプリ内で自分で追加します。

外部に登録する認証情報が必要なのは2つだけです: [Google カレンダー](integrations/google.md)(`MITRA_GOOGLE_*`)と[サインイン](sso.md)(`MITRA_OIDC_*`)。

## HTTPS 越しに公開する

自分のマシン以外から Mitra に届くようにするなら、Caddy、Traefik、nginx のようなリバースプロキシの後ろに置き、プロキシに HTTPS を任せてください。Mitra 自身はコンテナ内では平文の HTTP を話します。HTTPS でしか動かない機能がいくつかあります:

- [リマインダー](reminders.md)と[アプリのインストール](install-app.md)は、ブラウザーが `https://` のアドレス(および `http://localhost`)でしか許可しません。
- [サインイン](sso.md)の Cookie が secure とマークされるのは `https://` のときだけで、ほとんどの ID プロバイダーは `https://` のリダイレクトアドレスを要求します。
- [Google カレンダー](integrations/google.md)は `https://` のリダイレクトアドレスを必要とします。

それから [`MITRA_URL`](#set-the-public-url) に公開アドレスを設定します。

[Caddy](https://caddyserver.com/) なら、これだけです:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

[Traefik](https://traefik.io/) では、サービスのラベルで Mitra へルーティングします:

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

## 公開 URL を設定する

`MITRA_URL` は、人がブラウザーに入力して Mitra に届くアドレスで、コンテナの内部アドレスではありません:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Mitra はこれから Google カレンダーとサインインのリターンアドレスを組み立て、`https://` で始まるときは Cookie を secure とマークします。`http://localhost` で試している間は省略できます。Mitra に正式なアドレスができたらすぐに設定してください。サインインを有効にするには必須です。

## サーバーに名前を付ける

`MITRA_NAME` は、サイドバー、ブラウザーのタブ、[インストールしたアプリ](install-app.md)の「Mitra」を置き換えます:

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

名前をクリックすると **バージョン情報** ダイアログが開き、実行中のバージョンとコミットが表示されます。[インストールしたアプリ](install-app.md)の名前とアイコンは「Mitra」のままです。アプリのビルド時に決まっているからです。

## すべての変数

### コア

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `MITRA_URL` | *(未設定)* | 人が Mitra に届く[公開アドレス](#set-the-public-url)。`https://mitra.example.com` など。サインインと Google カレンダーのリターンアドレス、Cookie を secure にするかどうかは、ここから決まります。localhost で試す間は任意、[サインイン](sso.md)では必須、[Google カレンダー](integrations/google.md)や公開サーバーでは設定を推奨します。 |
| `MITRA_NAME` | *(Mitra。各利用者の言語で)* | サイドバー、ブラウザーのタブ、インストールしたアプリに表示される[名前](#name-your-instance)。 |
| `MITRA_PORT` | `3000` | サーバーが待ち受けるポート。Docker ではポートマッピングのホスト側を変えるのが普通です。プロセス自身が別のポートを待つ必要があるときだけ設定します。組み込みのヘルスチェックもこれに従います。 |
| `MITRA_LOG_LEVEL` | `info` | [Mitra が出力するログの量](logging.md): `error`、`warn`、`info`、`debug`、`trace` のいずれか。各レベルは、それより静かなレベルのすべてを含みます。 |
| `MITRA_UPDATE_CHECK` | *(オン)* | `off`(または `false`、`0`、`no`)にすると[更新チェック](updates.md)を無効にします。 |
| `MITRA_MCP` | *(オン)* | `off`(または `false`、`0`、`no`)にすると [AI ツールが接続するアドレス](ai-connectors.md)を閉じます。 |

### リマインダー

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | プッシュサービスに見せる、サーバーの[リマインダー](reminders.md)の連絡先。たいてい `mailto:` アドレスです。Mitra の利用者には見えません。署名キーは自動生成されるので、他に設定は不要です。 |

### 場所

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | 場所フィールドの背後にある [Photon ジオコーダー](location.md)。komoot の公開サーバーではなく、自分の Photon サーバーを指せます。 |

### 添付ファイル

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `MITRA_FILE_MAX_SIZE` | `25M` | 1人が項目に[添付](attachments.md)できるファイルの最大サイズ。バイト数、または `k`、`M`、`G` の接尾辞付きで書きます。`0` にするとファイルの追加を無効にします。 |
| `MITRA_FILE_QUOTA` | *(未設定)* | 各利用者が添付ファイルに保存できる総量。書き方は同じです。未設定なら制限なしです。 |

### Google カレンダー

両方を設定すると、利用者が [Google カレンダー](integrations/google.md)を接続できます。ID だけを設定すると Mitra は起動しません。

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(未設定)* | Google Cloud コンソールの OAuth クライアント ID。 |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(未設定)* | OAuth クライアントシークレット。`MITRA_GOOGLE_CLIENT_ID` を設定したときは必須です。 |

### シングルサインオン

`MITRA_OIDC_ISSUER` を設定すると[サインイン](sso.md)が有効になります。必要な変数が欠けていると、Mitra は起動を拒否します。

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(未設定)* | OIDC プロバイダーの issuer URL。`MITRA_OIDC_CLIENT_ID` と `MITRA_URL` が必要です。 |
| `MITRA_OIDC_CLIENT_ID` | *(未設定)* | プロバイダーに登録したクライアント ID。 |
| `MITRA_OIDC_CLIENT_SECRET` | *(未設定)* | クライアントシークレット。パブリッククライアントでは省略してください。Mitra は常に PKCE を使います。 |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Mitra が要求するスコープ。スペース区切りです。`openid` は必須。`profile` と `email` で各利用者の名前とメールアドレスを取得します。 |

### ビルドが設定する変数

サーバーでは設定しません。ビルドやイメージが設定するか、Mitra 自体の開発用です。

| 変数 | 設定元 | 説明 |
| --- | --- | --- |
| `MITRA_VERSION` | ビルド | イメージに組み込まれるバージョン。 |
| `MITRA_COMMIT` | ビルド | イメージに組み込まれるコミット。 |
| `MITRA_DEV` | 開発 | Mitra の開発中に、サンプルカレンダーのセットである **デモ** 連携を提供します。 |
| `NODE_ENV` | イメージ | コンテナイメージでは `production`。 |

### 例

サインイン、Google カレンダー、独自のジオコーダーを使うサーバー:

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
