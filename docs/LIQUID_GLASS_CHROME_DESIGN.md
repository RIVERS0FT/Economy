# Economy 毛玻璃应用外壳设计

> 状态：当前正式外壳、毛玻璃材质与响应式几何权威
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-08-16

文件名沿用既有权威文档路径，正文规则已经完全替换旧 Liquid Glass 实现。

## 1. 材质唯一实现

- 项目不得安装、导入或运行 `liquid-glass-react`，不得恢复 `LiquidGlassSurface`、`.glass__warp`、SVG 位移滤镜、色差、折射或鼠标跟随形变。
- `src/components/ui/FrostedGlassSurface.tsx` 是状态栏、管理员工作栏、移动底栏和认证卡片唯一共享表面包装器，只输出宿主和内容两层稳定 DOM。
- `src/styles/frosted-glass-surfaces.css` 是共享毛玻璃材质权威，统一使用半透明深色背景、`blur(18px) saturate(128%)`、一像素柔和边界、静态顶部高光和阴影；不支持 `backdrop-filter` 时使用更高不透明度的同色回退。
- 通用 `.panel`、玩家页面外层、桌面侧栏和地图镜头栏复用同一组 `--frosted-glass-*` 令牌。业务样式可以定义内部布局，不得创建第二套液态玻璃、折射或用途专属滤镜。
- `package.json` 与 `package-lock.json` 均不得包含 `liquid-glass-react`；生产和测试源码不得导入该包。

## 2. 根级摄影与采样链

`ApplicationLayerRoot` 继续永久挂载唯一四层根结构：

```text
图片层 0 → 氛围层 10 → 地图层 20 → UI 层 30
```

根级 `#root` 使用唯一 `isolation:isolate`。地图层、UI 层、内容根、登录后外壳、工作区、页面滚动区和 Chrome Overlay 必须保持 `isolation:auto`、`filter:none`、`transform:none`，让各毛玻璃表面能够采样其后的摄影、氛围和地图。毛玻璃宿主自身不得创建新的隔离根。

- 全应用四层根堆叠由 `ApplicationLayerRoot` 固定挂载在 `main.tsx`，并位于 `React.StrictMode` 与错误边界之外；四层对应 `z-index: 0 / 10 / 20 / 30`，不得建立第五个全局层。
- 页面和状态切换只修改 `data-app-backdrop` 与 `data-app-tone`；`data-app-backdrop` 只保留语义和状态路由职责，不得重新提供工作区地图背景插槽或 `SignedInShell.backdrop`。
- 账号检查、正式代码包、本地预览代码包和权威游戏连接四个入口统一使用 `ApplicationLoadingState.tsx`，四个入口只允许替换中文文字，不得出现纯色过渡页或恢复深色加载卡片。
- 登录、玩家与管理员必须使用完全相同的摄影滤镜，正常态摄影图片只承担低对比度空间纹理职责；角色和页面不得复制摄影节点或覆盖滤镜。
- `tests/browser/application-photography.spec.ts` 与 `tests/browser/application-atmosphere-consistency.spec.ts` 验证根节点跨状态保持、失败回退和桌面／移动氛围一致性。

## 3. 状态栏、认证与移动底栏

- 玩家状态栏 DOM 固定为 `header.asset-bar → FrostedGlassSurface → .frosted-glass-surface__content → .asset-bar-layout`，内部依次为身份轨道、五列状态项和通知工具位；三条轨道与各状态项必须占满状态栏内部高度并在同一垂直中线上居中。桌面状态项不得再叠加上下内容内边距，三行状态内容的自然高度必须完整落在实际卡片内容高度内，不能因渲染区小于内容区而向下溢出。
- 状态栏实际数字格式遵循全局“紧凑数字”偏好；玩家关闭全局“紧凑数字”后，桌面和移动状态栏都显示带千分位的完整整数。
- 移动状态栏数值自适应只允许仅真实溢出的状态项缩小字号，最低为 `0.56rem`；不得恢复省略号、裁剪数值或让未溢出的项目一起缩小。
- 管理员桌面工作栏复用 `statusBar` 变体；移动管理员不显示桌面工作栏。
- 认证卡片使用 `authCard + content`，依靠普通文档流自然增高，不使用测高状态、`ResizeObserver`、`MutationObserver` 或重建组件；登录／注册切换和桌面／移动断点不得丢失未受控表单值。
- 桌面状态栏和认证卡片圆角为 `24px`；移动状态栏、认证卡片和底栏圆角为 `40px`。
- 移动状态栏固定 `48px`，移动底栏固定 `68px`。底栏内容层提供唯一 `8px 0` 垂直留白，语义化 `nav` 是唯一横向滚动视口。
- 状态栏、移动底栏、认证卡片和管理员工作栏每处只允许一个 `.frosted-glass-surface`；通知、Toast 和业务弹层不得为装饰增加额外毛玻璃实例。

## 4. 侧栏几何与输入方式

- 玩家端桌面侧栏与当前页面必须共同位于唯一 `FrostedGlassSurface workspaceCard` 主卡片中；主卡片承担唯一外层毛玻璃、边框、圆角和阴影，侧栏与 `.page-content` 不得继续各自渲染第二层外壳材质。管理员继续使用原共享外壳结构，不接入玩家主卡片。
- 桌面侧栏默认 `78px`，悬浮或键盘焦点进入后展开为 `224px`，移出或焦点离开后收起；不得恢复显式展开／折叠按钮。主卡片只固定预留 `78px` 指挥轨道，展开侧栏绝对覆盖页面而不推动页面、地图或事件栏。侧栏右边缘必须始终提供 `1px` 竖向分隔线和向页面方向投射的阴影；分隔线与阴影随侧栏右边缘移动。
- `721px–960px` 使用与宽屏完全相同的 `78px／224px`、四边统一 `14px` 内边距、`48px` 图标轨道和 `48px` 导航行；导航区不叠加顶部外边距，不得切换为 `86px`、`18px` 内边距、隐藏文字的另一套紧凑几何。
- 细指针桌面设备的导航与底部操作在鼠标悬浮时显示边界、背景、左侧绿色提示和轻微亮度变化，但按钮位置、图标中心和高度不得移动或缩放。桌面侧栏按钮不得渲染数字角标，提醒数量只保留在可访问名称和移动底栏。
- 移动底栏禁止 hover 可见反馈。未选中、按下和已选中三种状态必须稳定区分；触摸产生的粘滞 `:hover` 不得改变未选中或已选中视觉。键盘 `:focus-visible` 继续保留明确焦点环。

## 5. 玩家页面与右侧事件日志

- `research`、`auction`、`contracts`、`bank`、`leaderboard`、`gem-shop` 使用 `fullscreen`，页面内容占满主卡片内侧可用页面区域，不挂载公开事件右栏；排行榜与商店必须保持相同页面宽度。
- `home`、`market`、`production`、`settings` 使用 `building`，四页统一使用 `--strategic-compact-page-width: 56rem` 作为内容目标值，但包含 `78px` 侧栏轨道的完整 `workspaceCard` 总宽度不得超过 `calc(100vw / 3)`，也不得超过事件右栏之外的可用空间；不得为其中任一页恢复独立宽度。地图在其余区域继续可见。
- 桌面状态栏、玩家主卡片和公开事件右栏统一使用 `8px` 屏幕边距；共享外壳已经在状态栏下方提供唯一 `8px` 间距，主卡片和事件右栏必须从工作区顶部 `0` 开始，禁止重复增加顶部沟槽。主卡片底部只保留 `8px` 屏幕边距，不得再为地图镜头栏挤压页面高度。标题与正文内距、一级区块间距统一使用 `var(--layout-gutter)`；玩家主卡片、公开事件面板和一级业务卡片统一使用 `var(--radius-card)`，不得保留独立 `12px`／`16px` 页面圆角。桌面 `.page-content` 只负责页面布局并保持透明，不得在主卡片内重复外层边框、圆角、阴影或 `backdrop-filter`。
- 玩家 `PageLayout` 把标题与页面操作固定在 `.page-fixed-header`，正文使用页面卡片内部唯一 `ScrollArea`；工作区外层滚动条隐藏，滚动轨道不得越过卡片边界。
- `--desktop-page-top-offset` 只表示下方工作区内部沟槽；页面滚动区已经完成状态栏避让，生产页 sticky 后代不得重复叠加完整状态栏高度。
- 公开经济事件不得进入 `OverviewPage`、`.page-content` 或页面滚动区。桌面端由 `StrategicWorkspaceChrome` 在工作区右侧挂载唯一 `.strategic-economic-event-rail`；建筑式页面必须给右栏预留空间，纯地图视图允许右栏覆盖地图。事件面板标题不带说明段落或右侧胶囊，事件折叠态只显示名称与距离开始时间，具体状态、时间范围、说明、类别、商品和成交反馈在展开后显示。
- 经营成长线在桌面概览时位于右栏事件日志上方；移动端右栏隐藏，概览只保留移动专用成长线入口，公开事件不回流概览正文。
- 研发、拍卖、合同、银行、排行榜和商店隐藏右栏；切换页面不得重建根级地图。
- 玩家主卡片宽度在页面目标宽度变化时使用与侧栏一致的 `220ms cubic-bezier(.2,.8,.2,1)` 过渡；新页面内容以 keyed `0fr → 1fr` 横向展开并轻微淡入。动画只由正式页面 ID 变化触发，权威状态刷新、倒计时和表单变化不得重播；不得对地图、ECharts 宿主、工作区或毛玻璃采样链设置动画 `transform`。`prefers-reduced-motion: reduce` 时立即完成。

## 6. 移动与浮层

- 不大于 `720px` 时桌面侧栏和右侧事件栏隐藏，`workspaceCard` 退化为无额外材质的结构容器，现有移动页面面板继续使用完整移动工作区宽度；状态栏和底栏保持 Chrome Overlay，页面保持唯一纵向滚动区。
- `SignedInShell` 为玩家与管理员统一提供唯一页面 `ScrollArea`；不得为管理员创建第二个原生主滚动容器，嵌套业务视口到达边界后必须把滚动链交还该共享页面视口。
- 地图镜头栏与唯一地图舞台通过同一个 `ApplicationMapLayerPortal` 挂载为根级 `.application-map-layer` 的直接子节点；镜头栏位于地图舞台之上，但整个地图层 `20` 必须低于承载页面的 UI 层 `30`，不得再把镜头栏挂入 `StrategicWorkspaceChrome`。镜头栏底部外距与通知面板左右／底部外距统一读取 `var(--layout-gutter)`。页面不为镜头栏预留高度；镜头栏位于页面层下方，在页面覆盖范围内由页面自然遮挡，不能挤压正文。通知面板继续位于工作区安全浮层并始终高于页面层、事件右栏和地图镜头栏；其顶部直接复用状态栏到工作区的既有沟槽，不得重复增加顶部内距，点击面板外遮罩空白必须关闭。移动通知灵动岛位于 Chrome Overlay；两者不得推动页面或新增毛玻璃宿主。
- 根级业务 Dialog 继续高于状态栏和底栏，普通 Tooltip、Popover 与菜单限制在工作区安全浮层内。
- 移动通知灵动岛以物理屏幕水平中线为中心，并从中心对称展开；左右安全区不能让其偏向页面内容列。工作区浮层根已经提供唯一水平边界，通知样式不得再次叠加侧栏或安全区偏移。
- 面板打开时立即清空 Toast 队列。移动工作区使用局部层级堆叠边界：页面使用 `1`、事件右栏使用 `2`、普通浮层使用 `4`；地图舞台与镜头栏分别使用根地图层内部 `0`／`1`，并共同受全应用地图层 `20` 收口，始终低于全应用 UI 层 `30`。页面内部任意正 `z-index` 都不得盖过通知面板或 Chrome。
- 页面内部若使用带非 `auto` `z-index` 的 `position: sticky`／定位元素，必须被 `.mobile-page-overlay` 的页面层堆叠边界收口，不得遮挡移动状态栏、通知或底栏。
- 登录态根视口的下拉刷新边界由 `html[data-app-surface="game"|"admin"]` 的 `overscroll-behavior-y: none` 终止；移动工厂详情通过 `mobileDetailSheetPullRefresh.ts` 的非被动 `touchmove` 仅阻止触发浏览器刷新所需的手势，内部滚动区继续保持 `overscroll-behavior-y: auto`，不得全局阻断页面触摸滚动。

## 7. 验证

必须通过以下防回退：

- `scripts/verify-liquid-glass-chrome.mjs`：历史脚本路径保留，但验证对象已改为 CSS 毛玻璃、依赖删除、共享组件、页面分流和右栏职责。
- `tests/browser/frosted-glass-layout.spec.ts`：状态栏、通用面板、认证和移动底栏的真实背景滤镜、边界、圆角、单实例与无旧 DOM。
- `tests/browser/open-glass-sampling.spec.ts`：四种玩家／管理员、桌面／移动场景的根级采样链。
- `tests/browser/game-shell-layout.spec.ts`：侧栏宽窄屏一致、悬浮反馈不位移、建筑式面板与事件右栏几何。
- `tests/browser/mobile-navigation-scrollbar.spec.ts`：移动底栏无 hover、按下／选中／未选中状态和横向滚动。
- `tests/browser/all-pages-preview.spec.ts`：概览、市场、生产、设置四个同宽紧凑页面，排行榜与商店等六个全区域页面和独立事件右栏。
