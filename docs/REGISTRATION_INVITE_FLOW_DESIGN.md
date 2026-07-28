# Economy 注册邀请码与共享金融背景设计

> 状态：当前权威设计  
> 更新时间：2026-07-28

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

## 2. 登录、注册与玩家游戏共享三层视觉

登录／注册入口和玩家游戏页面固定复用 `src/components/visual/FinancialBackdrop.tsx`，并由 `src/config/visualAssets.ts` 统一保存摄影资源地址。摄影作品仍为 Carol M. Highsmith 拍摄的纽约证券交易所交易大厅，来源于美国国会图书馆 Highsmith 档案，权利说明为无已知发表限制。图片只表达环境，使用空替代文本并从无障碍树隐藏；图片请求失败时必须隐藏破图元素，由深色氛围层继续提供完整可读背景。

共享背景严格分为三个视觉层级：

1. 图片层是全视口固定摄影背景，统一使用响应式 `<picture>`、`object-fit: cover` 和装饰性空替代文本。登录入口保留 `login-image-layer`，玩家游戏保留 `game-image-layer`；登录首屏使用高优先级加载，游戏页使用普通优先级并复用浏览器已下载资源。
2. 氛围层承载深色渐变、绿色光晕、细网格、噪点和暗角。登录入口保留 `login-atmosphere-layer`，玩家游戏保留 `game-atmosphere-layer`。玩家游戏变体必须比登录变体更暗，确保状态数值、订单簿、表格、表单和卡片保持稳定对比度。`html[data-app-surface="auth"|"game"] body::before` 必须关闭，网格只能存在于氛围层，避免形成第四个全局背景层。桌面登录氛围保持原有横向明暗分布；移动登录氛围层必须比原基线更透明，纵向主遮罩固定使用 `rgba(1, 7, 4, 0.62)`、`rgba(2, 10, 6, 0.6)`、`rgba(2, 8, 5, 0.82)`，网格与噪点透明度分别为 `0.12` 和 `0.05`，不得恢复 `0.78`／`0.76`／`0.93` 的过暗遮罩。
3. 内容层由现有认证内容或登录后游戏外壳承担。登录入口继续使用 `login-content-layer` 的桌面双列和移动单列；玩家游戏继续由 `SignedInShell` 承载桌面侧栏、唯一页面 `ScrollArea`、状态栏和移动导航，不得为三层背景重建页面外壳或增加第二个主滚动容器。

认证卡片必须使用 `src/components/auth/AuthCardSurface.tsx` 包装，并通过统一 `LiquidGlassSurface` 的 `desktopAuthCard`／`mobileAuthCard` 预设渲染。认证卡片任一时刻只能存在一个玻璃实例，`720px` 断点只允许在原位置切换预设，不得同时挂载桌面和移动卡片后用 CSS 隐藏。认证卡片继续使用 `layout="content"` 的自然内容高度，但真实登录／注册内容必须与状态栏相同，位于第三方 `.glass` 内的 `.liquid-glass-surface__content`，不得再作为玻璃效果外部的兄弟层。统一适配层使用单个 `ResizeObserver` 同时观察真实认证内容和认证宿主：内容高度只能读取不受弹性 transform 影响的 `scrollHeight`／`offsetHeight`，内容变化先更新宿主高度，宿主真实宽高提交后才通过窗口 resize 通知上游玻璃更新几何；不得读取认证内容的 `getBoundingClientRect()` 作为高度权威，不得在 `setContentHeight` 同一时序提前通知，也不得通过 revision 或 React `key` 重建认证内容。登录、注册、邀请码、验证码、错误与状态提示变化以及 `720px` 断点切换都不得清空原生未受控表单值。

认证卡片的光学与运动参数固定使用 `liquid-glass-react@1.1.1` 官方默认值：`displacementScale=70`、`blurAmount=0.0625`、`saturation=140`、`aberrationIntensity=2`、`elasticity=0.15`、`mode="standard"`。官方默认 `cornerRadius=999` 和默认内边距不适用于大表单，必须继续由项目几何规则覆盖：桌面／移动分别保持 `24px`／`40px` 圆角，真实内容保持 `32px`／`20px` 留白，第三方 `padding` 固定为 `0`。认证玻璃不得再降回低位移、低色差或 `elasticity=0` 的静态毛玻璃配置。

认证液体运动必须使用官方 `mouseContainer` 接口绑定当前认证宿主；认证预设不得继续传入固定的 `globalMousePos`／`mouseOffset`，否则会关闭第三方内部鼠标追踪。状态栏和移动底栏可以继续保持静态鼠标输入与零弹性，不得因为认证运动改造而改变其交互行为。

认证卡片的外层宽度、桌面／移动对齐、圆角和内容留白继续由 `src/styles/auth.css` 负责；液态玻璃参数、回退底色、状态栏单层结构描边、认证卡片无项目结构描边、上游装饰显隐和阴影只归 `src/styles/liquid-glass-surfaces.css`。认证卡片与桌面／移动状态栏统一把低密度透明染色放在 `.liquid-glass-surface` 宿主，并统一使用 `--liquid-glass-contrast`；不得再创建 `.liquid-glass-surface__material-fill` 或认证专用支持环境染色变量。不支持 `backdrop-filter` 时认证宿主改用 `--liquid-glass-auth-fallback`。不得在 `auth.css` 手写另一套 `backdrop-filter`、玻璃渐变、材质描边或 `.login-card.panel` 映射。输入框继续使用不透明深色控件与自动填充覆盖，确保密码、验证码、错误和提示文字保持稳定对比度。

认证卡片不得绘制项目 `::after` 结构描边或额外大圆角白色外框；`liquid-glass-react` Fragment 直属输出的两个边缘高光 `span` 必须可见并随内部 `mouseOffset` 更新渐变方向，成为认证卡片唯一亮边来源。`overLight=false` 对应的直属辅助黑色 `div` 继续隐藏，避免叠加无意义暗层。上游库在窗口 resize 时会读取带弹性 transform 的效果层视觉矩形，因此统一适配层派发尺寸通知前必须在同一同步任务内给直属 `.liquid-glass-surface__effect` 设置 `data-liquid-glass-measuring="true"` 中性测量态，以 `translate(-50%, -50%) scale(1)` 暂时移除弹性变换，派发后立即清除；该状态不得跨帧或形成可见闪烁。官方高光必须与宿主、效果层、`.glass` 和 SVG 滤镜保持同一未变换布局宽高，登录→注册→登录和 `721px`／`720px` 双向切换都不得保留旧尺寸。该规则不移除输入框、按钮、登录／注册模式切换器的控件边框，也不移除键盘 `:focus-visible` 焦点反馈。

移动端只有认证卡片保留圆角玻璃背景；不得把整个移动登录页恢复为单张外层面板，也不得为注册表单创建内部滚动区。注册内容较高时由文档视口纵向滚动，两层背景保持固定，页面不得产生横向溢出。

玩家游戏背景通过 `SignedInShell` 的可选 `backdrop` 插槽在侧栏之前渲染。管理员页面不得传入玩家摄影背景。移动端 `.mobile-page-overlay` 必须继续先于 `.mobile-chrome-overlay` 绘制，二者及 `.workspace` 不得因为背景改造增加正 `z-index` 或新的隔离层；状态栏和底栏到页面背景之间必须继续保持开放的 `backdrop-filter` 采样链。玩家加载、连接错误和重试状态也必须使用相同游戏背景，避免登录切换或刷新时闪现纯色页面。

背景图片和氛围层唯一归属 `src/styles/financial-backdrop.css`；认证内容层、品牌区和认证卡片几何仍由 `src/styles/auth.css` 收束；统一认证卡片材质归 `src/styles/liquid-glass-surfaces.css`；登录后侧栏、工作区、滚动区、状态栏和移动导航几何继续归 `viewport.css`、`game-shell-layout.css` 与 `LIQUID_GLASS_CHROME_DESIGN.md`。生产样式入口必须在 `game-shell-layout.css` 后、`liquid-glass-surfaces.css` 前加载 `financial-backdrop.css`；认证最终样式顺序继续固定为 `design-system.css → interaction-states.css → primary-surfaces.css → auth.css → registration-auth.css → form-controls.css`。

摄影资源地址只能存在于 `src/config/visualAssets.ts`，不得重新散落到 `LoginPage.tsx`、`GameShell.tsx`、CSS 或业务页面。替换摄影作品时必须保留交易大厅主题、权利来源记录、响应式版本、空替代文本、失败回退和共享三层结构。

## 3. 防回退

不得移除注册邀请码输入框，不得让分享链接只在后台隐式归因而不预填输入框，不得在设置页、商店或其他已登录页面恢复邀请码输入、补填、更换或重新绑定入口，也不得根据玩家档案创建时间重新开放 24 小时或其他临时补填窗口。

`scripts/verify-auth-three-layer.mjs` 必须校验认证三层 DOM、共享背景组件、`AuthCardSurface`、认证玻璃官方默认光学参数、`mouseContainer` 运动、官方双层高光、中性测量态、不受 transform 污染的内容高度、内容位于 `.glass` 内、状态栏同源宿主染色、认证卡片无项目结构描边、内容自适应、移动氛围透明度、图片来源配置、认证层级样式、最终 CSS 加载顺序和浏览器回归入口；`scripts/verify-liquid-glass-chrome.mjs` 必须同时校验登录后 Chrome 与认证卡片的唯一依赖入口、平台预设、认证官方默认值、认证运动、官方高光、内容自适应、状态栏单层描边、同源宿主染色和回退材质；`scripts/verify-game-three-layer.mjs` 必须校验玩家背景插槽、图片与氛围层、加载／错误状态、管理员隔离、全局网格关闭、移动 Overlay 顺序和游戏浏览器回归入口。`tests/browser/auth-three-layer.spec.ts` 必须覆盖 `1440 × 900` 桌面、`390 × 844` 移动注册模式、移动氛围渐变／网格／噪点计算值、认证内容位于 `.glass` 内、官方位移尺度 70、`blur(6px) saturate(140%)`、鼠标移动后的变换变化、两层高光可见、认证伪元素不生成项目外框、无 `material-fill`、表单值保持，以及登录→注册→登录和 `721px`／`720px` 双向切换；`tests/browser/game-three-layer.spec.ts` 必须覆盖桌面、移动和图片加载失败回退。不得把背景选择器移入 `globals.css`，不得通过 `card-system.css` 恢复登录外壳或认证卡片几何映射，不得改变登录、注册或游戏业务流程来适配视觉布局。
