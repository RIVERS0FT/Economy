# Economy 战略地图渲染设计

> 状态：当前有效
> 适用项目：`RIVERS0FT/Economy`

## 1. 唯一职责

本文是战略地图 **Camera、SVG 世界面、active 临时栅格快照、州名清晰度、地图路线视觉／运动、高亮、地图专属浮动控件材质和地图渲染性能** 的唯一权威 DESIGN。

本文不负责运输经济费用、耗时、载荷和结算，这些归 `WAREHOUSE_EXPANSION_DESIGN.md`；不负责公路／铁路原始 GIS 数据和离线首府路网快照生成，这些归 `TRANSPORT_NETWORK_GEOMETRY_DESIGN.md`；不负责全应用颜色、字体、普通按钮和 Tooltip 通用视觉，这些归 `UI_DESIGN_SYSTEM.md`；不负责四层根节点、普通页面 Workspace、状态栏和其他应用 Chrome 材质，这些归 `LIQUID_GLASS_CHROME_DESIGN.md`。

旧文档中与本文职责重叠的战略地图 Camera、运输路线并排、航空直线、地图镜头栏／选路面板毛玻璃规则不再具有权威性；后续修改必须以本文为准，不得依据旧段落恢复被本文明确禁止的实现。

## 2. 静态世界面与 active 栅格快照

- 战略地图只保留一个权威 `.province-map-world-svg`。世界大陆、美国连续 48 州、中文州名、运输路线和在途标记都位于这一个 SVG 世界坐标系中；不得创建第二个 SVG 世界或第二套投影。
- 世界背景的土地填充使用 `world-atlas@2.0.2` 的 Natural Earth 1:10m countries 数据，经确定性生成器 dissolve 北美上下文国家、裁剪未引用 arc 后形成运行时 TopoJSON；低对比海岸主线和外侧层次描边使用同一版本、同一国家集合按相同步骤派生的 1:110m TopoJSON。美国本土经营层和覆盖世界背景的最终美国外轮廓继续使用 `us-atlas@3.0.1` 的 1:10m 州界，不降低交互区域的边界精度。
- `non-obvious reason`：复杂 SVG 的 `viewBox` 或 transform 变化可能触发矢量重栅格化；合成提示本身不保证消除这种工作。因此根 `viewBox` 只作为 **settled Camera 的矢量权威状态**，active 热路径使用由同一 SVG 派生的栅格快照，不依赖每帧重新绘制复杂 SVG。具体瓶颈必须按第 11 节的当前 trace 与受控对照确认，不能仅凭实现结构或录制下的总耗时归因。
- 两条世界背景描边各自必须保持低于 `2,000` 个 `M/L` 顶点和 `30,000` 个 path 字符；完整 atlas、预展开浮点 GeoJSON 和超出预算的描边不得进入玩家运行时。
- `.province-map-camera-raster` 是唯一允许存在的 active 临时栅格层。它必须位于同一个 `.province-map-camera-surface` 内、与权威 SVG 同尺寸，是不接收输入的 Canvas，只缓存**由当前权威 SVG 派生的完整世界快照**；不得拥有 center、zoom、world bounds、投影、路线几何或独立时间状态，不得响应点击／拖动／滚轮，也不得成为第二套 Camera。
- 栅格快照只能在 idle／settled 阶段、标签布局完成后或真实内容／容器变化后异步生成；生成过程不得位于 Camera RAF、pointermove、wheel burst 或运输 `500ms` 叶子时钟热路径内。快照使用固定 preload world viewBox，像素倍率限制在 `1–2× devicePixelRatio` 范围，不根据逻辑 zoom 扩大纹理尺寸。
- 异步快照在发起和完成两个阶段都必须检查 Camera 是否 idle，并使用 generation 拒绝过期结果。`non-obvious reason`：请求时 idle 不代表解码完成时仍 idle；迟到结果不得在 active 中修改 Canvas 像素尺寸、绘制内容、ready、revision 或切换当前 fallback 承载层。手势期间的内容变化或解码完成只标记合并后的待刷新任务，旧结果仍须释放；观察既有 `data-map-zoom-active` 的 idle 边界后，从最新权威 SVG 重新生成一次。排队后再次进入 active 时继续延后，不得用逐帧轮询、额外输入监听或第二 Camera 实现。组件清理必须断开边界观察、取消排队的刷新 RAF、使旧 generation 失效；所有已解码资源均须在 `finally` 中释放，包括绘制异常和过期结果。
- 栅格快照必须继承当前 SVG 的计算后填充、描边、字体和标签布局；其中非交互世界土地允许直接采用现有 1:110m active LOD 填充。48 州经营面、州名、路线和最终美国轮廓仍来源于同一权威 SVG，不得为快照建立第二份业务几何模型。
- SVG Blob 解码优先使用 `createImageBitmap`，但浏览器拒绝 SVG Blob 解码时必须自动回退到 `Image` + `decode()`；不得因为存在 `createImageBitmap` 就让其失败直接终止整次快照生成。Blob URL 必须保留到图片完成解码、绘制并释放后才 revoke，避免提前销毁导致 `snapshot-failed`。
- `us-atlas` 州 path、世界大陆 path、中文州名基础布局、公路／铁路投影折线在模块初始化或真实容器尺寸变化之外不得重新生成。手势期间所有州 path `d`、世界 path `d`、州名基础中心和 glyph `transform` 必须保持不变。
- `.province-map-camera-surface` 是唯一世界宿主，但在 **raster-ready 正式 active 路径中必须保持 `transform:none / will-change:auto`**；只有 `.province-map-camera-raster` 接收瞬时合成 transform。Canvas idle／settled 必须恢复 `transform:none / will-change:auto / opacity:0`，不得把完整世界长期显示为可缩放纹理。
- raster-ready active 时，权威 SVG 必须继续挂载并保持最后一次 settled `viewBox`，仅临时 `opacity:0`；不得改为 `display:none`、不得切换到 preload viewBox。这样几何、可访问 DOM 和测试探针仍由同一个权威 SVG 提供，同时浏览器不再把复杂 SVG 放进 active transform 合成链。
- 根 SVG 继续承担 settled 状态的物理视口裁剪；屏幕外州始终完整挂载，不得按 Camera 可见性卸载或重建州面。active 时外层战略地图视口始终是最终裁剪边界。
- `.province-map-camera-surface` 自身固定 `contain:none`，不得使用 `contain:paint`、clip-path 或其他重复 paint 裁剪建立第二层瞬时裁剪边界。外层战略地图视口已经负责最终屏幕裁剪。
- 如果栅格快照尚未准备完成，允许功能性回退：把同一权威 SVG 一次切换到 preload world viewBox，并只对 `.province-map-camera-surface` 写 transient transform；该 fallback 不得创建第二 Camera。正式浏览器性能门禁必须等待 `data-map-raster-ready='true'` 后再测量，不得通过放宽预算掩盖快照失败。

## 3. Transient Camera + settled viewBox

- 逻辑缩放固定为 `1×–4×`。Camera 只有一套权威数学状态：SVG 世界坐标中的 `centerX / centerY / zoom`。`committed/current/target` 只是同一 Camera 在“已提交矢量状态／当前显示状态／目标状态”三个时点的快照，不得演化为第二套 Camera。
- `1×` 的基础视场根据真实地图容器宽高比和美国本土 focus bounds 计算。桌面／横屏在不裁掉美国的前提下以美国本土包围盒约占有效视场面积 `2/3` 为目标；窄屏／竖屏优先完整显示连续 48 州和约 `12px` 屏幕安全边距，允许面积比例低于 `2/3`。
- Camera 的合法世界边界在初始化或真实容器 resize 时一次计算并固定：以美国本土 focus bounds 为基准，水平方向最多扩展约 `35%`、垂直方向最多扩展约 `25%`，同时必须至少容纳完整 `1×` 基础视场。**该 world bounds 不得随 zoom 改变。**
- 当前视场尺寸必须由倍率反求：`viewWidth = baseViewWidth / zoom`，`viewHeight = baseViewHeight / zoom`。Camera 中心必须满足 `min + viewSize/2 <= center <= max - viewSize/2`；若某轴固定世界边界小于当前视场，则该轴锁定在世界边界中心。
- 鼠标滚轮和双指缩放围绕真实屏幕焦点执行：先按当前 target viewBox 把屏幕点反求为世界坐标，再计算新倍率与新视场，并调整 center 使同一世界锚点仍位于该屏幕位置，最后按固定 world bounds clamp。
- 鼠标／单指拖动把屏幕位移按 target viewBox 尺寸换算为世界坐标中心位移，再使用同一固定边界 clamp。不得先越界再回弹。
- Camera 初始化／reset 必须发布唯一固定 preload world viewBox。idle 期间的栅格快照只用这个 viewBox 生成，并且不改变 current／target／committed。
- 输入从 idle 进入 active 时必须先判断 `data-map-raster-ready`。若快照已准备完成，权威 SVG 保持最后 settled `viewBox` 并临时 `opacity:0`，Canvas 变为可见；transient basis 仍使用快照自身的固定 preload world viewBox，只用于推导 Canvas 的“preload → current” transform，不修改 SVG。
- raster-ready active 边界只允许一次性发布诊断状态并由 CSS 临时提升 `.province-map-camera-raster`；`.province-map-camera-surface` 必须继续 `transform:none / will-change:auto`。只有 snapshot 未就绪 fallback 才临时提升 Surface，并在进入 active 时一次把 SVG 切到 preload world viewBox。
- active 阶段的 `requestAnimationFrame` 热路径只允许：把内存 target 规范化为 current，然后**二选一直接写一次浏览器内建 `style.transform`**——raster-ready 时写 `.province-map-camera-raster`，fallback 时写 `.province-map-camera-surface`。不得同帧写两个 transform。
- 每帧 transform 必须完全由同一 Camera 数学推导；RAF 不得读取 DOM 几何、不得写根 SVG `viewBox`、不得发布 `data-*`、不得重绘 Canvas、不得创建定时器、不得提交 React state、不得重算 path／标签、不得调用 ECharts／ZRender。
- Camera RAF 不得通过 CSS custom property、`var(...)` 或 `@property` 间接驱动 transform。栅格快照解决的是复杂 SVG transform 下的重复栅格化，不改变“每个 RAF 只直接写一次内建 transform”的规则。
- 同一任务中的多次 wheel／pointermove 必须合并为下一帧的一次 transient transform 写入。active 热路径不得同时写 transform 与 `viewBox`，不得每帧改 Canvas 尺寸、重新截图或更新 raster revision。
- 输入 settle 使用单一 deadline 与单一定时器。只要仍有待提交 RAF，本轮不得先进入 idle；deadline 到达且 RAF 已清空后，必须 **一次性** 把 current Camera 提交为根 `.province-map-world-svg` 的最终 `viewBox`，同时清除 Surface 与 Canvas 两个可能的 transient transform、SVG 临时透明度和 active 状态。settle 后 Surface 与 Canvas 均恢复 `transform:none / will-change:auto`，Canvas 恢复 `opacity:0`，SVG 恢复 `opacity:1`。
- reset 和真实容器 resize 可以直接提交新的 settled `viewBox`，并必须同时清除两个 transient transform 与 SVG 临时透明度。空白双击／双触回到动态 `1×` 美国居中视场。移动双指的 click 抑制窗口继续只负责输入仲裁，不复制 Camera。
- `data-map-raster-ready`、`data-map-raster-revision`、像素尺寸与 preload viewBox 只在初始化、idle 快照完成、真实内容／容器变化和 active/idle 边界同步；不得为了展示每一帧的 current 值而重新生成快照或写诊断属性。

## 4. 字体与矢量清晰度

- 中文州名必须继续使用真实 SVG `text` glyph 作为权威布局和 idle／settled 最终显示；不得建立独立 Canvas 字层、逐州标签位图、HTML 字层或第二套标签坐标。
- idle／settled 状态必须由最终根 SVG `viewBox` 重新栅格化真实 SVG path 与文字，保证停手后立即回到矢量清晰度。active 手势期间允许整幅 `.province-map-camera-raster` 短暂包含这些 SVG glyph 的像素快照；这是完整世界画面的临时合成缓存，不属于独立州名位图化，且 settle 后必须立即隐藏。
- 州名自然字号、自然宽高比和静态 glyph 布局不因 Camera 变化重算；不得使用 `textLength`、`scaleX`、`scaleY` 拉伸文字。active 快照统一缩放完整世界，不改变 SVG 中的标签布局数据。
- active 世界背景 LOD 只降低非交互大陆底色的临时绘制复杂度，不改变权威 SVG 中经营州面、州名、路线和美国本土最终轮廓的数据精度。
- 地图 Camera 交互期间不得使用会导致大范围重复离屏栅格化的 SVG `drop-shadow` filter。世界背景层次使用普通低透明度描边；州 hover／选中、运输标记选中使用描边宽度、颜色和透明度表达，不依赖大范围滤镜。

### 4.1 州面视觉交互

- 战略地图州面交互固定采用“镜头底色 + 中性轮廓”分层。政治／资产／工业／市场／异常镜头只决定现有州 path 的底色和业务边界色；hover、focus 和 selected 不得用其他业务状态色覆盖底色，也不得复制第二条州面几何。
- 普通鼠标 hover 使用 `--color-text-secondary` 的 `1.5px` 中性描边；selected 使用 `--color-text-primary` 的 `2.5px` 描边；selected 同时 hover 时提升为 `3px`。视觉优先级固定为“选中悬浮 > 选中 > 普通悬浮 > 默认”，所有状态继续保持 `filter:none`。
- 交互视觉只由同一静态 SVG path 的 CSS `:hover`／`:focus-visible` 和外部 `data-selected` 驱动；不得使用 pointermove React state、ECharts emphasis/select、重新布局州名或复制 Camera。

## 5. 运输路线几何和运动

- 公路运输严格沿 `TRANSPORT_NETWORK_GEOMETRY_DESIGN.md` 提供的公路中心线显示和移动；铁路运输严格沿铁路中心线显示和移动。正式快照存在时不得退化为首府直线。
- 航空运输使用唯一稳定的二次贝塞尔抛物线 `M A Q C B`。控制点由两端首府中点、标准法线和受上下限约束的距离比例确定；同一首府对正反向复用同一曲线，只反转运动方向。
- 航空曲线必须生成同源采样点；飞机沿这些采样点按累计路径长度插值，保证视觉 path 和运动轨迹一致。
- 多条玩家路线使用同一种运输方式并经过同一物理区段时允许完全共线。不得生成平行车道、标准法线偏移、laneOffset 变体、正反向独立车道、往返第二条线或为了辨认路线而改变物理几何。
- 运行时路线数据模型和 DOM 诊断属性不得保留 `laneOwnerId`、`laneOffset`、`laneCountByEdge`、`byLaneOwnerId`、`data-route-lane-*` 或 `returnPath` 等车道／返程副线字段；路线身份只由 `routeId`／overlay id 表达，单条 overlay 直接持有唯一 `path` 与正式 segment points。
- 非闭环往返路线到达终点后只反转同一条正式几何；地图只显示一条路线。运输 marker 查询反向段时允许对原 segment points 反序，但不得创建第二份可见 path。
- 公路使用连续实线，铁路使用轨道节奏虚线，航空使用间隔更大的航线虚线。草稿和高亮只改变强调色／粗细／透明度，不改变方式线型和 path `d`。
- 玩家实际保存路线组成战略地图常驻路网：`StrategicMapStage` 挂载期间，无论当前一级页或详情页属于运输、地区、市场、建筑或其他玩家页面，都必须持续挂载全部有效 saved overlay；不得用 `model.tab` 或页面位置条件隐藏已保存路线。草稿和对应在途标记按各自生命周期叠加；仍不得绘制全国完整 1128×2 首府对物理路网集合。

## 6. 路线高亮

- 运输路线身份以 `routeId` 为唯一键。运输一级页路线按钮 hover 和 focus 必须设置当前 `highlightedRouteId`；离开／blur 清除临时高亮。
- 进入 `transport-route` 详情页后，该详情的 `routeId` 必须持续作为高亮来源，离开详情页时清除。
- 每条已保存路线在地图中只允许挂载一个路线 overlay／path。高亮必须在这一个实例上把 `kind` 或等价视觉状态切换为强调态，并继续使用与保存态完全相同的 `path d`；不得额外挂载同几何高亮副本、偏移副本或第二套路线规划。
- 路线绘制层级固定为普通 saved → draft → highlight。多条路线共享同一物理区段时，当前高亮路线必须最后绘制以覆盖普通共线路段；该层级只改变 DOM 绘制顺序和样式，不得改变 `path d`、生成第二条高亮 path 或引入车道偏移。

## 7. 地图专属表面材质

- 战略地图镜头栏和运输地图选路面板属于地图专属操作表面，固定使用实体深色背景、普通边框和轻量阴影，`backdrop-filter` 与 `-webkit-backdrop-filter` 必须为 `none`。
- 本条只取消地图专属镜头栏和选路面板的毛玻璃，不改变状态栏、普通业务 Workspace、移动 Sheet、通知、Tooltip 等由 `LIQUID_GLASS_CHROME_DESIGN.md` 或 `UI_DESIGN_SYSTEM.md` 管理的通用材质。
- 地图背景渐变和 vignette 属于非玻璃氛围层，可以保留，但不得引入实时滤镜或鼠标跟随变形。

## 8. 动态运输层

- 在途运输位置的 `500ms` 时间只由运输 marker 最小动态子树消费；运输 Tooltip 只有实际打开时才能独立消费同一共享时间。
- `StrategicMapStage`、世界背景、48 州、州名、路线和 Camera 根不得因运输时间 tick 重新提交 React 树。
- 在途 marker 与路线的权威几何仍位于同一个根 SVG 世界坐标中，不建立 HTML 标记动画层、第二投影或第二 Camera。active 栅格快照只冻结到最近一次 idle 快照中的 marker 像素位置，最多持续一个短暂 Camera 输入窗口；settle 后立即恢复实时 SVG marker。不得因此复制 shipment 逻辑时间、路线几何或单独更新 Canvas marker。

## 9. 防回退

不得恢复以下实现：

- 每个 wheel／pointermove RAF 都改根 SVG `viewBox`；
- active RAF 同时改 transient transform 与根 SVG `viewBox`；
- raster-ready active 时变换 `.province-map-camera-surface`、同时变换 Surface 与 Canvas，或给 Surface 开启 `will-change: transform`；
- raster-ready active 时把权威 SVG 切换到 preload viewBox、设为 `display:none`，或从 DOM／渲染树移除；
- 把 `.province-map-camera-surface` transform 重新作为长期或独立权威 Camera，或在 settle 后保留非 `none` transform；
- 使用 `--province-map-camera-transform`、`@property` 或任何 CSS custom property 间接驱动 active Camera transform；
- 永久 `will-change: transform` 全世界合成层；
- 另建第二套 center／zoom、第二投影、第二 SVG 或第二 HTML Camera 与 transient Camera 同步；
- 让 `.province-map-camera-raster` 拥有 center／zoom／world bounds／投影／输入事件，或把它扩展成第二套地图；
- 在 Camera RAF、wheel/pointermove 热路径或运输 `500ms` tick 中序列化 SVG、生成 Blob／ImageBitmap、调整 Canvas 像素尺寸、重画 Canvas 或增加 raster revision；
- 因 `createImageBitmap` 解码 SVG Blob 失败就直接放弃 snapshot，而不尝试 `Image.decode()` 回退；
- 在图片解码／Canvas draw 完成前 revoke SVG Blob URL；
- 在 idle／settled 继续显示 `.province-map-camera-raster`，或让快照替代最终 SVG `viewBox` 矢量画面；
- 州名位图化为独立逐州 Canvas/图片层、独立 HTML 字层，或让 active 整幅快照继续存活到 idle／settled；
- 逻辑倍率越大、合法 world bounds 越大的动态上下文；
- Camera RAF 中的 React state、DOM 测量、批量 `data-*`、path／标签重算、定时器或多个屏幕写入；
- 地图世界／选中州的大范围 `drop-shadow` 缩放滤镜；
- 使用 1:10m 北美土地完整 path 重复绘制世界背景海岸主线或外侧描边；
- 为背景 LOD 在 RAF 中改 DOM／path、建立第二 Camera，或在 settle 后不恢复 1:10m 世界底色；
- 在 `.province-map-camera-surface` 恢复 `contain:paint`、额外 clip-path 或其他会让 transient 世界重复 paint 的第二层裁剪；
- 公路／铁路共享同一中心线、地面运输首府直线正式几何；
- 运输路线强制并排、车道数据结构、laneOffset 或返程第二条线；
- 航空首府直线正式显示和直线运动；
- 按 `model.tab` 或页面导航状态隐藏玩家已保存路线，导致战略地图跨页切换时路网消失；
- hover／详情高亮通过复制或偏移第二条路线实现；
- 地图镜头栏或运输选路面板恢复毛玻璃。

## 10. 实现与验证映射

- `src/components/provinces/provinceMapCamera.ts`：唯一 Camera 数学状态、固定 world bounds、焦点反求、固定 preload viewBox、raster-ready active Canvas-only transform、snapshot 缺失时 live-SVG Surface fallback、settle 单次 viewBox 提交和输入仲裁。
- `src/components/provinces/provinceMapRasterSnapshot.ts`：只负责在 idle 从唯一权威 SVG 克隆计算后样式、应用 active 世界 LOD 并异步生成固定 preload viewBox 的 CanvasImageSource；必须支持 `createImageBitmap → Image.decode()` 解码回退和正确 Blob URL 生命周期，不得包含 Camera 状态或输入逻辑。
- `src/components/provinces/provinceMapRouteLayout.ts`：公路／铁路中心线复用、航空抛物线、反向 segment 和同源运动采样。
- `src/components/shell/StrategicWorkspace.tsx`：无页面条件构建全部已保存路线 overlay；草稿位于普通路线之上，高亮路线最后绘制；只传递既有路线身份和站点，不拥有第二套路线几何。
- `src/components/provinces/UsMainlandMap.tsx`：唯一静态 SVG 世界、路线和 marker 挂载；拥有唯一非交互 `.province-map-camera-raster` 缓存，并只在 idle／内容／尺寸变化时刷新。
- `src/pages/TransportPage.tsx` 与 `TransportRouteDraftContext`：路线 hover／focus／详情高亮身份。
- `src/styles/province-map.css` 与 `src/styles/strategic-map-rendering.css`：idle 矢量层级、raster-ready 时只提升 Canvas、fallback 时才提升 Surface、SVG/Canvas 可见性切换、active/idle 世界背景 LOD、无滤镜热路径、三种方式线型和地图专属实体表面；CSS 不拥有逐帧 Camera transform 值。
- `scripts/verify-provincial-economy.mjs`、`scripts/verify-province-map-raster-snapshot.mjs`、`scripts/verify-transport-route-lanes.mjs` 与 `scripts/verify-province-map-focus.mjs`：结构防回退。
- `tests/dt/transport-route-map-overlays.test.ts`：锁定已保存路线不再受运输页签条件限制，并验证普通路线、草稿、高亮的最终绘制顺序。
- `tests/browser/map-zoom-transient.spec.ts`：正式性能测量前必须等待 `data-map-raster-ready='true'`；同帧 wheel burst 在 raster-ready active 阶段必须是 `0` 次根 SVG `viewBox` 变化、`0` 次 Camera Surface style 变化、`1` 次 raster Canvas style 变化、`0` 次诊断属性变化；同时锁定 path/glyph 静态、active Canvas `opacity:1`、live SVG `opacity:0`、Surface `transform:none / will-change:auto`、settle 后 Canvas `opacity:0` 与 SVG `opacity:1`，并按第 11 节继续以同浏览器空帧中位数验证 `empty×2+8ms` 的输入到 RAF 间隔预算。
- `tests/browser/map-raster-lifecycle.spec.ts`：使用真实 SVG 解码与可控制的完成屏障，在 Camera active 期间释放迟到结果；必须验证 Canvas 尺寸／revision／ready 不变、fallback 不切换、过期资源释放，以及无需额外业务更新即可在 settle 后生成新快照。不得用固定 sleep 猜测解码先后。
- `tests/browser/province-map-world-boundary.spec.ts`：锁定闲置态 10m 土地填充、同源 110m 背景描边、10m 美国本土最终轮廓及背景描边复杂度预算；所有边界重复拖拽比较必须先等待 Camera settle，再以最终 viewBox 验证固定 world bounds，不得把 transient 帧误当 settled 边界。
- `tests/browser/map-zoom-out-boundary.spec.ts`：锁定 raster-ready 缩放 active 阶段 SVG 保持当前 settled viewBox、Camera Surface transform 为 `none`、Canvas 承担唯一 transient transform、48 个 path 始终挂载，settle 后再提交最终 SVG viewBox并恢复实时几何。
- `tests/browser/map-reset-sync.spec.ts`、`map-mobile-pinch.spec.ts`、`map-zoom-render-sync.spec.ts`、`province-map-focus.spec.ts`：重置、移动双指、settled SVG 同步和州交互不破坏同一 Camera。
- 运输浏览器回归必须验证重复路线共线、运行时无车道字段、往返无第二 path、公路／铁路／航空路径不同、航空包含 `Q` 曲线、运输标记沿对应几何、高亮不改变路线 `d`，以及地图镜头栏／选路面板最终 `backdrop-filter:none`。

## 11. 性能测量与逐帧诊断

- 性能门禁和瓶颈剖析是两个独立采样过程。`map-zoom-transient.spec.ts` 保持真实场景、既有视口和输入序列，等待 raster-ready 后比较空帧与交互采样；预算固定为 `empty×2+8ms`，不得通过隐藏摄影、氛围、Chrome、关闭正式毛玻璃、降低视口或剔除慢样本获得通过。 定量门禁不得与其他 Playwright worker 并发采样；标准浏览器 runner 必须先完成同 shard 的功能／视觉测试，再在独立 Playwright 进程中以 `workers=1` 运行该门禁。该隔离不得替代或放宽固定预算，也不得改变正式场景；其目的仅是移除同机测试 worker 对软件 Viz/compositor 的非产品竞争。
- Camera 性能测试文件和逐帧剖析文件在文件顶层配置 `trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true }`，保留动作与 DOM 诊断但不录制 screencast；其他视觉测试继续使用原有录制配置。`non-obvious reason`：截图录制会给变化中的画面额外引入读回与合成工作，而空白静止帧不承担同等开销，因而不能把录制成本混入产品性能门禁。不得把 worker 级 trace 配置放进 `test.describe`。
- 门禁必须保留每个空帧和交互样本，以 `map-camera-frame-budget.json` 附件记录输入到 RAF、同步派发与等待 RAF 三种耗时。输入到 RAF 和 RAF 时间戳间隔不是物理屏幕呈现时长，也不是 GPU 执行时长；报告必须使用准确名称，不得将其直接标成每帧渲染耗时。
- `map-camera-frame-diagnostics.spec.ts` 使用独立 CDP Tracing 采集 Viz／GPU／Skia、主线程与栅格线程事件，在同一次连续输入内分开记录冷启动、预热和稳定段，并给每个采样窗口写入开始／结束标记。阶段间不得插入跨进程调试查询或等待，避免 Camera settle 污染稳定段。剖析数据用于定位工作所在阶段，不作为无剖析门禁的等价性能数值。
- 采集类别必须使用明确的有限集合，常规逐帧诊断不自动开启全量 picture／display-item／quad 序列化转储。原始事件以 `map-camera-chrome-trace.json` 附件保留，逐窗口分析以 `map-camera-frame-analysis.json` 保留；记录浏览器版本、提交 SHA、视口、DPR、实际 tracing categories、原始采样窗口和是否发生数据丢失。通过浏览器会话读取实际 GPU featureStatus／renderer；不可用时明确记录，不能猜测硬件加速状态。缺失窗口标记或 `dataLossOccurred` 为真时，不得发布完整剖析成功结论。生成的 trace 与报告只作为测试产物，不提交到源码。
- 完整时长事件按与 `[start, end)` 采样窗口的交集计量，不能把跨窗口事件的完整时长重复计入每一帧。同线程嵌套／重叠区间先取并集；跨线程同时提供区间并集的墙钟时间和各线程区间时间之和，两者必须明确区分，不能把并行线程累加值、嵌套父子事件或各阶段之和当作整帧／GPU 时长。只分析 `X` 事件的摘要必须标明这一范围，其他事件继续保留在原始 trace 中。
- 线程身份使用 `pid + tid`，不能仅按相同线程名称合并工作线程。图层归属只依据同一次会话的 LayerTree 与 backendNodeId 历史关联；缺失或复用存在歧义时明确标为未映射／歧义，不得跨测试复用 layerId 推断 DOM。图层归属只是定位线索，不能替代同场景受控对照或证明某个 CSS 属性是根因；`SoftwareRenderer` 的工作不得报告为真实 GPU 耗时。
- 时间统计的合成事件回归必须覆盖跨窗口事件、嵌套事件、并行线程和刚好落在窗口边界的事件，锁定交集计量和不重复累加；真实诊断还需断言逐阶段墙钟交集不超过采样窗口，并验证连续输入期间权威 SVG viewBox 与 raster revision 不变。
