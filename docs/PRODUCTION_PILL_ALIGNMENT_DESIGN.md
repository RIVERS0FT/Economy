# Economy 建筑页工厂卡片与胶囊对齐设计

> 状态：建筑页区域管理几何、工厂卡片、二级详情、胶囊与开关的场景权威基线  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-08-23

本设计补充 `UI_DESIGN_SYSTEM.md`、`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`、`INDUSTRY_AND_PRODUCTION_DESIGN.md`、`FACILITY_CATALOG_PRESENTATION_DESIGN.md` 与 `LIQUID_GLASS_CHROME_DESIGN.md`。地区建筑页的最终可见几何、工厂卡片排列和工厂详情场景规则以本文为准；生产、建造、市场、合同和目录顺序仍由各自权威设计负责。

建筑页工厂集群开关的点击区域继续以本文为准，这是对全局 44 × 44px 开关点击区域规则的明确场景例外。

## 1. 建筑管理区目标

地区建筑分区不再使用“建筑概况 + 横向建筑账本 + 同页详情”的结构。正式列表态固定为：

```text
建设新工厂
→ 已拥有工厂卡片网格
```

具体规则：

- 删除“建筑概况”卡片，不在建筑分区顶部重复汇总建筑总数、运行数、异常数、平均满员率或总利润；相关数据继续在地区概览和单个工厂详情中按既有职责展示。
- “建设新工厂”是建筑列表态第一张一级卡片，继续承载工厂类型、数量、资金、材料、库存、缺口、一键采购／买单和待采购业务。
- 已拥有工厂列表不再套 `PagePanel` 或“建筑列表”外层卡片，工厂卡直接排列在地区建筑内容区。
- 建筑列表不显示搜索输入框、产业分类下拉框或运行状态下拉框，也不显示“X / X 类”计数和筛选说明。
- 已拥有工厂仍严格按服务器 `game.facilityTypes` 的正式 C1→C7 相对顺序输出，不得按利润、数量、状态或最近访问排序。

本次只改变信息架构和展示，不改变建造、生产、自动采购、资产交易、合同或服务端状态语义。

## 2. 工厂卡片

`FacilityClusterSelectorCard` 继续作为已拥有工厂的唯一点击入口。正式呈现恢复为原 4:5 插画卡片，不再使用横向账本行。

每张卡片必须同时在卡内显示：

- 工厂名称；
- 当前平均利润；
- 工厂数量；
- 正式工厂插画。

运行／异常／停止状态继续通过现有 `data-status` 与 success / danger / neutral / warning 色彩语义影响卡片视觉，不额外在卡片上重复“运行中”“异常”“已停止”文字。

列表正式使用三列：

```css
grid-template-columns: repeat(3, minmax(0, 1fr));
```

三列规则同时适用于桌面、紧凑地区工作区和移动端。卡片必须允许收缩到当前内容宽度，使用 `width: 100%`、`max-width: none` 和 `aspect-ratio: 4 / 5`，不得因为基础样式中的旧 `max-width` 形成大块空白，也不得恢复横向单列账本。

320px 及以上正式支持宽度不得产生页面级横向滚动。卡内名称、利润和数量允许使用既有移动字号与省略策略，但不得移出卡片。

## 3. 工厂详情二级视图

点击工厂卡片后进入当前地区建筑分区内部的二级详情视图，而不是在建筑列表旁边同时显示详情，也不是新增正式一级页面或独立工厂实例路由。

架构固定为：

```text
ProvincePage
└─ buildings
   ├─ 列表态：建设新工厂 + 工厂卡片
   └─ 详情态：FacilityClusterDetailContent
```

`ProvincePage` 持有地区建筑二级详情的 `facilityTypeId`。`BuildingsPage` 可以在独立建筑上下文中持有同等的本地详情 ID，但受控嵌入时必须服从 `ProvincePage`，不得创建第二套详情选择状态。

详情继续唯一复用现有 `FacilityClusterDetailContent`，包含状态、数量、满员率、利润、生产设置、生产结算、经营诊断以及市场／合同入口。不得复制第二套生产详情 DOM 或业务逻辑。

地区工厂详情标题固定复用共享 `RegionalEntityPageTitle`：

```text
食品加工厂
加利福尼亚州
```

第一行是工厂实体名称并使用较大主标题字号，第二行是州级地区全称并使用灰色次级文字；商品详情使用完全相同的结构。两行各自保持单行，过长时使用省略策略。所有玩家 `PageLayout` 标题统一使用 `design-system.css` 的 `--player-page-title-track-height: 40px`；普通单行标题统一使用 `--font-size-player-page-title`，地区实体两行标题复用同一轨道并由 `regional-entity-page-title.css` 负责内部排版。建筑页不得再通过 `body:has(...)`、未定义控制尺寸令牌或移动断点单独改变标题高度，页面切换与列表／详情切换都不得移动返回／关闭按钮或正文起点。

进入详情后不显示地区“概览 / 市场 / 建筑 / 仓库”分区按钮。返回建筑列表后恢复分区按钮和建设表单状态。

## 4. 地区分区导航位置

地区“概览 / 市场 / 建筑 / 仓库”是正文级子导航，不再通过 `PageLayout.actions` 放入固定标题区域。正常地区列表态的结构固定为：

```text
返回｜地区标题｜关闭
正文：地区分区切换
正文：当前分区内容
```

该规则是地区页对共享“页面业务操作位于固定头部”基线的明确场景例外；地区四分区属于页面内容层级，不属于页面标题操作。

## 5. 滚动与移动端

建设卡和工厂详情都保持普通文档流，不使用建筑页场景 sticky：

```css
position: static;
top: auto;
max-height: none;
overflow: visible;
```

页面唯一纵向滚动视口继续由 `PageLayout` 管理，建设卡和详情不得创建自己的纵向滚动条。

移动端工厂卡点击行为与桌面一致：进入地区建筑二级详情。地区工厂详情不再从 `BuildingsPage` 打开专用 `MobileFacilityDetailSheet`；共享 Mobile Workspace Sheet 基础设施继续供其他仍以 Sheet 呈现的业务详情使用，不因本规则删除。

二级详情在移动端仍位于当前页面工作区，必须保持无横向裁切、触控反馈和键盘可访问性。

## 6. 胶囊与开关

建筑页继续统一以下可见胶囊几何：

- `StatusTag` 状态胶囊；
- 工厂集群等级胶囊；
- 工厂集群 `SwitchControl` 的可见轨道与点击区域。

统一几何：

```text
可见高度：1.6rem
点击高度：1.6rem
开关宽度：2.75rem
圆角：var(--radius-pill)
边框：1px
```

状态与等级胶囊宽度由文字决定，开关保持固定宽度。工厂集群开关点击区域必须与可见胶囊完全一致，即 `2.75rem × 1.6rem`，不得恢复超出可见胶囊的透明 44px 点击盒。

滑块保持 `1rem`，使用：

```css
top: calc((可见轨道高度 - 滑块尺寸) / 2);
```

焦点环继续绘制在可见轨道外侧，键盘焦点和 `aria-label` 不得删除。

## 7. 样式职责

- `design-system.css` 定义所有玩家页面统一的 40px 标题轨道、普通单行标题字号、`StatusTag`、全局开关基础外观和焦点环；
- `facility-group-card-grid.css` 保留生产详情内部结构和 4:5 工厂选择器基础几何；
- `production-surface.css` 是地区建筑页最终三列工厂卡、列表无外层卡片、建设卡顺序、二级详情可见性和建筑页紧凑开关的场景最终权威，不得再承担共享页面标题高度；
- `regional-entity-page-title.css` 统一负责地区实体标题内部两行排版并复用共享标题轨道；
- `province-page.css` 负责地区正文级分区切换自身布局；
- `primary-surfaces.css` 继续独占一级卡片外层 padding；
- `mobile-detail-sheet.css` 与唯一 Sheet Host 继续负责其他仍使用根级移动详情 Sheet 的业务，不再承担地区工厂详情入口。

`production-surface.css` 必须在 `facility-group-card-grid.css` 之后加载，确保基础 4:5 卡片可以在地区场景中放宽到三列完整承载宽度。不得在业务组件内使用行内样式复制这些几何规则。

## 8. 防回退

`scripts/verify-production-desktop-layout.mjs` 与页面几何验证必须验证：

- `production-surface.css` 在 `facility-group-card-grid.css` 之后加载；
- 建筑列表态不存在“建筑概况”、搜索、产业分类、运行状态和 `facility-cluster-navigation` 外层卡片；
- “建设新工厂”位于工厂卡片列表之前；
- 工厂列表固定三列，工厂卡使用 `aspect-ratio: 4 / 5`、`width: 100%` 与 `max-width: none`；
- 工厂卡继续包含名称、利润和数量；
- 点击卡片进入二级详情，列表态不同时渲染详情；
- 所有玩家页面普通单行标题与地区建筑列表／详情标题共享同一 40px 标题轨道，建筑页不得恢复标题高度场景特例；
- 地区详情标题复用“实体名称第一行／灰色地区全称第二行”的共享结构；
- 胶囊与开关继续保持 `2.75rem × 1.6rem`；
- `tests/browser/buildings-ledger-layout.spec.ts` 使用真实浏览器验证桌面与移动端三列卡片、建设卡顺序、无横向裁切、详情进入／返回和标题高度稳定；`tests/browser/player-page-geometry.spec.ts` 验证所有正式玩家页面的共享标题轨道和单行标题字号。

不得为了恢复横向建筑账本、同页详情、筛选器、建筑概况、页面专属标题高度或移动专用工厂详情 Sheet 删除上述验证。改变本设计时必须同步更新本文、最终 CSS、页面实现和真实浏览器回归。