---
title: Mitra，一个真正属于你的日历
---
Mitra 的第一个版本：一个把任务和日程放在同一条时间线上的日历，并与你已经在用的日历双向同步。

## 为什么是 Mitra
好用的日历应用有不少，能自己托管的日历也有不少，但很长一段时间里，两者从来不是同一款。

精致的应用运行在别人的服务器上，你写进去的一切它们都看得到。能在自己家里运行的，大多只是服务器：它们忠实地保存你的日历，至于用什么来看，就只能靠你自己去找了。Mitra 的初衷就是两者兼得：一个让人愿意整天开着的日历，运行在你自己的机器上，不受任何人支配。

用它不需要搬家。Mitra 是叠在你现有日历之上的一层，而不是又一个存放日历的地方。每一个承载你时间的来源都是一个集成，与其他集成并排接入：最先是 CalDAV 服务器，之后又陆续加入了许多。它们在同一条时间线上汇合，数据仍各自留在原处。日程和任务也共用这条时间线，把任务塞进日程的这番盘算，再也不必在脑子里进行。

它也押注于今天的 Web，而不是十年前的 Web。Mitra 为现代浏览器而写，充分利用浏览器的原生能力：根据自身空间自适应的布局、就地锚定的弹出层、视图之间的过渡动画，以及真正的日期与时区模型。不背兼容层，也不依赖笨重的框架，它才能保持小巧、迅速，可以安装为应用，在手机上和在电脑上一样顺手。代价是它需要较新的浏览器，而且以后也会一直如此。

这一切背后是一个朴素的信念：你的时间是你最私人的记录。它存在哪里、谁能看到、看起来是否让人安心，都应该由你决定。Mitra 想让这件事变得简单。

[@a11delavar](https://github.com/a11delavar)

## 周视图
一天是一列 24 小时，当前时间处有一条线；一周就是并排的七列。点一下按钮就能回到今天。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="week-dark.webp">
	<img src="week-light.webp" alt="周视图，当前时间处有一条线">
</picture>

文档：[周视图](../../docs/views/week.md)

## 月视图
月视图可以无限滚动，每周一行，每个条目是一根横跨其日期的长条。在顶栏就能在月视图和周视图之间切换。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="month-dark.webp">
	<img src="month-light.webp" alt="月视图，每周一行">
</picture>

文档：[月视图](../../docs/views/month.md)

## 日程和任务
任务和日程一样排在当天，做完了勾一下就好。在网格中拖动即可新建条目，拖动条目即可移动，每个日历还可以有自己的颜色。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="entries-dark.webp">
	<img src="entries-light.webp" alt="同一天里并排的日程和任务">
</picture>

文档：[条目](../../docs/entries.md)

## CalDAV
连接一个 CalDAV 服务器，选择要显示其中哪些日历，Mitra 会让它们双向保持同步，在别处做的修改也会实时出现。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="caldav-dark.webp">
	<img src="caldav-light.webp" alt="连接 CalDAV 服务器">
</picture>

文档：[CalDAV](../../docs/integrations/caldav.md)

## Markdown 备注
条目的描述支持 Markdown：标题、列表和链接都会按格式显示，在其他应用里则仍是纯文本。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="markdown-dark.webp">
	<img src="markdown-light.webp" alt="用 Markdown 写在条目描述里的会议议程">
</picture>

## 贡献者
- [@a11delavar](https://github.com/a11delavar)
