---
title: Google カレンダー
description: Mitra サーバーに一度だけ Google サインインを設定し、アプリから Google アカウントを接続してカレンダーを双方向に同期します。
---

Mitra は、他のカレンダーサーバーと同様に CalDAV 経由で Google カレンダーに接続します。異なるのはサインインです。Google はパスワードを受け付けず、独自のページでアクセスを許可させます。そのために Google があなたの Mitra サーバーを知っている必要があるので、サーバーを運営する人が一度だけ Google に登録し、発行されたクライアント ID とシークレットを Mitra に渡します。

その後は、Mitra を使う人それぞれがアプリから自分の Google アカウントを、個別の許可で接続します。セットアップは3つの手順です。

1. [Mitra を Google に登録する](#register-mitra-with-google)。
2. [Mitra にクライアント ID とシークレットを渡す](#give-mitra-the-client-id-and-secret)。
3. [アカウントを接続する](#connect-an-account)。

最初の2つは Mitra サーバーごとに一度だけ行います。

## Mitra を Google に登録する

1. [Google Cloud コンソール](https://console.cloud.google.com)でプロジェクトを作成し、**API とサービス**で **CalDAV API** を有効にします。
2. **OAuth 同意画面**を設定します。アカウントを接続する自分と全員を**テストユーザー**として追加するか、アプリを公開します。
3. タイプ**ウェブアプリケーション**の **OAuth クライアント**を作成します。**承認済みのリダイレクト URI** には、あなたの Mitra サーバーのアドレスに `/api/integrations/google/callback` を続けたものを入力します。

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Google が表示する**クライアント ID** と**クライアント シークレット**をコピーします。

> [!CAUTION]
> 同意画面がテスト中の間、Google は各許可を7日で終了させるため、全員が毎週アカウントを接続し直す必要があります。アプリを公開すれば、許可はずっと有効です。

## Mitra にクライアント ID とシークレットを渡す

これらを環境変数として、サーバーのアドレスである `MITRA_URL` と一緒に設定します。

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

その後 Mitra を再起動します。

```bash
docker compose up -d
```

変数は両方設定するか、両方設定しないかのどちらかです。クライアント ID だけでシークレットがない状態では Mitra は起動を拒否するので、中途半端な設定が見逃されることはありません。

`MITRA_URL` はリダイレクト URI のアドレスと一致している必要があります。これがなければ、Mitra は開かれたアドレスを使います。`localhost` で試す分にはそれで十分です。`localhost` 以外では Google が `https://` のリダイレクトアドレスしか受け付けないため、実運用のサーバーには [HTTPS](../configuration.md#put-it-behind-https) と `MITRA_URL` が必要です。すべての変数は[設定](../configuration.md#all-variables)に一覧されています。

## アカウントを接続する

1. サイドバー下部の**連携を追加**を選び、**Google カレンダー**を選びます。
2. **Google で続行**を押します。Google がアカウントの選択と、Mitra へのカレンダーの閲覧・変更の許可を求めます。
3. Mitra に戻ると、アカウントのカレンダーがすべてオンの状態で一覧されます。不要なものをオフにして**保存**を押します。

同じ Google アカウントを再度接続しても二重には追加されず、許可が更新されます。

Google はアプリが呼び出せる頻度を制限しているため、Mitra は Google アカウントを約1分ごとに同期します([同期の仕組み](README.md#how-syncing-works)を参照)。

## 共有されたカレンダー

自分のカレンダーは接続と同時に現れます。チームや同僚のカレンダーなど、他の人が共有したカレンダーは、Google の設定で許可して初めて他のアプリに届きます。

1. Google にサインインした状態で [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect) を開きます。
2. **共有カレンダー**で Mitra に取り込みたいカレンダーにチェックを付け、**保存**を押します。
3. Mitra でサイドバーのアカウントの **⋯** メニューを開き、**編集**を選んで**更新**を押します。
4. 現れたカレンダーをオンにして**保存**を押します。

**すべての予定の詳細を表示**で共有されたカレンダーは、Mitra では読み取り専用です。中身はすべて見えますが、予定の追加・変更・削除はできません。あとでオーナーが**予定を変更**の権限を与えれば、次の同期で編集できるようになります。[読み取り専用カレンダー](../calendars.md#read-only-calendars)を参照してください。

## 同期されるもの

項目間の関連付けを除き、[CalDAV](caldav.md#what-syncs)と同じように同期されます。Google は予定のコピーから関連付けを取り除くため、Mitra は Google カレンダーでは関連付けを提供しません。

Google カレンダーの[添付ファイル](../attachments.md)は、Google カレンダーで添付する Google ドライブのファイルです。Mitra はそれらを表示し、それぞれドライブで開けますが、追加も削除もできません。Google はドライブのファイルのみを保持し、他のアプリが追加した添付は破棄します。

Google カレンダーで予定ありにした[対応可能時間](../availability.md)は、そのカレンダーに予定ありの予定として追加され、他の人にもその時間が埋まっているように見えます。動作は [CalDAV](caldav.md#busy-availability) と同じです。

## Google トークンについて

Google が発行するトークンがサーバーの外に出ることはありません。ブラウザーが通るのはアクセスを許可する Google のページだけです。Mitra はトークンをアカウントと一緒に保持し、同期のたびに短期間のアクセスを得るために使います。

## アカウントを切断する

アカウントとそのトークンを Mitra から取り除くには、アカウントの **⋯** メニューで**削除**を選びます。Google 側でも Mitra のアクセスを取り消すには、[Google アカウントのサードパーティ接続](https://myaccount.google.com/permissions)から Mitra を削除します。それだけを行っても同期は止まります。アカウントは Mitra に残りますが、再接続するまで同期はすべて失敗します。

## トラブルシューティング

- **Google カレンダー**を選んだときに **Google で続行**ボタンではなく「このサーバーでは設定されていません」という表示が出る場合は、`MITRA_GOOGLE_CLIENT_ID` と `MITRA_GOOGLE_CLIENT_SECRET` が設定されていないか、設定後に Mitra が再起動されていません。
- Google が `redirect_uri_mismatch` を返す場合は、Google Cloud コンソールのリダイレクト URI が `MITRA_URL` に `/api/integrations/google/callback` を続けたものと一致していません。`https://` を含め、末尾のスラッシュも付けずに完全一致させる必要があります。
- 7日後にアカウントの同期が止まる場合は、同意画面がまだテスト中です。アプリを公開してから、アカウントを接続し直してください。
