from pathlib import Path
import re


def replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S | re.M)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return updated


ui_path = Path('docs/UI_DESIGN_SYSTEM.md')
ui = ui_path.read_text(encoding='utf-8')
economy_chart = '''`EconomyChart` 是业务数据图表的唯一 React 入口。项目只安装 Apache `echarts`，不得引入 `echarts-for-react` 或第二套图表包装库；`echarts.init`、SVGRenderer、按需图表模块注册、`ResizeObserver`、`requestAnimationFrame` 合并 resize、Option 更新、事件绑定与卸载 `dispose()` 统一放在 `src/components/charts/`。图表容器宽或高为 `0` 时必须延迟 `setOption` 并跳过 `resize`，在首次获得可渲染尺寸后再应用最新 Option。市场行情、银行资产配置、管理员玩家与人口图表必须从现有 CSS 设计令牌读取颜色，提供中文 `aria-label` 与可读数据摘要；业务页面只提供数据、Option 和语义事件回调，不得直接持有 ECharts 实例或依赖其私有 SVG DOM。ECharts 必须随使用它的数据图表既有动态 import 按需加载，登录首屏不得静态加载图表包。战略地图不属于业务数据图表，不使用 ECharts Map／Geo；它由 `UsMainlandMap` 的静态 SVG 世界面和独立合成相机负责，避免高频缩放触发图表重绘。'''
ui = replace_once(
    ui,
    r'`EconomyChart` 是业务数据图表的唯一 React 入口。.*?(?=\n\nECharts 不得把)',
    economy_chart,
    'UI EconomyChart paragraph',
)
ui_map = '''### 8.1 美国本土州级经营地图

- 地图由 `StrategicWorkspace` 内唯一 `UsMainlandMap` 持有，不再使用 ECharts Geo/Map。精确使用 `us-atlas@3.0.1` 与 `topojson-client@3.1.0` 把州 TopoJSON 转为连续 48 州几何，不显示阿拉斯加、夏威夷、华盛顿特区或海外领地附图。地图在模块初始化时建立固定投影比例的静态 SVG 世界面；48 个州面 path 必须始终完整挂载，州面 path 的 `d` 在缩放和平移期间保持不变，不得按当前物理视口裁掉屏外州或在手势期间重新生成路径。根 `.application-map-layer` 仍只负责最终物理视口裁剪；州面放大后可以离开屏幕，但缩小时必须仅凭同一世界面的相机变换立即重新进入。
- 桌面与移动默认镜头均为完整美国本土轮廓的等比 Contain 视图，保持固定投影比例与少量安全边距；用户缩放固定为 `0.5～4`。单一合成相机状态是相对于默认世界面的 `x / y / zoom`，缩放焦点围绕指针或双指中点计算，单指／鼠标拖动修改平移。滚轮使用非被动监听器阻止页面滚动并归一化 `deltaMode`；移动双指使用两个 Pointer 的真实距离和中点。鼠标双击或触摸双触地图空白把相机恢复为 `0 / 0 / 1`，州面上的双击／双触不得重置。
- 地图高频交互使用单一合成相机：州面和州名共同位于 `.province-map-camera-surface` 下的同一个 SVG 世界坐标系，每个动画帧最多写一次该 HTML 合成层的 `translate3d(...) scale(...)`。缩放／平移帧不得调用 ECharts、`setOption`、`dispatchAction`、重新投影州界、修改州面 path 的 `d`、重新测量字体或重新布局州名。连续输入在同一浏览器帧内必须合并成一次 transform 写入；`will-change: transform` 只允许在交互 active 期间动态开启，停止输入后立即清除。选择州、切换镜头和普通状态刷新只能更新填充／描边／选中属性，不得重置或重建相机。
- 中文州全名和州面直接处于同一个 SVG 世界坐标系，不维护第二套标签相机、参考点同步矩阵或 `georoam` 跟随逻辑，因此任何相机 transform 天然同时作用于州界和名称。标签布局只在首次创建、字体准备完成或真实容器尺寸变化时允许执行；布局先依据静态投影后的州多边形求州内几何主轴与可读方向，沿主轴扫描完整位于州面的文字走廊，再使用实际字体固定字重的自然宽度、自然高度与自然长宽比等比求字号。每个汉字必须作为独立刚性 SVG `text`，只做 `translate + rotate`；不得通过 `textLength`、`lengthAdjust="spacingAndGlyphs"`、`scaleX`、`scaleY` 或其他非等比方式拉伸字形。逐字包围盒必须完整位于州面内部；标签 `pointer-events: none`，不得阻塞州面点击、拖动或 Tooltip。
- 地区默认、悬停、当前、资产、工业、市场和异常语义继续使用区域填充、边界、文字、Tooltip 和五种镜头共同表达；默认州面、未解锁州面、州界与州名分别读取 `--color-map-region-default`、`--color-map-region-locked`、`--color-map-region-border` 与 `--color-map-label`。当前地区由外部 `selectedProvinceId` 驱动 path 与标签选中属性；镜头状态只属于 `GameShell` 客户端视觉上下文，不写入服务器或更换地区。每个州面保留鼠标、触摸和键盘激活；单击后设置经营州并打开隐藏 `province` 上下文页。离开州级页立即清除地图视觉高亮，但保留经营州供后续业务写操作使用。
- 桌面 Tooltip 继续使用 `.ui-tooltip-surface` 的统一毛玻璃材质，并显示本地库存、工厂、运行中与本地挂单；未解锁州明确标注“未解锁”。不大于 `720px` 时地图 Tooltip 必须禁用并隐藏，触摸州面直接打开州级上下文页。地图容器继续提供“美国本土州级经营地图”可访问名称与可读摘要。`MapPage` 只保留透明路由占位；市场、建筑和其他业务页面不得恢复地区下拉框、第二张地图或平行选择状态。
- 性能回归必须验证实际热路径：缩放／平移前后的 48 条 path `d` 与州名基础 glyph transform 保持不变；州面和州名都能追溯到同一个 `.province-map-camera-surface`；同一任务内的多次滚轮输入在下一绘制帧只增加一次 camera write；放大使外围州离开屏幕后，缩小且 `data-map-zoom-active="true"` 时外围州已经重新进入且州名中心仍命中对应 path。不得用最终 settle 后才恢复、隐藏屏外州、永久 `will-change` 或第二套相机规避检查。
- 玩家端仍采用大战略游戏式常驻地图工作台：图片层 `0`、氛围层 `10`、地图层 `20`、UI 层 `30`，`.application-map-layer` 通过同一个 Portal 持有唯一 `StrategicMapStage` 和 `StrategicMapLensBar`。业务页面和通知仍位于更高 UI 层；不大于 `720px` 时镜头栏隐藏。地图数据只用于游戏经营地区视觉，不用于现实测绘、导航或法律边界声明；既有 34 个地区 ID 与新增 14 个州 ID 必须继续稳定对应现有资产。
'''
ui = replace_once(
    ui,
    r'### 8\.1 美国本土州级经营地图\n.*?(?=\n## 9\.)',
    ui_map.rstrip(),
    'UI map section',
)
ui_path.write_text(ui, encoding='utf-8')

page_path = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
page = page_path.read_text(encoding='utf-8')
page_map = '''### 3.1 地图

玩家界面固定展示 `shared/provinces.json` 中美国本土连续 48 个州级地区，不包含阿拉斯加、夏威夷、华盛顿特区或海外领地。地图主体由 `GameShell` 下的 `StrategicMapStage` 持有唯一 `UsMainlandMap`，通过 Portal 进入根级地图层并持续铺满整个视口；状态栏、指挥栏、业务面板和其他交互均位于其上的 UI 层。战略地图采用完整静态 SVG 世界面，不属于共享 `EconomyChart` 业务数据图表；`us-atlas`／TopoJSON 只在建立世界几何时转换为连续 48 州 path，所有州 path 始终挂载且在缩放和平移过程中不得改变 `d` 或按视口裁掉屏外州。

默认镜头使用固定投影比例的等比 Contain 视图并保留安全边距，用户缩放范围固定为 `0.5～4`。州面和中文州全名位于同一个 SVG 世界坐标系以及同一个 `.province-map-camera-surface` 下；唯一相机状态为 `x / y / zoom`。鼠标／单指拖动平移，桌面滚轮围绕指针缩放，移动双指围绕真实中点缩放。高频手势只允许通过单一 `requestAnimationFrame` 合并相机写入，每个动画帧最多写一次 `translate3d + scale`；不得调用 ECharts `geoRoam`、`setOption`、重新生成州面 path、重新投影、重排 48 州标签或维护第二套标签相机。交互 active 期间可以临时 `will-change: transform`，停止后必须清除。完整世界面始终存在，所以放大时离屏的州在缩小时必须在手势仍 active 时自然重新进入视口，不能等待 settle 或重新创建几何。

中文州全名作为唯一州面名称。标签按静态投影后的州内主轴、可读方向和文字走廊计算，使用实际字体自然宽度、自然高度和自然长宽比等比确定字号；每个汉字为刚性 SVG `text`，只做 `translate + rotate`，禁止 `textLength`、字形拉伸和州外引线。名称随地图缩放和平移同步变化由与州面共享同一个合成相机保证，不再通过 `georoam` 参考点同步。标签层不拦截州面交互；真实容器 resize 可以重新计算标签布局并重置默认 Contain 相机，但普通缩放、平移、选择、镜头切换和服务器状态更新不得触发完整标签布局。

鼠标双击或触摸双触地图空白恢复默认相机，州面上的双击／双触不重置。每个州面支持鼠标、触摸和键盘选择；单击后设置经营州并打开隐藏 `province` 上下文页，该页期间显示唯一州面高亮。未解锁州灰显，桌面 Tooltip 标注“未解锁”，点击后仍进入州级上下文页展示解锁面板。关闭州级页或进入其他页面后立即清除视觉高亮，但保留经营州供地区写操作使用。一级全局市场和建筑页可以通过已解锁州卡钻取既有地区工作区，但不得恢复地区下拉框、按钮组、第二张地图或第二套地区状态。

地图提供州界、资产、工业、市场和异常五种镜头；镜头只修改州面颜色／边界和 Tooltip 上下文，不修改服务器数据、相机或地区选择。地图不得提供独立的放大、缩小或重置功能面板。不大于 `720px` 时镜头栏和地图 Tooltip 必须隐藏，触摸州面直接进入地区页，地图继续保持缩放和平移手势。地图页、概览及其他业务页面都复用这一常驻实例；`MapPage` 仍只保留透明路由占位。
'''
page = replace_once(page, r'### 3\.1 地图\n.*?(?=\n### 3\.2 )', page_map.rstrip(), 'PAGE map section')
page_path.write_text(page, encoding='utf-8')

chrome_path = Path('docs/LIQUID_GLASS_CHROME_DESIGN.md')
chrome = chrome_path.read_text(encoding='utf-8')
chrome_bullet = '- 战略地图滚轮与双指逻辑缩放继续允许 `0.5–4`，但地图不再通过 ECharts `geoRoam` 逐帧重绘。完整 48 州与中文州名共用同一个静态 SVG 世界面和单一合成相机；缩放、平移每帧最多一次写入 `.province-map-camera-surface` 的 `translate3d + scale`，州面 path `d`、州名基础坐标和 glyph transform 在手势期间保持不变。根级 `.application-map-layer` 继续承担最终物理视口裁剪，屏幕外的州面不得从世界面卸载，因此缩小时必须在手势 active 阶段直接重新进入视口。滚轮／双指围绕真实焦点更新 `x / y / zoom`，同一帧输入合并；`will-change: transform` 只在 active 期间临时开启并在停止后清除。地图拖动、缩放不得调用 ECharts、重新投影、重新布局州名或维护第二套标签相机；空白双击／双触继续恢复默认 Contain 镜头。'
chrome = replace_once(
    chrome,
    r'^- 战略地图滚轮与双指逻辑缩放继续允许 `0\.5–4`.*$',
    chrome_bullet,
    'Chrome map bullet',
)
chrome = re.sub(
    r'^- `tests/browser/map-zoom-out-boundary\.spec\.ts`：.*$',
    '- `tests/browser/map-zoom-out-boundary.spec.ts`：放大后外围州真实离开屏幕，再缩小到 `0.5`，必须在相机仍 active 时重新进入并且州名中心命中对应 path；`tests/browser/map-zoom-transient.spec.ts` 锁定手势期间 path `d` 与 glyph 基础 transform 不变、同帧滚轮只写一次合成相机；`tests/browser/map-zoom-render-sync.spec.ts` 锁定州面和州名共享同一个静态世界与相机；`tests/browser/map-reset-sync.spec.ts` 锁定空白重置首帧同步。',
    chrome,
    count=1,
    flags=re.M,
)
chrome_path.write_text(chrome, encoding='utf-8')
