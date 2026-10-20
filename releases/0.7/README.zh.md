---
title: AI 连接器、附件、地区和语言
---
Mitra 0.7 可以与你已经在用的 AI 助手配合，让它们直接在你的日历里帮你规划时间。现在你可以给条目附加文件，Mitra 会按你所在地区的习惯书写日期，出行时你的主时区也会一直跟着你。Mitra 有了中文版，你还可以直接在应用里查看更新内容。拖动、缩放和加载都更快了，此外还有许多小改进和修复。

## AI 连接器
Claude、Cursor 等 AI 助手现在可以处理你的日历了。用“设置 → AI”中显示的地址连接一个助手，然后把原本要亲手做的事交给它，比如查看你的一周、查找某个条目、规划一次出行或挪动一场会议。它写入的内容会像其他任何更改一样进入你的日历，并从那里同步出去。在需要登录的服务器上，每个助手都有自己的访问令牌，可以限制为只读，也可以随时撤销。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="connectors-dark.webp">
	<img src="connectors-light.webp" alt="AI 助手把计划好的巴黎之行写进这一周：原来的安排一个个移走，行程逐项出现，最后打开埃菲尔铁塔，可以看到它的照片和门票">
</picture>

埃菲尔铁塔照片：David McSpadden，Wikimedia Commons，CC BY 2.0。

文档：[AI 连接器](../../docs/ai-connectors.md)

## 地区与语言
选择语言时，可以一并选择你所在的国家或地区。Mitra 会按当地人的习惯显示日期、时间和数字。一周从当地习惯的那一天开始，周末也落在你休息的日子上。做决定之前，可以先预览一切会显示成什么样。另外，即使你的键盘输入的是其他文字（比如波斯文），键盘快捷键现在也照样可用。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="locales-dark.webp">
	<img src="locales-light.webp" alt="“语言”设置展开了语言列表，其中意大利语下列出了使用意大利语的国家和地区">
</picture>

文档：[设置](../../docs/settings.md)

## 主时区
Mitra 现在知道你的主时区，并把它保存在你的账号里。出门在外时，日历会跟随设备所在的时区，主时区则留在旁边的一列。你的时区列表保持不变，所以回到家后，又只会看到一列。你添加的时区和给它们起的名字，在每台设备上都一样。每一列的标题，都是当地人实际使用的时区简称。

时区选择器也重新设计了。名称相同、时间也相同的时区合并成一行，你所在国家的时区排在最前面。房子图标标出你的主时区，图钉图标标出你出行时所在的时区。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="time-zones-dark.webp">
	<img src="time-zones-light.webp" alt="时区选择器打开在主时区上，周围是分组后的其他时区">
</picture>

> [!NOTE]
> 如果你曾给当前所在的时区起过名字，请再起一次。以前，这些名字只保存在你设置它们的那台设备上；从现在起，名字会跟着你到每一台设备。

文档：[时区](../../docs/time-zones.md)

## 附件
现在可以给条目附加文件了，比如一张票、一份议程或一张白板照片。在条目编辑器里用回形针添加，或者把文件拖到打开的条目上。点击文件即可打开。你也可以把文件添加到描述中：图片会显示为图片，其他文件显示为链接。之后如果移除这个文件，Mitra 也会把它从描述中移除。

附件会随日历同步。在 CalDAV 日历中，使用同一日历的其他应用能看到你附加的文件，Mitra 也会显示它们附加的文件。在 Google 日历中，Mitra 会显示附加到日程的 Google 云端硬盘文件，但无法添加或移除，因为 Google 只保留云端硬盘文件。Notion 页面中的图片现在会显示在任务的描述里。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="attachments-dark.webp">
	<img src="attachments-light.webp" alt="一个打开的任务，旁边是它在本周中的条目，回形针表示它带有文件：编辑器在描述上方列出一个 PDF、一张草图和一个电子表格，描述中显示着这张草图">
</picture>

> [!NOTE]
> Mitra 把你附加的文件保存在它的数据文件夹中，所以备份这个文件夹也就备份了你的文件。你可以用 `MITRA_FILE_MAX_SIZE` 限制单个文件的大小，用 `MITRA_FILE_QUOTA` 限制每个人总共能存储多少。

文档：[附件](../../docs/attachments.md)

## 应用内的版本说明
现在不用离开 Mitra 就能知道有哪些更新。“关于”对话框会像网站一样展示每个版本。你可以在这里看到当前版本的说明和图片，以及之后发布的修复。每一个提交也都列在其中，平时收起，需要时再展开。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="about-dark.webp">
	<img src="about-light.webp" alt="“关于”对话框，显示某个版本的说明和图片">
</picture>

## 中文
Mitra 现在支持中文，界面使用简体字。应用本身、示例日历、文档和网站都已翻译成中文，中文文字还采用了专为中文设计的字体。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="chinese-detail-dark.webp">
	<img src="chinese-detail-light.webp" alt="中文界面的条目编辑器，日期选择器打开在当月">
</picture>

文档：[设置](../../docs/settings.md)

## 贡献者
- [@a11delavar](https://github.com/a11delavar)
- [@d8monx](https://github.com/d8monx)
