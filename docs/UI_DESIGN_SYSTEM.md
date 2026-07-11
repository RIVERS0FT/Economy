# Economy UI 设计系统

> 状态：当前界面视觉、组件与交互实现基线  
> 适用项目：`RIVERS0FT/Economy`  
> 当前平台：网页端  
> 更新时间：2026-07-11  
> 迁移状态：核心页面已完成统一组件与设计令牌迁移

本文件定义 Economy 的颜色、字体、间距、圆角、阴影、按钮、输入框、卡片、指标卡、数据列表、状态标签、开关、表格和响应式规则。

产品结构与玩法以 `docs/WEB_MULTIPLAYER_GAME_DESIGN.md` 为准；涉及界面视觉、控件状态、响应式行为和样式实现时，以本文件为准。

## 1. 样式架构

样式职责必须保持分离：

| 文件 | 唯一职责 |
|---|---|
| `src/styles/design-system.css` | 设计令牌、基础控件、共享视觉组件、焦点、状态、表格和移动密度 |
| `src/styles/globals.css` | 页面与业务区域的布局，不定义基础按钮、输入框、状态标签或表格视觉 |
| `src/styles/auth.css` | 登录页布局、移动键盘适配和浏览器自动填充兼容 |
| `src/styles/card-system.css` | 将历史卡片表面映射到统一圆角令牌，不重新定义令牌 |
| `src/styles/desktop-sidebar.css` | 桌面侧栏的局部布局 |
| `src/styles/mobile-*.css` | 移动端导航、状态栏、安全区和页面布局 |
| `src/components/ui/layout.tsx` | 共享 React UI 结构与控件入口 |

`design-system.css` 必须在全部其他 CSS 之后加载，作为最终视觉约束层。

页面样式不得重新实现以下基础外观：

- 按钮；
- 输入框、选择框和文本区域；
- 卡片圆角和面板阴影；
- 状态标签；
- 指标卡；
- 数据列表；
- 开关；
- 表格基础样式和焦点样式。

## 2. 共享组件入口

业务页面优先从 `src/components/ui/layout.tsx` 使用：

| 组件 | 用途 |
|---|---|
| `PageLayout` | 页面标题、说明和操作区 |
| `Panel` | 主卡片与功能面板 |
| `WidgetHeading` | 卡片标题、前置说明和右侧操作 |
| `Button` | 主要、次要、危险、文字和紧凑按钮 |
| `StatusTag` | 中性、成功、警告、危险和信息状态 |
| `MetricCard` | 资产、价格、排名和统计指标 |
| `DataList`、`DataRow` | 标签与值组成的结构化数据列表 |
| `ToggleField` | 带标题和说明的布尔开关 |
| `ScrollableTable` | 可横向滚动的表格容器 |
| `EmptyState` | 无数据和空列表状态 |

核心页面不得重新直接使用以下历史字符串类名：

```text
ghost-button
danger-button
text-button
table-button
status-chip
widget-badge
rank-chip
side-buy
side-sell
toggle-input
```

这些类可以暂时作为 CSS 兼容别名存在，但不再是新 JSX 的实现接口。

## 3. 设计目标

Economy 的界面应体现：

- 深色、稳定、专业的金融与经营氛围；
- 信息密度高，但层级清楚；
- 绿色代表主要操作、增长、买入和正常状态；
- 红色代表损失、卖出、危险和错误；
- 金色代表价格、资产价值和等待状态；
- 蓝色代表挂牌、信息和外部状态；
- 桌面端适合持续观察和高频操作；
- 移动端保证单手操作、可滚动和安全区适配；
- 不使用与真实银行或证券软件高度相似的品牌视觉。

## 4. 实现原则

1. 设计令牌优先于硬编码值。
2. 共享 React 组件优先于字符串类名。
3. 页面 CSS 只负责业务布局。
4. 同一种语义在所有页面使用相同颜色。
5. 控件必须包含默认、悬停、聚焦、禁用和危险状态。
6. 响应式变化只使用统一断点。
7. 颜色不能作为状态的唯一表达，状态必须同时有文字。
8. 关键规则由 `scripts/verify-ui-architecture.mjs` 验证。
9. 修改令牌、断点或共享组件时，必须同步更新本文件和架构检查。

## 5. 颜色系统

### 5.1 背景与表面

| 令牌 | 值 | 用途 |
|---|---|---|
| `--color-bg-canvas` | `#07100d` | 页面主背景 |
| `--color-bg-deep` | `#050a08` | 深层背景与渐变终点 |
| `--color-surface-panel` | `rgba(12, 27, 21, 0.92)` | 主面板 |
| `--color-surface-soft` | `rgba(15, 34, 26, 0.76)` | 次级表面 |
| `--color-surface-control` | `rgba(2, 10, 7, 0.72)` | 表单控件 |
| `--color-surface-hover` | `rgba(193, 226, 207, 0.08)` | 次级按钮和悬停状态 |
| `--color-surface-inset` | `rgba(0, 0, 0, 0.14)` | 指标卡、规格格和内嵌表面 |
| `--color-surface-subtle` | `rgba(255, 255, 255, 0.04)` | 中性标签和弱背景 |

### 5.2 文字与边框

| 令牌 | 值 | 用途 |
|---|---|---|
| `--color-text-primary` | `#f3f7f4` | 标题、数字和主要文字 |
| `--color-text-secondary` | `#c5d0ca` | 表单标签和正文 |
| `--color-text-muted` | `#90a099` | 辅助文字和时间 |
| `--color-border` | `rgba(212, 245, 224, 0.12)` | 默认边框 |
| `--color-border-strong` | `rgba(212, 245, 224, 0.22)` | 强调边框 |
| `--color-divider` | `rgba(255, 255, 255, 0.055)` | 数据行分隔线 |

### 5.3 语义颜色

| 令牌 | 语义 |
|---|---|
| `--color-success` | 正常、增长、买入、运行中 |
| `--color-warning` | 价格、等待、施工中 |
| `--color-danger` | 错误、损失、卖出、资金不足 |
| `--color-info` | 挂牌、信息状态 |
| `--color-accent-violet` | 保留的特殊辅助状态 |

新增语义颜色必须先进入本文件和 `design-system.css`，不得在页面中直接创建新的品牌色。

## 6. 字体系统

```css
--font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

| 令牌 | 值 | 用途 |
|---|---:|---|
| `--font-size-xs` | `0.68rem` | 标签、徽章、表头 |
| `--font-size-sm` | `0.78rem` | 辅助说明和表格 |
| `--font-size-md` | `0.88rem` | 表单与常规正文 |
| `--font-size-lg` | `1rem` | 主要正文与按钮 |
| `--font-size-xl` | `1.125rem` | 卡片标题和指标 |
| `--font-size-2xl` | `1.5rem` | 重要数字 |
| `--font-size-page` | `clamp(1.9rem, 3vw, 3.1rem)` | 页面标题 |

正文行高使用 `--line-height-body: 1.5`，紧凑控件使用 `--line-height-tight: 1.25`。

## 7. 间距系统

所有新组件使用 4px 基础倍数：

| 令牌 | 值 |
|---|---:|
| `--space-1` | `0.25rem` |
| `--space-2` | `0.5rem` |
| `--space-3` | `0.75rem` |
| `--space-4` | `1rem` |
| `--space-5` | `1.25rem` |
| `--space-6` | `1.5rem` |
| `--space-8` | `2rem` |
| `--space-10` | `2.5rem` |
| `--space-12` | `3rem` |

规则：

- 控件内部使用 `--space-2` 到 `--space-4`；
- 卡片内部默认使用 `--space-4`；
- 卡片之间使用 `--layout-gutter`；
- 页面大区块使用 `--space-4` 到 `--space-8`；
- 不新增无法对应间距等级的近似值。

## 8. 圆角系统

| 令牌 | 值 | 用途 |
|---|---:|---|
| `--radius-sm` | `0.5rem` | 紧凑按钮和小元素 |
| `--radius-control` | `0.75rem` | 按钮、输入框和控件 |
| `--radius-card` | `1.5rem` | 桌面卡片和面板 |
| `--radius-card-mobile` | `2.5rem` | 移动端主要卡片 |
| `--radius-pill` | `999px` | 状态标签和胶囊控件 |

卡片不得自行定义主圆角。移动端通过令牌切换，不在页面内重复声明。

## 9. 阴影系统

| 令牌 | 用途 |
|---|---|
| `--shadow-panel` | 普通卡片与面板 |
| `--shadow-elevated` | 浮动提示和重要状态 |
| `--shadow-focus` | 键盘聚焦环 |

阴影只表达层级，不作为边框替代。表格行、小标签和普通输入框不使用大型阴影。

## 10. 按钮

业务页面必须使用 `Button`。

| `variant` | CSS | 用途 |
|---|---|---|
| `primary` | `.ui-button--primary` | 主要提交和确认 |
| `secondary` | `.ui-button--secondary` | 次级操作 |
| `danger` | `.ui-button--danger` | 删除、退出和不可逆操作 |
| `text` | `.ui-button--text` | 低权重导航 |
| `compact` | `.ui-button--compact` | 表格内操作 |

- 默认高度使用 `--control-height`；
- 移动端可点击控件最小高度为 `44px`；
- 所有按钮必须有可见的 `:focus-visible`；
- 禁用按钮必须设置 `disabled`；
- 每个操作区域只保留一个主要按钮；
- 危险操作不得使用绿色主要按钮。

## 11. 输入框与表单

适用于 `input`、`select` 和 `textarea`：

- 使用统一高度、圆角、背景和边框；
- 聚焦显示绿色边框和焦点环；
- 错误状态必须同时提供错误文字；
- 数字输入由业务层验证最小值、最大值和精度；
- 禁止移除焦点轮廓而不提供替代样式；
- 登录页自动填充兼容只能修改浏览器行为，不得复制基础输入框视觉。

布尔设置使用 `ToggleField` 和 `.ui-switch`，不得重新使用原生复选框外观作为项目开关。

## 12. 卡片、指标卡与数据列表

### 12.1 面板

`Panel` 输出 `.panel`：

- 使用统一边框、`--radius-card`、`--gradient-panel` 和 `--shadow-panel`；
- 页面只通过附加类定义布局，不重写基础表面；
- 移动端使用 `--radius-card-mobile`。

### 12.2 指标卡

`MetricCard` 输出 `.ui-metric-card`，用于：

- 市场价格；
- 资产估值；
- 排名摘要；
- 冻结资产；
- 重要统计。

支持 `neutral`、`success`、`warning`、`danger` 和 `info` 五种语义色。指标卡不能通过页面内硬编码颜色区分状态。

### 12.3 数据列表

`DataList` 与 `DataRow` 用于标签和值的成组信息，例如设施参数、货币发行、账号状态和资产组成。

- 标签左对齐；
- 值右对齐并使用较高字重；
- 行间使用统一分隔线；
- 正负或警告状态通过 `tone` 表达。

## 13. 状态标签

业务页面必须使用 `StatusTag`。

| `tone` | 类名 | 颜色 |
|---|---|---|
| `success` | `.status-success` | 绿色 |
| `warning` | `.status-warning` | 金色 |
| `danger` | `.status-danger` | 红色 |
| `info` | `.status-info` | 蓝色 |
| `neutral` | `.status-neutral` | 次要文字色 |

标签统一使用胶囊圆角、紧凑字号和文字说明。买入、卖出、运行、施工、挂牌等业务状态均映射到上述语义，不再创建独立视觉体系。

## 14. 表格

- 表格外层必须使用 `ScrollableTable`；
- 内容过宽时由 `.table-wrap` 横向滚动；
- 表头使用次要文字色和紧凑字号；
- 单元格使用统一边框和间距；
- 金额与数量使用 `.numeric-cell` 右对齐并启用等宽数字；
- 当前玩家行可以使用成功色低透明背景；
- 空表格使用统一空状态；
- 移动端保留最小宽度，不强行压缩列。

## 15. 页面标题与层级

- 页面使用 `PageLayout`；
- 卡片标题使用 `WidgetHeading`；
- 前置说明使用 `.ui-eyebrow`；
- 每个页面只允许一个 `h1`；
- 卡片标题使用 `h2`；
- 内部小节使用 `h3`；
- 不通过长段全大写文本表达层级。

## 16. 响应式规则

统一断点：

| 名称 | 条件 | 用途 |
|---|---|---|
| Wide | `max-width: 1220px` | 三列降为两列、市场布局重排 |
| Compact | `max-width: 960px` 且 `min-width: 721px` | 收窄侧栏、生产改为单列 |
| Mobile | `max-width: 720px` | 单列页面、底部导航和大触控目标 |

不得添加与现有断点只差少量像素的新宽度断点，例如 `1180px`、`950px`、`700px` 或 `380px`。仅针对可视高度和软键盘的媒体查询可以作为布局例外，但不能改变颜色、字体或基础控件视觉。

移动端要求：

- 页面主体使用单列布局；
- 主要点击目标不小于 `44px`；
- 顶部状态栏和底部导航尊重 `safe-area-inset-*`；
- 表格和市场统计允许横向滚动；
- 页面内容不能被固定导航遮挡；
- 不依赖 hover 才能发现关键操作。

## 17. 动画、性能与可访问性

- 快速动画使用 `--motion-fast: 150ms`；
- 普通过渡使用 `--motion-normal: 220ms`；
- `prefers-reduced-motion: reduce` 时关闭非必要动画；
- 不在大量表格行或盘口行上使用模糊和阴影动画；
- 键盘聚焦必须可见；
- 颜色不能是状态唯一信息；
- 图标按钮必须提供可访问名称；
- 错误信息使用 `role="alert"` 或关联说明；
- 移动端触控目标不小于 `44px`。

## 18. 当前重构基线

以下页面已经迁移到共享组件：

- 登录；
- 概览；
- 市场；
- 生产；
- 资产；
- 排行榜；
- 订单与记录；
- 设置；
- 桌面侧栏退出操作。

迁移后的约束：

- `globals.css` 只保留布局；
- `auth.css` 只保留登录布局和浏览器兼容；
- 所有基础视觉由 `design-system.css` 提供；
- 核心页面不直接使用历史按钮和状态类名；
- 新页面必须直接使用共享组件，不得先写局部样式再补迁移。

## 19. 架构检查契约

`scripts/verify-ui-architecture.mjs` 必须验证：

- `docs/UI_DESIGN_SYSTEM.md` 和 `src/styles/design-system.css` 存在；
- `design-system.css` 在 `main.tsx` 最后加载；
- 核心颜色、字体、间距、圆角、阴影和控件高度令牌存在；
- `Button`、`StatusTag`、`MetricCard`、`DataList`、`DataRow` 和 `ToggleField` 存在；
- 核心页面不包含历史按钮、状态或开关类名；
- `globals.css` 不重新定义原生按钮、输入框、状态标签或表格基础视觉；
- 1220、960 和 720 三个断点存在；
- 未记录的相近宽度断点不存在；
- `prefers-reduced-motion`、焦点样式和 `44px` 触控目标存在；
- `card-system.css` 只引用统一卡片令牌；
- 本文件包含不可回退规则。

## 20. 不可回退规则

除非先修改本设计并完成迁移评审，否则不得：

- 删除 `design-system.css` 或改变其最终加载顺序；
- 在业务页面重新直接使用历史按钮、状态或开关类名；
- 在 `globals.css` 或页面 CSS 重新定义基础控件视觉；
- 删除共享 `Button`、`StatusTag`、`MetricCard`、`DataList`、`DataRow` 或 `ToggleField`；
- 删除统一颜色、间距、圆角、阴影和控件高度令牌；
- 恢复多个互相冲突的卡片圆角变量；
- 删除键盘焦点样式；
- 删除移动端 `44px` 最小触控目标；
- 删除 `prefers-reduced-motion` 支持；
- 添加未记录的相近响应式宽度断点；
- 绕过架构检查来合并视觉回退。

## 21. 修改流程

涉及视觉体系的 PR 必须：

1. 说明修改的令牌、组件或布局语义；
2. 同步更新本文件；
3. 更新 `design-system.css` 或相应布局文件；
4. 更新架构检查或测试；
5. 通过完整 `npm run build`；
6. 检查桌面、紧凑桌面和移动端；
7. 检查键盘焦点、禁用、错误和减少动画状态。

未更新设计文档和架构检查的基础样式回退不应合并。