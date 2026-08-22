# Economy 毛玻璃应用外壳设计

> 状态：当前正式外壳、毛玻璃材质与响应式几何权威
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-08-22

文件名沿用既有权威文档路径，正文规则已经完全替换旧 Liquid Glass 实现。

## 1. 材质唯一实现

- 项目不得安装、导入或运行 `liquid-glass-react`，不得恢复 `LiquidGlassSurface`、`.glass__warp`、SVG 位移滤镜、色差、折射或鼠标跟随形变。
- `src/components/ui/FrostedGlassSurface.tsx` 是状态栏、管理员工作栏、移动底栏、认证卡片、玩家工作区和根级状态卡的唯一共享表面包装器，只输出宿主和内容两层稳定 DOM；全页异常使用 `stateCard` 变体，不得在状态页面复制另一套毛玻璃材质。
- `src/styles/frosted-glass-surfaces.css` 是共享毛玻璃材质权威，统一使用半透明深色背景、`blur(18px) saturate(128%)`、一像素柔和边界、静态顶部高光和阴影；`FrostedGlassSurface` 负责外壳级表面，应用内 Tooltip 则在自身唯一浮层节点使用 `.ui-tooltip-surface` 复用同一组材质令牌；不支持 `backdrop-filter` 时统一使用更高不透明度的同色回退。
- `SafeTooltip` 与 ECharts `commonTooltip` 是应用自己渲染 Tooltip 的批准入口，二者都必须给实际 Tooltip 节点附加 `.ui-tooltip-surface`。Tooltip 属于单节点轻量毛玻璃：不得再包 `FrostedGlassSurface`、不得增加内外装饰玻璃节点，也不得在 `safe-floating.css`、`charts.css` 或业务 CSS 中复制第二套背景、滤镜、边框或阴影。浏览器原生 `title` 不属于应用渲染的 Tooltip 材质范围。
- 通用 `.panel`、玩家页面外层、桌面侧栏和地图镜头栏复用同一组 `--frosted-glass-*` 令牌。业务样式可以定义内部布局，不得创建第二套液态玻璃、折射或用途专属滤镜。
- `package.json` 与 `package-lock.json` 均不得包含 `liquid-glass-react`；生产和测试源码不得导入该包。

## 2. 根级摄影与采样链

`ApplicationLayerRoot` 继续永久挂载唯一四层根结构：

```text
图片层 0 → 氛围层 10 → 地图层 20 → UI 层 30
```

根级 `#root` 使用唯一 `isolation:isolate`。地图层、UI 层、内容根、登录后外壳、工作区、页面滚动区和 Chrome Overlay 必须保持 `isolation:auto`、`filter:none`、`transform:none`，让各毛玻璃表面能够采样其后的摄影、氛围和地图。毛玻璃宿主自身不得创建新的隔离根。根级 `game-state-shell` 与 `PhotographicStateShell` 继续保留既有 `isolation:isolate` 状态边界，且 `filter`、`transform` 保持 `none`；该状态边界不得扩展到登录后 Chrome 采样链。

- 全应用四层根堆叠由 `ApplicationLayerRoot` 固定挂载在 `main.tsx`，并位于 `React.StrictMode` 与错误边界之外；四层对应 `z-index: 0 / 10 / 20 / 30`，不得建立第五个全局层。
- 页面和状态切换只修改 `data-app-backdrop` 与 `data-app-tone`；`data-app-backdrop` 只保留语义和状态路由职责，不得重新提供工作区地图背景插槽或 `SignedInShell.backdrop`。
- 账号检查、正式代码包、本地预览代码包和权威游戏连接四个入口统一使用 `ApplicationLoadingState.tsx`，四个入口只允许替换中文文字，不得出现纯色过渡页或恢复深色加载卡片。
- 登录、玩家与管理员必须使用完全相同的摄影滤镜，正常态摄影图片只承担低对比度空间纹理职责；角色和页面不得复制摄影节点或覆盖滤镜。
- `tests/browser/application-photography.spec.ts` 与 `tests/browser/application-atmosphere-consistency.spec.ts` 验证根节点跨状态保持、失败回退和桌面／移动氛围一致性。

## 3. 状态栏、认证、状态卡与移动底栏

- 玩家状态栏 DOM 固定为 `header.asset-bar → FrostedGlassSurface → .frosted-glass-surface__content → .asset-bar-layout`，内部依次为身份轨道、五列状态项和通知工具位；三条轨道与各状态项必须占满状态栏内部高度并在同一垂直中线上居中。桌面状态项不得再叠加上下内容内边距，三行状态内容的自然高度必须完整落在实际卡片内容高度内，不能因渲染区小于内容区而向下溢出。
- 状态栏实际数字格式遵循全局“紧凑数字”偏好；玩家关闭全局“紧凑数字”后，桌面和移动状态栏都显示带千分位的完整整数。
- 移动状态栏数值自适应只允许仅真实溢出的状态项缩小字号，最低为 `0.56rem`；不得恢复省略号、裁剪数值或让未溢出的项目一起缩小。
- 移动状态栏数值拟合必须在 `ResizeObserver`、媒体查询变化和 `orientationchange` 之外直接监听 `window.resize`。任何视口宽度变化都必须重新调度拟合，并在完成后恢复 `data-status-values-fitted="true"`；不得因为网格单元像素宽度未触发观察器而永久停留在未拟合状态。
- 数值拟合的 `ResizeObserver` 只允许观察稳定的五列 `.asset-bar-content` 容器，不得观察会被拟合逻辑主动修改字号的 `.asset-bar-item-value` 节点，否则会形成“改字号 → ResizeObserver → 再拟合”的反馈循环。业务数值变化由 React `items` 更新重新调度拟合，视口变化由上述 resize／媒体查询路径负责。
- 超窄移动端必须先释放状态值的横向空间，再触碰字号下限：不大于 `400px` 时状态内容水平内边距收紧为 `.2rem`、状态图标与数值间距收紧为 `.06rem`；不大于 `340px` 时身份轨道收紧为 `24px`、状态内容取消水平内边距、状态项间距归零且状态图标收紧为 `.625rem`，通知操作轨道仍保持 `44px` 触控目标。这样在 `320px` 视口仍需让完整整数在不低于 `0.56rem` 的前提下完整可见；不得用继续缩小字号、恢复省略号或裁剪末位数字代替横向打包。
- 管理员桌面工作栏复用 `statusBar` 变体；移动管理员不显示桌面工作栏。
- 认证卡片使用 `authCard + content`，依靠普通文档流自然增高，不使用测高状态、`ResizeObserver`、`MutationObserver` 或重建组件；登录／注册切换和桌面／移动断点不得丢失未受控表单值。
- 封禁、管理员无权限、React 致命渲染异常和权威游戏状态首次加载失败等全页状态卡必须复用 `FrostedGlassSurface stateCard`。`PhotographicStateShell` 统一为其子状态卡提供该宿主；仍保留旧 `GameErrorStateShell` 结构的游戏加载失败也必须在 `loading-screen` 内放置同一 `stateCard`，不得恢复不透明深色／暗红卡片。critical 只允许通过根级红色氛围暗角和柔和危险色边框表达，卡体本身继续使用共享深绿色毛玻璃。
- `PhotographicStateShell` 与 `GameErrorStateShell` 继续使用既有 `isolation:isolate` 状态边界，`filter` 与 `transform` 保持 `none`；不得为了异常卡毛玻璃去改写登录后工作区的开放采样链。浏览器回归必须同时验证 `stateCard` 的真实 `blur(18px)`、半透明背景和状态外壳隔离值。
- 所有“刷新页面”恢复操作统一使用 `src/components/system/RefreshPageButton.tsx`，内部使用 `GameIcons.tsx` 的 `RefreshIcon` 并直接执行 `window.location.reload()`；视觉固定为无文字的 `44px × 44px` 圆形浏览器式刷新控件，默认透明，细指针 hover 只出现中性圆形背景，active 轻微压缩，保留 `aria-label`、`title` 与键盘 `:focus-visible`。不得改回应用内 retry、伪刷新、延时刷新或文字主按钮。
- 桌面状态栏和认证卡片圆角为 `24px`；移动状态栏、认证卡片和底栏圆角为 `40px`；`stateCard` 桌面使用 `var(--radius-card)`，移动使用 `var(--radius-card-mobile)`。
- 移动状态栏固定 `48px`，移动底栏固定 `68px`。底栏内容层提供唯一 `8px 0` 垂直留白，语义化 `nav` 是唯一横向滚动视口。
- 移动底栏必须始终保留同一 DOM 实例。唯一根级 Mobile Workspace Sheet 存在期间，底栏通过 `aria-hidden`、`inert`、不可见和禁用命中退出交互树；不得只依赖 Sheet 遮挡。只有根 Sheet 完整收起并进入 `map` 后才恢复，并使用约 `280ms cubic-bezier(.2,.8,.2,1)` 的通知灵动岛同系弹性进入动画。详情层切换、通知面板开关、状态刷新和初始挂载不得触发该返回动画；`prefers-reduced-motion: reduce` 时立即恢复且不播放动画。
- 状态栏、移动底栏、认证卡片、根级状态卡和管理员工作栏每处只允许一个 `.frosted-glass-surface`；通知、Toast、Popover 和业务 Dialog 不得为了装饰再套 `FrostedGlassSurface` 或增加额外玻璃包装层。Tooltip 只允许按第 1 节在自身唯一浮层节点使用 `.ui-tooltip-surface`，该单节点轻量毛玻璃例外不得扩展成嵌套玻璃容器。

## 4. 侧栏几何与输入方式

- 玩家端桌面侧栏与当前页面必须共同位于唯一 `FrostedGlassSurface workspaceCard` DOM 中；通常由该主卡片承担唯一外层毛玻璃、边框、圆角和阴影，侧栏与 `.page-content` 不得继续各自渲染第二层外壳材质。研发页桌面保留 `workspaceCard` DOM 作为布局宿主，但移除其最外围卡片视觉，使侧栏右侧的科技画布直接显示在工作区；该例外不得创建第二套外壳或改变管理员结构。
- 桌面侧栏默认 `78px`，悬浮或当前前台交互已经建立后的焦点进入可展开为 `224px`，移出或焦点离开后收起；不得恢复显式展开／折叠按钮。主卡片只固定预留 `78px` 指挥轨道，展开侧栏绝对覆盖页面而不推动页面、地图或右侧信息栏。侧栏右边缘必须始终提供 `1px` 竖向分隔线和向页面方向投射的阴影；分隔线与阴影随侧栏右边缘移动。
- 鼠标展开必须代表本轮真实指针意图：当新文档或新侧栏 DOM 挂载到一个完全静止、此前已停留在侧栏位置的鼠标下方时，不得仅凭挂载产生的 `mouseenter` 自动展开；首次真实 `pointermove`／`mousemove` 后的悬浮立即恢复正常展开。焦点展开使用独立的前台交互门槛：当前页面内新的 `pointerdown`、`pointermove` 或 `Tab` 键盘导航都可以建立前台意图；在门槛尚未建立时，挂载、页面切换或浏览器恢复带来的旧焦点不得展开。该规则用于区分真实前台输入与 DOM／浏览器生命周期恢复事件，同时保留前台会话中既有焦点行为。
- 正式页面 ID 发生变化时，桌面玩家侧栏的展开状态必须立即恢复为 `78px` 收起态，并重新建立本轮指针与前台交互意图门槛；页面切换不得继承上一页的 `224px` 展开状态，静止在侧栏上的旧指针位置或旧焦点也不得让新页面自动重新展开。切页后的首次真实 `pointermove`／`mousemove`、`pointerdown` 或 `Tab` 键盘导航才重新允许相应的悬浮／焦点展开。
- 浏览器标签页或窗口失焦、进入后台时，共享桌面侧栏必须立即恢复为收起态，并清空本轮鼠标与前台交互意图；重新激活页面时，浏览器恢复的旧焦点和静止指针都不得触发展开。只有重新激活后的真实 `pointermove`／`mousemove`、`pointerdown` 或 `Tab` 键盘导航才重新建立前台意图；在此之前发生的焦点恢复必须被忽略。该输入语义由玩家与管理员复用的 `SidebarFrame` 统一承担，但不改变管理员布局职责。
- `721px–960px` 使用与宽屏完全相同的 `78px／224px`、四边统一 `14px` 内边距、`48px` 图标轨道和 `48px` 导航行；导航区不叠加顶部外边距，不得切换为 `86px`、`18px` 内边距、隐藏文字的另一套紧凑几何。
- 细指针桌面设备的导航与底部操作在鼠标悬浮时显示边界、背景、左侧绿色提示和轻微亮度变化，但按钮位置、图标中心和高度不得移动或缩放。桌面侧栏按钮不得渲染数字角标，提醒数量只保留在可访问名称和移动底栏。
- 移动底栏禁止 hover 可见反馈。未选中、按下和已选中三种状态必须稳定区分；触摸产生的粘滞 `:hover` 不得改变未选中或已选中视觉。键盘 `:focus-visible` 继续保留明确焦点环。

## 5. 玩家页面与右侧信息栏

- 桌面右侧信息栏由 `StrategicWorkspaceChrome` 唯一持有，教程与公开经济事件是两个独立模块：在允许右栏的 `building` 与 `map` 页面中，教程只由 `tutorial.isVisible && tutorial.currentStep` 控制，不能再以 `model.tab === 'home'` 或概览页面是否显示为条件，公开事件日志继续由页面类型控制；教程和公开事件任一需要显示时右栏存在，两者都不需要时右栏不挂载。所有 `fullscreen` 页面进入后整个右侧信息栏不挂载，模块级独立条件不再参与该页面的可见性。
- 教程是桌面应用外壳级常驻模块。只要当前教程存在进行中的本地轮次，在允许右栏的概览、州级上下文、市场、建筑、设置和纯地图视图之间切换不得卸载教程卡；`fullscreen` 是统一的显示例外，只隐藏外壳中的教程 DOM，不调用 `skip`、不清除本轮状态、不改变当前步骤或完成状态，离开全宽页后继续显示同一轮次。“跳过”会结束并清除当前教程轮次，写入按玩家和教程版本隔离的本地跳过标记，不视为完成、不调用服务器完成接口，也不改变任何经济状态。当前版本被跳过后，刷新、重新登录和页面切换都不得自动重建教程；设置页不提供“显示教程”或继续入口，只允许“重新开始教程”，该操作清除跳过标记、从第一步新建轮次并回到概览。旧客户端遗留的 `hidden` 轮次读取时直接迁移为已跳过。移动端同样复用 `StrategicWorkspaceChrome` 持有的同一教程 DOM，不得回流 `OverviewPage` 或创建第二份移动教程实例；移动 `fullscreen` 页面同样不挂载该教程 DOM。
- 教程卡根节点必须复用通用 `.panel` 的共享毛玻璃材质，使用 `--frosted-glass-background`、`--frosted-glass-border`、`--frosted-glass-shadow` 和 `--frosted-glass-filter`；`game-guide.css` 只负责教程内部布局、进度条和操作区，不得自行定义第二套卡片背景、边框、阴影、滤镜或独立卡片圆角。教程总体进度属于教程级信息，必须紧接“教程／步骤 N/9”标题区并位于当前单个任务标题之前，无障碍名称固定为“教程总体进度”，不得重新放到单个任务标题下方造成任务进度歧义。
- `research`、`auction`、`contracts`、`bank`、`leaderboard`、`gem-shop` 使用 `fullscreen`；所有 `fullscreen` 页面进入后整个右侧信息栏不挂载，教程与公开经济事件都不渲染，主卡片始终占用侧栏右侧全部可用工作区，不得再因后台存在进行中的教程而为右栏预留宽度。该隐藏只属于展示层，不修改教程轮次或经济事件状态。桌面 Toast、通知按钮、完整通知面板和状态栏不属于右栏，必须继续正常工作。排行榜与商店等全宽页保持同一完整页面宽度。
- `home`、隐藏 `province` 上下文页、`market`、`buildings`、`settings` 使用 `building`，统一使用 `--strategic-compact-page-width: 56rem` 作为内容目标值，但包含 `78px` 侧栏轨道的完整 `workspaceCard` 总宽度不得超过 `calc(100vw / 3)`，也不得超过右栏之外的可用空间；不得为其中任一页恢复独立宽度。地图在其余区域继续可见，打开或切换页面不得额外压暗地图。
- 桌面状态栏、玩家主卡片和右侧信息栏统一使用 `8px` 屏幕边距；共享外壳已经在状态栏下方提供唯一 `8px` 间距，主卡片和右栏必须从工作区顶部 `0` 开始，禁止重复增加顶部沟槽。主卡片底部只保留 `8px` 屏幕边距，不得再为地图镜头栏挤压页面高度。标题与正文内距、一级区块间距统一使用 `var(--layout-gutter)`；除研发桌面透明画布例外外，玩家主卡片、公开事件面板、教程卡和一级业务卡片统一使用 `var(--radius-card)`，不得保留独立 `12px`／`16px` 页面圆角。桌面 `.page-content` 只负责页面布局并保持透明，不得在主卡片内重复外层边框、圆角、阴影或 `backdrop-filter`。
- 玩家 `PageLayout` 把标题与页面操作固定在 `.page-fixed-header`，正文使用页面卡片内部唯一 `ScrollArea`；工作区外层滚动条隐藏，滚动轨道不得越过卡片边界。
- `--desktop-page-top-offset` 只表示下方工作区内部沟槽；页面滚动区已经完成状态栏避让，建筑页 sticky 后代不得重复叠加完整状态栏高度。
- 公开经济事件不得进入 `OverviewPage`、`.page-content` 或页面滚动区。桌面端由 `StrategicWorkspaceChrome` 在工作区右侧同一 `.strategic-economic-event-rail` 内按页面规则挂载；`home`、`province`、`market`、`buildings`、`settings` 和纯地图视图允许事件日志显示，`fullscreen` 的研发、拍卖、合同、银行、排行、商店则直接不挂载整个右栏，而不是只隐藏事件子模块。事件面板标题不带说明段落或右侧胶囊，事件折叠态只显示名称与距离开始时间，具体状态、时间范围、说明、类别、商品和成交反馈在展开后显示。
- 当允许右栏的页面中教程与公开事件同时显示时，教程位于右栏顶部，事件日志占用剩余高度并在自身列表内滚动；当右栏只有教程时，教程按自然高度停靠右上，不得用空的事件网格行把教程拉伸到整栏高度。现有 `.strategic-economic-event-rail` 技术类名可以继续沿用，但语义职责已经扩展为通用右侧信息栏。
- 桌面关闭态 Toast 必须作为 `.workspace-strategic-chrome` 的直接子项，与 `.strategic-economic-event-rail` 使用相同局部 `z-index: 2`，从工作区右下角按 `var(--strategic-panel-gap)`（当前桌面为 `8px`）定位并向上堆叠；最新通知最靠近右下角。Toast 使用独立最大宽度 `360px`，不得绑定右栏的 `clamp(260px, 21vw, 320px)` 宽度，也不得为了避让右栏推动、缩窄页面或改变右栏几何。Toast DOM 排在右栏之后，发生局部重叠时临时覆盖右栏；研发、拍卖、合同、银行、排行榜和商店即使整个右栏不挂载也仍必须保留桌面 Toast。完整通知中心不属于此层，仍按第 6 节使用工作区安全浮层右上角几何。
- 玩家主卡片宽度在页面目标宽度或允许右栏页面中的教程显示状态变化时使用与侧栏一致的 `220ms cubic-bezier(.2,.8,.2,1)` 过渡；新页面内容以 keyed `clip-path: inset(0 100% 0 0) → inset(0)` 从左向右裁剪展开并轻微淡入，页面布局轨道从首帧起保持最终 `1fr` 几何，动画不得修改 `grid-template-columns`、页面内容宽度或滚动根宽度。动画只由正式页面 ID 变化触发，教程开始／跳过只能在允许右栏的页面触发主卡片宽度过渡，不得重播页面展开；权威状态刷新、倒计时和表单变化不得重播；不得对地图、ECharts 宿主、工作区或毛玻璃采样链设置动画 `transform`。`prefers-reduced-motion: reduce` 时立即完成。

## 6. 移动与浮层

- 不大于 `720px` 时桌面侧栏和公开事件右栏隐藏，`workspaceCard` 退化为无额外材质的结构容器；移动端不新增第二套常驻右栏。在允许右栏的 `building` 与纯地图页面中，可见教程继续由 `StrategicWorkspaceChrome` 的 `.strategic-economic-event-rail` 持有，并在移动断点改为状态栏正下方的固定教程锚点；顶部统一使用 `--mobile-below-status-top = --mobile-status-top-inset + --mobile-asset-bar-height + --mobile-notice-gap`，左右使用 `--mobile-workspace-gutter` 与安全区较大值，卡片继续受 `30rem` 最大宽度限制，公开经济事件在该断点始终隐藏。教程留在 `.workspace-strategic-chrome`，不得移动到 Chrome Overlay、根 Dialog 或 `OverviewPage`：普通地图／页面层位于其下，根级 Mobile Workspace Sheet 与移动通知面板位于其上，通知灵动岛和状态栏继续由 Chrome Overlay 覆盖。普通业务页面或通知出现时只通过现有层级自然覆盖教程；`fullscreen` 页面是唯一页面级卸载例外，进入研发、拍卖、合同、银行、排行或商店时教程锚点不挂载，但本地教程轮次必须完整保留，离开后恢复。纯地图页继续只显示常驻战略地图与可见教程；除纯地图外的玩家页面与工厂／研发／自动交易等业务详情统一进入唯一根级 Mobile Workspace Sheet。该 Host 在 `.workspace-dialog-layer` 中只挂载一份工厂详情卡片容器 `.mobile-detail-sheet-backdrop > .mobile-detail-sheet`。实体 Sheet 底边贴物理视口底部，最大高度同时受 `88%` 视觉视口、`760px` 和状态栏下方可用高度约束，顶边必须始终低于移动状态栏。最大高度只允许在根 Sheet 首次可见绘制前的 `useLayoutEffect` 中按当时 `visualViewport` 快照一次；根 Sheet 存续期间不得监听 `window.resize`、`visualViewport.resize` 或 `visualViewport.scroll` 动态重测高度，关闭后重新打开才允许取得新快照。根 backdrop 可以覆盖完整视口承担点击关闭命中，但必须保持透明并禁用 `backdrop-filter`；唯一实体 `.mobile-detail-sheet` 自身才复用共享 `--frosted-glass-*` 材质和 `blur(18px) saturate(128%)`。Sheet 外部区域不得压暗或模糊，地图、状态栏和通知区域保持原亮度与清晰度。
- 唯一根级 Mobile Workspace Sheet 只在首次由纯地图进入业务页面时执行根容器底部打开动效；业务页面之间切换只替换基础内容并保持同一 `.mobile-detail-sheet` DOM。工厂、研发或自动交易详情打开时在根内增加详情内容层并把基础页设为 `inert`，详情层使用同一拖动内核从底部进入；关闭详情只收起详情层并恢复原页面。没有详情层时，右上关闭、遮罩点击、`Escape` 或正文已经位于顶部时的有效向下拖动才收起整个根并切换到 `map`；正文 `scrollTop > 0` 时向下手势继续属于正文滚动。根 Sheet 继续承担页面滚动锁，但作为可与顶部 Chrome 并存的非模态 `role="dialog"` 不得建立全局 `Tab` 焦点陷阱；状态栏通知按钮和其覆盖层必须能够取得焦点。物理根 Sheet 独占 Pointer／Touch 手势监听；详情打开时只把同一个 `useMobileWorkspaceSheetDrag` 的视觉拖拽目标切换到详情层，不得把监听下沉到详情子层或同时注册两套监听，保证真机触摸、Pointer Capture 与下拉刷新保护始终经过同一物理事件边界。一次拖动从开始到回弹或关闭完成必须锁定同一个 Sheet 高度；松手前必须同步提交最后一次真实拖动 offset、取消尚未执行的拖动 RAF，再从该位置下一帧进入 settle，禁止用回弹／关闭目标覆盖最后一个触摸位置而造成松手跳动。Touch 释放必须以最后一次已接收的 `touchMove` session 位置为权威；`touchEnd.changedTouches` 只表示结束事件，不得覆盖 session 位置或参与触摸释放位移判定，避免合成器异常坐标造成瞬移或误关闭。首次进入动画只能在每个物理 Sheet／详情实例初次挂载时播放一次；一旦进入拖动／settle，必须永久标记该实例的进入动画已完成，回弹结束移除状态类不得重播从视口底部进入的 keyframes。settle 完成优先以 `transform` 的 `transitionend` 收口，并保留定时器兜底；`prefers-reduced-motion` 继续立即完成。
- `SignedInShell` 为玩家与管理员统一提供唯一页面 `ScrollArea`；不得为管理员创建第二个原生主滚动容器，嵌套业务视口到达边界后必须把滚动链交还该共享页面视口。
- 移动页面卡片自己的竖向滚动条必须继续绝对定位在 `.page-card-scroll-area` 根上，并跨出 `--mobile-workspace-gutter + 1px` 卡片边框，使视觉滑块到达物理安全右边缘，同时不改变内容视口宽度。只有根级 `.page-scroll-area` 的竖向轨道允许使用 viewport-fixed 定位；不得把页面卡片滚动条设为 `fixed` 放在带 `backdrop-filter` 的毛玻璃祖先下，因为 Chromium 会为固定后代建立局部包含块并把轨道错误地向内偏移。
- 滚动条浏览器回归必须以 `getComputedStyle(workspace).paddingRight` 等已解析为像素的实际几何作为沟槽基准，再加页面卡片 `1px` 边框核对滚动根 inset；不得对可能为 `rem` 的 `--mobile-workspace-gutter` 原始字符串直接 `parseFloat` 后当作像素使用。最终滑块仍需验证距离物理右边缘约 `2px`。
- 地图镜头栏与唯一地图舞台通过同一个 `ApplicationMapLayerPortal` 挂载为根级 `.application-map-layer` 的直接子节点；镜头栏位于地图舞台之上，但整个地图层 `20` 必须低于承载页面的 UI 层 `30`，不得再把镜头栏挂入 `StrategicWorkspaceChrome`。镜头栏底部外距继续读取 `var(--layout-gutter)`。页面不为镜头栏预留高度；镜头栏位于页面层下方，在页面覆盖范围内由页面自然遮挡，不能挤压正文。桌面通知面板继续位于工作区安全浮层并保持原有右上角几何；移动通知面板复用现有 `.workspace-dialog-layer`，作为 Chrome 级临时覆盖层位于 Sheet 之上、移动状态栏之下，面板外点击捕获层必须透明且不得压暗地图，点击面板外遮罩空白必须关闭。移动通知灵动岛位于 Chrome Overlay；通知面板和灵动岛都不得推动页面或新增第五个全局层。
- 战略地图滚轮与双指逻辑缩放继续允许 `0.5–4`。基础 `layoutCenter + layoutSize` 只负责首次 Contain、地图容器真实 resize 和空白双击／双触重置；用户拖动与交互缩放必须共享同一个 ECharts Map 正式相机。滚轮／双指只更新目标缩放与焦点，单一 `requestAnimationFrame` 在对数空间收敛，并在每个动画帧通过增量 `geoRoam` 推进正式地图相机；不得对 ECharts 根 SVG 或中文州名根 SVG 设置 CSS scale／translate，也不得在 settle 时再用 `layoutSize + layoutCenter` 二次提交缩放。根级 `.application-map-layer` 继续保持物理视口裁剪，原本位于屏幕外的州面必须随正式相机缩小时重新进入视口；地图拖动继续由 `roam: 'move'` 处理，空白双击／双触继续恢复 Contain 镜头。
- 根级业务 Dialog 在移动玩家端由唯一 `MobileWorkspaceSheetHost` 统一占用，承载一级业务页面以及同根内的详情内容层。`MobileWorkspacePageSheet` 不再拥有可见根容器，只是 Host 的零 DOM 适配器；`MobileWorkspaceDetailSheet` 不再创建 Dialog，只向 Host 注册详情内容和固定底栏。普通 Tooltip、Popover 继续限制在工作区安全浮层内；Tooltip 自身仅可在唯一浮层节点使用 `.ui-tooltip-surface` 复用共享毛玻璃，不得再创建玻璃包装器。来自唯一根 Sheet 内的富下拉可以使用根 Dialog 作为安全边界。移动通知面板是明确例外：它复用同一个根 Dialog Layer 的更高内部层级覆盖 Sheet，但不创建第二个 Portal 根。状态栏始终位于 Sheet 与通知面板之上。不得创建第二份 `.mobile-detail-sheet`、第二个 backdrop 或第二个根级 Portal。
- 移动通知灵动岛以物理屏幕水平中线为中心，并从中心对称展开；左右安全区不能让其偏向页面内容列。Sheet 存在期间灵动岛仍可在状态栏下方显示并位于 Sheet 之上；打开通知面板后必须立即卸载通知岛、Toast 及其 ARIA live region。
- 面板打开时立即清空 Toast 队列。`useNotificationCenter` 同时必须在面板打开期间拒绝新增 Toast；新操作通知和待处理变化只更新面板内容并按现有已读语义处理，关闭面板后不得把面板期间已经展示的通知延迟补弹。移动内部层级固定为地图／普通页面 < 移动教程 < 根 Sheet < 移动通知面板／通知灵动岛 < 状态栏；底部导航在 Sheet 存在期间退出视觉与交互树，不参与该覆盖竞争。页面内部任意正 `z-index` 都不得盖过通知面板或 Chrome。
- 页面内部若使用带非 `auto` `z-index` 的 `position: sticky`／定位元素，必须被 `.mobile-page-overlay` 的页面层堆叠边界收口，不得遮挡移动状态栏、通知或底栏。
- 登录态根视口的下拉刷新边界由 `html[data-app-surface="game"|"admin"]` 的 `overscroll-behavior-y: none` 终止；移动工厂详情通过 `mobileDetailSheetPullRefresh.ts` 的非被动 `touchmove` 仅阻止触发浏览器刷新所需的手势，内部滚动区继续保持 `overscroll-behavior-y: auto`，不得全局阻断页面触摸滚动。

## 7. 验证

必须通过以下防回退：

- `scripts/verify-liquid-glass-chrome.mjs`：历史脚本路径保留，但验证对象已改为 CSS 毛玻璃、依赖删除、共享组件、单节点 Tooltip 材质、页面分流、普通页面教程右栏、`fullscreen` 整栏隐藏与研发透明画布职责。
- `scripts/verify-client-update-recovery.mjs`：锁定 `RefreshPageButton` 的浏览器式 SVG 刷新控件、真实 `window.location.reload()` 恢复语义，并禁止异常入口恢复文字刷新按钮或应用内 retry。
- `scripts/verify-mobile-page-sheet.mjs`：锁定唯一根级 Mobile Workspace Sheet、工厂详情卡片容器单实例、Sheet 自身毛玻璃、透明外部 backdrop、状态栏避让、页面／详情内容复用、共享拖动内核、首次高度快照、松手 offset 连续性、触摸释放最后 `touchMove` 坐标权威、进入动画单次播放、底栏隐藏与返回动画、通知覆盖和地图关闭语义，禁止恢复第二个 Sheet DOM、动态视觉视口测高、进入动画回弹后重播或松手跳帧。
- `scripts/verify-sidebar-navigation-collapse.mjs`：锁定正式页面切换强制恢复 `78px` 收起态、按页面重置真实指针意图门槛、浏览器失焦／后台立即收起、浏览器恢复焦点与新的前台输入意图分流以及专项浏览器回归，禁止恢复跨页面继承展开状态或让浏览器恢复旧焦点自动展开。
- `tests/browser/frosted-glass-layout.spec.ts`：状态栏、通用面板、认证和移动底栏的真实背景滤镜、边界、圆角、单实例与无旧 DOM。
- `tests/browser/auction-bid-history.spec.ts`：共享 `SafeTooltip` 必须在实际悬浮／焦点路径使用 `.ui-tooltip-surface`，真实计算样式包含共享 `blur(18px)`、半透明背景、高光、边界和阴影。
- `tests/browser/shell-floating-safe-zone.spec.ts`：ECharts Tooltip 必须使用同一 `.ui-tooltip-surface` 毛玻璃材质并继续限制在工作区安全边界，不能覆盖状态栏、侧栏或可见移动底栏。
- `tests/browser/application-error-state.spec.ts`：桌面／移动错误状态必须使用唯一 `stateCard`，真实计算样式包含共享 `blur(18px)`、半透明背景和危险色边界；刷新控件必须为圆形图标按钮并触发页面重新加载。
- `tests/browser/open-glass-sampling.spec.ts`：四种玩家／管理员、桌面／移动场景的根级采样链。
- `tests/browser/game-shell-layout.spec.ts`：侧栏宽窄屏一致、真实指针意图后的悬浮反馈不位移、页面展开期间布局盒几何不受视觉裁剪动画影响、建筑式面板与右栏几何。
- `tests/browser/sidebar-navigation-collapse.spec.ts`：桌面侧栏展开后切换正式页面必须立即回到 `78px` 收起态；浏览器失焦／进入后台后必须收起，返回时在没有新前台输入前恢复旧焦点与静止旧指针都不得重新展开；返回后的首次真实鼠标移动恢复 hover 展开，新的 `Tab` 键盘导航焦点进入仍可立即展开。
- `tests/browser/tutorial-right-rail.spec.ts`：桌面普通页面教程跨页常驻、总进度位于单项任务之前、跳过确认、六个 `fullscreen` 页面右栏／教程／事件 DOM 全部消失且离开后恢复同一步骤；移动端复用同一外壳教程 DOM 固定在状态栏下方并使用统一左右安全沟槽，普通页面根 Sheet 与通知可以覆盖教程而状态栏保持最高。
- `tests/browser/mobile-status-value-fit.spec.ts`：移动状态栏在连续视口 resize 后必须重新完成数值拟合；`400px` 与 `340px` 两级超窄布局必须先收紧留白和图标，在 `320px` 仍保留 `44px` 通知触控轨道并让完整整数不低于 `0.56rem`；不得卡在 `data-status-values-fitted="false"` 或裁剪末位数字。
- `tests/browser/mobile-workspace-overlay.spec.ts`：唯一根级 Mobile Workspace Sheet 必须复用工厂详情全宽容器、底边贴物理视口、顶边避让状态栏且只在自身毛玻璃；Sheet 外保持清晰，状态栏可交互，底栏在 Sheet 存在时隐藏并在根 Sheet 收起后播放返回动画；页面卡片滚动条继续位于根 Sheet 安全右边缘且不改变正文宽度。
- `tests/browser/mobile-sheet-release-stability.spec.ts`：模拟最后一次 `touchMove` 与 `touchEnd` 同帧发生，分别验证约半高下拉关闭和短距离回弹都从最后一次已接收的真实 `touchMove` 位置连续进入 settle、过程单调且 Sheet 高度冻结；回弹完成后不得重新触发首次进入 keyframes，禁止 `touchEnd.changedTouches` 覆盖 session 位置或松手瞬间跳回旧 RAF 位置。
- `tests/browser/notification-center.spec.ts`：桌面完整通知面板保持工作区安全浮层右上角；桌面关闭态 Toast 与右栏同属战略 Chrome 的 `z-index: 2`、固定工作区右下角且宽度独立，在 `fullscreen` 页面没有右栏时仍可出现；移动通知面板必须覆盖已打开的根 Sheet、保持状态栏最高且面板打开期间通知岛为零，`Escape` 只关闭通知面板并恢复通知入口焦点。
- `tests/browser/mobile-navigation-scrollbar.spec.ts`：移动底栏保持同一 DOM、Sheet 存在时不可见且不可交互、根 Sheet 收起到地图后使用通知灵动岛同系返回动画，并继续验证无 hover、按下／选中／未选中状态和横向滚动。
- `tests/browser/all-pages-preview.spec.ts`：概览、市场、建筑、设置四个同宽紧凑页面，排行榜与商店等六个全区域页面和独立右栏。
- `tests/browser/map-zoom-out-boundary.spec.ts`：必须先把地图放大到外围州真实离开屏幕，再缩小到 `0.5`，验证加利福尼亚、佛罗里达、缅因和华盛顿重新进入物理视口且州名中心命中可见州面；`tests/browser/map-zoom-transient.spec.ts` 同时逐帧验证根 SVG 无 CSS 缩放、几何尺寸单调变化并且 settle 前后没有尺寸跳变。
