"""One-off, branch-only source preparation. Removed before opening the final PR."""
from pathlib import Path
import json
import re
import subprocess

BASE = 'f98ff5850e86f4a8c20177a0f5f011c6739061ab'
changes = {}

def read(path):
    return changes.get(path, Path(path).read_text())

def put(path, content):
    changes[path] = content.rstrip() + '\n'

def replace(path, old, new):
    content = read(path)
    if content.count(old) != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement for {old[:100]!r}')
    put(path, content.replace(old, new, 1))

def paragraph(path, prefix, new):
    lines = read(path).splitlines()
    indices = [index for index, line in enumerate(lines) if line.startswith(prefix)]
    if len(indices) != 1:
        raise RuntimeError(f'{path}: expected one paragraph with {prefix!r}, found {len(indices)}')
    lines[indices[0]] = new
    put(path, '\n'.join(lines))

def original(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], text=True)

ui = 'docs/UI_DESIGN_SYSTEM.md'
if '冻结明细始终脱离正文布局' in read(ui):
    print('Source preparation already applied; preserving subsequent edits.')
    raise SystemExit(0)

# Preserve untouched chart lifecycle, numerical geometry, and market business code.
path = 'src/components/charts/EconomyChart.tsx'
current, baseline = read(path), original(path)
start, end = 'function optionWithTooltipLayer(', 'function hasRenderableSize('
put(path, baseline[:baseline.index(start)] + current[current.index(start):current.index(end)] + baseline[baseline.index(end):])
path = 'src/components/charts/PriceSparkline.tsx'
current, baseline = read(path), original(path)
marker = 'function MarketHistoryChart('
prefix = baseline[:baseline.index(marker)]
prefix = prefix.replace("import type { MarketHistoryBucket }", "import { formatCurrency } from '../../utils/formatters';\nimport type { MarketHistoryBucket }", 1)
style_start = 'const MARKET_AXIS_POINTER_LINE_STYLE = {'
style_end = '\n};'
start = prefix.index(style_start)
end = prefix.index(style_end, start) + len(style_end)
new_start = current.index(style_start)
new_end = current.index(style_end, new_start) + len(style_end)
prefix = prefix[:start] + current[new_start:new_end] + prefix[end:]
put(path, prefix + current[current.index(marker):])
path = 'src/pages/MarketPage.tsx'
put(path, original(path))
replace(path, '  const selectedMarketDetail = marketDetail',
        '  const detailInteractionKey = `${game.userId}:${game.saveEpoch ?? 0}:${model.selectedProvinceId}:${activeAssetKind}:${assetId}`;\n  const selectedMarketDetail = marketDetail')
replace(path, '<CommodityFreezeDisclosure quantity=', '<CommodityFreezeDisclosure key={detailInteractionKey} quantity=')
replace(path, '<PriceSparkline buckets={marketBuckets}', '<PriceSparkline key={detailInteractionKey} buckets={marketBuckets}')
path = 'src/styles/safe-floating.css'
put(path, original(path) + "\n/* One ordinary, bounded host above the mobile Sheet; never a new Portal root. */\n.workspace-dialog-layer > .workspace-tooltip-layer {\n  z-index: 100;\n}\n\n.safe-tooltip[data-interactive='true'] {\n  pointer-events: auto !important;\n  overscroll-behavior: contain;\n  touch-action: pan-y;\n}\n")

paragraph(ui, '- 游戏端与管理员端普通 Tooltip 统一由 `SignedInShell`',
          '- 游戏端与管理员端普通 Tooltip 统一由 `SignedInShell` 提供唯一共享宿主 `.workspace-tooltip-layer`，物理层级与安全矩形以 `LIQUID_GLASS_CHROME_DESIGN.md` 为准。宿主必须保持普通 DOM 子层、`pointer-events: none`，不得给宿主添加 `popover`、调用 `showPopover()` 或整体进入浏览器 Top Layer，也不得创建新的根级 Portal 或第五个全局层。普通非 Tooltip Popover、下拉菜单、上下文菜单、确认框和普通页面 Dialog 继续使用 `.workspace-floating-layer`，或由业务容器在自身边界内完成 `confine`；移动 Sheet 和通知仍使用现有 `.workspace-dialog-layer`。')
paragraph(ui, '冻结数量复用 `SafeTooltip`',
          '冻结数量复用 `SafeTooltip` 的安全定位、唯一共享宿主与 hover／focus 内核；冻结明细始终脱离正文布局，不得插入摘要网格、预留明细空白、展开正文或创建第二个 Sheet、backdrop、全屏命中层及页面滚动锁。桌面悬浮／键盘聚焦预览，桌面点击／移动端轻点保持打开；首次点击必须兼容先聚焦后点击的事件顺序，移入浮层可以继续阅读，再次点击数值、点击外部、Escape 或商品／地区／玩家／存档上下文切换时关闭。Escape 只关闭当前明细，不继续关闭商品详情。只为该模式开放实际浮层节点的命中与内部滚动，共享透明宿主与其他普通提示仍不拦截事件；长明细必须在安全区内翻转、收敛并只滚动浮层内容。保留商品插画、摘要卡、四项指标顺序、桌面四列及移动两列；冻结触发器的行盒与普通数值一致，同排标题和数值基线分别对齐，不以偏移量补齐。打开、关闭和刷新明细前后，摘要、插画、图表与交易控件的位置和尺寸不变。列表按类型分组，来源名称可换行，数量保持整数右对齐，使用已有间距和字体令牌；总数与明细来自同一玩家资产状态，无冻结显示“暂无冻结”，明细缺失或合计不符显示“冻结来源明细暂不可用”，不显示保障目标和缺口。')
page_doc = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
paragraph(page_doc, '地区商品详情的“冻结库存”数字',
          '地区商品详情的“冻结库存”数字只通过共享安全悬浮框披露冻结类型、具体建筑／合同／拍卖来源及各数量，不向正文增加明细区域。点击保持打开、键盘、触摸、关闭和布局稳定性统一遵循 `UI_DESIGN_SYSTEM.md` 的“商品冻结来源披露”；金额或库存字段不变成新的自动经营配置。')
chrome = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
replace(chrome, '## 6. 移动与浮层\n',
        '## 6. 移动与浮层\n\n- 唯一 `.workspace-tooltip-layer` 作为现有 `.workspace-dialog-layer` 的普通 DOM 子层，使用独立局部层级位于根 Sheet 内容上方；不得建立第五个全局层或把整个宿主提升为浏览器 Popover。它的安全矩形仍由既有 `.workspace-floating-layer` 实际边界提供，并与当前视觉视口取交集；窗口、字体、侧栏或安全区变化只更新该宿主的固定定位矩形，不改变页面、Sheet 尺寸或布局。宿主始终 `pointer-events: none`，实际节点的交互模式归 UI 设计。React／地图提示仍由各自实际节点进入 Top Layer；ECharts 节点继续由库管理并 `appendTo` 唯一宿主，由 `EconomyChart` 同时约束在图表与工作区的可见交集，不能仅依靠提示节点的高 `z-index` 穿越祖先层叠上下文。状态栏、桌面侧栏和可见移动底栏始终在安全矩形之外；不增加遮罩、装饰玻璃容器或滚动锁。\n')
market = 'docs/MARKET_CHART_LAYOUT_DESIGN.md'
paragraph(market, '- 竖向指针必须在零间距双 Grid',
          '- 竖向指针必须在零间距双 Grid 中保持同一 x 坐标、线宽、虚线段长和节奏，视觉上从价格区连续贯穿成交量区。两个指针关闭独立动画，按同一日桶中心同步更新；虚线相位必须按实际绘制方向和相邻区高度连续衔接，不能在分区边界重新起算。真实上下指针横坐标误差不得超过 1 个 CSS 像素。')
paragraph(market, '- Tooltip 只展示当前日桶的日期',
          '- Tooltip 只展示当前日桶的日期、价格、总成交量、主动买入、主动卖出、方向未知和净主动量，不得显示玩家身份、订单来源或交易对手。整数价格刻度仅属于纵轴；Tooltip 与无障碍摘要中的实际价格必须复用共享金额格式，例如 `16.03` 不能被显示为 `16`。')
paragraph(market, '- 指针首次进入行情数据区或在数据区横向移动时',
          '- 行情外层 Pointer 事件是唯一主动触发入口：先把横向位置解析为同一个自然日，再在一帧内驱动该日中心对应的 Tooltip 与联动 AxisPointer；ECharts 原生鼠标／点击触发设置为 `none`，不得与外层手动驱动并行竞争。第一次有效 `pointermove` 或移动端 `pointerdown` 必须显示提示，不要求触碰价格线或成交柱；连续移动通过 `requestAnimationFrame` 合并，价格区和成交量区不得独立取整。移动端轻点后抬手保持当前日提示，不能把触摸释放产生的 `pointerleave` 当成鼠标离开；纵向滚动仍属于页面，触摸取消及时清除提示。')
paragraph(market, '- Tooltip 只允许在指针离开行情数据区',
          '- 鼠标离开行情数据区、触摸取消、用户主动滚动承载页面、点击外部、Escape、商品／地区／玩家／存档上下文切换及页面卸载时隐藏 Tooltip，并同时清除上下指针、选中日期和尚未执行的显示帧，防止残留或关闭后闪回；Escape 不继续关闭下层详情。不得使用 `alwaysShowContent`、超长 `hideDelay` 或禁止正常离开隐藏掩盖更新重置。浮层物理层级归外壳设计，行情继续复用 `EconomyChart` 的唯一工作区宿主，不自建 Tooltip 或改造 ECharts 节点为 Popover。')
paragraph(market, '- 真实日桶数据或 30 天窗口变化需要更新 ECharts Option 时',
          '- 真实日桶数据、30 天窗口或尺寸变化需要更新 ECharts Option 时，必须在 Option 应用／resize 后按当前指针横向位置重新计算日期并恢复同一个 Tooltip，不要求用户再次移动；普通无关重渲染不得更换 ECharts 实例。')
replace(market, '## 4. 成交量可读性与动态总高度',
        '交互回归由 `tests/browser/market-pointer-interaction.spec.ts` 覆盖桌面与真实触摸的移动 Sheet：读取公开轴值和像素位置验证上下对齐，临时命中探测验证提示实际绘制在 Sheet 之上而非仅有可见 DOM，并验证唯一普通宿主、共享毛玻璃、安全区、125% 字号、轮询／真实 Option 更新、取消与上下文清理；冻结来源几何与长列表回归由 `tests/browser/commodity-freeze-details.spec.ts` 负责。\n\n## 4. 成交量可读性与动态总高度')

# Replace the obsolete structural assertion without weakening the one-host rule.
path = 'scripts/verify-game-shell-layout.mjs'
old = '''if (!(sharedShell.indexOf('className="workspace-floating-layer"') >= 0
  && sharedShell.indexOf('className="workspace-floating-layer"') < sharedShell.indexOf('className="workspace-tooltip-layer"'))) {
  failures.push('共享 Tooltip 宿主必须作为工作区安全浮层的子层存在，不得创建第五个根级 Portal');
}'''
new = '''const tooltipHostPattern = /className="workspace-dialog-layer"[\\s\\S]*?<div\\s+ref=\\{setTooltipLayer\\}\\s+className="workspace-tooltip-layer"/;
if (!tooltipHostPattern.test(sharedShell)
  || (sharedShell.match(/data-workspace-tooltip-layer="true"/g) ?? []).length !== 1
  || !sharedShell.includes('floatingLayer.getBoundingClientRect()')) {
  failures.push('唯一普通 Tooltip 宿主必须位于既有 Dialog 层，安全矩形仍来自工作区，不得新增根级 Portal');
}'''
replace(path, old, new)
replace(path, "'floatingLayer.getBoundingClientRect()', 'const portalTarget = tooltipLayer'",
        "'floatingLayer?.getBoundingClientRect()', 'const portalTarget = tooltipLayer'")

# Extend the existing real-shell fixture, not a second fake layout.
path = 'tests/browser/market-runtime-harness.tsx'
replace(path, "import '../../src/styles/viewport.css';",
        "import '../../src/styles/viewport.css';\nimport '../../src/styles/game-shell-layout.css';\nimport '../../src/styles/safe-floating.css';")
replace(path, "import '../../src/styles/market-page-polish.css';",
        "import '../../src/styles/market-page-polish.css';\nimport '../../src/styles/market-detail-direct-flow.css';")
replace(path, "document.documentElement.dataset.appSurface = 'game';",
        "document.documentElement.dataset.appSurface = 'game';\nlet chartRevision = 0;")
replace(path, '  return {\n    provinceId,\n    assetKind,',
        "  if (params.has('fractional') && assetKind === 'commodity') {\n    market.lastPrice = 16.03 + chartRevision / 100;\n    market.priceHistory = market.priceHistory.map((point) => ({ ...point, price: market.lastPrice }));\n  }\n  return {\n    provinceId,\n    assetKind,")
replace(path, 'revision: `market-runtime:${provinceId}:${assetKind}:${assetId}`,',
        'revision: `market-runtime:${provinceId}:${assetKind}:${assetId}:${chartRevision}`,')
replace(path, '  const [orderPrice, setOrderPrice] = useState(2);',
        '''  const [orderPrice, setOrderPrice] = useState(2);
  const [selectedProvinceId, setSelectedProvinceId] = useState('110000');
  const [saveEpoch, setSaveEpoch] = useState(0);
  const [marketRevision, setMarketRevision] = useState(0);
  useEffect(() => {
    const changeContext = (event: Event) => {
      const kind = (event as CustomEvent<{ kind: string }>).detail.kind;
      if (kind === 'province') setSelectedProvinceId((value) => value === '110000' ? '120000' : '110000');
      if (kind === 'asset') setMarketAssetId((value) => value === 'wheat' ? 'product-2' : 'wheat');
      if (kind === 'save') setSaveEpoch((value) => value + 1);
      if (kind === 'price') { chartRevision += 1; setMarketRevision(chartRevision); }
    };
    window.addEventListener('market-fixture-context', changeContext);
    return () => window.removeEventListener('market-fixture-context', changeContext);
  }, []);''')
replace(path, '        productId: product.id,\n        lastPrice:',
        '        productId: product.id,\n        lastTradeAt: fixedNow + marketRevision,\n        lastPrice:')
replace(path, '    const game = {\n      version:', '    const game = {\n      saveEpoch,\n      version:')
replace(path, "inventoryFreezeDetails: scenario === 'freeze-details' ? { wheat: [",
        "inventoryFreezeDetails: scenario === 'freeze-long' ? { wheat: Array.from({ length: 32 }, (_, index) => ({ kind: 'production', sourceId: `long-${index}`, label: `很长的商品冻结来源建筑名称用于验证完整换行与浮层内部滚动 ${index + 1}`, quantity: 10 + (index === 0 ? freezeExtra : 0) })) } : scenario === 'freeze-details' ? { wheat: [")
replace(path, "      selectedProvinceId: '110000',\n      selectedProvince: { id: '110000', name: '加利福尼亚州' },\n      setSelectedProvinceId: () => {},",
        "      selectedProvinceId,\n      selectedProvince: { id: selectedProvinceId, name: selectedProvinceId === '110000' ? '加利福尼亚州' : '得克萨斯州' },\n      setSelectedProvinceId,")
replace(path, '  }, [\n    freezeExtra,', '  }, [\n    freezeExtra,\n    selectedProvinceId,\n    saveEpoch,\n    marketRevision,')

# Freeze geometry snapshots must wait for the independently fetched market detail.
path = 'tests/browser/commodity-freeze-details.spec.ts'
replace(path, "      await expect(page.locator('.market-history-echart')).toHaveAttribute('data-echarts-ready', 'true');",
        "      await expect(page.locator('.market-history-echart')).toHaveAttribute('data-echarts-ready', 'true');\n      await expect(page.getByText('正在加载当前市场行情…')).toHaveCount(0);")

for path, content in changes.items():
    Path(path).write_text(content)
print(json.dumps({'prepared_paths': sorted(changes)}, ensure_ascii=False, indent=2))
