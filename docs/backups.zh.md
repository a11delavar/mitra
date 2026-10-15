---
title: 备份
description: Mitra 存储的所有内容都在一个文件夹里。用你现有的任何工具备份它即可。
---

Mitra 把所有内容都保存在一个文件夹中：容器内的 `/app/data`，如果你按照[快速入门](README.md#install-mitra)操作，它在宿主机上就是 `~/mitra`。备份了这个文件夹，就备份了整个实例。不需要导出数据库服务器，也不需要挑拣配置文件。

> [!CAUTION]
> 你在 Mitra 中保存的部分内容，只有这个文件夹里的这一份。[Mitra 日历](integrations/mitra.md)中的每个条目都只存在这里，别处没有。同样只存在这里的还有：用户账号和登录会话、已连接账号的凭据、你的设置、日历的颜色、顺序和名称、你的[可用时间](availability.md)、任务的排序、条目之间的部分关联，以及设备接收[提醒](reminders.md)所依赖的密钥。一旦丢失这个文件夹，服务商只能还给你它那里的日程和任务，其他一切都无法找回。

## 备份

用你已经在用的任何工具备份这个文件夹即可：[restic](https://restic.net/)、[Borg](https://www.borgbackup.org/)、`rsync`、文件系统或虚拟机快照，或者一个普通的压缩包。

最稳妥的做法是在 Mitra 停止运行时进行备份：

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

如果无法停止 Mitra，在它运行时复制文件夹通常也没问题，因为 SQLite 能很好地应对这种情况。文件系统或虚拟机快照则无需停止任何服务，就能得到一份一致的副本。

## 恢复

停止 Mitra，放回文件夹，再重新启动：

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

请整体恢复这个文件夹。其中的文件是一个整体，把不同日期的文件混在一起可能会损坏实例。旧版本的备份可以直接恢复到新版本的镜像上，因为 Mitra 会在启动时自动更新数据库。

## 备份不包含的内容

已连接账号中的日程和任务，比如 [CalDAV](integrations/caldav.md) 服务器、[Google 日历](integrations/google.md)或 [Notion](integrations/notion.md) 中的内容，保存在这些服务商那里。备份中包含 Mitra 保存的副本，恢复之后 Mitra 会重新同步它们。

你的环境变量保存在 `compose.yaml` 或 `.env` 文件中，不在数据文件夹里。请同样妥善保管它们，比如放进版本控制或密钥管理工具中。
