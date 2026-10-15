---
title: 快速入门
description: 用 Docker Compose 安装 Mitra，添加你的第一个日历，再试试几个功能。
sidebar:
  label: 快速入门
---

Mitra 是一款自托管的日历，用来管理你的日程和任务。想先四处看看，可以[试用演示版](https://demo.mitracal.com)。

## 安装 Mitra

安装好 [Docker](https://docs.docker.com/get-docker/) 及其 Compose 插件后，创建一个 `compose.yaml`：

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

运行 `docker compose up -d`，然后打开 [http://localhost:3000](http://localhost:3000)。

在正式使用之前，请先[备份](backups.md) `~/mitra`，并[为它配置 HTTPS](configuration.md#put-it-behind-https)。如果还有其他人要用，请先开启[登录](sso.md)，因为以后再开启的话，每个人都要从一个空账号重新开始。

## 添加日历

第一次打开 Mitra 时，它会引导你添加日历：可以是保存在你服务器上的 [Mitra 日历](integrations/mitra.md)，也可以是你已有的账号，比如 [CalDAV](integrations/caldav.md) 或 [Google 日历](integrations/google.md)。

## 试试这些

- 在[周视图](views/week.md)中，在一段空白时间上拖动，即可新建日程。
- 在侧边栏的[规划](planning.md)标签页中按 **添加任务**，之后再把任务拖进你的一周。
- 按 <kbd>/</kbd>，运行 **添加可用时间**，为你的[工作时间](availability.md)加上底色。
- [在手机上安装 Mitra](install-app.md)，以便接收[提醒](reminders.md)。
- 按 <kbd>?</kbd> 查看所有[键盘快捷键](shortcuts.md)。
