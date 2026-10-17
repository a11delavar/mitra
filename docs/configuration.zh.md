---
title: 配置
description: 如何通过环境变量配置 Mitra，大多数服务器需要设置哪些变量，以及每个变量及其默认值。
---

Mitra 完全通过环境变量来配置。没有需要挂载的配置文件：你在容器上设置变量，Mitra 启动时读取它们。所有变量都是可选的，没有设置的变量会使用[下文](#all-variables)列出的默认值。

使用 Docker Compose 时，变量写在 `environment` 块中：

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

如果你不想把密钥写进 compose 文件，用 `.env` 文件或 Docker secrets 也一样可以。修改会在 Mitra 下次启动时生效：

```bash
docker compose up -d
```

## 服务器上需要设置什么

几乎什么都不用。[Mitra 日历](integrations/mitra.md)、[CalDAV](integrations/caldav.md)、[Apple 日历](integrations/apple.md)、[日历订阅](integrations/subscriptions.md)、[Notion](integrations/notion.md) 和 [Tempo](integrations/tempo.md) 都由用户自己在应用中添加。

只有两项需要你先到别处注册凭据：[Google 日历](integrations/google.md)（`MITRA_GOOGLE_*`）和[登录](sso.md)（`MITRA_OIDC_*`）。

## 通过 HTTPS 访问

一旦要在你自己的电脑以外访问 Mitra，就应该把它放在 Caddy、Traefik 或 nginx 等反向代理后面，由代理来处理 HTTPS。Mitra 本身在容器内只使用普通的 HTTP。有些功能只能在 HTTPS 下使用：

- 浏览器只允许在 `https://` 地址（以及 `http://localhost`）上使用[提醒](reminders.md)和[安装应用](install-app.md)。
- [登录](sso.md)的 Cookie 只有在 `https://` 下才会被标记为安全，而且大多数身份提供方都要求使用 `https://` 重定向地址。
- [Google 日历](integrations/google.md)要求使用 `https://` 重定向地址。

然后把 [`MITRA_URL`](#set-the-public-url) 设为公开地址。

使用 [Caddy](https://caddyserver.com/) 时，只需要这几行：

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

使用 [Traefik](https://traefik.io/) 时，在服务上添加标签，把请求路由到 Mitra：

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    volumes:
      - ~/mitra:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mitra.rule=Host(`mitra.example.com`)"
      - "traefik.http.services.mitra.loadbalancer.server.port=3000"
    environment:
      MITRA_URL: 'https://mitra.example.com'
```

## 设置公开 URL

`MITRA_URL` 是用户在浏览器中输入、用来访问 Mitra 的地址，而不是容器的内部地址：

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Mitra 根据它生成 Google 日历和登录的回调地址；如果它以 `https://` 开头，Mitra 还会把 Cookie 标记为安全。在 `http://localhost` 上试用 Mitra 时可以不设置。一旦 Mitra 有了正式地址，就应该设置它；要启用登录，则必须设置。

## 给你的实例命名

`MITRA_NAME` 会替换侧边栏和浏览器标签页中的“Mitra”：

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

点击名称会打开**关于**对话框，其中显示你正在运行的版本和提交。[安装后的应用](install-app.md)仍使用“Mitra”这个名称和图标，因为它们在构建应用时就已确定。

## 所有变量

### 核心

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MITRA_URL` | *（未设置）* | 用户访问 Mitra 的[公开地址](#set-the-public-url)，比如 `https://mitra.example.com`。登录和 Google 日历的回调地址，以及 Cookie 是否安全，都取决于它。在 localhost 上试用时可选，使用[登录](sso.md)时必填，使用 [Google 日历](integrations/google.md)或任何公开服务器时建议设置。 |
| `MITRA_NAME` | *（Mitra，按每个人的语言显示）* | 显示在侧边栏和浏览器标签页中的[名称](#name-your-instance)。[安装后的应用](install-app.md)仍叫“Mitra”。 |
| `MITRA_PORT` | `3000` | 服务器监听的端口。使用 Docker 时，请改为修改端口映射的主机端；只有当进程本身必须监听其他端口时才设置它。内置的健康检查会随之调整。 |
| `MITRA_LOG_LEVEL` | `info` | [Mitra 记录多少日志](logging.md)：`error`、`warn`、`info`、`debug` 或 `trace`。级别越往后，记录的内容越详细，每个级别都包含前面所有级别的内容。 |
| `MITRA_UPDATE_CHECK` | *（开启）* | 设为 `off`（或 `false`、`0`、`no`）可关闭[更新检查](updates.md)。 |

### 提醒

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | 推送服务看到的、你的服务器发送[提醒](reminders.md)时的联系方式，通常是一个 `mailto:` 地址。Mitra 的用户看不到它。签名密钥会自动生成，所以不需要设置其他内容。 |

### 地点

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | 地点字段背后的 [Photon 地理编码服务](location.md)。可以把它指向你自己的 Photon 实例，而不使用 komoot 的公共实例。 |

### 附件

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MITRA_FILE_MAX_SIZE` | `25M` | 一个人可以[附加](attachments.md)到条目的最大文件，以字节计，或带 `k`、`M`、`G` 后缀。设为 `0` 则关闭添加文件。 |
| `MITRA_FILE_QUOTA` | *(未设置)* | 每个人附加的文件总共可占用的空间，写法相同。不设置则没有限制。 |

### Google 日历

两个都设置后，用户才能连接 [Google 日历](integrations/google.md)。只设置 ID 会导致 Mitra 无法启动。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *（未设置）* | 来自 Google Cloud 控制台的 OAuth 客户端 ID。 |
| `MITRA_GOOGLE_CLIENT_SECRET` | *（未设置）* | OAuth 客户端密钥。设置了 `MITRA_GOOGLE_CLIENT_ID` 时必填。 |

### 单点登录

设置 `MITRA_OIDC_ISSUER` 即可启用[登录](sso.md)。如果缺少它所需的变量，Mitra 会拒绝启动。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *（未设置）* | 你的 OIDC 提供方的颁发者（issuer）URL。需要同时设置 `MITRA_OIDC_CLIENT_ID` 和 `MITRA_URL`。 |
| `MITRA_OIDC_CLIENT_ID` | *（未设置）* | 在提供方处注册的客户端 ID。 |
| `MITRA_OIDC_CLIENT_SECRET` | *（未设置）* | 客户端密钥。公共客户端不需要设置；Mitra 始终使用 PKCE。 |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Mitra 请求的权限范围（scope），以空格分隔。`openid` 是必需的；`profile` 和 `email` 让 Mitra 获取每个人的姓名和电子邮件地址。 |

### 由构建设置

这些变量不需要你在服务器上设置。它们由构建过程或镜像设置，或者用于 Mitra 本身的开发。

| 变量 | 设置方 | 说明 |
| --- | --- | --- |
| `MITRA_VERSION` | 构建 | 构建进镜像的版本。 |
| `MITRA_COMMIT` | 构建 | 构建进镜像的提交。 |
| `MITRA_DEV` | 开发 | 开发 Mitra 时提供**演示**集成，其中包含一组示例日历。 |
| `NODE_ENV` | 镜像 | 在容器镜像中为 `production`。 |

### 示例

一台启用了登录、Google 日历并使用自己地理编码服务的服务器：

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'

      # Sign-in
      MITRA_OIDC_ISSUER: 'https://auth.example.com'
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'

      # Google Calendar
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'

      # Your own geocoder
      MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```
