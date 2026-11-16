---
title: シングルサインオン
description: 1 台の Mitra サーバーを家族やチームで共有します。全員がすでに持っているアカウントで、OpenID Connect プロバイダー経由でサインインします。
---

標準の状態では、Mitra は 1 人向けでサインインもありません。自分だけがアクセスできる間はそれで十分です。1 台のサーバーを家族やチームで共有するには、OpenID Connect（OIDC）プロバイダーにつなぎます。すると全員がすでに持っているアカウントでサインインし、他の人には見えない自分のカレンダーを持てます。

Mitra は標準的な OIDC プロバイダーならどれでも動きます。Pocket ID、Authelia、Authentik、Keycloak、Google などで使われています。

> [!CAUTION]
> サインインを有効にすると、あなたを含む全員に新しい空のアカウントが作られます。Mitra が 1 人向けだった間に設定したものは古いアカウントに残り、引き継がれません。接続したアカウント、設定、[Mitra カレンダー](integrations/mitra.md)内のすべての項目です。接続したアカウントはすぐに追加し直せますが、Mitra カレンダー内の項目は引き継げません。Mitra に内容を入れ始める前にサインインを有効にするか、先にそれらの項目を接続したカレンダーへ移動し（カレンダーの **⋯** メニューの **項目の移動先…**）、あとでそのアカウントを接続し直してください。

## サインインを有効にする

コンテナーに OIDC の変数を設定します。

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

プロバイダー側では、`MITRA_URL` のあとに `/auth/callback` を付けたものをリダイレクトアドレスとして登録します。

```text
https://mitra.example.com/auth/callback
```

プロバイダーに必要なのはこれだけです。`docker compose up -d` で Mitra を再起動すると、全員にサインインが求められます。

`MITRA_OIDC_ISSUER` を設定することがサインインを有効にする操作で、`MITRA_OIDC_CLIENT_ID` と `MITRA_URL` も必要です。どれかが欠けていると Mitra は起動を拒否します。サインインなしでこっそり動くほうが、はるかにまずいからです。

## クライアントシークレットとスコープ

プロバイダーでクライアントシークレットを登録した場合は、`MITRA_OIDC_CLIENT_SECRET` を設定します。パブリッククライアントを登録した場合は省略します。Mitra は常に PKCE を使うので、完全に対応しています。

Mitra が要求するスコープは `openid profile email` です。`openid` は必須で、残りの 2 つで各人の名前とメールアドレスが Mitra に渡ります。プロバイダーが別のものを必要とする場合だけ、`MITRA_OIDC_SCOPES` で変更してください。

## サインインできる人

プロバイダーが通した人は誰でも、最初のサインインで Mitra アカウントを得ます。Mitra に管理するユーザーリストはないので、グループやアプリの割り当てなど、プロバイダー側のアクセス管理の方法で誰がサインインできるかを決めてください。各人の名前とメールアドレスは、サインインのたびにプロバイダーから更新されます。

## サインインの仕組み

サインイン自体はサーバー上で行われます（PKCE を使った認可コードフロー）。ブラウザーが受け取るのは Cookie だけで、トークンはブラウザーのストレージに保存されないので、ページ上の悪意あるスクリプトに盗まれるものがありません。

セッションは、Mitra を最後に使った時点から 30 日間有効です。`MITRA_URL` が `https://` で始まる場合、Cookie には secure が付きます。自前のネットワーク内で HTTPS のないプロバイダーのために、`http://` の発行者（issuer）も許可されます。プロバイダーが対応していれば、Mitra からサインアウトするとプロバイダーからもサインアウトされます。

## トラブルシューティング

- **Mitra が起動せず、欠けている変数を指摘する。** `MITRA_OIDC_ISSUER` を設定したら、`MITRA_OIDC_CLIENT_ID` と `MITRA_URL` も設定しなければなりません。
- **プロバイダーがリダイレクトアドレスについて警告する。** 正確に `MITRA_URL` に `/auth/callback` を続けたものでなければなりません。
- **ログにディスカバリーの失敗と出る。** Mitra は最初のサインインでプロバイダーを調べ、次のサインインで再試行するので、Mitra よりあとに起動したプロバイダーは自然に解決します。失敗し続ける場合は、発行者（issuer）の URL と Mitra から到達できるかを、[ログレベル](logging.md)を `debug` にして確認してください。
- **サインインを有効にしたらカレンダーが消えた。** 想定どおりの動作です。全員が新しいアカウントで始まります。アカウントを接続し直してください。
