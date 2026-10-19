---
title: AI 连接器
description: 把 Claude、Cursor 等 AI 工具连接到 Mitra，让它们能读取和更改你的日历。
---

Mitra 支持 Model Context Protocol（MCP），所以 AI 工具可以处理你的日历：查看你的一周，找到某个条目，安排一项任务，挪动一场会议。每个工具都连接到同一个地址 `https://<你的 Mitra>/api/mcp`，它显示在**设置 → AI** 的 **AI 连接器**下。Claude 把这样的连接叫作连接器，Cursor 等工具则叫作 MCP 服务器。

已连接的工具在 Mitra 里看到和能改的，与你完全相同，涵盖你所有已连接的日历；它做出的更改也会像你自己的更改一样同步到提供方。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/ai-connectors-detail-dark.webp">
  <img src="../assets/screenshots/ai-connectors-detail-light.webp" alt="设置对话框，当前显示“AI”页面和要连接的地址" />
</picture>

## 连接工具

在需要[登录](sso.md)的服务器上，工具需要一个访问令牌：

1. 打开**设置 → AI**，在**访问令牌**下选择**新建令牌**。
2. 按用途给它命名，比如笔记本电脑或 Claude，然后选择**只读**或**读写**。
3. 复制令牌。Mitra 只保存它的指纹，所以令牌只会显示这一次。

在你撤销之前，令牌一直代表你；撤销就在同一个列表里，列表还会显示每个令牌上次使用的时间。只读令牌只向工具提供读取的功能。

没有登录时，Mitra 只供一个人使用，不需要令牌：有地址就够了。这样一来，任何能访问这个地址的人都能使用它，所以请让这样的服务器保持私密。

很多工具也能自行完成设置：让 Claude Code 或 Cursor 用令牌连接到这个地址，它就会自己写好配置。下面的示例是手动完成同样的事；不需要令牌时，去掉 `Authorization` 请求头即可。

### Claude Code

```sh
claude mcp add --transport http mitra https://mitra.example.com/api/mcp --header "Authorization: Bearer mitra_…"
```

### Cursor

把 Mitra 添加到项目中的 `.cursor/mcp.json`，或添加到 `~/.cursor/mcp.json` 以用于所有项目：

```json
{
  "mcpServers": {
    "mitra": {
      "url": "https://mitra.example.com/api/mcp",
      "headers": { "Authorization": "Bearer mitra_…" }
    }
  }
}
```

### Claude Desktop

Claude Desktop 通过 `mcp-remote` 访问需要令牌的地址，这需要 Node.js。把它添加到 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "mitra": {
      "command": "npx",
      "args": ["mcp-remote", "https://mitra.example.com/api/mcp", "--header", "Authorization:${MITRA_TOKEN}"],
      "env": { "MITRA_TOKEN": "Bearer mitra_…" }
    }
  }
}
```

## 已连接的工具能做什么

已连接的工具处理你的日历的方式，和你在 Mitra 里一样。它可以：

- 查看某一天或某一周，包括已逾期和仍未安排的内容
- 查找条目并读取完整内容
- 创建、更改、完成和删除条目，对重复条目可以只改其中一次，也可以全部更改
- 在支持[参与者](participants.md)的日历中邀请他人；对方是否会收到通知取决于提供方
- 把条目关联为[依赖关系](dependencies.md)和[子任务](subtasks.md)
- 在提供方允许时创建和删除日历

它会读取你所有的日历，包括你在侧边栏中隐藏的日历；它也知道你的时区，以及你在**设置 → 常规**中选择的语言和地区，所以能按你习惯的写法表达日期。

> [!CAUTION]
> 条目可能来自别人也能写入的日历，比如共享日历或一封邀请。它们的文字会像工具读取的其他内容一样传给工具，所以只把可写入的令牌交给你信得过的工具：即使面前摆着陌生人写的一张字条，你也放心让它操作。

## 在浏览器中

如果浏览器自带的助手能够使用网页提供的功能（WebMCP，Chrome 的一项早期功能），打开着的 Mitra 也会提供同样的功能，无需任何设置。

## 关闭

把 [`MITRA_MCP`](configuration.md) 设为 `off`，任何工具都无法连接。[演示版](https://demo.mitracal.com)从不接受连接。
