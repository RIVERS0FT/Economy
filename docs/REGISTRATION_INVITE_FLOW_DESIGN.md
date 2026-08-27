# Economy 注册邀请码与共享金融背景设计

> 状态：当前权威设计  
> 更新时间：2026-08-27


全应用氛围基线：认证、注册、九个玩家页面、管理员后台以及根级加载／异常状态继续保留 `auth`、`game`、`admin` 语义变体，但三者必须共享登录／注册页当前的摄影滤镜、渐变遮罩、网格和噪点参数；页面或角色不得再覆盖这些参数。正常态摄影图片只作为低对比度空间纹理，第一视觉层必须是状态栏、导航、业务卡片和正文；不得通过降低共享遮罩、增强绿光、网格或噪点，使人物、窗框或建筑轮廓与业务内容争夺注意力。仅 `data-app-tone="critical"` 允许叠加红色内暗角，且不得改变共享基线。

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

## 2. 登录、注册、玩家游戏、管理员后台与根级状态共享四层根结构

原有登录／注册“摄影、氛围、认证内容”三类可见视觉职责继续成立；全应用 DOM 统一纳入图片、氛围、地图、UI 四层根堆叠，并扩展到玩家游戏、管理员后台与根级状态。

登录／注册入口、九个玩家页面、管理员五个分区及根级加载／封禁／无权限／致命错误状态固定复用 `src/components/visual/FinancialBackdrop.tsx`，并由 `src/config/visualAssets.ts` 统一保存摄影资源地址。摄影作品仍为 Carol M. Highsmith 拍摄的纽约证券交易所交易大厅，来源于美国国会图书馆 Highsmith 档案，权利说明为无已知发表限制。图片只表达环境，使用空替代文本并从无障碍树隐藏；图片请求失败时必须隐藏破图元素，由深色氛围层继续提供完整可读背景。

整个应用生命周期只允许一个摄影 `<picture>` 节点。`main.tsx` 在 `React.StrictMode` 与 `AppErrorBoundary` 外部固定挂载 `ApplicationLayerRoot`，摄影节点由该根组件内的 `FinancialBackdrop` 以 `loading="eager"`、`fetchPriority="high"` 首次加载；账号检查、认证、代码包加载、玩家连接、正式游戏、管理员后台、封禁、无权限和致命错误之间切换时不得卸载或重新创建四层宿主或摄影节点。不得在 `LoginPage`、`ApplicationLoadingState`、`GameErrorStateShell`、`GameShell`、`AdminApp` 或 `PhotographicStateShell` 中重新挂载 `FinancialBackdrop`，也不得重新提供页面级背景插槽。

全应用根节点严格分为四个层级：

1. 图片层由根级 `.application-image-layer` 承载，统一使用响应式 `<picture>`、`object-fit: cover` 和装饰性空替代文本。桌面使用原图，移动端通过 `<source media="(max-width: 720px)">` 使用 `960px` 版本。页面、管理员分区、弹窗、详情抽屉、页内空状态和根级状态切换只复用同一图片 DOM 节点；浏览器缓存、解码结果和合成表面不得因为业务页面切换而失效。
2. 氛围层由根级 `.application-atmosphere-layer` 承载。`data-app-backdrop` 只保留认证／玩家／管理员语义和状态路由职责，`data-app-tone` 只负责普通或 critical 警示暗角；对应选择器为 `html[data-app-backdrop="auth"|"game"|"admin"]` 与 `html[data-app-tone="normal"|"critical"]`。认证、九个玩家页面、管理员五个分区及根级普通状态必须使用完全相同的正常态视觉参数，并以登录／注册页当前样式为唯一基线：桌面图片滤镜固定为 `saturate(0.72) contrast(1.08) brightness(0.72)`，桌面渐变固定使用两处低强度绿光 `0.10 / 0.06` 与横向主遮罩 `0.96 / 0.90 / 0.84 / 0.90`，网格与噪点透明度固定为 `0.16` 和 `0.045`；移动图片滤镜固定为 `saturate(0.68) contrast(1.08) brightness(0.62)`，顶部低强度绿光固定为 `0.09`，纵向主遮罩固定使用 `rgba(1, 7, 4, 0.78)`、`rgba(2, 10, 6, 0.76)`、`rgba(2, 8, 5, 0.90)`，网格与噪点透明度固定为 `0.08` 和 `0.03`。`auth`、`game`、`admin` 不得再拥有角色级或页面级图片滤镜、渐变、网格或噪点覆盖；仅 `html[data-app-tone="critical"]` 可以在共享基线之上增加红色内暗角，且不得改变共享参数。`html[data-app-surface="auth"|"game"|"admin"|"loading"|"banned"|"error"] body::before` 必须关闭，网格只能存在于氛围层，避免形成额外全局网格层。封禁、无权限和致命错误不得替换为纯色页面或另一张图片。
3. 地图层由根级 `.application-map-layer` 承载。认证、管理员和根级状态下保持空且不拦截指针；玩家游戏只允许通过 `ApplicationMapLayerPortal` 挂载唯一战略地图，不得把认证内容或业务卡片放入该层。
4. UI 层由根级 `.application-ui-layer` 承载，其内部唯一 `.application-content-root` 继续承载现有认证内容、登录后共享外壳或根级状态外壳。图片、氛围、地图和 UI 必须是同一个 `#root` 隔离根的直接子层，并固定使用 `z-index: 0 / 10 / 20 / 30`；`.application-content-root` 及其认证或登录后外壳全链保持 `z-index:auto`、`isolation:auto`、`filter:none` 与 `transform:none`，不得建立额外 stacking context，也不得按 `data-app-surface` 恢复状态专属层级。登录入口继续使用 `login-content-layer` 的桌面双列和移动单列；玩家游戏与管理员后台继续由 `SignedInShell` 承载桌面侧栏、唯一页面 `ScrollArea`、工作栏和移动导航；统一账号服务连接、正式代码包加载、本地免登录预览代码包加载与权威游戏服务器连接统一由 `ApplicationLoadingState` 承载同一全屏居中加载结构，只允许替换中文文字，不得恢复深色加载卡片或创建平行加载样式；游戏状态加载失败由 `GameErrorStateShell` 使用同一基础布局承载错误内容。封禁、无权限和致命错误仍由 `PhotographicStateShell` 承载单一可滚动状态卡。不得增加第五个全局层、第二个主滚动容器或把整个页面恢复成不透明纯色面板。

认证卡片必须使用 `src/components/auth/AuthCardSurface.tsx` 包装，并通过唯一 `FrostedGlassSurface` 的 `authCard` 变体渲染。任一时刻只能存在一个 `.frosted-glass-surface`，桌面与移动只通过 CSS 改变圆角和内容留白，不并行挂载两套卡片。认证内容位于 `.frosted-glass-surface__content`，使用普通文档流自然增高；不得恢复组件测高状态、`useLayoutEffect` 测量、`ResizeObserver`、`MutationObserver`、revision 或 React `key` 重建。登录／注册和断点切换不得清空原生未受控表单值。

认证卡片、玩家状态栏、管理员工作栏和移动底栏统一使用纯 CSS 毛玻璃令牌：半透明深色背景、`blur(18px) saturate(128%)`、柔和边界、静态高光和阴影。桌面认证卡圆角保持 `24px`，移动保持 `40px`；真实内容留白保持 `32px`／`20px`。

认证卡片不得包含鼠标、触控板、触笔或触摸跟踪逻辑；指针进入或移动时毛玻璃背景和高光方向保持静态。该规则同样适用于桌面状态栏、管理员工作栏、移动状态栏和移动底栏。

认证卡片外层宽度、桌面／移动对齐和内容留白继续由 `src/styles/auth.css` 负责；统一材质与回退只归 `src/styles/frosted-glass-surfaces.css`。`auth.css` 不得复制另一套 `backdrop-filter` 或把 `.login-card` 恢复为 `.panel`。输入框继续使用不透明深色控件与自动填充覆盖，确保密码、验证码、错误和提示文字稳定可读。

认证服务错误条 `.auth-service-warning` 固定使用三列内部网格 `44px minmax(0, 1fr) 44px`：中间列承载可换行错误文案，右列承载唯一 `RefreshPageButton`，左列保留等宽空轨以保证文案相对整条警示真正居中。文案与刷新控件必须垂直居中，移动端不得退化为基线对齐的行内排列，也不得让长错误文本挤压或覆盖 `44px × 44px` 刷新触控目标。浏览器或客户端取消错误不得原样向玩家暴露 `AbortError`、`signal is aborted without reason` 等实现细节，统一转换为可操作的中文恢复提示。

登录成功后的 `POST /economy-api/game/session` 是认证启动初始化，不是玩家主动经济动作。已有 Economy 玩家且永久邀请码元数据完整时必须走只读快速路径，不进入权威写队列、不加载世界状态，也不得等待五分钟世界调度 barrier；仅缺失永久邀请码时通过 `system:session-metadata:*` 串行补齐注册元数据，同样不得触发世界调度。只有第一次真正创建 Economy 玩家档案、绑定首次邀请码或发放邀请奖励时才使用普通 `user:*` 世界写语义。会话请求继续经过统一幂等协调并保留同一逻辑操作的 `Idempotency-Key`，但不叠加普通经济写动作的 12 秒客户端 Abort，仍受部署层 `proxy_read_timeout 30s` 有限上限约束。统一账号登录已经成功后，session 的网络错误、408、429 或 5xx 只能进入“无法连接游戏服务器”的重新连接状态并保留当前认证用户；重新连接只重试 session，不得重新提交邮箱和密码。只有 session 明确返回 401 才允许清除认证用户并返回登录表单。普通经济写动作的 12 秒单次尝试规则保持不变。

认证卡片、玩家状态栏、管理员工作栏和移动底栏只允许共享毛玻璃宿主的一像素柔和边界与 `::before` 静态高光，不得追加大圆角白框、SVG 位移滤镜、辅助黑层或尺寸通知。登录→注册→登录时宿主随普通内容流同步增减高度。输入框、按钮、模式切换器和键盘 `:focus-visible` 继续保留各自控件边界。

移动端只有认证卡片保留圆角玻璃背景；不得把整个移动登录页恢复为单张外层面板，也不得为注册表单创建内部滚动区。注册内容较高时由文档视口纵向滚动，两层背景保持固定，页面不得产生横向溢出。

`SignedInShell` 只负责侧栏、页面 Overlay、Chrome Overlay 和唯一页面滚动区，不再拥有背景或地图插槽。`#root` 是认证、玩家和管理员共同的唯一全应用隔离根；`.application-map-layer`、`.application-ui-layer`、`.application-content-root`、`.signed-in-shell`、`.game-shell`、`.admin-shell`、`.workspace`、两层移动 Overlay 与页面主滚动区在桌面和移动端都必须保持 `isolation:auto`、`filter:none` 与 `transform:none`。移动端 `.mobile-page-overlay` 必须继续先于 `.mobile-chrome-overlay` 绘制；状态栏、管理员工作栏和底栏到根级地图、摄影与氛围层之间必须继续保持开放的 `backdrop-filter` 采样链。只有不包围 Chrome 的页面局部业务子树可以建立隔离，不得用用途专用染色或第二份氛围层掩盖采样失败。统一账号检查、代码包加载、玩家连接／错误／重试、账号封禁、管理员无权限和客户端致命错误只改变根级数据属性，避免进入、刷新、异常或权限切换时闪现纯色页面。

背景图片和氛围层唯一归属 `src/styles/financial-backdrop.css`；认证内容层、品牌区和认证卡片几何由 `src/styles/auth.css` 收束；统一认证卡片材质归 `src/styles/frosted-glass-surfaces.css`。生产样式入口必须在 `game-shell-layout.css` 后加载背景与毛玻璃样式，更晚加载的业务样式不得用不透明根背景遮盖摄影层。认证最终样式顺序继续固定为 `design-system.css → interaction-states.css → primary-surfaces.css → auth.css → registration-auth.css → form-controls.css`。

摄影资源地址只能存在于 `src/config/visualAssets.ts`，不得重新散落到 `LoginPage.tsx`、`GameShell.tsx`、`AdminApp.tsx`、状态外壳、CSS 或业务页面。替换摄影作品时必须保留交易大厅主题、权利来源记录、响应式版本、空替代文本、失败回退和共享四层根结构。

## 3. 防回退

不得移除注册邀请码输入框，不得让分享链接只在后台隐式归因而不预填输入框，不得在设置页、商店或其他已登录页面恢复邀请码输入、补填、更换或重新绑定入口，也不得根据玩家档案创建时间重新开放 24 小时或其他临时补填窗口。不得把认证服务错误条恢复为文本与刷新图标的行内基线排列，不得移除对称三列以让刷新控件挤偏错误文案，不得向玩家重新显示 `AbortError` 或 `signal is aborted without reason`。不得把 `/economy-api/game/session` 重新纳入普通经济写动作的 12 秒客户端 Abort 定时器；该例外只作用于认证启动初始化，不得扩大到其他玩家、合同或管理员经济写动作。

`scripts/verify-auth-three-layer.mjs` 必须校验认证三层 DOM、根级唯一摄影组件、`AuthCardSurface`、唯一 `FrostedGlassSurface`、自然内容高度、移动圆角、表单值跨模式与断点保持、认证服务错误条三列内部布局、Abort 文案归一化、无旧 Liquid Glass DOM 和最终 CSS 加载顺序。`scripts/verify-liquid-glass-chrome.mjs` 的历史路径继续验证第三方依赖删除、纯 CSS 毛玻璃令牌、共享宿主和回退材质。`scripts/verify-open-glass-sampling.mjs` 与 `tests/browser/open-glass-sampling.spec.ts` 必须覆盖桌面玩家、桌面管理员、移动玩家和移动管理员四种根级采样链及真实 `blur(18px) saturate(128%)`；`tests/browser/application-photography.spec.ts` 验证唯一摄影节点跨加载、认证、玩家、管理员和异常状态保持。`tests/browser/auth-three-layer.spec.ts` 必须覆盖 `1440×900` 桌面、`390×844` 移动注册、单一宿主、自然增高、无内部滚动和表单值保持；`tests/browser/application-error-state.spec.ts` 必须覆盖认证会话 Abort 被转换为中文恢复提示以及移动错误条文案真正居中、刷新控件保持 `44px × 44px` 且不重叠。不得改变登录、注册或游戏业务流程来适配视觉布局。
