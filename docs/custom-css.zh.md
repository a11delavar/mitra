---
title: 自定义 CSS
description: "用你自己的 CSS 改变 Mitra 的外观：一份跟随你账号的样式表，以及一份供服务器上所有人使用的样式表。"
---

Mitra 的外观就是普通的 CSS，你可以在上面加上自己的。隐藏你从不用的东西，给今天加一圈边框，或者让整个服务器换上你的颜色。有两个地方可以写：**设置 → 常规 → 自定义 CSS** 只对你自己生效，在需要登录的服务器上，**设置 → 管理 → 所有人的自定义 CSS** 则对服务器上的所有人生效。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/custom-css-dark.webp">
  <img src="../assets/screenshots/custom-css-light.webp" alt="换上标志金色的 Mitra，设置里打开着实现这一效果的自定义 CSS 规则" />
</picture>

> [!WARNING]
> 在 Mitra 1.0 之前，任何一次更新都可能改变你的规则所针对的元素、属性和变量。今天有效的规则，更新后可能失效，或者开始把某些东西藏起来。让你的样式表保持简短，每次更新后看一看 Mitra。

## 你自己的样式表

打开 **设置 → 常规**，在 **自定义 CSS** 下面的输入框里写 CSS。Mitra 会边输入边应用，在你停下片刻后保存，并且它会跟着你的账号同步到你登录的每台设备和每个浏览器。

**自定义 CSS** 旁边的开关可以关掉你的样式表而不丢失它，[命令面板](shortcuts.md)也提供 **自定义 CSS：关闭** 和 **自定义 CSS：开启**。

保存时会去掉 `@import`：请粘贴整份样式表，而不是链接到一份。

## 服务器的样式表

在需要登录的服务器上，管理员可以为服务器上的所有人改变 Mitra 的外观：打开 **设置 → 管理**，在 **所有人的自定义 CSS** 下面的框里输入 CSS。你边输入边看到效果，其他人则在下次加载 Mitra 时看到。旁边的开关可以为所有人关掉它而不丢失内容。第一个登录服务器的人就是它的管理员。没有登录时，你自己的样式表已经作用于所有使用 Mitra 的人，所以只有这一份。

它适合放那些让服务器成为“你的”的东西，比如颜色、字体，或它已经带着的[名字](configuration.md#name-your-instance)。每个人自己的样式表排在它之后，所以两者设置同一处时，个人的样式表胜出。

## 你的规则胜出

Mitra 自己的规则放在一个名为 `mitra` 的层叠层里，你的规则不在其中，所以无论选择器怎么写，你的规则都会胜过 Mitra 的。你不需要 `!important`。Mitra 自己少数几条 `!important` 声明仍然在最上面，因为层叠层对它们的排序正好相反：它们撑着整个布局。

要去掉 Mitra 设置的某样东西，而不是在上面再涂一层，就把这个属性设为 `revert`。下面这条去掉月视图中日子的底色：

```css
mitra-weeks mitra-day {
	background: revert;
}
```

## 示例

### 隐藏本月以外的日子

```css
mitra-weeks [data-outside] {
	visibility: hidden;
}
```

在[月视图](views/month.md)里，这会隐藏所显示月份之前和之后的日子，包括日期和背景。其中的条目仍会保留。`visibility` 让网格保持原位，而 `display: none` 会把它拆散。放大视图，就能给本月的日子更多空间。

### 给今天加一圈边框

```css
mitra-weeks mitra-day[today] {
	outline: 2px solid var(--color-accent);
	outline-offset: -2px;
}
```

用 `outline` 而不是 `border`：边框会让日子变大，把网格挤偏。

### 你自己的颜色

```css
:root {
	--color-accent: light-dark(#2e7d32, #81c784);
	--border-radius: 8px;
}
```

`light-dark()` 先写浅色主题的颜色，再写深色主题的颜色。Mitra 用这些变量着色的地方都会跟着变，[已安装应用](install-app.md)的标题栏也不例外：

| 变量 | 它决定的颜色 |
| --- | --- |
| `--color-accent` | 今天、选中的内容、焦点环和主要按钮 |
| `--color-background-seed` | 一切背后的底色；对话框从它派生出自己的底色 |
| `--color-surface` | 各视图中的日子，以及放在底色上的东西，比如命令面板 |
| `--color-text` | 文字 |
| `--color-text-muted` | 次要文字，比如提示和时间 |
| `--color-error` | 错误和警告 |
| `--border-radius` | 按钮、条目和大多数控件的圆角 |
| `--font-family` | 文字的字体 |

## 找到要针对的元素

浏览器的开发者工具会显示页面上有什么：在某个东西上右键，选择 **检查**。Mitra 自己的元素都叫 `mitra-…`，比如视图 `mitra-days`（周）、`mitra-weeks`（月）、`mitra-months`（年）、`mitra-timeline` 和 `mitra-table`，一天是 `mitra-day`，一个条目是 `mitra-entry-segment`，侧边栏是 `mitra-sidebar`。属性表示事实，比如 `today`、`data-outside` 和 `data-date`。

按钮、输入框、开关、菜单等控件不对外开放内部结构。可以通过它们的部件来触及，比如 `mitra-switch::part(switch)`，以及它们读取的 `--mitra-…` 变量。如果需要触及更深处，请在 [issue](https://github.com/a11delavar/mitra/issues) 里申请一个部件。

## 不要去动的地方

有几样东西撑着 Mitra，改动它们会把它弄坏：

- `mitra-day` 或视图中 `.entries` 上的 `display` 或 `position`：它们排在整个视图共用的网格上，没有这个网格，周视图会变得非常慢。
- 以 `--_` 开头的变量：缩放时它们每一帧都在变，设置它们会和缩放较劲。
- 条目的尺寸：条目的标题按宽度选择布局，从外面改它的尺寸可能让布局切换。
- `all: unset` 也会取消隐藏，所以要在旁边补上 `[hidden] { display: none }`。

## 当某条规则挡住了退路

在地址后加上 `?css=off`，比如 `https://mitra.example.com/?css=off`。这样 Mitra 会在这一次加载中不使用任何一份样式表，你就能打开 **设置** 修好自己的。管理员也用同样的方法修好所有人的那一份。

## 粘贴之前

样式表不会运行代码，但它可以加载地址，而专门写成的样式表可以把你屏幕上的内容发送到这些地址。只粘贴你看得懂的 CSS。你自己的样式表只影响你；服务器的样式表影响服务器上的所有人。

## 分享你的样式表

框下方的 **分享到 GitHub** 会在 [Custom CSS](https://github.com/a11delavar/mitra/discussions/categories/custom-css) 分类里打开一个新讨论，里面已经填好了你的样式表。写下它的作用，如果能看出效果就加一张截图，然后发布。样式表太长、放不进链接时，Mitra 会把它复制到剪贴板，你再粘贴到讨论里。这个分类里也有别人分享的样式表：粘贴之前先读一读。
