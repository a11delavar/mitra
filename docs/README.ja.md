---
title: はじめに
description: Docker Compose で Mitra をインストールし、最初のカレンダーを用意して、いくつか試してみましょう。
sidebar:
  label: はじめに
---

Mitra は、予定とタスクを管理するセルフホスト型のカレンダーです。まず中を見てみたいときは[デモをお試しください](https://demo.mitracal.com)。

## Mitra をインストール

[Docker](https://docs.docker.com/get-docker/) とその Compose プラグインを用意し、`compose.yaml` を作成します:

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

`docker compose up -d` を実行し、[http://localhost:3000](http://localhost:3000) を開きます。

本格的に使い始める前に、`~/mitra` を[バックアップ](backups.md)し、[HTTPS 越しに公開](configuration.md#put-it-behind-https)してください。他の人も使う場合は、先に[サインイン](sso.md)を有効にしましょう。後から有効にすると、全員が空のアカウントからやり直しになります。

## カレンダーを用意する

初めて開くと、Mitra がカレンダーの追加を案内します: サーバーに保存される [Mitra カレンダー](integrations/mitra.md)か、[CalDAV](integrations/caldav.md) や [Google カレンダー](integrations/google.md) など、すでにお持ちのアカウントを追加できます。

## 試してみること

- [週ビュー](views/week.md)で空いている時間帯をドラッグすると、予定を作成できます。
- サイドバーの[計画](planning.md)タブで **タスクを追加** を押し、あとでそのタスクを週の中へドラッグします。
- <kbd>/</kbd> を押して **対応可能時間を追加** を実行し、[勤務時間](availability.md)に色を付けます。
- [スマートフォンに Mitra をインストール](install-app.md)して[リマインダー](reminders.md)を受け取ります。
- <kbd>?</kbd> を押すと、すべての[キーボードショートカット](shortcuts.md)が表示されます。
