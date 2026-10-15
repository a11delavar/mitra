---
title: 单点登录
description: 和家人或团队共用一台 Mitra 服务器。每个人都用已有的账号，通过 OpenID Connect 提供方登录。
---

默认情况下，Mitra 只供一个人使用，也不需要登录；只要只有你能访问它，这样就没问题。如果想和家人或团队共用一台服务器，请把它接入一个 OpenID Connect（OIDC）提供方。之后，每个人都用自己已有的账号登录，并拥有只属于自己、别人看不到的日历。

Mitra 支持任何符合标准的 OIDC 提供方。大家用过的有 Pocket ID、Authelia、Authentik、Keycloak 和 Google 等。

> [!CAUTION]
> 开启登录后，每个人都会得到一个全新的空账号，你自己也不例外。Mitra 单人使用期间你设置的一切都会留在那个旧账号里，不会迁移过来：包括你连接的账号、你的设置，以及 [Mitra 日历](integrations/mitra.md)中的所有条目。连接的账号很快就能重新添加，但 Mitra 日历中的条目无法跟过来。请在开始往 Mitra 里添加内容之前就开启登录；或者先把这些条目移到一个已连接的日历中（在该日历的 **⋯** 菜单中选择**将条目移动到…**），之后再重新连接那个账号。

## 开启登录

在容器上设置 OIDC 变量：

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'          # the address people use to reach Mitra
      MITRA_OIDC_ISSUER: 'https://auth.example.com'   # your provider's issuer URL
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'                   # leave out for a public client
```

在提供方那里，把 `MITRA_URL` 加上 `/auth/callback` 注册为重定向地址：

```text
https://mitra.example.com/auth/callback
```

提供方需要的就是这些。用 `docker compose up -d` 重启 Mitra 后，它就会要求每个人登录。

设置 `MITRA_OIDC_ISSUER` 就会开启登录，同时还需要设置 `MITRA_OIDC_CLIENT_ID` 和 `MITRA_URL`。缺少其中任何一个，Mitra 都会拒绝启动：这总比悄悄地以无需登录的状态运行要好得多。

## 客户端密钥和作用域

如果你在提供方那里注册了客户端密钥，请设置 `MITRA_OIDC_CLIENT_SECRET`。如果注册的是公共客户端，就不要设置它；这种方式完全受支持，因为 Mitra 始终使用 PKCE。

Mitra 请求的作用域是 `openid profile email`。`openid` 是必需的，另外两个让 Mitra 获取每个人的姓名和邮箱地址。只有在你的提供方需要其他作用域时，才用 `MITRA_OIDC_SCOPES` 修改。

## 谁可以登录

凡是提供方放行的人，第一次登录时都会获得一个 Mitra 账号。Mitra 中没有需要管理的用户列表，所以请在提供方那里决定谁可以登录，比如按用户组、应用分配，或者提供方支持的其他访问控制方式。每次登录时，每个人的姓名和邮箱地址都会从提供方更新。

## 登录的工作方式

登录过程本身在服务器上完成（使用 PKCE 的授权码流程）。你的浏览器只会拿到一个 Cookie，浏览器存储中不保存任何令牌，所以页面上的恶意脚本也偷不到什么。

会话在你最后一次使用 Mitra 后保持 30 天。当 `MITRA_URL` 以 `https://` 开头时，Cookie 会被标记为安全；对于在你自己网络中、没有 HTTPS 的提供方，也允许使用 `http://` 的签发者地址。如果提供方支持，退出 Mitra 时也会同时退出提供方的登录。

## 故障排除

- **Mitra 无法启动，并提示缺少某个变量。** 设置了 `MITRA_OIDC_ISSUER` 时，也必须设置 `MITRA_OIDC_CLIENT_ID` 和 `MITRA_URL`。
- **提供方提示重定向地址有问题。** 重定向地址必须正好是 `MITRA_URL` 加上 `/auth/callback`。
- **日志显示发现（discovery）失败。** Mitra 会在第一次登录时查找你的提供方，失败后会在下一次登录时重试，所以如果提供方比 Mitra 启动得晚，问题会自行解决。如果一直失败，请把[日志级别](logging.md)设为 `debug`，检查签发者地址是否正确、Mitra 能否访问它。
- **开启登录后我的日历不见了。** 这是正常的：每个人都会从一个新账号开始。请重新连接你的账号。
