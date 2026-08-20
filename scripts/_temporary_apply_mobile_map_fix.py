from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one match, found {count}: {old[:120]!r}')
    write(path, content.replace(old, new, 1))


# Shared ECharts wrapper: expose raw canvas clicks so map blank-space taps can be handled
# without depending on private SVG DOM.
replace_once(
    'src/components/charts/EconomyChart.tsx',
    """export interface EconomyChartDoubleClickEvent {\n  target?: unknown;\n  topTarget?: unknown;\n}\n""",
    """export interface EconomyChartDoubleClickEvent {\n  target?: unknown;\n  topTarget?: unknown;\n  event?: {\n    pointerType?: string;\n    type?: string;\n    timeStamp?: number;\n  };\n}\n\nexport interface EconomyChartCanvasClickEvent {\n  target?: unknown;\n  topTarget?: unknown;\n  offsetX?: number;\n  offsetY?: number;\n  event?: {\n    pointerType?: string;\n    type?: string;\n    timeStamp?: number;\n  };\n}\n""",
)
replace_once(
    'src/components/charts/EconomyChart.tsx',
    """  onResize,\n  onClick,\n  onDoubleClick,\n}: {\n""",
    """  onResize,\n  onClick,\n  onCanvasClick,\n  onDoubleClick,\n}: {\n""",
)
replace_once(
    'src/components/charts/EconomyChart.tsx',
    """  onResize?: (chart: EChartsType, size: EconomyChartSize) => void;\n  onClick?: (event: EconomyChartClickEvent) => void;\n  onDoubleClick?: (event: EconomyChartDoubleClickEvent, chart: EChartsType) => void;\n}) {\n""",
    """  onResize?: (chart: EChartsType, size: EconomyChartSize) => void;\n  onClick?: (event: EconomyChartClickEvent) => void;\n  onCanvasClick?: (event: EconomyChartCanvasClickEvent, chart: EChartsType) => void;\n  onDoubleClick?: (event: EconomyChartDoubleClickEvent, chart: EChartsType) => void;\n}) {\n""",
)
replace_once(
    'src/components/charts/EconomyChart.tsx',
    """  const onResizeRef = useRef(onResize);\n  const onClickRef = useRef(onClick);\n  const onDoubleClickRef = useRef(onDoubleClick);\n""",
    """  const onResizeRef = useRef(onResize);\n  const onClickRef = useRef(onClick);\n  const onCanvasClickRef = useRef(onCanvasClick);\n  const onDoubleClickRef = useRef(onDoubleClick);\n""",
)
replace_once(
    'src/components/charts/EconomyChart.tsx',
    """  onResizeRef.current = onResize;\n  onClickRef.current = onClick;\n  onDoubleClickRef.current = onDoubleClick;\n""",
    """  onResizeRef.current = onResize;\n  onClickRef.current = onClick;\n  onCanvasClickRef.current = onCanvasClick;\n  onDoubleClickRef.current = onDoubleClick;\n""",
)
replace_once(
    'src/components/charts/EconomyChart.tsx',
    """    const handleClick = (event: unknown) => {\n      onClickRef.current?.(event as EconomyChartClickEvent);\n    };\n    const handleDoubleClick = (event: unknown) => {\n""",
    """    const handleClick = (event: unknown) => {\n      onClickRef.current?.(event as EconomyChartClickEvent);\n    };\n    const handleCanvasClick = (event: unknown) => {\n      onCanvasClickRef.current?.(event as EconomyChartCanvasClickEvent, chart);\n    };\n    const handleDoubleClick = (event: unknown) => {\n""",
)
replace_once(
    'src/components/charts/EconomyChart.tsx',
    """    chart.on('click', handleClick);\n    chart.getZr().on('dblclick', handleDoubleClick);\n""",
    """    chart.on('click', handleClick);\n    chart.getZr().on('click', handleCanvasClick);\n    chart.getZr().on('dblclick', handleDoubleClick);\n""",
)
replace_once(
    'src/components/charts/EconomyChart.tsx',
    """      chart.off('click', handleClick);\n      chart.getZr().off('dblclick', handleDoubleClick);\n""",
    """      chart.off('click', handleClick);\n      chart.getZr().off('click', handleCanvasClick);\n      chart.getZr().off('dblclick', handleDoubleClick);\n""",
)

# Map implementation: visible mobile labels, map-specific palette, global roam, and touch double-tap reset.
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    "import { useCallback, useMemo } from 'react';",
    "import { useCallback, useMemo, useRef } from 'react';",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """  EconomyChart,\n  type EconomyChartClickEvent,\n  type EconomyChartDoubleClickEvent,\n} from '../charts/EconomyChart';\n""",
    """  EconomyChart,\n  type EconomyChartCanvasClickEvent,\n  type EconomyChartClickEvent,\n  type EconomyChartDoubleClickEvent,\n} from '../charts/EconomyChart';\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """const US_MAINLAND_ASPECT_SCALE = 0.75;\nconst MAP_CONTAIN_INSET = 0.96;\n""",
    """const US_MAINLAND_ASPECT_SCALE = 0.75;\nconst MAP_CONTAIN_INSET = 0.96;\nconst MOBILE_BLANK_DOUBLE_TAP_MS = 360;\nconst MOBILE_BLANK_DOUBLE_TAP_DISTANCE = 28;\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """  const areaColor = locked\n    ? 'var(--color-surface-muted)'\n    : lens === 'political'\n    ? 'var(--color-surface-soft)'\n""",
    """  const areaColor = locked\n    ? 'var(--color-map-region-locked)'\n    : lens === 'political'\n    ? 'var(--color-map-region-default)'\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """      ? facilityCount > 0 ? 'var(--color-success-soft)' : 'var(--color-surface-soft)'\n      : lens === 'market'\n        ? openOrderCount > 0 ? 'var(--color-warning-soft)' : 'var(--color-surface-soft)'\n        : lens === 'alerts'\n          ? blockedFacilityCount > 0 ? 'var(--color-danger-soft)' : 'var(--color-surface-soft)'\n""",
    """      ? facilityCount > 0 ? 'var(--color-success-soft)' : 'var(--color-map-region-default)'\n      : lens === 'market'\n        ? openOrderCount > 0 ? 'var(--color-warning-soft)' : 'var(--color-map-region-default)'\n        : lens === 'alerts'\n          ? blockedFacilityCount > 0 ? 'var(--color-danger-soft)' : 'var(--color-map-region-default)'\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """            : hasAssets\n              ? 'var(--color-success-soft)'\n              : 'var(--color-surface-soft)';\n""",
    """            : hasAssets\n              ? 'var(--color-success-soft)'\n              : 'var(--color-map-region-default)';\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """  const data = useMemo(() => provinces.map((province) => (\n    datumFor(province, summaries[province.id], lens, !unlockedSet.has(province.id))\n  )), [lens, provinces, summaries, unlockedSet]);\n""",
    """  const data = useMemo(() => provinces.map((province) => (\n    datumFor(province, summaries[province.id], lens, !unlockedSet.has(province.id))\n  )), [lens, provinces, summaries, unlockedSet]);\n  const lastBlankTapRef = useRef<{ at: number; x: number; y: number } | null>(null);\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """      selectedMap,\n      roam: true,\n      scaleLimit: { min: 1, max: 8 },\n""",
    """      selectedMap,\n      roam: true,\n      roamTrigger: 'global',\n      scaleLimit: { min: 1, max: 8 },\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """        show: true,\n        color: 'var(--color-text-secondary)',\n        fontFamily: 'inherit',\n""",
    """        show: true,\n        color: 'var(--color-map-label)',\n        fontFamily: 'inherit',\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """      itemStyle: {\n        areaColor: 'var(--color-surface-soft)',\n        borderColor: 'var(--color-border-strong)',\n        borderWidth: 1,\n      },\n""",
    """      itemStyle: {\n        areaColor: 'var(--color-map-region-default)',\n        borderColor: 'var(--color-map-region-border)',\n        borderWidth: 1,\n      },\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """    media: [{\n      query: {\n        maxAspectRatio: 0.8,\n      },\n      option: {\n        series: [{\n          label: {\n            show: false,\n          },\n          data: data.map((datum) => ({\n            ...datum,\n            label: { show: false },\n          })),\n        }],\n      },\n    }],\n""",
    """    media: [{\n      query: {\n        maxAspectRatio: 0.8,\n      },\n      option: {\n        series: [{\n          id: 'us-mainland-map',\n          label: {\n            show: true,\n            fontSize: 8,\n          },\n        }],\n      },\n    }],\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """  const handleMapDoubleClick = useCallback((\n    event: EconomyChartDoubleClickEvent,\n    chart: EChartsType,\n  ) => {\n    if (event.target) return;\n    applyContainCamera(chart);\n    chart.getDom().dataset.mapCameraReset = 'blank-double-click';\n  }, [applyContainCamera]);\n\n  const accessibleSummary = `美国本土州级经营地图，共 ${provinces.length} 个可经营地区。${selectedProvince ? `当前打开${selectedProvince.name}页面。` : '当前没有打开州页面。'}点击州面可以打开对应州页面，双击地图空白可以重置缩放和平移。`;\n""",
    """  const handleMapCanvasClick = useCallback((\n    event: EconomyChartCanvasClickEvent,\n    chart: EChartsType,\n  ) => {\n    if (event.target) {\n      lastBlankTapRef.current = null;\n      return;\n    }\n    const pointerType = String(event.event?.pointerType || '');\n    const nativeType = String(event.event?.type || '');\n    if (pointerType !== 'touch' && !nativeType.startsWith('touch')) return;\n    const x = Number(event.offsetX);\n    const y = Number(event.offsetY);\n    if (!Number.isFinite(x) || !Number.isFinite(y)) return;\n    const rawTime = Number(event.event?.timeStamp);\n    const at = Number.isFinite(rawTime) && rawTime > 0 ? rawTime : performance.now();\n    const previous = lastBlankTapRef.current;\n    lastBlankTapRef.current = { at, x, y };\n    if (!previous) return;\n    const elapsed = at - previous.at;\n    const distance = Math.hypot(x - previous.x, y - previous.y);\n    if (elapsed < 0 || elapsed > MOBILE_BLANK_DOUBLE_TAP_MS || distance > MOBILE_BLANK_DOUBLE_TAP_DISTANCE) return;\n    lastBlankTapRef.current = null;\n    applyContainCamera(chart);\n    chart.getDom().dataset.mapCameraReset = 'blank-double-tap';\n  }, [applyContainCamera]);\n\n  const handleMapDoubleClick = useCallback((\n    event: EconomyChartDoubleClickEvent,\n    chart: EChartsType,\n  ) => {\n    if (event.target || event.event?.pointerType === 'touch') return;\n    applyContainCamera(chart);\n    chart.getDom().dataset.mapCameraReset = 'blank-double-click';\n  }, [applyContainCamera]);\n\n  const accessibleSummary = `美国本土州级经营地图，共 ${provinces.length} 个可经营地区。${selectedProvince ? `当前打开${selectedProvince.name}页面。` : '当前没有打开州页面。'}点击州面可以打开对应州页面，拖动地图空白可以平移，双击或双触地图空白可以重置缩放和平移。`;\n""",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    """        onResize={applyContainCamera}\n        onClick={handleMapClick}\n        onDoubleClick={handleMapDoubleClick}\n""",
    """        onResize={applyContainCamera}\n        onClick={handleMapClick}\n        onCanvasClick={handleMapCanvasClick}\n        onDoubleClick={handleMapDoubleClick}\n""",
)

# Map colors are explicit design tokens so ZRender always receives resolved, non-black fills.
replace_once(
    'src/styles/design-system.css',
    """  --color-info: #75c9ff;\n  --color-info-soft: rgba(117, 201, 255, 0.08);\n  --color-accent-violet: #b9a0ff;\n""",
    """  --color-info: #75c9ff;\n  --color-info-soft: rgba(117, 201, 255, 0.08);\n  --color-map-region-default: rgba(44, 73, 59, 0.82);\n  --color-map-region-locked: rgba(34, 54, 46, 0.76);\n  --color-map-region-border: rgba(212, 245, 224, 0.34);\n  --color-map-label: #d7e2dc;\n  --color-accent-violet: #b9a0ff;\n""",
)
replace_once(
    'src/styles/strategic-game-shell.css',
    """.strategic-map-stage .province-map-echart {\n  padding: 0;\n}\n\n.strategic-map-vignette {\n""",
    """.strategic-map-stage .province-map-echart {\n  padding: 0;\n}\n\n.strategic-map-stage .province-map-echart .economy-chart__canvas {\n  touch-action: none;\n  overscroll-behavior: contain;\n}\n\n.strategic-map-vignette {\n""",
)

# Resolve the duplicated/obsolete Cover map design section and record the mobile interaction rules.
ui_path = 'docs/UI_DESIGN_SYSTEM.md'
ui = read(ui_path)
ui = ui.replace('> 更新时间：2026-08-20', '> 更新时间：2026-08-21', 1)
marker = '### 8.1 美国本土州级经营地图'
first = ui.find(marker)
second = ui.find(marker, first + len(marker)) if first >= 0 else -1
if first < 0 or second < 0:
    raise RuntimeError('docs/UI_DESIGN_SYSTEM.md: expected duplicate 8.1 map sections')
end = ui.find('\n## 9. 目录型横向导航', second)
if end < 0:
    raise RuntimeError('docs/UI_DESIGN_SYSTEM.md: section 9 marker missing')
ui = ui[:second] + ui[end:]
old_interaction = '地图表面支持鼠标／触摸点击、拖动和最高 8 倍受限缩放；纵向窄屏必须使用 ECharts `media` 选项按宽度适配美国本土轮廓，并隐藏普通常驻州缩写，只在选中或悬停时显示标签，避免在小地图上重叠。'
new_interaction = "地图表面支持鼠标／触摸点击、拖动和最高 8 倍受限缩放；Map 系列必须同时使用 `roam: true` 与 `roamTrigger: 'global'`，保证州面与地图空白都可以作为平移起点，移动地图画布必须用局部 `touch-action: none` 把手势交给 ECharts 而不得影响其他图表。鼠标双击或触摸双触地图空白必须调用同一个默认 Contain 相机重置缩放和平移，双击／双触州面不得重置。纵向窄屏必须继续显示可读的常驻州缩写：默认字号降低到移动密度并由 `labelLayout.hideOverlap` 消除重叠，CT、DE、MD、MA、NH、NJ、RI、VT 等小州可以保持默认隐藏并仅在选中或悬停时显示；不得通过 `media` 或数据项覆盖把全部州缩写关闭。"
if old_interaction not in ui:
    raise RuntimeError('docs/UI_DESIGN_SYSTEM.md: current mobile map interaction sentence missing')
ui = ui.replace(old_interaction, new_interaction, 1)
old_visual = '地区默认、悬停、当前、资产、工业、市场和异常语义使用区域填充、边界、文字、Tooltip 和五种镜头共同表达；当前地区由 ECharts 单选状态与外部 `selectedProvinceId` 双向同步。'
new_visual = '地区默认、悬停、当前、资产、工业、市场和异常语义使用区域填充、边界、文字、Tooltip 和五种镜头共同表达；默认州面、未解锁州面、州界与州名必须分别读取 `--color-map-region-default`、`--color-map-region-locked`、`--color-map-region-border` 与 `--color-map-label`，不得引用未定义颜色变量或把未解锁州渲染为近纯黑；当前地区由 ECharts 单选状态与外部 `selectedProvinceId` 双向同步。'
if old_visual not in ui:
    raise RuntimeError('docs/UI_DESIGN_SYSTEM.md: current map visual sentence missing')
ui = ui.replace(old_visual, new_visual, 1)
write(ui_path, ui)

page_design_path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
page_design = read(page_design_path)
page_design = page_design.replace('> 更新时间：2026-08-20', '> 更新时间：2026-08-21', 1)
old_reset = '用户双击地图绘图区空白时必须把缩放与平移恢复到完整美国本土地图的默认 Contain 镜头；双击州面不得触发该重置。'
new_reset = "用户使用鼠标双击或触摸双触地图绘图区空白时必须把缩放与平移恢复到完整美国本土地图的默认 Contain 镜头；双击／双触州面不得触发该重置。地图空白与州面都必须可以作为拖动平移起点，移动触摸不得被浏览器页面手势抢占。"
if old_reset not in page_design:
    raise RuntimeError('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md: map reset rule missing')
page_design = page_design.replace(old_reset, new_reset, 1)
write(page_design_path, page_design)

# Strengthen the existing provincial verifier instead of adding a parallel verification system.
verify_path = 'scripts/verify-provincial-economy.mjs'
verify = read(verify_path)
verify = verify.replace(
    """const strategicStyles = read('src/styles/strategic-game-shell.css');\nfor (const text of [\n""",
    """const strategicStyles = read('src/styles/strategic-game-shell.css');\nconst designSystemStyles = read('src/styles/design-system.css');\nfor (const text of [\n""",
    1,
)
verify = verify.replace(
    """  '--strategic-command-rail-width: 78px',\n]) assert.ok(strategicStyles.includes(text), `常驻战略地图样式缺少: ${text}`);\n""",
    """  '--strategic-command-rail-width: 78px',\n  'touch-action: none;',\n  'overscroll-behavior: contain;',\n]) assert.ok(strategicStyles.includes(text), `常驻战略地图样式缺少: ${text}`);\nfor (const text of [\n  '--color-map-region-default:',\n  '--color-map-region-locked:',\n  '--color-map-region-border:',\n  '--color-map-label:',\n]) assert.ok(designSystemStyles.includes(text), `地图设计令牌缺少: ${text}`);\n""",
    1,
)
verify = verify.replace(
    """  \"selectedMode: 'single'\",\n  'const US_MAINLAND_ASPECT_SCALE = 0.75',\n""",
    """  \"selectedMode: 'single'\",\n  \"roamTrigger: 'global'\",\n  'const US_MAINLAND_ASPECT_SCALE = 0.75',\n  'const MOBILE_BLANK_DOUBLE_TAP_MS = 360',\n  'const MOBILE_BLANK_DOUBLE_TAP_DISTANCE = 28',\n""",
    1,
)
verify = verify.replace(
    """  'onClick={handleMapClick}',\n  'selectedProvinceId: string | null',\n""",
    """  'onClick={handleMapClick}',\n  'onCanvasClick={handleMapCanvasClick}',\n  'selectedProvinceId: string | null',\n""",
    1,
)
verify = verify.replace(
    """  \"chart.getDom().dataset.mapCameraReset = 'blank-double-click'\",\n  'onDoubleClick={handleMapDoubleClick}',\n""",
    """  \"chart.getDom().dataset.mapCameraReset = 'blank-double-click'\",\n  \"chart.getDom().dataset.mapCameraReset = 'blank-double-tap'\",\n  'onDoubleClick={handleMapDoubleClick}',\n""",
    1,
)
needle = """}) assert.ok(mapComponent.includes(text), `ECharts 美国本土地图缺少: ${text}`);\nfor (const forbidden of [\n"""
replacement = """}) assert.ok(mapComponent.includes(text), `ECharts 美国本土地图缺少: ${text}`);\nassert.equal(mapComponent.includes("var(--color-surface-muted)"), false, '地图不得引用未定义的 color-surface-muted');\nassert.equal(mapComponent.includes('data: data.map((datum)'), false, '移动地图不得批量覆盖全部州标签为隐藏');\nfor (const forbidden of [\n"""
if needle not in verify:
    raise RuntimeError('verify-provincial-economy: map assertion insertion point missing')
verify = verify.replace(needle, replacement, 1)
verify = verify.replace(
    """  \"'blank-double-click'\",\n  'outlineAspect',\n""",
    """  \"'blank-double-click'\",\n  \"'blank-double-tap'\",\n  \"toHaveCSS('touch-action', 'none')\",\n  'mobile strategy map keeps labels and blank-space gestures usable',\n  'outlineAspect',\n""",
    1,
)
insert_before = """const navigation = read('src/config/navigation.ts');\n"""
design_assertions = """const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');\nassert.equal((uiDesign.match(/### 8\\.1 美国本土州级经营地图/g) ?? []).length, 1, 'UI 设计文档只能保留一份美国本土州级经营地图 8.1 规则');\nfor (const text of [\n  \"roamTrigger: 'global'\",\n  '触摸双触地图空白',\n  '--color-map-region-locked',\n  '不得通过 `media` 或数据项覆盖把全部州缩写关闭',\n]) assert.ok(uiDesign.includes(text), `移动地图设计规则缺少: ${text}`);\nassert.equal(uiDesign.includes('等比 Cover 相机'), false, 'UI 设计文档不得保留旧 Cover 相机冲突规则');\n\n"""
if insert_before not in verify:
    raise RuntimeError('verify-provincial-economy: navigation insertion point missing')
verify = verify.replace(insert_before, design_assertions + insert_before, 1)
verify = verify.replace(
    'ECharts 地图点击和空白双击镜头重置均已锁定。',
    'ECharts 地图点击、移动标签、空白全局平移和空白双击／双触镜头重置均已锁定。',
    1,
)
write(verify_path, verify)

# Add a focused browser regression to the existing map spec.
test_path = 'tests/browser/province-map.spec.ts'
test_source = read(test_path)
marker_text = "mobile strategy map keeps labels and blank-space gestures usable"
if marker_text not in test_source:
    test_source += r'''

test('mobile strategy map keeps labels and blank-space gestures usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(canvas).toHaveCSS('touch-action', 'none');

  const renderedLabels = await map.locator('svg text').allTextContents();
  for (const code of ['CA', 'TX', 'CO', 'FL', 'NY']) expect(renderedLabels).toContain(code);

  const stateFills = await map.locator('svg path').evaluateAll((paths) => paths
    .map((path) => getComputedStyle(path).fill)
    .filter((fill) => fill.startsWith('rgb')));
  expect(stateFills.length).toBeGreaterThanOrEqual(48);
  expect(stateFills.some((fill) => fill === 'rgb(0, 0, 0)' || fill === 'rgba(0, 0, 0, 1)')).toBe(false);

  const initialOutline = await readOutlineGeometry(page);
  let blankPoint = await findMapBlankPoint(page);
  await page.mouse.move(blankPoint.x, blankPoint.y);
  await page.mouse.wheel(0, -480);
  await expect.poll(async () => {
    const outline = await readOutlineGeometry(page);
    return outline.right - outline.left;
  }).toBeGreaterThan((initialOutline.right - initialOutline.left) * 1.05);

  blankPoint = await findMapBlankPoint(page);
  const beforeBlankPan = await readOutlineGeometry(page);
  await page.mouse.move(blankPoint.x, blankPoint.y);
  await page.mouse.down();
  await page.mouse.move(blankPoint.x + 42, blankPoint.y + 24, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => {
    const outline = await readOutlineGeometry(page);
    return Math.abs(outline.left - beforeBlankPan.left) + Math.abs(outline.top - beforeBlankPan.top);
  }).toBeGreaterThan(8);

  blankPoint = await findMapBlankPoint(page);
  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    if (!(target instanceof SVGSVGElement)) throw new Error('mobile blank point must hit the ECharts SVG root');
    const dispatchTouchClick = () => target.dispatchEvent(new PointerEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
    }));
    dispatchTouchClick();
    dispatchTouchClick();
  }, blankPoint);
  await expect(canvas).toHaveAttribute('data-map-camera-reset', 'blank-double-tap');
  await page.waitForTimeout(320);
  const resetOutline = await readOutlineGeometry(page);
  expect(resetOutline.left).toBeCloseTo(initialOutline.left, 0);
  expect(resetOutline.top).toBeCloseTo(initialOutline.top, 0);
  expect(resetOutline.right).toBeCloseTo(initialOutline.right, 0);
  expect(resetOutline.bottom).toBeCloseTo(initialOutline.bottom, 0);
});
'''
write(test_path, test_source)

print('Applied mobile map interaction, visibility, design, verifier, and browser regression changes.')
