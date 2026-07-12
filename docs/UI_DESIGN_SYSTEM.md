# Economy UI 设计系统

> 状态：当前界面视觉、组件与交互实现基线  
> 适用项目：`RIVERS0FT/Economy`  
> 当前平台：网页端  
> 更新时间：2026-07-11  
> 迁移状态：核心页面已完成统一组件与设计令牌迁移

本文件定义 Economy 的颜色、字体、间距、圆角、阴影、按钮、输入框、卡片、指标卡、数据列表、状态标签、开关、表格、标题层级和响应式规则。

产品结构与玩法以 `docs/WEB_MULTIPLAYER_GAME_DESIGN.md` 为准；涉及界面视觉、控件状态、标题结构和响应式行为时，以本文件为准。

## 1. 样式架构

样式职责必须保持分离：

| 文件 | 唯一职责 |
|---|---|
| `src/styles/design-system.css` | 设计令牌、基础控件、共享视觉组件、焦点、状态、表格和移动密度 |
| `src/styles/globals.css` | 页面与业务区域布局，不定义基础控件视觉 |
| `src/styles/auth.css` | 登录布局、移动键盘适配和自动填充兼容 |
| `src/styles/card-system.css` | 将历史卡片表面映射到统一圆角令牌 |
| `src/styles/desktop-sidebar.css` | 桌面侧栏局部布局 |
| `src/styles/mobile-*.css` | 移动导航、状态栏、安全区和页面布局 |
| `src/components/ui/layout.tsx` | 共享 React UI 结构与控件入口 |

`src/styles/design-system.css` 必须在所有其他 CSS 之后加载，作为最终视觉约束层。

页面样式不得重新实现按钮、输入框、面板、指标卡、状态标签、开关、表格或焦点状态的基础外观。

## 2. 共享组件入口

业务页面优先使用：

| 组件 | 用途 |
|---|---|
| `PageLayout` | 页面标题、说明和操作区 |
| `Panel` | 主卡片与功能面板 |
| `WidgetHeading` | 卡片标题和右侧操作 |
| `Button` | 主要、次要、危险、文字和紧凑按钮 |
| `StatusTag` | 中性、成功、警告、危险和信息状态 |
| `MetricCard` | 资产、价格、排名和统计指标 |
| `DataList`、`DataRow` | 标签和值组成的数据列表 |
| `SwitchControl` | 所有页面共用的布尔开关 |
| `ToggleField` | 组合说明文字与 `SwitchControl` 的设置行 |
| `ScrollableTable` | 可横向滚动的表格容器 |
| `EmptyState` | 无数据状态 |

页面标题和卡片标题不得显示前置小字。

`PageLayout` 和 `WidgetHeading` 不得提供 `eyebrow` 参数，也不得渲染 `.ui-eyebrow`。页面标题直接从 `h1` 开始，卡片标题直接从 `h2` 开始。

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

这些类可以暂时作为 CSS 兼容别名存在，但不再是 JSX 实现接口。

## 3. 设计目标

Economy 的界面应体现：

- 深色、稳定、专业的金融和经营氛围；
- 信息密度高，但层级清晰；
- 绿色代表主要操作、增长、买入和正常状态；
- 红色代表损失、卖出、危险和错误；
- 金色代表价格、资产价值和等待状态；
- 蓝色代表挂牌和信息状态；
- 桌面端适合持续观察和高频操作；
- 移动端适合单手操作并尊重安全区；
- 标题简洁，不堆叠重复标签或英文小字。

## 4. 实现原则

1. 设计令牌优先于硬编码值。
2. 共享 React 组件优先于字符串类名。
3. 页面 CSS 只负责业务布局。
4. 相同语义在所有页面使用相同颜色。
5. 控件包含默认、悬停、聚焦、禁用和危险状态。
6. 响应式变化只使用统一断点。
7. 颜色不能作为状态的唯一表达。
8. 页面标题和卡片标题只保留主标题，不显示前置小字。
9. 关键规则由 `scripts/verify-ui-architecture.mjs` 验证。
10. 修改令牌、断点、标题结构或共享组件时，必须同步更新本文档和架构检查。

## 5. 颜色系统

### 5.1 背景与表面

| 令牌 | 用途 |
|---|---|
| `--color-bg-canvas` | 页面主背景 |
| `--color-bg-deep` | 深层背景与渐变终点 |
| `--color-surface-panel` | 主面板 |
| `--color-surface-soft` | 次级表面 |
| `--color-surface-control` | 表单控件 |
| `--color-surface-hover` | 次级按钮和悬停状态 |
| `--color-surface-inset` | 指标卡和内嵌表面 |
| `--color-surface-subtle` | 中性标签和弱背景 |

### 5.2 文字与边框

| 令牌 | 用途 |
|---|---|
| `--color-text-primary` | 标题、数字和主要文字 |
| `--color-text-secondary` | 表单标签和正文 |
| `--color-text-muted` | 辅助文字和时间 |
| `--color-border` | 默认边框 |
| `--color-border-strong` | 强调边框 |
| `--color-divider` | 数据行分隔线 |

### 5.3 语义颜色

| 令牌 | 语义 |
|---|---|
| `--color-success` | 正常、增长、买入、运行中 |
| `--color-warning` | 价格、等待、施工中 |
| `--color-danger` | 错误、损失、卖出、资金不足 |
| `--color-info` | 挂牌和信息状态 |
| `--color-accent-violet` | 特殊辅助状态 |

新增语义颜色必须先进入本文档和 `design-system.css`。

## 6. 字体系统

```css
--font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

| 令牌 | 用途 |
|---|---|
| `--font-size-xs` | 标签、徽章和表头 |
| `--font-size-sm` | 辅助说明和表格 |
| `--font-size-md` | 表单和正文 |
| `--font-size-lg` | 主要正文和按钮 |
| `--font-size-xl` | 卡片标题和指标 |
| `--font-size-2xl` | 重要数字 |
| `--font-size-page` | 页面标题 |

页面标题使用 `--font-size-page`，卡片标题使用 `--font-size-xl`。标题上方不得增加更小字号的重复标签。

## 7. 间距系统

统一使用：

```text
--space-1  0.25rem
--space-2  0.5rem
--space-3  0.75rem
--space-4  1rem
--space-5  1.25rem
--space-6  1.5rem
--space-8  2rem
--space-10 2.5rem
--space-12 3rem
```

- 控件内部使用 `--space-2` 到 `--space-4`；
- 卡片内部默认使用 `--space-4`；
- 卡片之间使用 `--layout-gutter`；
- 页面大区块使用 `--space-4` 到 `--space-8`；
- 不新增无法对应间距等级的近似值。

## 8. 圆角系统

| 令牌 | 用途 |
|---|---|
| `--radius-sm` | 紧凑按钮和小元素 |
| `--radius-control` | 按钮、输入框和控件 |
| `--radius-card` | 桌面卡片和面板 |
| `--radius-card-mobile` | 移动端主要卡片 |
| `--radius-pill` | 状态标签和胶囊控件 |

卡片不得自行定义主圆角。

## 9. 阴影系统

| 令牌 | 用途 |
|---|---|
| `--shadow-panel` | 普通卡片与面板 |
| `--shadow-elevated` | 浮动提示和重要状态 |
| `--shadow-focus` | 键盘聚焦环 |

阴影只表达层级，不替代边框。

## 10. 按钮

业务页面必须使用 `Button`。

| `variant` | 用途 |
|---|---|
| `primary` | 主要提交和确认 |
| `secondary` | 次级操作 |
| `danger` | 删除、退出和不可逆操作 |
| `text` | 低权重导航 |
| `compact` | 表格内操作 |

- 默认高度使用 `--control-height`；
- 移动端可点击控件最小高度为 `44px`；
- 所有按钮必须有可见的 `:focus-visible`；
- 禁用按钮必须设置 `disabled`；
- 危险操作不得使用绿色主要按钮。

## 11. 输入框与表单

- `input`、`select` 和 `textarea` 使用统一高度、圆角、背景和边框；
- 聚焦显示绿色边框和焦点环；
- 错误状态必须提供错误文字；
- 数字输入在业务层验证范围与精度；
- 所有布尔控制使用 `SwitchControl`；带说明的设置行使用 `ToggleField`；`.ui-switch` 是唯一开关视觉；
- 登录自动填充兼容只能处理浏览器行为，不得复制基础输入视觉。

## 12. 卡片、指标卡与数据列表

### 12.1 面板

`Panel` 输出 `.panel`，统一使用边框、`--radius-card`、`--gradient-panel` 和 `--shadow-panel`。

### 12.2 指标卡

`MetricCard` 用于市场价格、资产估值、排名摘要、冻结资产和重要统计，支持 `neutral`、`success`、`warning`、`danger` 和 `info`。

### 12.3 数据列表

`DataList` 与 `DataRow` 用于设施参数、货币发行、账号状态和资产组成。标签左对齐，值右对齐，行间使用统一分隔线。

## 13. 状态标签

业务页面使用 `StatusTag`：

| `tone` | 颜色 |
|---|---|
| `success` | 绿色 |
| `warning` | 金色 |
| `danger` | 红色 |
| `info` | 蓝色 |
| `neutral` | 次要文字色 |

状态标签必须同时包含文字，不能仅依赖颜色。

## 14. 表格

- 表格外层使用 `ScrollableTable`；
- 过宽内容由 `.table-wrap` 横向滚动；
- 表头使用次要文字色和紧凑字号；
- 金额与数量使用 `.numeric-cell` 右对齐并启用等宽数字；
- 当前玩家行可使用成功色低透明背景；
- 空表格使用统一空状态；
- 移动端保留最小宽度，不强行压缩列。

## 15. 页面标题与层级

- 页面使用 `PageLayout`；
- 卡片标题使用 `WidgetHeading`；
- 页面标题直接渲染 `h1`；
- 卡片标题直接渲染 `h2`；
- 内部小节使用 `h3`；
- 页面标题上方不显示“小标签”“分类名”或重复标题；
- 卡片标题上方不显示“小标签”“栏目名”或重复标题；
- `订单与记录` 页面只显示一次主标题“订单与记录”；
- 不使用 `.ui-eyebrow` 作为页面或卡片标题的一部分。

## 16. 响应式规则

统一断点：

| 名称 | 条件 | 用途 |
|---|---|---|
| Wide | `max-width: 1220px` | 三列降为两列、市场布局重排 |
| Compact | `max-width: 960px` 且 `min-width: 721px` | 收窄侧栏、生产改为单列 |
| Mobile | `max-width: 720px` | 单列页面、底部导航和大触控目标 |

不得添加与现有断点只差少量像素的新宽度断点。

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
- 键盘聚焦必须可见；
- 颜色不能是状态唯一信息；
- 错误信息使用 `role="alert"` 或关联说明；
- 移动端触控目标不小于 `44px`。

## 18. 当前重构基线

以下页面已迁移到共享组件：登录、概览、市场、生产、资产、排行榜、订单与记录、设置和桌面侧栏。

迁移后的约束：

- `globals.css` 只保留布局；
- `auth.css` 只保留登录布局和浏览器兼容；
- 基础视觉由 `design-system.css` 提供；
- 核心页面不直接使用历史按钮和状态类名；
- 页面标题和卡片标题不显示前置小字；
- 新页面直接使用共享组件。

## 19. 架构检查契约

`scripts/verify-ui-architecture.mjs` 必须验证：

- 设计文档和 `design-system.css` 存在；
- `design-system.css` 最后加载；
- 核心令牌和共享组件存在；
- 核心页面不包含历史按钮、状态或开关类名；
- `globals.css` 不重新定义基础控件视觉；
- `PageLayout` 和 `WidgetHeading` 不提供 `eyebrow`；
- 核心页面不出现 `.ui-eyebrow`；
- `订单与记录` 页面只显示单一主标题；
- 1220、960 和 720 三个断点存在；
- `prefers-reduced-motion`、焦点样式和 `44px` 触控目标存在；
- 本文件包含不可回退规则。

## 20. 不可回退规则

除非先修改本设计并完成评审，否则不得：

- 恢复页面标题或卡片标题上方的小字；
- 为 `PageLayout` 或 `WidgetHeading` 恢复 `eyebrow` 参数；
- 在业务页面重新使用 `.ui-eyebrow`；
- 删除 `design-system.css` 或改变其最终加载顺序；
- 在业务页面重新使用历史按钮、状态或开关类名；
- 在页面 CSS 重新定义基础控件视觉；
- 删除共享 UI 组件；
- 删除统一颜色、间距、圆角、阴影和控件高度令牌；
- 删除键盘焦点样式；
- 删除移动端 `44px` 最小触控目标；
- 删除 `prefers-reduced-motion` 支持；
- 添加未记录的相近响应式宽度断点；
- 绕过架构检查来合并视觉回退。

## 21. 修改流程

涉及视觉体系的 PR 必须：

1. 说明修改的令牌、组件、标题或布局语义；
2. 同步更新本文件；
3. 更新设计系统或布局文件；
4. 更新架构检查；
5. 通过完整 `npm run build`；
6. 检查桌面、紧凑桌面和移动端；
7. 检查标题层级、键盘焦点、禁用、错误和减少动画状态。

未更新设计文档和架构检查的基础样式回退不应合并。

## 目录型横向导航（2026-07-12）

商品市场标签属于可扩展目录导航：使用单行隐式网格列和横向滚动，项目最小宽度由控件可读性决定，不得使用 `repeat(6, ...)` 把当前目录数量写入样式。移动端保留滚动吸附。概览行情和商品资产网格允许按断点采用 3 列、2 列或 1 列，但不得因目录增加而截断项目。

## 统一资产订单簿与玩家系统（2026-07-12）

- 商品和工厂共用同一限价订单簿，不再使用工厂固定价格挂牌或商品／工厂二级切换。
- 商品与工厂估值使用最高非本人有效买入价，服务器统一计算总资产和排行榜。
- 运行中工厂允许进入卖单，冻结数量立即减少当前参与数量和周期产量。
- 工作冷却固定为 10 秒，连续工作不再提高冷却。
- 玩家资料统计固定为点击工作次数、生产商品总数、买入商品总数、卖出商品总数。
- 状态栏固定显示可用资金、总资产、排行榜和仓库剩余。
- 设置页玩家资料卡包含统计、退出和重置；侧栏退出按钮保留；设置页增加礼品兑换。
- 管理员页面固定为 /economy/admin。
- 详细规则以 docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md 和 docs/GIFT_CODE_AND_ADMIN_DESIGN.md 为准。

## 22. 开关唯一性规则

`SwitchControl` 是布尔开关的唯一 React 基础组件，`.ui-switch` 是唯一视觉类。设置页音效、紧凑数字和工厂运行开关必须使用同一实现。业务 CSS 只能安排开关位置，不得重新定义轨道、滑块、选中颜色或动画；不得新增 `facility-power-button`、`factory-switch`、`music-switch` 或 `production-toggle`。异常通过状态标签和说明文字表达，不创建异常开关变体。


## 23. 开关焦点环与点击区域

- `.ui-switch` 保留至少 `44 × 44px` 的透明点击区域，不得为了视觉尺寸缩小可点击目标；
- 开关轨道由伪元素绘制，键盘 `:focus-visible` 焦点环必须绘制在轨道伪元素外侧；
- 通用 `input:focus` 和 `input:focus-visible` 的外框、阴影不得直接显示在开关完整点击区域上，避免出现额外的大圆环；
- 鼠标或触摸选中只改变轨道和滑块状态，不增加第二层选中描边；
- 工厂、设置及后续所有开关继续共用同一规则。

## 共享仓库与工厂卡片布局基线（2026-07-12）

仓库管理使用单一 `Panel` 内部 `1:3` 分栏，不拆成两个顶层面板。仓库商品必须使用统一紧凑卡片，整卡为可访问按钮；字段只允许产品名称、可用库存和冻结库存。宽屏四列、普通桌面三列、平板与手机两列、极窄屏单列。

工厂卡片使用紧凑状态头、数量网格、规格网格、进度、计划和文本市场入口。状态原因只允许在顶部出现一次；不得创建 `manual-stop-card`、`factory-new-status`、`warehouse-special-panel` 或新的开关样式。基础按钮、状态标签、面板、输入框和开关继续使用设计系统组件。

