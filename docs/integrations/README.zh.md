---
title: 集成
description: 把日历直接存在 Mitra 中，或者连接 CalDAV、Google 日历、Apple 日历、日历订阅、Notion 和 Tempo，并了解同步的工作方式。
sidebar:
  label: 概览
---

在 Mitra 中管理日历有两种方式。一种是直接存在 Mitra 里，也就是存在你自己的服务器上，不依赖任何账号。另一种是连接你已有的账号，由 Mitra 与其中的日历双向同步。大多数人最后会两种都用，条目也可以在两者之间随意移动。

无论哪种方式，都从侧边栏底部的 **添加集成** 开始。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../assets/screenshots/integrations-detail-dark.webp">
  <img src="../../assets/screenshots/integrations-detail-light.webp" alt="“添加集成”对话框，可选择 Mitra、CalDAV、Google 日历、Apple 日历、日历订阅、Notion 和 Tempo" />
</picture>

## 各集成能存放什么

| 集成 | 存放的内容 | 服务器端设置 |
| --- | --- | --- |
| [Mitra](mitra.md) | 日程和任务，存储在 Mitra 中 | 无需设置 |
| [CalDAV](caldav.md) | 任意 CalDAV 服务器上的日程和任务 | 无需设置 |
| [Google 日历](google.md) | Google 账号中的日历 | 一次性的 OAuth 设置 |
| [Apple 日历](apple.md) | iCloud 账户中的日历 | 无需设置 |
| [日历订阅](subscriptions.md) | 公开发布的 `webcal://` 或 `.ics` 订阅源，只读 | 无需设置 |
| [Notion](notion.md) | Notion 数据库视图中的任务 | 无需设置 |
| [Tempo](tempo.md) | 你在 Jira 工作项上登记的工时 | 无需设置 |

每家服务商能存的内容各不相同。比如 Notion 任务不能重复，Tempo 工时记录没有地点。日历存不了的字段，Mitra 会直接隐藏，这样你输入的内容就不会在下次同步时消失。

## 同步的工作方式

连接账号后，Mitra 会找出其中的所有日历并列出来，默认全部勾选。保存之前，取消勾选你不需要的日历，Mitra 就会导入其余的日历。之后账号里新出现的日历默认不勾选，所以不经你同意，不会有新内容出现在你的日历上。已关闭的日历，Mitra 一律不会下载。

此后，服务器会在后台自动同步。有人打开 Mitra 时同步得更频繁，没人使用时则放慢节奏：

| | Mitra 打开时 | 无人打开时 |
| --- | --- | --- |
| CalDAV 和 Apple 日历 | 每 10 秒 | 每 5 分钟 |
| Google 日历、Notion 和 Tempo | 约每分钟一次 | 每 5 分钟 |
| 日历订阅 | 每 15 分钟 | 每 15 分钟 |
| Mitra 日历 | 无需同步 | 无需同步 |

Google、Notion 和 Tempo 限制了应用调用它们的频率，所以同步慢一些。打开 Mitra 时，所有到了同步时间的账号会立即同步，因此不需要什么刷新按钮。

改动是双向的。你新建、编辑、移动或删除条目时，Mitra 会把改动写回条目所属的日历。某个账号同步失败不会耽误其他账号：Mitra 会在一分钟后重试。

有些日历无法在 Mitra 中修改，比如订阅的日历，以及别人只共享给你查看的日历。不过你仍然可以给它们重命名、换颜色或隐藏它们，详见[只读日历](../calendars.md#read-only-calendars)。

> [!NOTE]
> 同步只会获取有变化的内容。如果某个日历看起来不对劲，可以在它的 **⋯** 菜单中选择 **重新导入条目**：Mitra 会丢弃自己保存的副本，从服务商那里重新导入，详见[重新导入日历](../calendars.md#re-import-a-calendar)。无论如何，服务商那边的数据都不会被改动。

## 修改账号

每个账号只能连接一次。要修改账号密码，或者调整 Mitra 显示哪些日历，请在账号的 **⋯** 菜单中选择 **编辑**，不要重新添加。Google 日历是个例外：再次连接同一个 Google 账号，会更新 Mitra 对它的访问授权。
