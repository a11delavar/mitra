---
title: Google 日历
description: 为你的 Mitra 服务器设置一次 Google 登录，之后就可以在应用中连接 Google 账号，双向同步其中的日历。
---

Mitra 通过 CalDAV 连接 Google 日历，和连接其他日历服务器一样。不同之处在于登录方式：Google 不接受密码，而是让你在它自己的页面上授予访问权限。为此，Google 需要知道你的 Mitra 服务器，所以服务器的管理员要先在 Google 那里注册一次，再把 Google 提供的客户端 ID 和客户端密钥交给 Mitra。

之后，每个使用 Mitra 的人都可以在应用中连接自己的 Google 账号，各自单独授权。设置分为三步：

1. [在 Google 注册 Mitra](#register-mitra-with-google)。
2. [把客户端 ID 和密钥交给 Mitra](#give-mitra-the-client-id-and-secret)。
3. [连接账号](#connect-an-account)。

前两步每台 Mitra 服务器只需做一次。

## 在 Google 注册 Mitra

1. 在 [Google Cloud 控制台](https://console.cloud.google.com)中创建一个项目，然后在 **API 和服务**（APIs & Services）中启用 **CalDAV API**。
2. 配置 **OAuth 同意屏幕**（OAuth consent screen）。你可以把自己和其他所有要连接账号的人添加为**测试用户**（test user），也可以直接发布应用。
3. 创建一个类型为 **Web 应用**（Web application）的 **OAuth 客户端**（OAuth client）。在**已获授权的重定向 URI**（authorized redirect URI）中，填入你的 Mitra 服务器地址，后面加上 `/api/integrations/google/callback`：

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. 复制 Google 显示的**客户端 ID**（client ID）和**客户端密钥**（client secret）。

> [!CAUTION]
> 同意屏幕处于测试阶段时，Google 会在 7 天后让每次授权失效，所有人每周都得重新连接一次账号。发布应用后，授权就会一直有效。

## 把客户端 ID 和密钥交给 Mitra

把它们设为环境变量，同时设置 `MITRA_URL`，也就是你的服务器地址：

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'
    # …
```

然后重启 Mitra：

```bash
docker compose up -d
```

这两个变量要么都设置，要么都不设置。只有客户端 ID 而没有密钥时，Mitra 会拒绝启动，这样设置做了一半也不会被忽略。

`MITRA_URL` 必须与重定向 URI 中的地址一致。不设置时，Mitra 会使用你打开它时的地址，在 `localhost` 上试用时这就够了。除了 `localhost`，Google 只接受 `https://` 开头的重定向地址，所以正式部署的服务器需要启用 [HTTPS](../configuration.md#put-it-behind-https) 并设置 `MITRA_URL`。所有变量都列在[配置](../configuration.md#all-variables)中。

## 连接账号

1. 点击侧边栏底部的**添加集成**，然后选择 **Google 日历**。
2. 点击**使用 Google 账号继续**。Google 会让你选择一个账号，并允许 Mitra 查看和更改你的日历。
3. 回到 Mitra 后，会列出该账号的所有日历，并全部开启。关掉不需要的日历，然后点击**保存**。

再次连接同一个 Google 账号时，会更新它的授权，而不会把它重复添加一遍。

Google 限制了应用调用它的频率，所以 Mitra 大约每分钟同步一次 Google 账号（参见[同步的工作方式](README.md#how-syncing-works)）。

## 别人共享给你的日历

你自己的日历在连接后会立即出现。别人共享给你的日历，比如团队日历或同事的日历，则要先在 Google 设置中允许，才能被其他应用读取：

1. 登录 Google 后，打开 [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect)。
2. 在**共享的日历**（Shared Calendars）下勾选你想在 Mitra 中看到的日历，然后点击**保存**。
3. 在 Mitra 中，打开侧边栏里该账号的 **⋯** 菜单，选择**编辑**，然后点击**刷新**。
4. 开启新出现的日历，然后点击**保存**。

如果别人共享给你的权限是**查看所有活动详情**（See all event details），这个日历在 Mitra 中就是只读的：你能看到其中的全部内容，但不能添加、修改或删除日程。如果所有者之后给了你**更改活动**（Make changes to events）的权限，下次同步时就可以编辑了。参见[只读日历](../calendars.md#read-only-calendars)。

## 同步哪些内容

所有内容的同步方式都与 [CalDAV](caldav.md#what-syncs) 相同，只有条目之间的关联除外。Google 保存日程时会丢弃关联，所以 Mitra 不在 Google 日历中提供关联功能。

你在 Google 日历中标为忙碌的[可用时间](../availability.md)，会以忙碌日程的形式添加到这个日历中，让别人看到这段时间已被占用。具体方式与 [CalDAV](caldav.md#busy-availability) 中的说明相同。

## 你的 Google 令牌

Google 签发的令牌始终留在服务器上，不会离开。你的浏览器只是经过 Google 的页面授予访问权限。Mitra 会把令牌和账号保存在一起，每次同步时用它获取短期有效的访问权限。

## 断开账号

在该账号的 **⋯** 菜单中选择**删除**，即可从 Mitra 中移除它及其令牌。如果还想在 Google 那边收回 Mitra 的访问权限，请在 [Google 账号的第三方关联](https://myaccount.google.com/permissions)中移除 Mitra。只在 Google 那边移除同样会停止同步：账号仍然留在 Mitra 中，但在你重新连接之前，每次同步都会失败。

## 故障排除

- 如果选择 **Google 日历**后看到的不是**使用 Google 账号继续**按钮，而是一条提示，说明这台服务器尚未配置 Google 日历，那么就是没有设置 `MITRA_GOOGLE_CLIENT_ID` 和 `MITRA_GOOGLE_CLIENT_SECRET`，或者设置后还没有重启 Mitra。
- 如果 Google 返回 `redirect_uri_mismatch`，说明 Google Cloud 控制台中的重定向 URI 与 `MITRA_URL` 加上 `/api/integrations/google/callback` 不一致。两者必须完全相同，包括 `https://`，末尾也不能有斜杠。
- 如果账号在 7 天后停止同步，说明你的同意屏幕仍处于测试阶段。发布应用，然后重新连接这些账号。
