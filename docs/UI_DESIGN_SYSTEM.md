# Economy UI 设计系统

> 状态：当前视觉、共享组件、响应式与可访问性实现基线  
> 适用项目：`RIVERS0FT/Economy`  
> 当前平台：网页端  
> 更新时间：2026-07-12

产品和页面职责分别以 `PRODUCT_AND_GAMEPLAY_DESIGN.md`、`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为准；应用外壳玻璃材质以 `LIQUID_GLASS_CHROME_DESIGN.md` 为准。

## 1. 界面目标

- 深色、稳定、专业的金融与产业经营氛围；
- 信息密度高但层级清晰；
- 玩家可见固定文案统一使用中文；
- 绿色表示主要操作、增长、买入和正常；
- 红色表示卖出、损失、危险和错误；
- 金色表示价格、等待和施工；
- 蓝色表示信息；
- 桌面适合持续观察，移动端适合单手操作并尊重安全区；
- 标题只保留主标题和必要说明，不显示英文眉题或重复小字。

## 2. 样式职责

| 文件 | 唯一职责 |
|---|---|
| `src/styles/design-system.css` | 设计令牌、基础控件、共享视觉、状态、表格和焦点 |
| `src/styles/globals.css` | 通用业务布局 |
| `src/styles/icon-system.css` | 全局 SVG 图标尺寸、商品图标标签、导航图标槽位和移动图标尺寸 |
| `src/styles/unified-market-admin.css` | 统一市场与管理员页面布局 |
| `src/styles/industry-system.css` | 工厂与生产密度 |
| `src/styles/warehouse-expansion.css` | 共享仓库布局 |
| `src/styles/auth.css` | 登录布局与自动填充兼容 |
| `src/styles/card-system.css` | 卡片圆角映射 |
| `src/styles/desktop-sidebar.css` | 桌面侧栏 |
| `src/styles/liquid-glass-chrome.css` | 状态栏和移动底栏玻璃材质 |
| `src/styles/mobile-*.css` | 移动导航、安全区和页面布局 |

`design-system.css` 保持最后加载。页面样式不得重新实现按钮、输入、面板、状态标签、开关、表格、图标或焦点的基础外观。

## 3. 共享 React 组件

业务页面优先使用：

- `PageLayout`
- `Panel`
- `WidgetHeading`
- `Button`
- `StatusTag`
- `MetricCard`
- `DataList`
- `DataRow`
- `SwitchControl`
- `ToggleField`
- `ScrollableTable`
- `EmptyState`

`SwitchControl` 是布尔开关的唯一 React 基础组件，`.ui-switch` 是唯一视觉实现。不得新增工厂开关、音乐开关或设置开关的平行 CSS。

页面标题从 `h1` 开始，卡片标题从 `h2` 开始。`PageLayout` 和 `WidgetHeading` 不提供 `eyebrow` 参数。

## 4. 统一 SVG 图标体系

应用外壳图标来自 `src/components/icons/GameIcons.tsx`，商品语义图标来自 `src/components/icons/ProductIcons.tsx`：

- 状态栏和桌面／移动导航不得继续使用 Unicode 字符、Emoji 或字体符号作为图标；
- 商品图标不得使用 `▣`、字母缩写、Emoji 或字体符号作为占位；
- 所有图标使用统一 `24 × 24` `viewBox`、`currentColor`、圆角端点和约 `1.8–1.9` 描边；
- SVG 根节点必须带 `.game-icon`，商品 SVG 额外带 `.product-icon`，尺寸由 `src/styles/icon-system.css` 统一控制；
- 图标本身使用 `aria-hidden="true"` 和 `focusable="false"`，可访问名称由按钮、状态项或相邻文字提供；
- 导航配置只保存 `id` 与中文 `label`，不得重新加入字符型 `icon` 字段；
- 桌面侧栏和移动底栏复用同一套导航 SVG，不维护两套图标；
- 图标颜色必须继承 `currentColor`，不得在 SVG 路径中硬编码业务颜色；
- `ProductIconLabel` 是商品图标与名称的统一并排结构，页面不得复制另一套图标标签布局；
- 品牌 Logo、商品照片和工厂插图属于内容图像，不受本节“界面图标”规则限制。

### 4.1 商品 SVG 图标目录

当前 12 种正式商品必须在 `ProductIcons.tsx` 中各有一个独立、可辨识的本地内联 SVG：

| 商品 ID | 图标语义 |
|---|---|
| `grain` | 麦穗 |
| `timber` | 原木 |
| `ore` | 矿石 |
| `crude-oil` | 油滴 |
| `flour` | 面粉袋 |
| `lumber` | 堆叠木板 |
| `steel` | 工字钢 |
| `plastic` | 塑料瓶 |
| `food` | 食物碗 |
| `furniture` | 椅子 |
| `machinery` | 齿轮机械 |
| `electronics` | 芯片 |

商品图标实现规则：

- 商品正式名称、分类和价格仍只来自服务器 `PRODUCT_CATALOG`，客户端图标映射仅承担视觉语义，不得成为第二套经济目录；
- 当前 12 个商品 ID 必须全部具有显式图标分支；
- 服务器未来返回未知商品 ID 时必须使用统一包装箱 SVG 回退，页面仍按服务器数组动态渲染，不得因缺少图标隐藏商品；
- 市场商品标签、概览商品行情、商品库存与估值卡、商品订单和商品资产变动必须使用相同的 `ProductIcon`／`ProductIconLabel`；
- 商品图标在相邻文字存在时保持装饰性，不重复朗读商品名称。

## 5. 设计令牌

基础视觉必须使用 `design-system.css` 中的颜色、文字、间距、圆角、阴影和控件高度令牌。相同语义在所有页面使用相同颜色，颜色不能作为状态的唯一表达。

桌面卡片使用统一 `--radius-card`，移动主要卡片使用 `--radius-card-mobile`。控件不得跟随卡片大圆角。

## 6. 按钮与表单

- 业务操作使用 `Button` 的 `primary`、`secondary`、`danger`、`text` 或 `compact`。
- 危险操作不得使用绿色主要按钮。
- 输入框、选择器和文本域使用统一高度、背景、边框和焦点。
- 数字范围、整数和资产约束由业务层与服务器共同校验。
- 所有可点击控件在移动端至少提供 44px 的有效触控高度。
- 禁用状态使用原生 `disabled`。

## 7. 开关焦点环与点击区域

`SwitchControl` 的可访问点击区域为至少 `44 × 44px`，视觉轨道仍保持紧凑。

焦点环应位于轨道伪元素外侧，并与轨道形状一致。不得恢复围绕整个 44px 点击区域的额外的大圆环。

必须保留：

- `.ui-switch:focus`
- `.ui-switch:focus-visible`
- `.ui-switch:focus-visible::before`
- 明确的 `outline-offset`

## 8. 状态、表格与数据

- 状态使用 `StatusTag`，必须同时包含文字。
- 表格外层使用 `ScrollableTable`，窄屏允许横向滚动列。
- 页面主滚动由 `.page-scroll` 承担；业务表格不得抢占页面纵向滚动。
- 本地成交记录面板自然增长，不设置固定高度、分页、折叠或内部垂直滚动。
- 订单簿每行只显示方向、价格和剩余数量，不显示所有者。

## 9. 统一资产市场

- 商品和工厂使用同一资产标签和下单区域。
- 订单簿为单列 5+5 笔，不按价格档位聚合。
- 不得恢复商品／工厂二级切换、双列买卖盘或工厂固定价格卡。
- 买入使用成功色，卖出使用危险色，但方向必须有文字。
- 桌面订单簿可拉伸网格高度，移动端按内容自然增长。

## 10. 目录型横向导航

商品和工厂标签必须根据服务器目录动态生成。

- 使用可滚动横向区域或自适应自动列。
- 不得使用固定项目数量的 `repeat(6, ...)`。
- 不得在 JSX 中硬编码 6 个商品或工厂。
- 目录为空时显示空状态。
- 标签文本过长时保持可访问名称，不得让页面整体横向溢出。

## 11. 生产与仓库布局

- 共享仓库桌面采用 1:3 分栏，低于 960px 上下排列。
- 商品卡宽屏四列、桌面三列、平板和手机两列，极窄屏单列。
- 工厂卡宽屏双列、自然高度、顶部对齐，低于 960px 单列。
- 状态原因只在工厂卡顶部显示一次。
- 停止和异常状态使用紧凑状态行，不显示大型空进度条。
- 生产信息、计划控件和统一市场入口不得因紧凑布局被删除。

## 12. 中文与品牌

- 玩家可见界面统一使用中文，不允许固定文案中英文夹杂。
- 技术枚举必须转换为中文。
- 时间使用秒、分钟、小时。
- 桌面侧栏品牌第一行固定为“金融帝国”，第二行显示玩家用户名。
- 不显示固定副标题“市场交易版”。
- 不恢复独立玩家头像或重复用户名卡。

## 13. 响应式与安全区

- `.page-scroll` 是唯一页面纵向滚动容器。
- 移动状态栏和底栏必须使用 `safe-area-inset-*`。
- 移动底部导航允许横向滚动，首尾保留完整空白。
- 活动导航按钮和图标不得位移、缩放或改变几何尺寸。
- 页面底部预留空间必须保证最后一张卡能滚动到导航栏上方。
- 复杂图表可以在性能不足时降级，但交易和资产操作不能依赖动画。

## 14. 防回退

不得：

- 在业务页面复制基础控件视觉；
- 恢复英文眉题；
- 恢复价格档位聚合订单簿；
- 恢复 `records` 导航；
- 新增平行开关；
- 在导航或状态栏中恢复 Unicode 字符、Emoji 或字体符号图标；
- 绕过 `GameIcons.tsx` 新增平行界面图标库；
- 删除 `ProductIcons.tsx` 的任一当前商品显式图标、未知商品包装箱回退或 `ProductIconLabel`；
- 在商品标签、商品行情和商品资产卡中恢复字符占位图标或无图标文本卡；
- 让移动状态栏或底栏忽略安全区；
- 给导航活动态添加位移或缩放；
- 使用运行时 DOM 扫描、文本匹配或 `MutationObserver` 修补已渲染页面；
- 未更新本文档和验证脚本就改变令牌、断点、共享组件、图标体系或关键布局。
