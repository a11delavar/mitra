---
title: バックアップ
description: Mitra が保存するすべては1つのフォルダーにあります。いつものツールでバックアップしてください。
---

Mitra はすべてを1つのフォルダーに保存します。コンテナ内では `/app/data` で、[はじめに](README.md#install-mitra)どおりに構成していればホスト上では `~/mitra` です。そのフォルダーをバックアップすれば、サーバー全体をバックアップしたことになります。ダンプすべきデータベースサーバーも、選り分けるべき設定ファイルもありません。

> [!CAUTION]
> Mitra に保管しているものの中には、このフォルダーが唯一のコピーというものがあります。[Mitra カレンダー](integrations/mitra.md)のすべての項目はここにだけ存在します。それだけでなく、アカウントとサインインセッション、接続したアカウントの認証情報、設定、カレンダーの色・並び順・名前、[対応可能時間](availability.md)、タスクの並び順、項目に[添付したファイル](attachments.md)、項目間の一部のリンク、そしてデバイスの[リマインダー](reminders.md)が依存するキーも同様です。このフォルダーを失うと、プロバイダーからは予定とタスクを取り戻せても、それ以外は戻りません。

## バックアップする

普段使っているツールをこのフォルダーに向ければよいだけです: [restic](https://restic.net/)、[Borg](https://www.borgbackup.org/)、`rsync`、ファイルシステムや VM のスナップショット、あるいは素朴なアーカイブでも。

最も安全なのは Mitra を止めてから取ったコピーです:

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

止められない場合でも、Mitra が動いたままフォルダーをコピーしてもたいてい問題ありません。SQLite はこうした扱いによく耐えるからです。ファイルシステムや VM のスナップショットなら、何も止めずに一貫したコピーが取れます。

## 復元する

Mitra を止め、フォルダーを元に戻して、もう一度起動します:

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

フォルダーはまるごと復元してください。中のファイルは一体のもので、異なる日付のファイルを混ぜるとサーバーが壊れます。古いバージョンのバックアップを新しいイメージへ復元しても問題ありません。Mitra は起動時にデータベースを更新します。

## バックアップの対象外

[CalDAV](integrations/caldav.md) サーバーや [Google カレンダー](integrations/google.md)、[Notion](integrations/notion.md) といった接続済みアカウント内の予定とタスクは、それぞれのプロバイダー側にあります。バックアップには Mitra の持つコピーが含まれ、復元後に Mitra が再同期します。

環境変数はデータフォルダーではなく、`compose.yaml` や `.env` ファイルにあります。それらも、バージョン管理やシークレットストアで安全に保管してください。
