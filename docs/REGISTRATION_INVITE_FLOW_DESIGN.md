# Economy 注册邀请码与共享金融背景设计

> 状态：当前权威设计  
> 更新时间：2026-07-29

## 1. 注册邀请码流程

- 注册表单固定提供“邀请码（可选）”输入框。
- 访问 `/economy/?invite=ABCDEFGH` 时，客户端自动切换到注册模式并把链接邀请码预填进该输入框。
- 用户可以在提交注册前清空或修改邀请码；最终提交值由服务器规范化与校验。
- 链接中预填且未被修改的邀请码记为 `share_link`；用户自行输入或修改后的邀请码记为 `manual_code`。`manual_code` 只表示注册表单填写，不表示注册后的补填操作。
- 有效邀请码与统一账号首次创建 Economy 玩家档案处于同一事务，注册完成后邀请人立即获得 10 宝石，被邀请人不获得宝石。
- 无效邀请码不得阻止统一账号注册；只是不创建邀请关系或发放宝石。
- Economy 注册完成的唯一判定是该统一账号的玩家档案首次创建事务提交成功。注册完成后不能补填、更换或替换邀请关系。
- 已经拥有主页统一账号、但尚未创建 Economy 玩家档案的用户，首次进入 Economy 时仍可通过分享链接提交邀请码；已经存在 Economy 玩家档案时，URL 中的 `invite` 参数必须被忽略并清除。
- 每个被邀请账号最多绑定一条邀请关系。已有关系不得更换；没有关系的历史账号也不得事后补绑。
- 邀请码、邀请关系与奖励状态均以服务器和 SQLite 记录为准，不得只保存在 URL、本地存储或客户端状态。
- 已登录页面只允许展示玩家自己的永久邀请码、专属分享链接、邀请统计和最近邀请；不得展示邀请码填写、补填或更换控件。
- 旧 `POST /api/game/invitations/claim` 固定返回 `410 Gone`，不得读取邀请码、建立关系、发放宝石、创建玩家档案或推进世界修订号。

## 2. 登录、注册、玩家游戏、管理员后台与根级状态共享三层视觉

原有“登录、注册与玩家游戏共享三层视觉”规则继续成立，并扩展到管理员后台与根级状态。

登录／注册入口、九个玩家页面、管理员五个分区及根级加载／封禁／无权限／致命错误状态固定复用 `src/components/visual/FinancialBackdrop.tsx`，并由 `src/config/visualAssets.ts` 统一保存摄影资源地址。摄影作品仍为 Carol M. Highsmith 拍摄的纽约证券交易所交易大厅，来源于美国国会图书馆 Highsmith 档案，权利说明为无已知发表限制。图片只表达环境，使用空替代文本并从无障碍树隐藏；图片请求失败时必须隐藏破图元素，由深色氛围层继续提供完整可读背景。

整个应用生命周期只允许一个摄影 `<picture>` 节点。摄影节点固定在 `main.tsx`，位于 `React.StrictMode` 与 `AppErrorBoundary` 外部，并以 `loading="eager"`、`fetchPriority="high"` 首次加载；账号检查、认证、代码包加载、玩家连接、正式游戏、管理员后台、封禁、无权限和致命错误之间切换时不得卸载或重新创建该节点。不得在 `LoginPage`、`GameStateShell`、`GameShell`、`AdminApp` 或 `PhotographicStateShell` 中重新挂载 `FinancialBackdrop`，也不得重新提供页面级背景插槽。

共享背景严格分为三个视觉层级：

1. 图片层由根级 `.application-image-layer` 承载，统一使用响应式 `<picture>`、`object-fit: cover` 和装饰性空替代文本。桌面使用原图，移动端通过 `<source media="(max-width: 720px)">` 使用 `960px` 版本。页面、管理员分区、弹窗、详情抽屉、页内空状态和根级状态切换只复用同一图片 DOM 节点；浏览器缓存、解码结果和合成表面不得因为业务页面切换而失效。
2. 氛围层由根级 `.application-atmosphere-layer` 承载。`data-app-backdrop` 只负责认证／玩家／管理员三种图片滤镜与氛围选择，`data-app-tone` 只负责普通或 critical 警示暗角；对应选择器为 `html[data-app-backdrop="auth"|"game"|"admin"]` 与 `html[data-app-tone="normal"|"critical"]`。玩家和管理员变体必须比登录变体更暗，管理员变体还必须比玩家变体更均匀，确保密集表格、表单和运营数据保持稳定对比度。`html[data-app-surface="auth"|"game"|"admin"|"loading"|"banned"|"error"] body::before` 必须关闭，网格只能存在于氛围层，避免形成第四个全局背景层。封禁、无权限和致命错误不得替换为纯色页面或另一张图片。桌面登录氛围保持原有横向明暗分布；移动登录氛围层必须比原基线更透明，纵向主遮罩固定使用 `rgba(1, 7, 4, 0.62)`、`rgba(2, 10, 6, 0.6)`、`rgba(2, 8, 5, 0.82)`，网格与噪点透明度分别为 `0.12` 和 `0.05`，不得恢复 `0.78`／`0.76`／`0.93` 的过暗遮罩。
3. 内容层由根级 `.application-content-root`、现有认证内容、登录后共享外壳或根级状态外壳承担。生产登录页的图片层、氛围层和 `.application-content-root` 必须是同一个 `#root` 隔离根的直接子节点；图片与氛围分别使用 `z-index: -2 / -1`，`.application-content-root → .login-shell → .login-content-layer → .login-card` 全链保持 `z-index:auto`、`isolation:auto`、`filter:none` 与 `transform:none`，不得建立额外 stacking context。登录入口继续使用 `login-content-layer` 的桌面双列和移动单列；玩家游戏与管理员后台继续由 `SignedInShell` 承载桌面侧栏、唯一页面 `ScrollArea`、工作栏和移动导航；根级加载、封禁、无权限和致命错误由 `PhotographicStateShell` 承载单一可滚动状态卡。不得为三层背景重建业务页面外壳、增加第二个主滚动容器或把整个页面恢复成不透明纯色面板。

认证卡片必须使用 `src/components/auth/AuthCardSurface.tsx` 包装，并通过统一 `LiquidGlassSurface` 的 `desktopAuthCard`／`mobileAuthCard` 预设渲染。认证卡片任一时刻只能存在一个玻璃实例，`720px` 断点只允许在原位置切换预设，不得同时挂载桌面和移动卡片后用 CSS 隐藏。认证卡片继续使用 `layout="content"` 的自然内容高度，但真实登录／注册内容必须与状态栏相同，位于第三方 `.glass` 内的 `.liquid-glass-surface__content`，不得再作为玻璃效果外部的兄弟层。登录／注册、邀请码、验证码、错误和状态提示等由 React 直接提交的内容变化，必须在 `useLayoutEffect` 中读取 `scrollHeight`／`offsetHeight` 并于首次绘制前同步提交宿主高度；同一节点上的单个 `ResizeObserver` 和条件 `MutationObserver` 只负责字体、异步提示和容器宽度等提交后的补充变化。不得读取认证内容的 `getBoundingClientRect()` 作为高度权威，不得通过 revision 或 React `key` 重建认证内容，所有模式切换和 `720px` 断点切换都不得清空原生未受控表单值。

认证卡片采用与受控对照页一致的认证专用对照参数：`displacementScale=70`、`blurAmount=0`、`saturation=140`、`aberrationIntensity=2`、`mode="standard"`、`overLight=false`、`elasticity=0`。官方实现计算为 `blur(4px) saturate(140%)`，首个位移 scale 保持 `70`，`.glass` 使用 `0 12px 40px rgba(0, 0, 0, 0.25)` 默认阴影。第三方默认 `cornerRadius=999` 和默认内边距不适用于大表单，必须继续由项目几何规则覆盖：桌面／移动分别保持 `24px`／`40px` 圆角，真实内容保持 `32px`／`20px` 留白，第三方 `padding` 固定为 `0`。状态栏和移动底栏继续使用 `70 / 0 / 140 / 2 / overLight=true` Chrome 参数，不得因认证卡片同步而改变。

所有 `LiquidGlassSurface` 预设必须使用静态输入：`mouseContainer={null}`，并传入固定的 `globalMousePos` 与 `mouseOffset`。桌面和移动认证卡片不得开启鼠标、触控板、触笔或触摸跟踪；指针进入或移动时，玻璃宿主、效果层和边缘高光不得发生跟随形变。该规则同样适用于桌面状态栏、管理员桌面工作栏、移动状态栏和移动底栏。

认证卡片的外层宽度、桌面／移动对齐、圆角和内容留白继续由 `src/styles/auth.css` 负责；液态玻璃参数、回退底色、状态栏单层结构描边、认证卡片无项目结构描边、上游装饰显隐和阴影只归 `src/styles/liquid-glass-surfaces.css`。认证卡片使用 `overLight=false`，状态栏、管理员工作栏和移动底栏继续使用 `overLight=true`。支持 `backdrop-filter` 时认证宿主背景必须透明，且不得绘制项目宿主阴影，悬浮阴影完全使用第三方 `.glass` 在 `overLight=false` 下生成的官方默认值；`--liquid-glass-contrast: rgba(194, 231, 214, 0.06)` 只供状态栏与导航的低密度支持染色使用。不得再创建 `--liquid-glass-tint-dark`、`.liquid-glass-surface__material-fill` 或认证专用支持环境染色变量。不支持 `backdrop-filter` 时认证宿主改用 `--liquid-glass-auth-fallback`。不得在 `auth.css` 手写另一套 `backdrop-filter`、玻璃渐变、材质描边或 `.login-card.panel` 映射。输入框继续使用不透明深色控件与自动填充覆盖，确保密码、验证码、错误和提示文字保持稳定对比度。

认证卡片不得绘制项目 `::after` 结构描边或额外大圆角白色外框；`liquid-glass-react` Fragment 直属输出的两个边缘高光 `span` 必须可见，并保持固定静态方向，成为认证卡片唯一亮边来源。两个边缘高光 `span` 必须直接使用宿主的 `100%` 宽高、`inset: 0` 与未变换坐标；`overLight=false` 对应的两个辅助 `div` 也必须采用同一宿主几何，但不得产生可见黑色绘制，其 `padding` 必须为 `0` 且 `mask-image` 必须为 `none`。认证宿主背景与宿主阴影必须透明／关闭，第三方 `.glass` 的官方 `0 12px 40px rgba(0, 0, 0, 0.25)` 阴影不得被项目 CSS 覆盖。认证效果层和 `.glass` 的可见几何同样必须直接填满宿主；不得保留第三方尺寸过渡，登录→注册→登录时边框底部必须与宿主底部在首个绘制帧内同步。上游 `glassSize` 与窗口 resize 通知只负责随后补齐 SVG 滤镜内部尺寸，不得继续控制可见边框位置。统一适配层派发尺寸通知前必须在同一同步任务内给直属 `.liquid-glass-surface__effect` 设置 `data-liquid-glass-measuring="true"` 中性测量态，以 `translate(-50%, -50%) scale(1)` 排除第三方视觉 transform 对几何读取的影响，派发后立即清除；该状态不得跨帧或形成可见闪烁。该规则不移除输入框、按钮、登录／注册模式切换器的控件边框，也不移除键盘 `:focus-visible` 焦点反馈。

移动端只有认证卡片保留圆角玻璃背景；不得把整个移动登录页恢复为单张外层面板，也不得为注册表单创建内部滚动区。注册内容较高时由文档视口纵向滚动，两层背景保持固定，页面不得产生横向溢出。

`SignedInShell` 只负责侧栏、页面 Overlay、Chrome Overlay 和唯一页面滚动区，不再拥有背景插槽。移动端 `.mobile-page-overlay` 必须继续先于 `.mobile-chrome-overlay` 绘制，二者及 `.workspace` 不得因为背景改造增加正 `z-index` 或新的隔离层；状态栏、管理员工作栏和底栏到根级摄影与氛围层之间必须继续保持开放的 `backdrop-filter` 采样链。统一账号检查、代码包加载、玩家连接／错误／重试、账号封禁、管理员无权限和客户端致命错误只改变根级数据属性，避免进入、刷新、异常或权限切换时闪现纯色页面。

背景图片和氛围层唯一归属 `src/styles/financial-backdrop.css`；该文件同时负责三种根级氛围、critical 暗角和根级状态外壳几何；认证内容层、品牌区和认证卡片几何仍由 `src/styles/auth.css` 收束；统一认证卡片材质归 `src/styles/liquid-glass-surfaces.css`；登录后侧栏、工作区、滚动区、状态栏和移动导航几何继续归 `viewport.css`、`game-shell-layout.css` 与 `LIQUID_GLASS_CHROME_DESIGN.md`。生产样式入口必须在 `game-shell-layout.css` 后、`liquid-glass-surfaces.css` 前加载 `financial-backdrop.css`；更晚加载的认证或管理员业务样式不得用不透明根背景遮盖摄影层。认证最终样式顺序继续固定为 `design-system.css → interaction-states.css → primary-surfaces.css → auth.css → registration-auth.css → form-controls.css`。

摄影资源地址只能存在于 `src/config/visualAssets.ts`，不得重新散落到 `LoginPage.tsx`、`GameShell.tsx`、`AdminApp.tsx`、状态外壳、CSS 或业务页面。替换摄影作品时必须保留交易大厅主题、权利来源记录、响应式版本、空替代文本、失败回退和共享三层结构。

## 3. 防回退

不得移除注册邀请码输入框，不得让分享链接只在后台隐式归因而不预填输入框，不得在设置页、商店或其他已登录页面恢复邀请码输入、补填、更换或重新绑定入口，也不得根据玩家档案创建时间重新开放 24 小时或其他临时补填窗口。

`scripts/verify-auth-three-layer.mjs` 必须校验认证三层 DOM、根级唯一摄影组件、`AuthCardSurface`、认证专用对照参数、全预设 `elasticity=0`、静态鼠标输入、官方双层高光、中性测量态、不受 transform 污染的内容高度、内容位于 `.glass` 内、认证透明宿主、不可见辅助黑层与 `.glass` 默认阴影、认证卡片无项目结构描边、内容自适应、移动氛围透明度、图片来源配置、认证层级样式、最终 CSS 加载顺序和浏览器回归入口；`scripts/verify-liquid-glass-chrome.mjs` 必须同时校验登录后 Chrome 与认证卡片的唯一依赖入口、各自参数、零弹性、无指针跟踪、官方高光、内容自适应、状态栏单层描边、认证透明宿主、认证辅助层不可见、官方 `.glass` 默认阴影和回退材质；`scripts/verify-game-three-layer.mjs` 必须校验整个生产入口只能挂载一个摄影节点、`SignedInShell` 不存在背景插槽、三种氛围变体、根级加载／封禁／无权限／错误状态、全局网格关闭、移动 Overlay 顺序、图片失败回退和浏览器回归入口。`tests/browser/auth-three-layer.spec.ts` 必须覆盖 `1440 × 900` 桌面、`390 × 844` 移动注册模式、移动氛围渐变／网格／噪点计算值、认证内容位于 `.glass` 内、配置位移尺度 70、`blur(4px) saturate(140%)`、首个位移 scale 70、两个辅助黑层不可见、透明认证宿主、官方 `.glass` 默认阴影、`data-liquid-glass-elasticity="0"`、鼠标移动后效果层变换与高光方向保持不变、两层高光可见、认证伪元素不生成项目外框、无 `material-fill`、表单值保持，以及登录→注册→登录和 `721px`／`720px` 双向切换；`tests/browser/liquid-glass-reference.spec.ts` 必须让官方组件和项目认证表面共享同一个 Backdrop Root，使用项目生产 `FinancialBackdrop` 摄影图片与氛围层，保持项目认证氛围渐变、网格、噪点和图片滤镜不变，并使用相同的 `440 × 352px` 卡片尺寸、内容、`70 / 0 / 140 / 2 / 0 / 24 / standard / overLight=false` 参数与固定 `{0,0}` 鼠标输入，验证辅助黑色图层透明、宿主透明、官方默认阴影、`blur(4px) saturate(140%)` 和实际几何一致，不得把背景或几何差异误判为参数差异。`tests/browser/game-three-layer.spec.ts` 必须覆盖玩家桌面、移动和图片加载失败回退；`tests/browser/application-photography.spec.ts` 必须用 DOM 标记验证账号检查切换到认证后仍是同一图片节点，并覆盖管理员、封禁、无权限与摄影失败回退。不得把背景选择器移入 `globals.css`，不得通过 `card-system.css` 恢复登录外壳或认证卡片几何映射，不得改变登录、注册或游戏业务流程来适配视觉布局；管理员业务流程同样不得为摄影背景调整。
