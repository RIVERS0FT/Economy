# Economy 建筑页账本与胶囊对齐设计

> 状态：建筑页区域管理几何、工厂账本、胶囊与开关的场景权威基线
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-08-21

本设计补充 `UI_DESIGN_SYSTEM.md`、`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`、`INDUSTRY_AND_PRODUCTION_DESIGN.md` 与 `LIQUID_GLASS_CHROME_DESIGN.md`。建筑页工厂集群开关的点击区域规则以本文为准；这是对全局 44 × 44px 开关点击区域规则的明确场景例外。

地区 `BuildingsPage` 的业务职责、建设材料、生产结算、市场与合同语义仍由页面与产业权威设计决定；本文只覆盖建筑管理区的最终可见几何。为解决战略卡片实际内容宽度小于浏览器 viewport 时产生的三列裁切，本文明确覆盖旧设计中“按 viewport 固定左／中／右三列”“建设卡与详情卡桌面 sticky”“工厂选择器 4:5 竖卡作为最终呈现”的视觉规则。旧规则可以继续作为前置基础 CSS 的兼容默认值，但最终计算样式必须以本文和 `production-surface.css` 为准，不得重新压缩页面内容。

## 1. 建筑管理区目标

建筑页参考大型经营模拟游戏的高密度建筑账本信息组织方式，但继续使用 Economy 自身的深色毛玻璃材质、正式工厂插画、目录顺序和生产规则，不复制其他游戏的皮肤或资产。

地区建筑工作区保持三个业务模块：

1. 已拥有建筑账本；
2. 建设新工厂；
3. 当前建筑详情。

最终视觉优先级固定为：

```text
建筑概况
→ 已拥有建筑账本（始终第一、始终占满当前管理区宽度）
→ 建设新工厂 / 当前建筑详情（按当前承载面真实宽度自动并排或换行）
```

这里的“自动并排或换行”必须基于 `.production-workspace` 自身可用宽度，而不是浏览器 viewport 断点。桌面战略卡片只有约 500～700px 实际页面宽度时必须自然成为单列，不得因为浏览器总宽度大于 960px 或 1380px 强行保留超宽三轨。

## 2. 工厂账本

`.facility-cluster-navigation` 是建筑管理区第一张主表面并横跨当前管理区全部轨道。筛选器继续保留搜索、产业和运行状态三个正式条件，但轨道必须使用可收缩 `auto-fit + minmax()`，不能在窄承载面制造横向滚动。

已拥有工厂继续严格使用服务器 `game.facilityTypes` 的 C1→C7 正式相对顺序，不得因状态、利润、数量或最近查看重新排序。

工厂选择器最终呈现改为高密度横向账本行：

- 单行宽度占满账本内容区；
- 最小高度约 `4.5rem～4.75rem`，不得恢复 4:5 大卡作为最终桌面／移动呈现；
- 左侧使用正式工厂插画缩略区；
- 中部显示工厂名称与“数量”；
- 右侧显示当前平均利润与运行状态；
- 运行状态继续由 `data-status` 和现有 success / danger / neutral / warning 颜色语义派生；
- 行本身仍是唯一选择按钮，不增加“查看详情”第二按钮，不绘制持久选中态。

选择器可以在 `facility-group-card-grid.css` 保留兼容基础几何，但 `production-surface.css` 必须在其后把最终页面呈现收束为横向账本。任何后续修改不得通过删除最终覆盖让 4:5 竖卡重新成为正式建筑页视觉。

## 3. 建设与详情区

账本之后的建设卡和详情外壳使用同一个自适应网格：

```css
grid-template-columns: repeat(auto-fit, minmax(min(26rem, 100%), 1fr));
```

当承载面足够宽时，建设和详情可以并排；不足时按文档流自然换行。不得通过固定第三列、最小 480px 详情轨道或父级 `overflow: hidden` 维持桌面三列假象。

建设卡继续展示现有工厂类型、数量、建造资金、材料、库存、缺口、一键采购／买单和待采购业务；本次改造不改变服务器写操作和采购规则。

详情继续使用现有 `FacilityClusterDetailContent`，包含状态、数量、满员率、利润、生产设置、生产结算、经营诊断及市场／合同入口；本次改造不创建第二套详情状态。

## 4. 桌面滚动规则

建设卡与详情外壳不再使用建筑页场景 sticky。大于等于 `961px` 时也保持：

```css
position: static;
top: auto;
max-height: none;
overflow: visible;
```

页面唯一纵向滚动视口继续由 `PageLayout` 的页面滚动区负责。建设卡内容较长时允许整页继续向下滚动，不得恢复建设卡自己的纵向滚动条；详情卡同样由真实内容决定高度。

该规则覆盖本文旧版本以及产业设计中对建设卡／详情卡固定位置的描述。不得使用 `position: fixed`、负 margin、JavaScript 滚动监听或额外透明占位模拟旧 sticky。

## 5. 胶囊与开关

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

## 6. 移动端

不大于 `720px` 时仍复用唯一根级 Mobile Workspace Sheet：

- 建筑列表仍使用同一横向账本行，不恢复 4:5 大图卡；
- 工厂详情继续使用现有移动详情 Sheet；
- 页面内桌面详情外壳继续隐藏；
- 不创建嵌套 Sheet、不改变拖动关闭、焦点恢复、背景滚动锁或底部导航隐藏逻辑；
- 建设卡仍在页面正文中，账本位于其前方；
- 页面根级不得产生横向溢出。

## 7. 样式职责

- `design-system.css` 定义 `StatusTag`、全局开关基础外观和焦点环；
- `facility-group-card-grid.css` 保留生产详情内部结构和可被其他上下文复用的基础选择器几何；
- `production-surface.css` 是地区建筑页最终账本密度、建筑管理区自适应轨道、筛选器收缩、工厂选择行、建设／详情非 sticky 行为，以及建筑页紧凑开关的场景最终权威；
- `primary-surfaces.css` 继续独占一级卡片外层 padding；
- 移动详情外框、Portal、拖动和安全区继续由 `mobile-detail-sheet.css` 与唯一 Sheet Host 管理。

`production-surface.css` 必须在 `facility-group-card-grid.css` 之后加载。正确性依赖最终场景覆盖，但不得在业务组件内使用行内样式复制这些几何规则。

## 8. 防回退

`scripts/verify-production-desktop-layout.mjs` 必须验证：

- `production-surface.css` 在 `facility-group-card-grid.css` 之后加载；
- 建筑管理区使用基于真实承载宽度的 `auto-fit / minmax(min(26rem, 100%), 1fr)`；
- 建筑账本横跨全部轨道并位于建设和详情之前；
- 工厂选择器最终为单列横向行，`aspect-ratio: auto` 且 `max-width: none`；
- 工厂行显示名称、数量、利润和四种状态文字；
- 建设卡与详情外壳在桌面最终为 `position: static`，不创建独立纵向滚动；
- 胶囊与开关继续保持 `2.75rem × 1.6rem`；
- `tests/browser/buildings-ledger-layout.spec.ts` 使用真实浏览器验证紧凑桌面承载面和移动端均无横向裁切，账本位于建设卡之前，并验证选择行是明显的横向信息行。

不得为了恢复旧三列或大卡视觉删除上述验证。改变本设计时必须同步更新本文、最终 CSS 和真实浏览器回归。
