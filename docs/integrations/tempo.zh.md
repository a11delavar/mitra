---
title: Tempo
description: 在日历上查看你在 Tempo 中登记的工时，并直接在 Mitra 中登记、移动、调整和删除它们。
---

[Tempo](https://www.tempo.io/) 是 Jira 的工时记录应用。Mitra 会把你的**工时记录**（也就是你在 Jira 工作项上登记的工时）作为有具体时间的条目显示在日历上，旁边就是这些时间所对应的会议和任务。

工时记录双向同步。移动条目或调整它的时长，就能修改你工作的时间和时长；编辑描述可以修改工时记录的备注；删除条目会删除对应的工时记录；新建条目则会登记新的工时。

只需在应用里用两个 API 令牌连接即可，服务器端无需任何设置。

## 连接你的工时表

Mitra 需要两个令牌，一个来自 Tempo，一个来自 Atlassian：Tempo 保存工时，Jira 则知道有哪些工作项以及你是谁。

1. 创建 Tempo API 令牌。在 Jira 中打开 Tempo 的 **Settings**（齿轮图标）→ **Data Access** → **API integration**，选择 **New Token**，命名为“Mitra”，然后复制令牌。
2. 在 [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) 点击 **Create API token** 创建一个 Atlassian API 令牌，并复制下来。两个令牌要用同一个 Jira 用户创建。
3. 在 Mitra 中，点击侧边栏底部的**添加集成**，选择 **Tempo**，然后填写：
   - **站点 URL**：你的 Atlassian 地址，例如 `https://your-company.atlassian.net`。
   - **Tempo API 令牌**：第 1 步中的令牌。
   - **Atlassian 账号邮箱**：你的 Atlassian 账号的邮箱地址。
   - **Atlassian API 令牌**：第 2 步中的令牌。
4. 点击**连接**。Mitra 会列出一个日历：**My worklogs**。
5. 保持它开启，然后点击**保存**。

Tempo 限制了应用调用它的频率，所以 Mitra 大约每分钟同步一次（参见[同步的工作方式](README.md#how-syncing-works)）。

## 工时记录的显示方式

条目的标题是工时所登记的 Jira 工作项，由它的键和摘要组成：

```text
ACME-1234 Code review for auth migration
```

工时记录的备注则是条目的描述。Tempo 自己的应用也是这样显示的：工作项说明了这段时间花在什么事情上，而备注往往只是“Review”这样的活动标签，或者是 Jira 替你填写的文字，例如“Working on work item ACME-1234”。

标题属于工作项，所以已保存的工时记录不能修改标题：Mitra 不会因为你改了一个日历条目，就去重命名 Jira 工作项。想说明你做了什么，请编辑描述。如果 Jira 无法给出工作项的名称（比如工作项已被删除，或者你已经没有查看权限），标题会显示 `#` 加上工作项的 ID，条目仍然可以正常使用。

Tempo 以普通的时钟时间保存工时记录，不带时区。Mitra 按你 Jira 个人资料中的时区来读取，所以显示的时间与 Tempo 中一致。

有些 Tempo 站点关闭了开始时间。在这样的站点上，同一天的所有工时记录都从同一时间开始，因此会叠在一起，但它们的时长是准确的。

## 在 Mitra 中登记工时

在 **My worklogs** 中新建一个有具体时间的条目，并在标题中的任意位置写上 Jira 工作项的键：

| 你输入的标题 | 登记到 |
| --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` |
| `Investigating ACME-1234 regression` | `ACME-1234` |
| `ACME-1234` | `ACME-1234` |

Mitra 会在你能看到的 Jira 项目中核对这个键。如果标题里没有这样的键，或者 Jira 中没有这个工作项，Mitra 不会登记任何工时，并会告诉你原因。

工时记录的备注就是你在描述中写的内容；如果描述留空，则是你输入的完整标题。工时登记后，标题会变为工作项的键和摘要。这个替换只在登记时发生一次，所以在登记之前你可以随意修改标题，登记之后就不行了。

> [!TIP]
> 要在以前登记过的工作项上再登记工时，可以复制它的某个条目：按住 <kbd>Alt</kbd>（Mac 上按 <kbd>⌥</kbd>）把它拖到新的时间，或者在编辑器的 **⋯** 菜单中选择**创建副本**。

## 修改工时记录

移动、调整时长、删除以及编辑描述，都会直接同步到 Tempo。有几点需要注意：

- 工时记录始终属于原来的工作项。Tempo 无法把工时记录移到另一个工作项，所以如果要把这段时间登记到别处，请删除这个条目，再用正确的键新建一个。
- Mitra 修改工时记录时，会保留 Tempo 自己的详细信息，例如计费工时和工作属性。
- 如果 Tempo 中的某个工时表周期已经关闭或审批通过，Tempo 会拒绝在其中添加、修改或删除工时记录。

要在 Jira 中打开工作项，在编辑器的 **⋯** 菜单中选择**在 Jira 中打开**。

## 工时记录无法保存的内容

一条工时记录就是某一天里的一段时间，登记在一个工作项上。因此 Tempo 日历只能保存有具体时间的条目：没有全天条目、重复、提醒、地点、参与者、关联、忙碌或空闲状态、可见性，也没有[可用时间](../availability.md)。Mitra 会在工时记录上隐藏这些字段。

## 故障排除

- 如果 Mitra 提示“Tempo rejected the API token”，请新建一个 Tempo API 令牌，并在该账号的 **⋯ → 编辑**中填入。
- 如果 Mitra 提示“Jira rejected the e-mail and API token”，请确认这个邮箱地址属于创建该 API 令牌的 Atlassian 账号。
- 如果工时记录显示的时间不对，请检查 Jira 个人资料中的时区（**Account settings** → **Time zone**）。修改之后，在 **My worklogs** 的 **⋯** 菜单中使用**重新导入条目**，让已有的工时记录也一起调整过来。
- 如果每天的工时记录都叠在同一时间，说明你的 Tempo 站点关闭了开始时间。工时本身仍然是准确的。
