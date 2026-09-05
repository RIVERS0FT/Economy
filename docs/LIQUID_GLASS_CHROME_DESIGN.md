# Economy 毛玻璃应用外壳设计

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
- 静态摄影节点 `.application-image-layer img` 必须保持 `will-change:auto`，不得永久设置 `will-change:filter` 或为同一静态图片改用其他强制合成提升提示。`non-obvious reason`：图片滤镜没有逐帧动画，永久滤镜提升会使软件合成器在无关地图更新时继续处理全屏滤镜渲染批次。保留原摄影资源、桌面／移动 CSS 滤镜、裁切、缩放和唯一持久 `<picture>`，不以关闭滤镜、冻结玻璃采样或修改氛围强度代替移除多余提示；桌面／移动及认证／玩家／管理员的实际计算样式由 `application-atmosphere-consistency.spec.ts` 同时锁定。
- `tests/browser/application-photography.spec.ts` 与 `tests/browser/application-atmosphere-consistency.spec.ts` 验证根节点跨状态保持、失败回退和桌面／移动氛围一致性。

## 3. 状态栏、认证、状态卡与移动底栏

- 玩家状态栏 DOM 固定为 `header.asset-bar → FrostedGlassSurface → .frosted-glass-surface__content → .asset-bar-layout`，内部依次为可点击的玩家身份轨道、五列状态项和通知工具位；身份轨道使用共享 `PlayerAvatar` 加载服务器实际 64×64 WebP，点击或键盘激活只导航到设置页；三条轨道与各状态项必须占满状态栏内部高度并在同一垂直中线上居中。桌面状态项不得再叠加上下内容内边距，三行状态内容的自然高度必须完整落在实际卡片内容高度内，不能因渲染区小于内容区而向下溢出。
- 状态栏中的数量、普通货币与排名等只读业务数值遵循全局固定紧凑规则，桌面和移动端统一使用 K/M/B/T；悬停或键盘聚焦时通过共享 Tooltip 显示完整数字，状态栏不得恢复只在移动端紧凑或让桌面货币长期占用完整数字宽度。
- 移动状态栏数值自适应只允许仅真实溢出的状态项缩小字号，最低为 `0.56rem`；不得恢复省略号、裁剪数值或让未溢出的项目一起缩小。
- 移动状态栏数值拟合必须在 `ResizeObserver`、媒体查询变化和 `orientationchange` 之外直接监听 `window.resize`。任何视口宽度变化都必须重新调度拟合，并在完成后恢复 `data-status-values-fitted="true"`；不得因为网格单元像素宽度未触发观察器而永久停留在未拟合状态。
- 数值拟合的 `ResizeObserver` 只允许观察稳定的五列 `.asset-bar-content` 容器，不得观察会被拟合逻辑主动修改字号的 `.asset-bar-item-value` 节点，否则会形成“改字号 → ResizeObserver → 再拟合”的反馈循环。业务数值变化由 React `items` 更新重新调度拟合，视口变化由上述 resize／媒体查询路径负责。
- 超窄移动端必须先释放状态值的横向空间，再触碰字号下限：不大于 `400px` 时状态内容水平内边距收紧为 `.2rem`、状态图标与数值间距收紧为 `.06rem`；不大于 `340px` 时身份轨道收紧为 `24px`、状态内容取消水平内边距、状态项间距归零且状态图标收紧为 `.625rem`，通知操作轨道仍保持 `44px` 触控目标。这样在 `320px` 视口仍需让完整数值文本在不低于 `0.56rem` 的前提下完整可见；不得用继续缩小字号、恢复省略号或裁剪末位数字代替横向打包。
- 管理员桌面工作栏复用 `statusBar` 变体；移动管理员不显示桌面工作栏。
- 认证卡片使用 `authCard + content`，依靠普通文档流自然增高，不使用测高状态、`ResizeObserver`、`MutationObserver` 或重建组件；登录／注册切换和桌面／移动断点不得丢失未受控表单值。
- 封禁、管理员无权限、React 致命渲染异常和权威游戏状态首次加载失败等全页状态卡必须复用 `FrostedGlassSurface stateCard`。`PhotographicStateShell` 统一为其子状态卡提供该宿主；仍保留旧 `GameErrorStateShell` 结构的游戏加载失败也必须在 `loading-screen` 内放置同一 `stateCard`，不得恢复不透明深色／暗红卡片。critical 只允许通过根级红色氛围暗角和柔和危险色边框表达，卡体本身继续使用共享深绿色毛玻璃。
- `PhotographicStateShell` 与 `GameErrorStateShell` 继续使用既有 `isolation:isolate` 状态边界，`filter` 与 `transform` 保持 `none`；不得为了异常卡毛玻璃去改写登录后工作区的开放采样链。浏览器回归必须同时验证 `stateCard` 的真实 `blur(18px)`、半透明背景和状态外壳隔离值。
- 所有“刷新页面”恢复操作统一使用 `src/components/system/RefreshPageButton.tsx`，内部使用 `GameIcons.tsx` 的 `RefreshIcon` 并直接执行 `window.location.reload()`；视觉固定为无文字的 `44px × 44px` 圆形浏览器式刷新控件，默认透明，细指针 hover 只出现中性圆形背景，active 轻微压缩，保留 `aria-label`、`title` 与键盘 `:focus-visible`。不得改回应用内 retry、伪刷新、延时刷新或文字主按钮。
- 桌面状态栏和认证卡片圆角为 `24px`；移动状态栏、认证卡片和底栏圆角为 `40px`；`stateCard` 桌面使用 `var(--radius-card)`，移动使用 `var(--radius-card-mobile)`。
- 移动状态栏固定 `48px`，移动底栏固定 `68px`。底栏内容层提供唯一 `8px 0` 垂直留白，语义化 `nav` 是唯一横向滚动视口。
- 玩家移动底栏的游戏导航项固定使用 `56px × 50px` 胶囊几何，图标在上、中文标签在下并保持同一水平中心；玩家图标槽固定为 `1.45rem`、实际 SVG 为 `1.35rem`，按钮使用全圆胶囊圆角。该规则只作用于 `game-mobile-navigation`，管理员移动导航继续使用共享基础几何；未选中、按下、选中、焦点的既有颜色、透明度和反馈语义全部保持不变，底栏外层 `68px` 高度、`40px` 圆角、共享毛玻璃背景／边界／模糊／阴影也不得因该几何调整改变。导航项在可用宽度内仍整组居中，溢出时继续使用唯一原生横向滚动视口。
- 移动底栏必须始终保留同一 DOM 实例。唯一根级 Mobile Workspace Sheet 存在期间，底栏通过 `aria-hidden`、`inert`、不可见和禁用命中退出交互树；不得只依赖 Sheet 遮挡。只有根 Sheet 完整收起并进入 `map` 后才恢复，并使用约 `280ms cubic-bezier(.2,.8,.2,1)` 的通知灵动岛同系弹性进入动画。详情层切换、通知面板开关、状态刷新和初始挂载不得触发该返回动画；`prefers-reduced-motion: reduce` 时立即恢复且不播放动画。
- 状态栏、移动底栏、认证卡片、根级状态卡和管理员工作栏每处只允许一个 `.frosted-glass-surface`；通知、Toast、Popover 和业务 Dialog 不得为了装饰再套 `FrostedGlassSurface` 或增加额外玻璃包装层。Tooltip 只允许按第 1 节在自身唯一浮层节点使用 `.ui-tooltip-surface`，该单节点轻量毛玻璃例外不得扩展成嵌套玻璃容器。

## 4. 侧栏几何与输入方式

- 玩家端桌面侧栏与当前页面必须共同位于唯一 `FrostedGlassSurface workspaceCard` DOM 中；由该主卡片统一承担外层毛玻璃、边框、圆角和阴影，侧栏与 `.page-content` 不得继续各自渲染第二层外壳材质。研发页桌面与其他玩家页面统一使用 `workspaceCard` 外层容器，不得关闭该容器的边框、圆角、背景、阴影、高光或 `backdrop-filter`；研发科技树 viewport 仍可在该统一容器内部保持透明、无边框、无圆角画布。
- 桌面侧栏默认 `78px`，悬浮或当前前台交互已经建立后的焦点进入可展开为 `224px`，移出或焦点离开后收起；不得恢复显式展开／折叠按钮。主卡片只固定预留 `78px` 指挥轨道，展开侧栏绝对覆盖页面而不推动页面、地图或战略追踪器。侧栏右边缘必须始终提供 `1px` 竖向分隔线和向页面方向投射的阴影；分隔线与阴影随侧栏右边缘移动。
- 鼠标展开必须代表本轮真实指针意图：当新文档或新侧栏 DOM 挂载到一个完全静止、此前已停留在侧栏位置的鼠标下方时，不得仅凭挂载产生的 `mouseenter` 自动展开；首次真实 `pointermove`／`mousemove` 后的悬浮立即恢复正常展开。焦点展开使用独立的前台交互门槛：当前文档内新的 `pointerdown`、`pointermove` 或 `Tab` 键盘导航都可以建立前台意图；在门槛尚未建立时，首次挂载或浏览器恢复带来的旧焦点不得展开。正式页面切换不重置该门槛，也不得重置仍然成立的侧栏悬浮或焦点。该规则用于区分真实前台输入与 DOM／浏览器生命周期恢复事件，同时保留前台会话中既有焦点行为。
- 正式页面 ID 变化只切换页面内容，不得写入桌面玩家侧栏的展开状态，也不得重置本轮鼠标或前台交互意图。只要指针仍悬浮在侧栏内，或键盘焦点仍位于侧栏内，切换概览、市场、建筑、研发、设置等正式页面后必须继续保持 `224px` 展开态；只有真实 `mouseleave`、焦点离开侧栏、浏览器失焦／后台等侧栏自身生命周期事件才允许恢复 `78px`。页面切换和侧栏输入状态必须保持彼此独立。
- 浏览器标签页或窗口失焦、进入后台时，共享桌面侧栏必须立即恢复为收起态，并清空本轮鼠标与前台交互意图；重新激活页面时，浏览器恢复的旧焦点和静止指针都不得触发展开。只有重新激活后的真实 `pointermove`／`mousemove`、`pointerdown` 或 `Tab` 键盘导航才重新建立前台意图；在此之前发生的焦点恢复必须被忽略。该输入语义由玩家与管理员复用的 `SidebarFrame` 统一承担，但不改变管理员布局职责。
- `721px–960px` 使用与宽屏完全相同的 `78px／224px`、四边统一 `14px` 内边距、`48px` 图标轨道和 `48px` 导航行；导航区不叠加顶部外边距，不得切换为 `86px`、`18px` 内边距、隐藏文字的另一套紧凑几何。
- 细指针桌面设备的导航与底部操作在鼠标悬浮时显示边界、背景、左侧绿色提示和轻微亮度变化，但按钮位置、图标中心和高度不得移动或缩放。桌面侧栏按钮不得渲染数字角标，提醒数量只保留在可访问名称和移动底栏。
- 移动底栏禁止 hover 可见反馈。未选中、按下和已选中三种状态必须稳定区分；触摸产生的粘滞 `:hover` 不得改变未选中或已选中视觉。键盘 `:focus-visible` 继续保留明确焦点环。

## 5. 玩家页面与战略追踪器

- 桌面右侧统一使用 `StrategicWorkspaceChrome → StrategicOutliner`。战略追踪器是应用外壳级 Outliner，不属于任何业务页面，固定包含“教程／进行中／关注／公开经济事件”四个可折叠分区。战略追踪器与页面路由生命周期解耦：`home`、`map`、`province`、`market`、`buildings`、`transport`、`settings` 以及 `research`、`auction`、`contracts`、`bank`、`leaderboard`、`gem-shop` 六个 `fullscreen` 页面都复用同一追踪器 DOM。正式页面切换不得卸载追踪器、清空关注引用、重置其滚动位置或改写教程轮次；六个 `fullscreen` 页面在桌面端隐藏同一追踪器并禁用命中，同时把追踪器预留宽度释放为 `0`，离开 `fullscreen` 后恢复完整显示。显示切换不得重建追踪器 DOM 或改写四个分区的折叠状态。
- 战略追踪器只允许一个外层毛玻璃表面，直接复用 `--frosted-glass-background`、`--frosted-glass-border`、`--frosted-glass-shadow` 与 `--frosted-glass-filter`。内部四个分区、事件条目、进行中条目和关注条目只使用分隔线、透明行与状态色，不得为教程、公开事件或关注列表再次套用 `.panel`、`FrostedGlassSurface` 或第二套背景／滤镜。整个追踪器只有 `.strategic-outliner__scroll` 一个纵向滚动根；事件、关注和进行中分区不得建立嵌套纵向滚动视口。
- 教程固定为追踪器顶部的紧凑分区。追踪器内必须使用 `GameGuideStrip variant="outliner"`，保留“步骤 N/9”、教程总体进度、当前任务、前往操作和“跳过”；总体进度继续位于单个任务标题之前且无障碍名称固定为“教程总体进度”。Outliner 变体不得带独立 `.panel` 外壳。跳过仍需确认，清除当前教程轮次并写入按玩家和教程版本隔离的本地跳过标记；设置页只提供“重新开始教程”，该操作清除跳过标记、从第一步新建轮次并回到概览。页面切换、`fullscreen` 桌面隐藏展示、权威状态刷新和分区折叠均不得把展示层隐藏误写成跳过、完成或重开。
- “进行中”只投影已有权威状态与统一通知待处理派生结果：至少包括当前研发、当前工厂施工，以及通知中心已经识别的生产异常、市场事项、拍卖被超价、合同待处理和银行事项。不得为追踪器新增轮询、订单簿请求、合同请求、拍卖请求或第二套待处理判断；倒计时只使用现有服务器校准时间和权威截止时间展示。
- “关注”支持地区、商品、工厂类型、合同和拍卖引用。浏览器本地只允许按玩家和追踪器版本保存 `{ kind, id, provinceId? }` 引用、顺序与四个分区的折叠状态；不得保存追踪器整体收起状态，也不得把成交价、库存、工厂数量、生产状态、倒计时、合同状态、拍卖价格、订单或任何权威经济值复制到 localStorage。关注行的实时数字必须每次从当前 `EconomyState` 或既有通知派生结果投影；引用暂时不可用时只显示不可用状态，不得伪造旧值。点击关注行只允许导航并显式设置对应地区／实体上下文，不得自动提交订单、建设、合同、拍卖或其他经济写操作。
- “公开经济事件”直接读取 `economicCalendar.events`。正在生效与未来七天已公布事件使用紧凑行，折叠态只显示名称、状态点和距离开始／结束时间；展开后才显示说明、类别和重点商品。已经结束的最近事件收进“最近结束”折叠组，不得继续用每项至少 `4rem` 的独立大卡或事件列表专属滚动区。事件日历的服务器窗口、预算语义与成交反馈权威规则保持不变。
- 桌面战略追踪器只有一种完整宽度 `clamp(280px, 21vw, 320px)`，不得提供追踪器整体横向展开／收起按钮，也不得保留 `44px` 紧凑轨道或整体 `data-collapsed` 状态。视口不小于 `1440px` 时，普通页面必须真实预留完整追踪器宽度和 `8px` 沟槽；`721px–1439px` 普通页面不预留伪收起轨道，完整追踪器向左覆盖地图／页面剩余区域而不推动主卡片。进入任一 `fullscreen` 页面时桌面追踪器保持同一 DOM 但 `visibility:hidden` 且禁止命中，预留宽度统一释放为 `0`；离开 `fullscreen` 后恢复完整显示。追踪器本身不执行横向宽度动画，页面主卡片继续使用既有页面展示宽度过渡；`prefers-reduced-motion: reduce` 时页面过渡立即完成。
- `home`、`province`、`market`、`buildings`、`transport`、`settings` 仍使用 `building`，统一以 `--strategic-compact-page-width: 56rem` 为内容目标；包含 `78px` 侧栏轨道的完整 `workspaceCard` 仍不得超过 `calc(100vw / 3)`，并不得越入宽屏普通页面为追踪器预留的空间。`research`、`auction`、`contracts`、`bank`、`leaderboard`、`gem-shop` 使用 `fullscreen`；其“全宽”含义为占用左侧 `8px` 屏幕边距之后到右侧 `8px` 屏幕边距之前的全部工作区，桌面 `fullscreen` 不再为战略追踪器保留任何横向轨道。
- 桌面状态栏、玩家主卡片和战略追踪器统一使用 `8px` 屏幕边距；共享外壳已经在状态栏下方提供唯一 `8px` 间距，主卡片和追踪器必须从工作区顶部 `0` 开始，禁止重复增加顶部沟槽。主卡片底部只保留 `8px` 屏幕边距，不得再为地图镜头栏挤压页面高度。标题与正文内距、一级区块间距统一使用 `var(--layout-gutter)`；玩家主卡片和一级业务卡片统一使用 `var(--radius-card)`，不得为研发恢复零圆角、透明外壳或独立 `12px`／`16px` 页面圆角。桌面 `.page-content` 只负责页面布局并保持透明，不得在主卡片内重复外层边框、圆角、阴影或 `backdrop-filter`。
- 玩家 `PageLayout` 把标题与页面操作固定在 `.page-fixed-header`，正文使用页面卡片内部唯一 `ScrollArea`；工作区外层滚动条隐藏，滚动轨道不得越过卡片边界。`--desktop-page-top-offset` 只表示下方工作区内部沟槽；页面滚动区已经完成状态栏避让，建筑页 sticky 后代不得重复叠加完整状态栏高度。
- 桌面关闭态 Toast 继续作为 `.workspace-strategic-chrome` 的直接子项，从工作区右下角按 `var(--strategic-panel-gap)` 定位并向上堆叠；最新通知最靠近右下角。Toast 使用独立最大宽度 `360px`，不得绑定战略追踪器宽度，也不得为了避让追踪器推动或缩窄页面。Toast 与战略追踪器使用相同局部 `z-index: 2`，且 Toast DOM 排在追踪器之后，所以局部重叠时临时覆盖追踪器；完整通知中心不属于追踪器，仍按第 6 节使用工作区安全浮层右上角几何。历史防回退断言“整个右栏不挂载也仍必须保留桌面 Toast”只表达 Toast 生命周期必须独立于右侧追踪模块；当前战略追踪器本身跨路由常驻，不再以页面类型卸载。
- 玩家主卡片宽度只允许因正式页面展示类型、响应式断点或 `fullscreen` 隐藏／恢复战略追踪器导致可用区域变化而使用既有 `220ms cubic-bezier(.2,.8,.2,1)` 过渡；教程开始／跳过、事件数量、待处理数量、关注实时值和权威状态刷新不得改变主卡片宽度或重播页面展开。新页面内容继续以 keyed `clip-path: inset(0 100% 0 0) → inset(0)` 从左向右裁剪展开并轻微淡入，动画不得修改 `grid-template-columns`、页面内容宽度或滚动根宽度，不得对地图、ECharts 宿主、工作区或毛玻璃采样链设置动画 `transform`。

## 6. 移动与浮层

- 不大于 `720px` 时桌面侧栏与桌面战略追踪器分区隐藏，`workspaceCard` 退化为无额外材质的结构容器；移动端不新增第二套常驻右栏。若教程可见，同一个 `StrategicOutliner` DOM 仅呈现“教程”分区，并改为状态栏正下方的固定教程锚点；“进行中／关注／公开经济事件”三个桌面分区在该断点隐藏。顶部统一使用 `--mobile-below-status-top = --mobile-status-top-inset + --mobile-asset-bar-height + --mobile-notice-gap`，左右使用 `--mobile-workspace-gutter` 与安全区较大值，教程锚点继续受 `30rem` 最大宽度限制。教程留在 `.workspace-strategic-chrome`，不得移动到 Chrome Overlay、根 Dialog 或 `OverviewPage`：普通地图／页面层位于其下，根级 Mobile Workspace Sheet 与移动通知面板位于其上，通知灵动岛和状态栏继续由 Chrome Overlay 覆盖。任意业务页面（包括桌面分类为 `fullscreen` 的页面）都不得因为路由切换卸载教程；页面 Sheet 与通知只通过现有层级自然覆盖它。纯地图页继续只显示常驻战略地图与可见教程；除纯地图外的玩家页面与工厂／研发等业务详情统一进入唯一根级 Mobile Workspace Sheet；地区商品自动经营执行状态保留在商品详情正文，不创建独立策略详情层。该 Host 在 `.workspace-dialog-layer` 中只挂载一份工厂详情卡片容器 `.mobile-detail-sheet-backdrop > .mobile-detail-sheet`。实体 Sheet 底边贴物理视口底部，最大高度同时受 `88%` 视觉视口、`760px` 和通知岛安全槽以下可用高度约束；该安全槽固定由状态栏下方间距、`56px` 的 `--mobile-notification-island-height` 与其下方间距组成，即使当前没有通知岛、主动通知已禁用或通知面板正在打开也必须预留，实体 Sheet 顶边始终低于这条通知岛安全槽。通知面板只以更高层覆盖 Sheet，不参与 Sheet 高度计算，因此面板开关不得改变 Sheet 的顶边或高度。最大高度只允许在根 Sheet 首次可见绘制前的 `useLayoutEffect` 中按当时 `visualViewport` 快照一次；根 Sheet 存续期间不得监听 `window.resize`、`visualViewport.resize` 或 `visualViewport.scroll` 动态重测高度，关闭后重新打开才允许取得新快照。根 backdrop 可以覆盖完整视口承担点击关闭命中，但必须保持透明并禁用 `backdrop-filter`；唯一实体 `.mobile-detail-sheet` 自身才复用共享 `--frosted-glass-*` 材质和 `blur(18px) saturate(128%)`。Sheet 外部区域不得压暗或模糊，地图、状态栏和通知区域保持原亮度与清晰度。
- 唯一根级 Mobile Workspace Sheet 只在首次由纯地图进入业务页面时执行根容器底部打开动效；业务页面之间切换只替换基础内容并保持同一 `.mobile-detail-sheet` DOM。工厂或研发详情打开时在根内增加详情内容层并把基础页设为 `inert`，详情层使用同一拖动内核从底部进入；关闭详情只收起详情层并恢复原页面。没有详情层时，右上关闭、遮罩点击、`Escape` 或正文已经位于顶部时的有效向下拖动才收起整个根并切换到 `map`；正文 `scrollTop > 0` 时向下手势继续属于正文滚动。根 Sheet 继续承担页面滚动锁，但作为可与顶部 Chrome 并存的非模态 `role="dialog"` 不得建立全局 `Tab` 焦点陷阱；状态栏通知按钮和其覆盖层必须能够取得焦点。物理根 Sheet 独占 Pointer／Touch 手势监听；详情打开时只把同一个 `useMobileWorkspaceSheetDrag` 的视觉拖拽目标切换到详情层，不得把监听下沉到详情子层或同时注册两套监听，保证真机触摸、Pointer Capture 与下拉刷新保护始终经过同一物理事件边界。一次拖动从开始到回弹或关闭完成必须锁定同一个 Sheet 高度；松手前必须同步提交最后一次真实拖动 offset、取消尚未执行的拖动 RAF，再从该位置下一帧进入 settle，禁止用回弹／关闭目标覆盖最后一个触摸位置而造成松手跳动。Touch 释放必须以最后一次已接收的 `touchMove` session 位置为权威；`touchEnd.changedTouches` 只表示结束事件，不得覆盖 session 位置或参与触摸释放位移判定，避免合成器异常坐标造成瞬移或误关闭。首次进入动画只能在每个物理 Sheet／详情实例初次挂载时播放一次；一旦进入拖动／settle，必须永久标记该实例的进入动画已完成，回弹结束移除状态类不得重播从视口底部进入的 keyframes。settle 完成优先以 `transform` 的 `transitionend` 收口，并保留定时器兜底；`prefers-reduced-motion` 继续立即完成。
- `SignedInShell` 为玩家与管理员统一提供唯一页面 `ScrollArea`；不得为管理员创建第二个原生主滚动容器，嵌套业务视口到达边界后必须把滚动链交还该共享页面视口。
- 移动页面卡片自己的竖向滚动条必须继续绝对定位在 `.page-card-scroll-area` 根上，并跨出 `--mobile-workspace-gutter + 1px` 卡片边框，使视觉滑块到达物理安全右边缘，同时不改变内容视口宽度。只有根级 `.page-scroll-area` 的竖向轨道允许使用 viewport-fixed 定位；不得把页面卡片滚动条设为 `fixed` 放在带 `backdrop-filter` 的毛玻璃祖先下，因为 Chromium 会为固定后代建立局部包含块并把轨道错误地向内偏移。
- 滚动条浏览器回归必须以 `getComputedStyle(workspace).paddingRight` 等已解析为像素的实际几何作为沟槽基准，再加页面卡片 `1px` 边框核对滚动根 inset；不得对可能为 `rem` 的 `--mobile-workspace-gutter` 原始字符串直接 `parseFloat` 后当作像素使用。最终滑块仍需验证距离物理右边缘约 `2px`。
- 地图镜头栏与唯一地图舞台通过同一个 `ApplicationMapLayerPortal` 挂载为根级 `.application-map-layer` 的直接子节点；镜头栏位于地图舞台之上，但整个地图层 `20` 必须低于承载页面的 UI 层 `30`，不得再把镜头栏挂入 `StrategicWorkspaceChrome`。镜头栏底部外距继续读取 `var(--layout-gutter)`。页面不为镜头栏预留高度；镜头栏位于页面层下方，在页面覆盖范围内由页面自然遮挡，不能挤压正文。桌面通知面板继续位于工作区安全浮层并保持原有右上角几何；移动通知面板复用现有 `.workspace-dialog-layer`，作为 Chrome 级临时覆盖层位于 Sheet 之上、移动状态栏之下，面板外点击捕获层必须透明且不得压暗地图，点击面板外遮罩空白必须关闭。移动通知灵动岛位于 Chrome Overlay；通知面板和灵动岛都不得推动页面或新增第五个全局层。
- 桌面地图镜头切换按钮固定使用单行横向“图标 + 文字”胶囊，最小高度 `44px`、全圆胶囊圆角，图标始终位于文字左侧且禁止换行；州界／资产／工业／市场／异常五项的既有未选中与选中颜色、边框、背景、毛玻璃镜头栏材质和按钮间距语义保持不变，不得为了同步胶囊风格把桌面镜头按钮改成移动底栏的上下排列。
- 战略地图的世界面数据、SVG Camera、州名、路线、交互视觉和渲染性能统一由 `STRATEGIC_MAP_RENDERING_DESIGN.md` 定义。本文只拥有根 `.application-map-layer` 与 Chrome／业务层之间的层级、裁剪和材质边界；不得在这里复制 Camera、底图精度或州面状态规则。
- 根级业务 Dialog 在移动玩家端由唯一 `MobileWorkspaceSheetHost` 统一占用，承载一级业务页面以及同根内的详情内容层。`MobileWorkspacePageSheet` 不再拥有可见根容器，只是 Host 的零 DOM 适配器；`MobileWorkspaceDetailSheet` 不再创建 Dialog，只向 Host 注册详情内容和固定底栏。普通 Tooltip、Popover 继续限制在工作区安全浮层内；Tooltip 自身仅可在唯一浮层节点使用 `.ui-tooltip-surface` 复用共享毛玻璃，不得再创建玻璃包装器。来自唯一根 Sheet 内的富下拉可以使用根 Dialog 作为安全边界。移动通知面板是明确例外：它复用同一个根 Dialog Layer 的更高内部层级覆盖 Sheet，但不创建第二个 Portal 根。状态栏始终位于 Sheet 与通知面板之上。不得创建第二份 `.mobile-detail-sheet`、第二个 backdrop 或第二个根级 Portal。
- 移动通知灵动岛以物理屏幕水平中线为中心，并从中心对称展开；左右安全区不能让其偏向页面内容列。Sheet 存在期间灵动岛仍可在状态栏下方显示并位于 Sheet 之上；Sheet 的实体顶边始终位于固定通知岛安全槽之下，即使当前没有通知岛也不得向上扩展占用该槽；打开通知面板后必须立即卸载通知岛、Toast 及其 ARIA live region，而底层 Sheet 几何保持不变。
- 面板打开时立即清空 Toast 队列。`useNotificationCenter` 同时必须在面板打开期间拒绝新增 Toast；新操作通知和待处理变化只更新面板内容并按现有已读语义处理，关闭面板后不得把面板期间已经展示的通知延迟补弹。移动内部层级固定为地图／普通页面 < 移动教程 < 根 Sheet < 移动通知面板／通知灵动岛 < 状态栏；底部导航在 Sheet 存在期间退出视觉与交互树，不参与该覆盖竞争。页面内部任意正 `z-index` 都不得盖过通知面板或 Chrome。
- 页面内部若使用带非 `auto` `z-index` 的 `position: sticky`／定位元素，必须被 `.mobile-page-overlay` 的页面层堆叠边界收口，不得遮挡移动状态栏、通知或底栏。
- 登录态根视口的下拉刷新边界由 `html[data-app-surface="game"|"admin"]` 的 `overscroll-behavior-y: none` 终止；移动工厂详情通过 `mobileDetailSheetPullRefresh.ts` 的非被动 `touchmove` 仅阻止触发浏览器刷新所需的手势，内部滚动区继续保持 `overscroll-behavior-y: auto`，不得全局阻断页面触摸滚动。

## 7. 验证

必须通过以下防回退：

- `scripts/verify-liquid-glass-chrome.mjs`：历史脚本路径保留，但验证对象已改为 CSS 毛玻璃、依赖删除、共享组件、单节点 Tooltip 材质、统一 `workspaceCard`、战略追踪器四分区、页面路由与追踪器生命周期解耦、`fullscreen` 桌面隐藏并释放右侧预留空间以及移动教程复用同一 Outliner DOM。
- `scripts/verify-navigation-pill-geometry.mjs`：锁定玩家移动底栏 `56px × 50px` 上图标下文字胶囊、玩家专属放大图标槽、桌面地图镜头 `44px` 单行横向胶囊，以及两处既有颜色与共享毛玻璃材质不得随几何调整漂移。
- `scripts/verify-strategic-outliner.mjs`：锁定“教程／进行中／关注／公开经济事件”四分区、唯一纵向滚动根、关注引用与分区折叠本地持久化边界、禁止保存实时经济值、现有通知待处理复用、桌面普通页完整展示／`fullscreen` 隐藏同一 DOM、禁止整体横向收起状态与移动教程单实例。
- `scripts/verify-province-map-focus.mjs`：锁定静态 SVG 州面 hover／select 必须复用镜头基础 `areaColor`，普通悬浮使用中性弱轮廓，选中及选中悬浮使用更强中性轮廓与低强度辉光，禁止恢复 `surface-hover`／绿色业务状态填充、第二地图、ECharts 交互态或 React 高频 hover 状态。
- `scripts/verify-client-update-recovery.mjs`：锁定 `RefreshPageButton` 的浏览器式 SVG 刷新控件、真实 `window.location.reload()` 恢复语义，并禁止异常入口恢复文字刷新按钮或应用内 retry。
- `scripts/verify-mobile-page-sheet.mjs`：锁定唯一根级 Mobile Workspace Sheet、工厂详情卡片容器单实例、Sheet 自身毛玻璃、透明外部 backdrop、状态栏避让、页面／详情内容复用、共享拖动内核、首次高度快照、松手 offset 连续性、触摸释放最后 `touchMove` 坐标权威、进入动画单次播放、底栏隐藏与返回动画、通知覆盖和地图关闭语义，禁止恢复第二个 Sheet DOM、动态视觉视口测高、进入动画回弹后重播或松手跳帧。
- `scripts/verify-sidebar-navigation-collapse.mjs`：锁定正式页面切换不修改侧栏展开态、不重置前台输入意图，悬浮或焦点成立时跨页继续保持 `224px`，浏览器失焦／后台仍立即收起，浏览器恢复焦点与新的前台输入意图分流以及专项浏览器回归，禁止恢复按页面强制收起、按路由重置交互门槛或让浏览器恢复旧焦点自动展开。
- `tests/browser/frosted-glass-layout.spec.ts`：状态栏、通用面板、认证和移动底栏的真实背景滤镜、边界、圆角、单实例与无旧 DOM。
- `tests/browser/auction-bid-history.spec.ts`：共享 `SafeTooltip` 必须在实际悬浮／焦点路径使用 `.ui-tooltip-surface`，真实计算样式包含共享 `blur(18px)`、半透明背景、高光、边界和阴影。
- `tests/browser/shell-floating-safe-zone.spec.ts`：ECharts Tooltip 必须使用同一 `.ui-tooltip-surface` 毛玻璃材质并继续限制在工作区安全边界，不能覆盖状态栏、侧栏或可见移动底栏。
- `tests/browser/application-error-state.spec.ts`：桌面／移动错误状态必须使用唯一 `stateCard`，真实计算样式包含共享 `blur(18px)`、半透明背景和危险色边界；刷新控件必须为圆形图标按钮并触发页面重新加载。
- `tests/browser/open-glass-sampling.spec.ts`：四种玩家／管理员、桌面／移动场景的根级采样链。
- `tests/browser/game-shell-layout.spec.ts`：侧栏宽窄屏一致、真实指针意图后的悬浮反馈不位移、页面展开期间布局盒几何不受视觉裁剪动画影响、建筑式面板与战略追踪器几何。
- `tests/browser/sidebar-navigation-collapse.spec.ts`：桌面侧栏悬浮展开后切换正式页面必须继续保持 `224px`，直到真实鼠标移出或焦点离开；浏览器失焦／进入后台后仍必须收起，返回时在没有新前台输入前恢复旧焦点与静止旧指针都不得重新展开；新的 `Tab` 键盘导航焦点进入仍可立即展开。
- `tests/browser/tutorial-right-rail.spec.ts`：桌面战略追踪器在普通与六个 `fullscreen` 页面之间保持同一 DOM，普通页完整显示、`fullscreen` 隐藏且主卡片扩展到右侧 `8px` 屏幕边距，不存在整体横向收起按钮或 `44px` 轨道；教程步骤、分区折叠和关注引用跨页保持。移动端复用同一 Outliner DOM 只显示教程分区，根 Sheet 与通知可以自然覆盖教程而状态栏保持最高。
- `tests/browser/mobile-status-value-fit.spec.ts`：移动状态栏在连续视口 resize 后必须重新完成数值拟合；`400px` 与 `340px` 两级超窄布局必须先收紧留白和图标，在 `320px` 仍保留 `44px` 通知触控轨道并让完整整数不低于 `0.56rem`；不得卡在 `data-status-values-fitted="false"` 或裁剪末位数字。
- `tests/browser/mobile-workspace-overlay.spec.ts`：唯一根级 Mobile Workspace Sheet 必须复用工厂详情全宽容器、底边贴物理视口、顶边避让状态栏且只在自身毛玻璃；Sheet 外保持清晰，状态栏可交互，底栏在 Sheet 存在时隐藏并在根 Sheet 收起后播放返回动画；页面卡片滚动条继续位于根 Sheet 安全右边缘且不改变正文宽度。
- `tests/browser/mobile-sheet-release-stability.spec.ts`：模拟最后一次 `touchMove` 与 `touchEnd` 同帧发生，分别验证约半高下拉关闭和短距离回弹都从最后一次已接收的真实 `touchMove` 位置连续进入 settle、过程单调且 Sheet 高度冻结；回弹完成后不得重新触发首次进入 keyframes，禁止 `touchEnd.changedTouches` 覆盖 session 位置或松手瞬间跳回旧 RAF 位置。
- `tests/browser/notification-center.spec.ts`：桌面完整通知面板保持工作区安全浮层右上角；桌面关闭态 Toast 与战略追踪器同属战略 Chrome、固定工作区右下角且宽度独立，发生局部重叠时允许覆盖追踪器；移动通知面板必须覆盖已打开的根 Sheet、保持状态栏最高且面板打开期间通知岛为零，`Escape` 只关闭通知面板并恢复通知入口焦点。
- `tests/browser/mobile-notification-sheet-reserve.spec.ts`：移动根 Sheet 即使当前没有通知岛也必须永久低于 `56px` 通知岛安全槽；打开通知面板只覆盖而不得改变 Sheet 顶边／高度；按玩家禁用主动通知后刷新仍保持该偏好且不补弹历史提醒。
- `tests/browser/mobile-navigation-scrollbar.spec.ts`：移动底栏保持同一 DOM、Sheet 存在时不可见且不可交互、根 Sheet 收起到地图后使用通知灵动岛同系弹性返回动画，并继续验证无 hover、按下／选中／未选中状态和横向滚动。
- `tests/browser/navigation-pill-geometry.spec.ts`：真实浏览器分别锁定玩家移动底栏大号上图标下文字胶囊、既有导航状态色与毛玻璃材质，以及桌面地图镜头横向图标文字胶囊、最小高度和既有镜头栏材质。
- `tests/browser/all-pages-preview.spec.ts`：概览、市场、建筑、运输、设置五个同宽紧凑页面，研发、拍卖、合同、银行、排行榜与商店六个全区域页面，并验证所有桌面页面共享同一战略追踪器而不是恢复页面专属右栏。
- 战略地图浏览器回归与结构 verifier 的所有权和覆盖边界见 `STRATEGIC_MAP_RENDERING_DESIGN.md`；本设计的测试只验证 `.application-map-layer` 与地图专属操作表面相对 Chrome 的层级、裁剪和材质。

## 压缩后工作区层级防回退摘要

- 通知面板作为 Chrome 级临时覆盖层始终位于 Sheet 之上；通知面板打开期间不得挂载通知岛。移动底栏在根 Sheet 存在时继续保持同一 DOM，但必须隐藏并退出交互树。
- 战略追踪器与页面路由生命周期解耦，不得提供整体横向展开／收起按钮；六个 `fullscreen` 页面在桌面端隐藏同一追踪器 DOM，离开后恢复同一实例。

移动根 Sheet 和二级详情复用同一个拖拽把手，命中区域固定为 `24px` 高；不得恢复 `32px` 或更高的顶部空白区。视觉把手尺寸、Sheet 拖拽关闭、视口冻结与焦点恢复规则保持不变。
