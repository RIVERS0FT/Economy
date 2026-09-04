# Economy 战略地图渲染设计

> 状态：当前有效
> 适用项目：`RIVERS0FT/Economy`

## 1. 唯一职责

本文是战略地图 **Camera、SVG 世界面、州名清晰度、地图路线视觉／运动、高亮、地图专属浮动控件材质和地图渲染性能** 的唯一权威 DESIGN。

本文不负责运输经济费用、耗时、载荷和结算，这些归 `WAREHOUSE_EXPANSION_DESIGN.md`；不负责公路／铁路原始 GIS 数据和离线首府路网快照生成，这些归 `TRANSPORT_NETWORK_GEOMETRY_DESIGN.md`；不负责全应用颜色、字体、普通按钮和 Tooltip 通用视觉，这些归 `UI_DESIGN_SYSTEM.md`；不负责四层根节点、普通页面 Workspace、状态栏和其他应用 Chrome 材质，这些归 `LIQUID_GLASS_CHROME_DESIGN.md`。

旧文档中与本文职责重叠的战略地图 Camera、运输路线并排、航空直线、地图镜头栏／选路面板毛玻璃规则不再具有权威性；后续修改必须以本文为准，不得依据旧段落恢复被本文明确禁止的实现。

## 2. 静态世界面

- 战略地图只保留一个 `.province-map-world-svg`。世界大陆、美国连续 48 州、中文州名、运输路线和在途标记都位于这一个 SVG 世界坐标系中。
- 世界背景的土地填充使用 `world-atlas@2.0.2` 的 Natural Earth 1:10m countries 数据，经确定性生成器 dissolve 北美上下文国家、裁剪未引用 arc 后形成运行时 TopoJSON；低对比海岸主线和外侧层次描边使用同一版本、同一国家集合按相同步骤派生的 1:110m TopoJSON。美国本土经营层和覆盖世界背景的最终美国外轮廓继续使用 `us-atlas@3.0.1` 的 1:10m 州界，不降低交互区域的边界精度。
- `non-obvious reason`：根 SVG 的 `viewBox` 变化会让浏览器重新 tessellate 可见描边；1:10m 北美填充本身可以稳定保留，但不得把约十万级顶点的同一土地 path 再作为海岸主线和外侧描边重复绘制。两条世界背景描边各自必须保持低于 `2,000` 个 `M/L` 顶点和 `30,000` 个 path 字符；完整 atlas、预展开浮点 GeoJSON 和超出预算的描边不得进入玩家运行时。
- 世界背景允许且只允许在 Camera 输入 `active` 边界启用一次低成本绘制 LOD：`data-map-zoom-active='true'` 时，闲置态 1:10m 大陆填充 path 继续挂载但退出 paint，已存在的同源 1:110m 低复杂度世界 path 临时承担同色低对比土地填充；输入 settle 回到 `idle` 后必须恢复 1:10m 填充。该切换只能由 active/idle 的既有诊断属性通过 CSS 驱动，不得在 RAF 中增删节点、改写 path `d`、切换第二 Camera 或改变 48 州经营层、美国本土最终轮廓、州名、路线的矢量精度。
- `us-atlas` 州 path、世界大陆 path、中文州名基础布局、公路／铁路投影折线在模块初始化或真实容器尺寸变化之外不得重新生成。手势期间所有州 path `d`、世界 path `d`、州名基础中心和 glyph `transform` 必须保持不变。
- `.province-map-camera-surface` 只作为稳定 DOM 世界宿主，不再承担缩放矩阵。其最终计算样式必须保持 `transform:none`、`will-change:auto`，不得把完整 SVG 世界长期提升为可缩放纹理。
- 根 SVG 直接承担物理视口裁剪；屏幕外州仍完整挂载，不得按 Camera 可见性卸载或重建州面。

## 3. SVG viewBox Camera

- 逻辑缩放固定为 `1×–4×`。Camera 状态只保存 SVG 世界坐标中的 `centerX / centerY / zoom`。
- `1×` 的基础视场根据真实地图容器宽高比和美国本土 focus bounds 计算。桌面／横屏在不裁掉美国的前提下以美国本土包围盒约占有效视场面积 `2/3` 为目标；窄屏／竖屏优先完整显示连续 48 州和约 `12px` 屏幕安全边距，允许面积比例低于 `2/3`。
- Camera 的合法世界边界在初始化或真实容器 resize 时一次计算并固定：以美国本土 focus bounds 为基准，水平方向最多扩展约 `35%`、垂直方向最多扩展约 `25%`，同时必须至少容纳完整 `1×` 基础视场。**该 world bounds 不得随 zoom 改变。**
- 当前视场尺寸必须由倍率反求：`viewWidth = baseViewWidth / zoom`，`viewHeight = baseViewHeight / zoom`。Camera 中心必须满足 `min + viewSize/2 <= center <= max - viewSize/2`；若某轴固定世界边界小于当前视场，则该轴锁定在世界边界中心。
- 鼠标滚轮和双指缩放围绕真实屏幕焦点执行：先按当前目标 viewBox 把屏幕点反求为世界坐标，再计算新倍率与新视场，并调整 center 使同一世界锚点仍位于该屏幕位置，最后按固定 world bounds clamp。
- 鼠标／单指拖动把屏幕位移按当前 viewBox 尺寸换算为世界坐标中心位移，再使用同一固定边界 clamp。不得先越界再回弹。
- Camera 的 `requestAnimationFrame` 热路径只允许把内存 target 复制为 current，并对根 `.province-map-world-svg` 执行一次 `setAttribute('viewBox', ...)`。同一任务中的多次 wheel／pointermove 必须合并为下一帧的一次 viewBox 写入。
- RAF 内不得出现 React state 提交、`dataset` 批量更新、DOM 几何测量、path 生成、州名布局、定时器创建、CSS transform、ECharts／ZRender 调用或第二相机同步。
- 诊断 `data-*` 只在初始化、输入 active/idle 边界和 reset 同步；输入 settle 使用单一 deadline 与单一定时器。只要仍有待提交 RAF，本轮不得先进入 idle。
- 空白双击／双触和真实容器 resize 回到动态 `1×` 美国居中视场。移动双指的 click 抑制窗口继续只负责输入仲裁，不复制 Camera。

## 4. 字体与矢量清晰度

- 中文州名必须继续使用真实 SVG `text` glyph，不得转为 Canvas 位图、CSS 合成纹理、预栅格图片或随倍率缩放的 HTML 字层。
- 放大只通过根 SVG viewBox 改变当前世界视场，使浏览器按当前倍率重新栅格化 SVG path 与文字；不得通过 `.province-map-camera-surface scale(...)` 放大旧低倍率纹理。第 2 节允许的 active 世界背景 LOD 只降低非交互大陆底色的临时绘制复杂度，不改变经营州面、州名和路线的矢量清晰度。
- 州名自然字号、自然宽高比和静态 glyph 布局不因 Camera 变化重算；不得使用 `textLength`、`scaleX`、`scaleY` 拉伸文字。
- 地图 viewBox 高频变化期间不得使用会导致大范围重复离屏栅格化的 SVG `drop-shadow` filter。世界背景层次使用普通低透明度描边；州 hover／选中、运输标记选中使用描边宽度、颜色和透明度表达，不依赖大范围滤镜。

### 4.1 州面视觉交互

- 战略地图州面交互固定采用“镜头底色 + 中性轮廓”分层。政治／资产／工业／市场／异常镜头只决定现有州 path 的底色和业务边界色；hover、focus 和 selected 不得用其他业务状态色覆盖底色，也不得复制第二条州面几何。
- 普通鼠标 hover 使用 `--color-text-secondary` 的 `1.5px` 中性描边；selected 使用 `--color-text-primary` 的 `2.5px` 描边；selected 同时 hover 时提升为 `3px`。视觉优先级固定为“选中悬浮 > 选中 > 普通悬浮 > 默认”，所有状态继续保持 `filter:none`。
- 交互视觉只由同一静态 SVG path 的 CSS `:hover`／`:focus-visible` 和外部 `data-selected` 驱动；不得使用 pointermove React state、ECharts emphasis/select、重新布局州名或改写 Camera。

## 5. 运输路线几何和运动

- 公路运输严格沿 `TRANSPORT_NETWORK_GEOMETRY_DESIGN.md` 提供的公路中心线显示和移动；铁路运输严格沿铁路中心线显示和移动。正式快照存在时不得退化为首府直线。
- 航空运输使用唯一稳定的二次贝塞尔抛物线 `M A Q C B`。控制点由两端首府中点、标准法线和受上下限约束的距离比例确定；同一首府对正反向复用同一曲线，只反转运动方向。
- 航空曲线必须生成同源采样点；飞机沿这些采样点按累计路径长度插值，保证视觉 path 和运动轨迹一致。
- 多条玩家路线使用同一种运输方式并经过同一物理区段时允许完全共线。不得生成平行车道、标准法线偏移、laneOffset 变体、正反向独立车道、往返第二条线或为了辨认路线而改变物理几何。
- 运行时路线数据模型和 DOM 诊断属性不得保留 `laneOwnerId`、`laneOffset`、`laneCountByEdge`、`byLaneOwnerId`、`data-route-lane-*` 或 `returnPath` 等车道／返程副线字段；路线身份只由 `routeId`／overlay id 表达，单条 overlay 直接持有唯一 `path` 与正式 segment points。
- 非闭环往返路线到达终点后只反转同一条正式几何；地图只显示一条路线。运输 marker 查询反向段时允许对原 segment points 反序，但不得创建第二份可见 path。
- 公路使用连续实线，铁路使用轨道节奏虚线，航空使用间隔更大的航线虚线。草稿和高亮只改变强调色／粗细／透明度，不改变方式线型和 path `d`。
- 地图只渲染玩家实际保存路线、草稿和对应在途标记，不绘制全国完整 1128×2 首府对路网集合。

## 6. 路线高亮

- 运输路线身份以 `routeId` 为唯一键。运输一级页路线按钮 hover 和 focus 必须设置当前 `highlightedRouteId`；离开／blur 清除临时高亮。
- 进入 `transport-route` 详情页后，该详情的 `routeId` 必须持续作为高亮来源，离开详情页时清除。
- 每条已保存路线在地图中只允许挂载一个路线 overlay／path。高亮必须在这一个实例上把 `kind` 或等价视觉状态切换为强调态，并继续使用与保存态完全相同的 `path d`；不得额外挂载同几何高亮副本、偏移副本或第二套路线规划。

## 7. 地图专属表面材质

- 战略地图镜头栏和运输地图选路面板属于地图专属操作表面，固定使用实体深色背景、普通边框和轻量阴影，`backdrop-filter` 与 `-webkit-backdrop-filter` 必须为 `none`。
- 本条只取消地图专属镜头栏和选路面板的毛玻璃，不改变状态栏、普通业务 Workspace、移动 Sheet、通知、Tooltip 等由 `LIQUID_GLASS_CHROME_DESIGN.md` 或 `UI_DESIGN_SYSTEM.md` 管理的通用材质。
- 地图背景渐变和 vignette 属于非玻璃氛围层，可以保留，但不得引入实时滤镜或鼠标跟随变形。

## 8. 动态运输层

- 在途运输位置的 `500ms` 时间只由运输 marker 最小动态子树消费；运输 Tooltip 只有实际打开时才能独立消费同一共享时间。
- `StrategicMapStage`、世界背景、48 州、州名、路线和 Camera 根不得因运输时间 tick 重新提交 React 树。
- 在途 marker 与路线位于同一个根 SVG viewBox 中，不建立 HTML 动画层、第二投影或第二 Camera。

## 9. 防回退

不得恢复以下实现：

- `.province-map-camera-surface` 的 `translate3d + scale` Camera；
- 永久 `will-change: transform` 全世界合成层；
- 逻辑倍率越大、合法世界边界越大的动态上下文；
- Camera RAF 中的 React state、DOM 测量、批量 `data-*`、path／标签重算或多个屏幕写入；
- 州名位图化或随 CSS scale 放大的低倍率纹理；
- 地图世界／选中州的大范围 `drop-shadow` 缩放滤镜；
- 使用 1:10m 北美土地完整 path 重复绘制世界背景海岸主线或外侧描边；
- 在 active Camera 输入期间继续让约十万级 1:10m 世界底色 path 参与每帧 paint，或把 LOD 扩大到 48 州、州名、路线、美国本土最终轮廓；
- 为背景 LOD 在 RAF 中改 DOM／path、建立第二 Camera，或在 settle 后不恢复 1:10m 世界底色；
- 公路／铁路共享同一中心线、地面运输首府直线正式几何；
- 运输路线强制并排、车道数据结构、laneOffset 或返程第二条线；
- 航空首府直线正式显示和直线运动；
- hover／详情高亮通过复制或偏移第二条路线实现；
- 地图镜头栏或运输选路面板恢复毛玻璃。

## 10. 实现与验证映射

- `src/components/provinces/provinceMapCamera.ts`：唯一 SVG viewBox Camera、固定 world bounds、焦点反求和输入仲裁。
- `src/components/provinces/provinceMapRouteLayout.ts`：公路／铁路中心线复用、航空抛物线、反向 segment 和同源运动采样。
- `src/components/provinces/UsMainlandMap.tsx`：唯一静态 SVG 世界、路线和 marker 挂载。
- `src/pages/TransportPage.tsx` 与 `TransportRouteDraftContext`：路线 hover／focus／详情高亮身份。
- `src/styles/province-map.css` 与 `src/styles/strategic-map-rendering.css`：矢量层级、无滤镜热路径、active/idle 世界背景 LOD、三种方式线型和地图专属实体表面。
- `scripts/verify-provincial-economy.mjs`、`scripts/verify-transport-route-lanes.mjs` 与 `scripts/verify-province-map-focus.mjs`：结构防回退。
- `tests/browser/map-zoom-transient.spec.ts`：同帧输入只发生一次根 SVG `viewBox` 属性变化、Camera Surface style 不变、诊断属性热路径不变、path/glyph 几何静态；同时验证 active 时 10m 世界底色退出 paint、同源 110m 世界 path 承担临时底色、idle 恢复 10m，并以同浏览器空帧中位数为基线验证真实 wheel→RAF Camera 帧成本没有重新失控。
- `tests/browser/province-map-world-boundary.spec.ts`：锁定闲置态 10m 土地填充、同源 110m 背景描边、10m 美国本土最终轮廓及背景描边复杂度预算；同时验证不同倍率下 fixed world bounds 不变，并按当前 viewBox 尺寸反求可用 Camera center。
- `tests/browser/map-zoom-out-boundary.spec.ts`、`map-reset-sync.spec.ts`、`map-mobile-pinch.spec.ts`、`province-map-focus.spec.ts`：屏外州恢复、重置、移动双指和州交互不破坏同一 SVG Camera。
- 运输浏览器回归必须验证重复路线共线、运行时无车道字段、往返无第二 path、公路／铁路／航空路径不同、航空包含 `Q` 曲线、运输标记沿对应几何、高亮不改变路线 `d`，以及地图镜头栏／选路面板最终 `backdrop-filter:none`。
