---
title: Mitra 日历、表格视图、截止日期
---
这个版本让 Mitra 有了自己的日历，能把条目排成表格，还给任务补上了一直缺少的约束条件：截止日期、预估时长，以及你要留出来的时间。Mitra 也开始支持波斯语，连同波斯历一起。

## Mitra 日历
日历可以直接存在 Mitra 里，不需要任何账号，也不用登录。安装 Mitra，添加一个日历，就可以开始规划了。你用的每台设备上都能看到它；以后连接了账号，其中的条目随时可以移过去。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="calendars-detail-dark.webp">
	<img src="calendars-detail-light.webp" alt="侧边栏中的日历">
</picture>

文档：[Mitra 日历](../../docs/integrations/mitra.md)

## 表格视图
每个条目一行。你可以选择要列出的时间范围，从过去一个月到全部条目；在标题、地点和描述中搜索；同时按多列排序；按状态、日历、类型或是否重复来筛选。选中多行，就能一次修改多个条目。标题列显示的就是日历里的那个条目块，所以条目可以直接在这里打开。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="table-detail-dark.webp">
	<img src="table-detail-light.webp" alt="表格视图，时间、日历、状态和参与者各占一列">
</picture>

文档：[表格视图](../../docs/views/table.md)

## 截止日期和预估时长
任务在安排时间之前，就可以先设定截止日期和预估时长。未安排的任务会在“规划”中按截止日期先后排列；把其中一个拖进周视图，预估时长就成了它的时长。错过日期的任务会集中在上方的“已逾期”分组里。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="plan-task-dark.webp">
	<img src="plan-task-light.webp" alt="从“规划”拖进周视图的任务，预估时长成了它的时长">
</picture>

文档：[规划](../../docs/planning.md)

## 描述中的清单
任务的描述里可以写一个 Markdown 清单，而且复选框是真的能勾：在编辑器里勾选一项，Mitra 会把它写回文本，这个日历上的其他应用也都能看到。复选框和子任务合在一起计数，每个算一个步骤：一个任务有三个复选框和一个子任务，就是四个步骤；勾掉一个复选框、完成那个子任务后，它的状态菜单会显示“4 个步骤中已完成 2 个”，条目上的圆环也会填满一半。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="checklist-dark.webp">
	<img src="checklist-light.webp" alt="任务的清单和子任务，在状态菜单中合计为“4 个步骤中已完成 2 个”">
</picture>

文档：[子任务](../../docs/subtasks.md)

## 可用时间
在任意日历中画出你工作、锻炼或想要留空的时段。它们会在周视图中以底色标出，让空闲的时间一目了然。标为忙碌的时段，和你共享日历的人会看到你在忙；标为空闲的，则只留给你自己。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="availability-detail-dark.webp">
	<img src="availability-detail-light.webp" alt="可用时间以底色标出一周中的时段">
</picture>

文档：[可用时间](../../docs/availability.md)

## 链接集中在一行
条目描述或地点中的每一个链接，都会汇集到编辑器的“链接”一行里，并按它指向的地方命名：网页显示网站名，会议显示服务名，笔记显示应用名。如果地点本身就是一个链接，它会直接显示为这个链接。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="links-detail-dark.webp">
	<img src="links-detail-light.webp" alt="条目的“链接”一行">
</picture>

文档：[链接](../../docs/links.md)

## 波斯历
Mitra 会说波斯语了，波斯历也随这门语言一起到来：标题栏和日期选择器中显示波斯历的月份和星期，日期也可以按波斯语的习惯输入。你的条目不会挪动位置，变的只是它们的显示方式。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="persian-calendar-detail-dark.webp">
	<img src="persian-calendar-detail-light.webp" alt="波斯语界面的条目编辑器，日期选择器打开在一个波斯历月份">
</picture>

文档：[设置](../../docs/settings.md)

## 贡献者
- [@a11delavar](https://github.com/a11delavar)
