---
title: 附件
description: 给日程或任务添加文件。Mitra 把文件保存在你的服务器上，并随条目一起存储，其他日历应用也能看到。
---

条目可以带有**附件**，比如一张票、一张白板照片或一份菜谱。Mitra 把文件保存在你的服务器上，并以标准日历格式随条目一起存储，因此使用同一日历的其他应用（例如 Nextcloud 或 Apple 日历）会在同一个日程上显示同一个文件。

## 添加文件

打开条目，点击带回形针那一行中的 **＋**；如果这一行还是空的，也可以直接点击**附件**，然后选择一个或多个文件。每个附件都会显示表示文件类型的图标、文件名和大小。点击附件会在新标签页中打开它，点击它的 **✕** 则会把它从条目中移除。

日历中的条目上如果有回形针，就表示这个条目带有文件。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/attachments-detail-dark.webp">
  <img src="../assets/screenshots/attachments-detail-light.webp" alt="周视图中打开的一个任务，旁边是它在日历中的条目，条目上的回形针表示它带有文件：编辑器在描述上方列出一个 PDF、一张草图和一个电子表格，描述中显示着这张草图" />
</picture>

链接不是附件。要给条目添加链接，把它写进描述，[链接](links.md)一行就会显示它。

## 文件保存在哪里

你添加的文件保存在 Mitra 数据文件夹的 `files` 文件夹中，就在数据库旁边，所以[备份](backups.md)这个文件夹时也会一并备份它们。每个文件都以随机名称而不是原文件名保存，同一个文件添加两次也只保存一份。

> [!IMPORTANT]
> 任何拿到文件地址的人，无需登录 Mitra 就能打开它。正因如此，其他日历应用才能打开这个文件：Mitra 会把地址写进你的日历，而这些应用无法登录 Mitra。地址中包含一段无法猜到的随机字符，但请像对待任何分享链接一样对待它。如果想换一个新地址，移除这个附件，再重新添加文件即可。

图片、视频、音频、PDF 和纯文本会在浏览器中打开。其他类型的文件都会直接下载，因此文件永远无法在 Mitra 内运行代码。

## 限制

单个文件最大 25 MB，每个人能存储的总量不设上限。服务器管理员可以更改这两项，也可以关闭添加文件的功能，参见[配置](configuration.md#attachments)。在[演示版](https://demo.mitracal.com)中，添加文件的功能始终关闭。

不再被任何条目使用的文件，会在添加后大约一天被删除。在那之前，你仍然可以把它添加到尚未保存的条目中，或者在误删后把它重新添加回来。

## 哪些日历支持附件

来自 [CalDAV 服务器](integrations/caldav.md)和 [Apple 日历](integrations/apple.md)的日历可以存放附件，[Mitra 日历](integrations/mitra.md)也可以。在[日历订阅](integrations/subscriptions.md)中，你能看到订阅源自带的附件，但无法更改它们。

文件也可以出现在描述中：点击附件那一行上的图片或链接按钮，就会把它添加到文本末尾，图片以图片形式插入，其他文件则以链接形式插入。移除附件时，描述中的这些内容也会一并移除。

在 [Google 日历](integrations/google.md)中，附件是在 Google 日历中附加的 Google 云端硬盘文件：Mitra 会显示它们，但无法添加或移除。[Notion](integrations/notion.md)、[Todoist](integrations/todoist.md) 和 [Tempo](integrations/tempo.md) 日历没有附件这一行。把带附件的条目移动到这些日历中会丢失它的文件，Mitra 会在移动之前提醒你。

> [!NOTE]
> 其他应用添加的附件也会显示在 Mitra 中，包括日历服务器自己存储的文件，这些文件通过该服务器自己的地址打开。Mitra 会原样保留它无法识别的附件，因此在 Mitra 中编辑条目永远不会改动其他应用的附件。
