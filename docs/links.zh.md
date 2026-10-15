---
title: 链接
description: Mitra 如何显示条目中的链接：要加入的会议、要打开的笔记、要阅读的网页。
---

条目中的链接会显示它指向的内容，而不是原始网址。会议链接显示为 **加入 Google Meet**，指向 Obsidian 笔记的链接显示笔记的名称，网页则显示站点和路径，例如 `example.atlassian.net/browse/DEV-9177`。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/links-detail-dark.webp">
  <img src="../assets/screenshots/links-detail-light.webp" alt="条目编辑器中，描述上方有一行“链接”，其中是一个指向 Obsidian 笔记的链接" />
</picture>

## 在编辑器中

如果条目的描述中有链接，编辑器会把它们集中显示在描述正上方的 **链接** 一行中，这样不用通读全文就能打开它们。点击即可打开：网页会在新标签页中打开，其他链接则会打开对应的应用。链接超过两行时，这一行可以滚动。

这一行本身不存储任何内容，它只是显示描述中已有的链接。要添加或删除链接，直接编辑描述，这一行会随之更新。你使用的其他日历应用，在描述中看到的也是同样的链接。

## 在描述中

描述中的链接前面会有一个小图标，表示它会打开什么。直接贴上的网址（比如从浏览器复制来的）会缩写为站点和路径。你用自己的文字写成的链接，则保留你的文字。

Mitra 还能识别应用链接，例如 `obsidian://open?vault=…`，而大多数日历应用只会把这类链接当作纯文本。会执行代码的链接（如 `javascript:`）会显示为纯文本，绝不会显示为链接。

## 地点中的会议链接和应用链接

如果地点只是一个链接，Mitra 会把它当作链接，而不是地点。Zoom、Google Meet、Microsoft Teams、Webex、Jitsi、Whereby、FaceTime 或 Skype 链接，在编辑器、日历和表格中都会显示为 **加入** 加上服务名称，并且不会显示地图按钮。要编辑这个链接，点击它旁边的空白处即可。

## 应用链接

Mitra 会根据链接的地址判断它属于哪个应用。它能识别 Obsidian、Notion、Slack、Linear、Figma、Things、OmniFocus、Bear、Craft、Drafts、DEVONthink、Evernote、OneNote、Visual Studio Code、Cursor 和 Spotify。所有应用链接，无论能否识别，都使用同一个“在其他应用中打开”的图标。

> [!NOTE]
> 网页无法得知某个应用是否已安装。第一次打开应用链接时，浏览器会询问是否打开该应用。如果没有安装这个应用，则什么都不会发生。
