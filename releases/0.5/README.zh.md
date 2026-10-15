---
title: 关联、时间线和例行事项
---
这个版本让条目之间可以相互依赖。把任务关联到它要等待的任务，或者组成它的各个部分，就能在一周中看到画出的连接线；其中一个移动，整条依赖链都会跟着移动。时间线视图按截止日期排开未完成的任务，月视图和年视图则把日常习惯收成低调的小标记。

## 关联
把一个条目设为另一个条目的子任务，或者让它等待某个必须先完成的条目。从条目上的手柄拖到它所属的条目，Mitra 就会在一周中画出连接线，有具体时间的条目和全天条目之间都可以，在 Notion 中也会保留下来。移动一个条目，所有等着它的条目都会跟着移动。如果某条关联不再成立，比如一个条目现在比它的前置条目还先开始，Mitra 会提醒你。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="relationships-dark.webp">
	<img src="relationships-light.webp" alt="周视图中以连接线显示的依赖关系">
</picture>

文档：[依赖关系](../../docs/dependencies.md)

## 时间线视图
未完成的任务每个一行，从开始时间到截止日期画成一根长条，一段工作在你动手规划之前就能看出全貌。重叠、空档和超出日期的任务都一目了然。滚出视野的任务会在边缘留下一个标记，点一下就能回到它；例行事项只显示下一次的截止日期。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="timeline-dark.webp">
	<img src="timeline-light.webp" alt="时间线视图，未完成的任务按日期显示为长条">
</picture>

文档：[时间线视图](../../docs/views/timeline.md)

## 例行事项
每天或每周都要做的事，比如健身或吃药，在月视图和年视图中会收成小标记，再忙的月份也能一眼看清。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="routines-dark.webp">
	<img src="routines-light.webp" alt="月视图中以小标记显示的每日和每周例行事项">
</picture>

文档：[例行事项](../../docs/routines.md)

## 任务进度
有子任务的任务会随着子任务完成逐渐填满一个圆环；最后一个子任务完成时，Mitra 会问你要不要把这个任务也标为完成。没有子任务的任务，可以自己设置完成的百分比。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="progress-dark.webp">
	<img src="progress-light.webp" alt="根据已完成的子任务计算出的任务进度">
</picture>

文档：[子任务](../../docs/subtasks.md)

## 未安排的任务
任务不再非得有个日期。还不确定什么时候做，就先不安排；想好了，再给它安排时间。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="unscheduled-dark.webp">
	<img src="unscheduled-light.webp" alt="列在周视图旁边的未安排任务">
</picture>

文档：[规划](../../docs/planning.md)

## Tempo
你在 Tempo 中记录的 Jira 工时会显示为一个日历；在这个日历里新建条目，就会在标题中注明的工作项上记录工时。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="tempo-dark.webp">
	<img src="tempo-light.webp" alt="可添加的集成中的 Tempo">
</picture>

文档：[Tempo](../../docs/integrations/tempo.md)

## 更多语言
除了英语和德语，Mitra 现在还会说法语、西班牙语、葡萄牙语和意大利语。

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="languages-dark.webp">
	<img src="languages-light.webp" alt="法语界面的 Mitra">
</picture>

文档：[设置](../../docs/settings.md)

## 贡献者
- [@a11delavar](https://github.com/a11delavar)
