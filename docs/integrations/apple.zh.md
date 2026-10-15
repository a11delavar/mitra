---
title: Apple 日历
description: 用 App 专用密码把你的 iCloud 日历连接到 Mitra，服务器端无需任何设置。
---

Mitra 通过 CalDAV 连接你的 iCloud 日历，并双向同步其中的日程。Apple 不允许其他应用使用你的 Apple 账户密码登录，所以你需要先为 Mitra 创建一个 App 专用密码。整个过程只需一分钟，服务器端无需任何设置。

## 创建 App 专用密码

1. 登录 [appleid.apple.com](https://appleid.apple.com/)。
2. 在 **登录与安全** 下，选择 **App 专用密码**。
3. 新建一个密码，命名为“Mitra”，方便以后辨认，然后复制这个密码。

只有在你的账户开启了双重认证之后，Apple 才会提供 App 专用密码。

## 连接你的账户

1. 在侧边栏底部选择 **添加集成**，然后选择 **Apple 日历**。
2. 在 **Apple 账户** 中输入你登录 Apple 时使用的电子邮件地址，在 **App 专用密码** 中输入你为 Mitra 创建的密码。
3. 按 **连接**。Mitra 会列出你的 iCloud 日历，默认全部开启。
4. 关闭你不需要的日历，然后按 **保存**。

Mitra 会导入你保留的日历，并在你打开 Mitra 期间每 10 秒同步一次（请参阅[同步的工作方式](README.md#how-syncing-works)）。

## 同步哪些内容

日程会双向同步，[CalDAV](caldav.md#what-syncs) 能传输的内容都会同步。

> [!NOTE]
> 任务的情况有所不同。Mitra 保存到 iCloud 日历中的任务会存储在 iCloud 上，其他 CalDAV 应用也能读取，但 Apple 的“提醒事项”App 不会显示它们。从 iOS 13 起，“提醒事项”不再使用 CalDAV，而 Apple 也没有为 Mitra 这样的应用提供其他接入方式。

你在 iCloud 日历中标为忙碌的[可用时间](../availability.md)，会以忙碌日程的形式添加到该日历中，这样在你的 iPhone 上，以及在邀请你的人看来，这段时间都显示为已占用。具体方式与 [CalDAV](caldav.md#busy-availability) 中的说明相同。

## 断开账户连接

在侧边栏中该账户的 **⋯** 菜单里选择 **删除**，即可将其从 Mitra 中移除。要在 Apple 那边撤销 Mitra 的访问权限，请回到你创建密码的 **登录与安全** 页面，删除名为“Mitra”的密码。你的 Apple 账户密码和其他应用都不会受影响。

## 故障排除

- 如果因为密码问题而连接失败，请确认你输入的是 App 专用密码，而不是 Apple 账户密码。
- 如果少了某个日历，说明它处于关闭状态。在该账户的 **⋯ → 编辑** 中打开它，然后按 **保存**。
