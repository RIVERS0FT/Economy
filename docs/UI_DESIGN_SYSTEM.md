# Economy UI 设计系统

> 状态：当前界面视觉与交互设计基线  
> 适用项目：`RIVERS0FT/Economy`  
> 当前平台：网页端  
> 更新时间：2026-07-11

本文件定义 Economy 的颜色、字体、间距、圆角、阴影、按钮、输入框、卡片、状态标签、表格和响应式规则。

产品结构与玩法以 `docs/WEB_MULTIPLAYER_GAME_DESIGN.md` 为准；涉及界面视觉、控件状态、响应式行为和样式实现时，以本文件为准。

所有核心设计令牌和基础控件样式必须集中在：

```text
src/styles/design-system.css
```

该文件必须在其他项目样式之后加载，作为最终视觉约束层。旧页面样式可以在迁移期间保留，但不得改变基础控件和设计令牌的最终含义。

## 1. 设计目标

Economy 的界面应体现：

- 深色、稳定、专业的金融与经营氛围；
- 信息密度高，但层级清楚；
- 绿色代表主要操作、增长和正常状态；
- 红色代表损失、危险和错误；
- 金色代表价格、资产价值和等待状态；
- 蓝色代表挂牌、信息和外部状态；
- 桌面端适合持续观察和操作；
- 移动端保证单手操作、可滚动和安全区适配；
- 不使用与真实银行或证券软件高度相似的品牌视觉。

## 2. 实现原则

1. 设计令牌优先于页面硬编码值。
2. 基础控件优先复用统一类名或共享组件。
3. 页面 CSS 只负责业务布局，不重新定义按钮、输入框、卡片、标签或表格的基础外观。
4. 同一种语义在所有页面使用相同颜色。
5. 交互状态必须包含默认、悬停、聚焦、禁用和危险状态。
6. 响应式变化使用统一断点，不随页面自行增加相近断点。
7. 关键规则由 `scripts/verify-ui-architecture.mjs` 验证。
8. 修改令牌、断点或基础控件时，必须同步更新本文件和架构检查。

## 3. 文件职责

| 文件 | 职责 |
|---|---|
| `src/styles/design-system.css` | 设计令牌、基础控件、焦点、状态、表格和响应式密度 |
| `src/styles/globals.css` | 页面业务布局和历史页面样式 |
| `src/styles/card-system.css` | 将现有卡片类映射到统一卡片圆角令牌 |
| `src/styles/desktop-sidebar.css` | 桌面侧栏布局 |
| `src/styles/mobile-*.css` | 移动端导航、页面和状态栏布局 |
| `src/components/ui/layout.tsx` | 页面、面板、标题、空状态和状态标签共享结构 |

`design-system.css` 必须最后导入，以保证基础控件的最终呈现不受旧样式文件加载顺序影响。

## 4. 颜色系统

### 4.1 背景与表面

| 令牌 | 值 | 用途 |
|---|---|---|
| `--color-bg-canvas` | `#07100d` | 页面主背景 |
| `--color-bg-deep` | `#050a08` | 深层背景与渐变终点 |
| `--color-surface-panel` | `rgba(12, 27, 21, 0.92)` | 主卡片与面板 |
| `--color-surface-soft` | `rgba(15, 34, 26, 0.76)` | 次级表面 |
| `--color-surface-control` | `rgba(2, 10, 7, 0.72)` | 输入框与控件背景 |
| `--color-surface-hover` | `rgba(193, 226, 207, 0.08)` | 次级按钮和悬停表面 |

### 4.2 文字与边框

| 令牌 | 值 | 用途 |
|---|---|---|
| `--color-text-primary` | `#f3f7f4` | 标题、数字和主要文字 |
| `--color-text-secondary` | `#c5d0ca` | 表单标签和说明文字 |
| `--color-text-muted` | `#90a099` | 辅助文字、时间和占位信息 |
| `--color-border` | `rgba(212, 245, 224, 0.12)` | 默认边框 |
| `--color-border-strong` | `rgba(212, 245, 224, 0.22)` | 强调边框和聚焦状态 |

### 4.3 语义颜色

| 令牌 | 值 | 语义 |
|---|---|---|
| `--color-success` | `#7be49e` | 正常、增长、买价、运行中 |
| `--color-success-strong` | `#239b57` | 主要操作渐变和进度 |
| `--color-warning` | `#f2c568` | 价格、等待、施工中 |
| `--color-danger` | `#ff8f83` | 错误、损失、资金不足 |
| `--color-info` | `#75c9ff` | 挂牌、信息状态 |
| `--color-accent-violet` | `#b9a0ff` | 保留的特殊辅助状态 |

禁止在新增基础控件中直接写新的品牌色。新增语义颜色必须先进入本文件与 `design-system.css`。

## 5. 字体系统

### 5.1 字体族

```css
--font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

- 普通界面统一使用 `--font-sans`。
- 订单号、请求标识或需要等宽对齐的数据可以使用 `--font-mono`。
- 不在单个页面中引入额外网络字体。

### 5.2 字号等级

| 令牌 | 值 | 用途 |
|---|---:|---|
| `--font-size-xs` | `0.68rem` | 标签、徽章、表头 |
| `--font-size-sm` | `0.78rem` | 辅助说明和表格内容 |
| `--font-size-md` | `0.88rem` | 表单与常规正文 |
| `--font-size-lg` | `1rem` | 主要正文与按钮 |
| `--font-size-xl` | `1.125rem` | 卡片标题 |
| `--font-size-2xl` | `1.5rem` | 重要数字 |
| `--font-size-page` | `clamp(1.9rem, 3vw, 3.1rem)` | 页面标题 |

正文默认行高为 `1.5`，紧凑数据行可使用 `1.25`。

## 6. 间距系统

所有新组件使用以下 4px 基础倍数：

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

使用规则：

- 控件内部水平间距一般使用 `--space-3` 或 `--space-4`。
- 卡片内部间距默认使用 `--space-4`。
- 卡片之间默认使用 `--space-3`。
- 页面大区块之间使用 `--space-4` 到 `--space-8`。
- 不新增 `0.73rem`、`0.81rem` 等无法对应间距等级的值。

## 7. 圆角系统

| 令牌 | 值 | 用途 |
|---|---:|---|
| `--radius-sm` | `0.5rem` | 紧凑表格按钮和小元素 |
| `--radius-control` | `0.75rem` | 按钮、输入框和普通控件 |
| `--radius-card` | `1.5rem` | 桌面端卡片和面板 |
| `--radius-card-mobile` | `2.5rem` | 移动端主要卡片 |
| `--radius-pill` | `999px` | 状态标签、徽章和胶囊控件 |

卡片不得自行定义新的主圆角。移动端卡片圆角通过令牌切换，不在单个页面重复声明。

## 8. 阴影系统

| 令牌 | 用途 |
|---|---|
| `--shadow-panel` | 普通卡片与面板 |
| `--shadow-elevated` | 弹出提示、浮动状态和重要操作 |
| `--shadow-focus` | 键盘聚焦环 |

- 阴影只表达层级，不作为边框替代。
- 表格行、普通输入框和小标签不使用大面积阴影。
- 移动端减少不必要的高模糊阴影，避免影响性能。

## 9. 按钮

### 9.1 基础规则

- 默认高度：`--control-height`，桌面为 `2.75rem`。
- 移动端可点击控件最小高度为 `44px`。
- 默认圆角：`--radius-control`。
- 默认字重：`800`。
- 所有按钮必须有可见的 `:focus-visible` 状态。
- 禁用状态降低透明度并取消位移动画。

### 9.2 变体

| 类名 | 用途 |
|---|---|
| 原生 `button` 或 `.ui-button--primary` | 主要提交和确认操作 |
| `.ghost-button` 或 `.ui-button--secondary` | 次级操作 |
| `.danger-button` 或 `.ui-button--danger` | 删除、退出和不可逆操作 |
| `.text-button` 或 `.ui-button--text` | 页面内低权重导航 |
| `.table-button` 或 `.ui-button--compact` | 表格内操作 |

每个页面同一操作区只保留一个主要按钮。危险操作不能使用绿色主要按钮。

## 10. 输入框与表单

适用于 `input`、`select` 和 `textarea`：

- 使用统一控件高度、圆角、背景和边框。
- 标签使用 `--color-text-secondary` 与 `--font-size-md`。
- 聚焦时显示绿色边框和焦点环。
- 错误状态使用危险色，但不得只依赖颜色表达错误，必须提供错误文字。
- 数字输入需要在业务层验证最小值、最大值和精度。
- 禁止移除键盘焦点轮廓而不提供替代样式。

## 11. 卡片与面板

### 11.1 统一卡片

以下现有结构统一映射到卡片令牌：

- `.panel`
- `.player-mini-card`
- `.empty-state`
- `.market-quote-grid > div`
- `.wealth-total`
- `.listing-card`
- `.asset-card-grid > div`
- `.frozen-cards > div`

统一规则：

- 使用 `--radius-card`；
- 使用统一边框；
- 主面板使用 `--shadow-panel`；
- 内容间距使用间距令牌；
- 不通过不同圆角表达业务状态。

移动端主要外壳可以使用 `--radius-card-mobile`，登录表单在窄屏下允许与页面边缘融合。

## 12. 状态标签

统一基础类：

```text
.status-chip
.ui-status-tag
.widget-badge
.rank-chip
.side-buy
.side-sell
.you-label
```

状态语义：

| 状态 | 类名 | 颜色 |
|---|---|---|
| 正常、运行中、买入 | `.status-success`、`.status-running`、`.side-buy` | 绿色 |
| 等待、施工中 | `.status-warning`、`.status-constructing` | 金色 |
| 错误、库存满、资金不足、卖出 | `.status-danger`、`.status-full`、`.status-insufficient_funds`、`.side-sell` | 红色 |
| 挂牌、信息 | `.status-info`、`.status-listed` | 蓝色 |
| 中性 | `.status-neutral` | 次要文字色 |

所有状态标签使用胶囊圆角、紧凑字号和统一水平间距。

## 13. 表格

- 表格外层必须使用 `.table-wrap` 或 `ScrollableTable`。
- 表格宽度为 `100%`，内容过宽时由外层横向滚动。
- 表头使用次要文字色、紧凑字号和大写字距。
- 单元格统一边框与垂直间距。
- 金额和数量推荐右对齐；名称和说明左对齐。
- 当前玩家行可以使用成功色的低透明背景。
- 空表格使用统一空状态，不在表格中生成多个占位行。
- 移动端不强行压缩所有列，应保留最小表格宽度并允许横向滚动。

## 14. 页面标题与层级

- 页面使用 `PageLayout`。
- 卡片标题使用 `WidgetHeading`。
- 页面与卡片可选的前置说明统一使用 `.ui-eyebrow`。
- 每个页面只允许一个 `h1`。
- 卡片标题使用 `h2`，内部小节使用 `h3`。
- 不通过全大写长文本表达层级。

## 15. 响应式规则

统一断点：

| 名称 | 条件 | 用途 |
|---|---|---|
| Wide | `max-width: 1220px` | 三列降为两列、复杂市场布局重排 |
| Compact | `max-width: 960px` 且 `min-width: 721px` | 收窄侧栏、单列生产布局 |
| Mobile | `max-width: 720px` | 单列页面、底部导航、安全区与大触控目标 |

不得添加与现有断点只差少量像素的新断点，例如 `1180px`、`950px` 或 `700px`。确需新增断点时，必须更新本文件和架构检查。

### 15.1 移动端要求

- 页面主体使用单列布局。
- 主要点击目标不小于 `44px`。
- 顶部状态栏和底部导航尊重 `safe-area-inset-*`。
- 表格允许横向滚动。
- 页面内容不能被固定导航遮挡。
- 卡片圆角切换为 `--radius-card-mobile`。
- 不依赖 hover 才能发现关键操作。

## 16. 动画与性能

- 默认快速动画时长：`--motion-fast: 150ms`。
- 普通过渡时长：`--motion-normal: 220ms`。
- 动画只用于状态反馈，不阻塞操作。
- `prefers-reduced-motion: reduce` 时关闭非必要动画、过渡和滚动动画。
- 不在大量表格行或盘口行上使用高成本模糊和阴影动画。

## 17. 可访问性

- 键盘聚焦必须可见。
- 颜色不能是状态的唯一信息来源。
- 文字与背景保持足够对比度。
- 图标按钮必须提供可访问名称。
- 禁用按钮不能仅改变颜色，应同时设置 `disabled`。
- 错误信息使用文字描述并与字段关联。
- 触控目标在移动端不小于 `44px`。

## 18. 架构检查契约

`scripts/verify-ui-architecture.mjs` 必须验证：

- `docs/UI_DESIGN_SYSTEM.md` 存在；
- `src/styles/design-system.css` 存在并在 `main.tsx` 最后导入；
- 核心颜色、字体、间距、圆角、阴影和控件高度令牌存在；
- 按钮、输入框、卡片、状态标签和表格基础选择器存在；
- 1220、960 和 720 三个断点存在；
- `prefers-reduced-motion` 规则存在；
- `card-system.css` 使用 `--radius-card`，不得重新定义卡片主令牌；
- `PageLayout` 与 `WidgetHeading` 渲染 `.ui-eyebrow`；
- 本文件包含不可回退规则。

## 19. 不可回退规则

除非先修改本设计并完成迁移，否则不得：

- 删除 `design-system.css` 或改变其最终加载顺序；
- 在页面中重新定义基础按钮、输入框、卡片、状态标签或表格外观；
- 删除统一颜色、间距、圆角、阴影和控件高度令牌；
- 恢复多个互相冲突的卡片圆角变量；
- 删除键盘焦点样式；
- 删除移动端 `44px` 最小触控目标；
- 删除 `prefers-reduced-motion` 支持；
- 添加未记录的相近响应式断点；
- 绕过架构检查来合并视觉回退。

## 20. 修改流程

涉及视觉体系的 PR 必须：

1. 说明修改的令牌或组件语义；
2. 同步更新本文件；
3. 更新 `design-system.css`；
4. 更新架构检查或测试；
5. 通过完整 `npm run build`；
6. 检查桌面、紧凑桌面和移动端；
7. 检查键盘焦点、禁用状态和错误状态。

未更新设计文档和架构检查的基础样式回退不应合并。