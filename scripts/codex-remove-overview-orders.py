from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, source: str) -> None:
    Path(path).write_text(source if source.endswith('\n') else source + '\n', encoding='utf-8')


def replace_once(source: str, old: str, new: str, path: str) -> str:
    if old not in source:
        raise RuntimeError(f'{path}: missing expected text: {old[:120]}')
    return source.replace(old, new, 1)


def regex_once(source: str, pattern: str, repl: str, path: str) -> str:
    updated, count = re.subn(pattern, repl, source, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{path}: expected one regex match, got {count}: {pattern}')
    return updated

# PageRouter: overview no longer subscribes to market order/quote/calendar slices.
path = 'src/pages/PageRouter.tsx'
source = read(path)
old = """  home: [
    'catalog',
    'player.identity',
    'player.assets',
    'player.production',
    'player.progression',
    'market.orders',
    'market.quotes',
    'market.calendar',
  ],"""
new = """  home: [
    'catalog',
    'player.identity',
    'player.assets',
    'player.production',
    'player.progression',
  ],"""
source = replace_once(source, old, new, path)
write(path, source)

# Industry design: preserve legal fractional official prices in profit presentation.
path = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md'
source = read(path)
old = '当日官方系统价必须使用统一两位小数价格边界：不低于 0.01、最多两位小数；客户端不得要求官方价为整数或不低于 1。'
new = '当日官方系统价必须使用统一两位小数价格边界：不低于 0.01、最多两位小数；客户端不得要求成交价为整数或不低于 1，也不得把低于 1 的合法官方价截断为 1。'
source = replace_once(source, old, new, path)
write(path, source)

# Page content owner: overview has two business summaries and no player resting-order module.
path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
source = read(path)
replacements = [
    ('- 生产摘要、资产与银行和当前挂单三张核心经营卡；', '- 生产摘要和资产与银行两张核心经营卡；'),
    ('生产异常、主动停工与本人未完成挂单统一由通知中心派生，并同时可以由战略追踪器“进行中”只读投影；概览不复制这些规则或数量。', '生产异常与主动停工统一由通知中心派生，并同时可以由战略追踪器“进行中”只读投影；玩家商品即时交易没有未完成挂单，概览与通知中心不得恢复玩家商品挂单摘要。'),
    ('主列第二排固定为生产摘要、资产与银行和当前挂单。主列内容宽度大于 `1050px` 时三卡同排并统一约 `320px` 高；不足时改为两列且挂单卡跨两列，不大于 `580px` 时全部单列并恢复自然高度。`1920×1080` 下应同时看到主列核心内容和战略追踪器；`1440×900` 下至少必须显示主列摘要标题与战略追踪器标题。', '主列第二排固定为生产摘要和资产与银行两张核心经营卡。主列内容宽度大于 `1050px` 时两卡同排并统一约 `320px` 高；`581px–1050px` 时继续两列但恢复自然高度；不大于 `580px` 时改为单列并保持自然高度。`1920×1080` 下应同时看到主列核心内容和战略追踪器；`1440×900` 下至少必须显示主列摘要标题与战略追踪器标题。'),
    ('资产与银行卡只显示现金、商品估值、工厂估值、冻结资金，以及服务器权威的可支配资产、冻结资产和贷款负债；不得恢复当前浏览器本地资金变化，也不得重复状态栏已经显示的净资产和排名。当前挂单只显示一次买卖统计、冻结资金和订单列表；列表在固定卡片内滚动，概览不提供撤单按钮。生产摘要优先显示正在运行、生产受阻、主动停工和理论日产量，不以总工厂数掩盖异常。', '资产与银行卡只显示现金、商品估值、工厂估值、冻结资金，以及服务器权威的可支配资产、冻结资产和贷款负债；不得恢复当前浏览器本地资金变化，也不得重复状态栏已经显示的净资产和排名。概览不得显示“当前挂单”、管理订单、玩家买卖单统计、开放订单列表或订单专用滚动区；冻结资金只作为资产状态展示，不解释为商品挂单占用。生产摘要优先显示正在运行、生产受阻、主动停工和理论日产量，不以总工厂数掩盖异常。'),
]
for old, new in replacements:
    source = replace_once(source, old, new, path)
if '当前挂单' in source:
    raise RuntimeError(f'{path}: stale overview resting-order wording remains')
write(path, source)

# Overview layout owner: two summaries, no order-card geometry or internal order scroll root.
path = 'docs/OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md'
source = read(path)
replacements = [
    ('概览正文只负责签到、生产摘要、资产与银行、当前挂单，不持有桌面或移动教程、公开事件、今日经营、基础工作或第二套经营提醒。', '概览正文只负责签到、生产摘要和资产与银行，不持有玩家挂单摘要、桌面或移动教程、公开事件、今日经营、基础工作或第二套经营提醒。'),
    ('工作区左侧：概览 PageLayout → 本周签到 → 三张经营摘要', '工作区左侧：概览 PageLayout → 本周签到 → 两张经营摘要'),
    ('- 概览真实内容宽度大于 `1050px` 时三张摘要卡同排；\n- 不大于 `1050px` 时摘要两列，当前挂单跨两列；\n- 不大于 `580px` 时摘要全部单列并恢复自然高度；', '- 概览真实内容宽度大于 `1050px` 时两张摘要卡同排并保持统一摘要高度；\n- `581px–1050px` 时两张摘要卡继续两列并恢复自然高度；\n- 不大于 `580px` 时两张摘要卡单列并保持自然高度；'),
    ('- 当前挂单只有超过三条时使用 `overview-open-orders-list--scrollable`；\n- 服务器权威资产状态不得内部滚动；', '- 概览不得建立玩家开放订单列表或订单专用内部滚动根；\n- 服务器权威资产状态不得内部滚动；'),
    ('- “当前挂单”只显示本人未完成订单摘要和列表，不提供概览撤单。', '- 玩家商品挂单已经退役，概览不得恢复开放订单摘要、订单列表、管理订单入口或订单滚动区。'),
    ('7. 签到七格、短挂单和长挂单滚动语义；', '7. 签到七格、两张经营摘要以及玩家挂单入口不存在；'),
    ('- `src/pages/OverviewPage.tsx`：签到、经营摘要和挂单；不得持有教程或公开事件；', '- `src/pages/OverviewPage.tsx`：签到与两张经营摘要；不得持有玩家挂单、教程或公开事件；'),
]
for old, new in replacements:
    source = replace_once(source, old, new, path)
if '当前挂单' in source or '三张经营摘要' in source:
    raise RuntimeError(f'{path}: stale three-card/resting-order wording remains')
write(path, source)

# UI design owns generic visual rules, not duplicated overview business content.
path = 'docs/UI_DESIGN_SYSTEM.md'
source = read(path)
source, count = re.subn(r'\n- 概览页“当前挂单”卡：[^\n]*\n', '\n', source, count=1)
if count != 1:
    raise RuntimeError(f'{path}: overview order scroll bullet not found')
section = """## 10. 概览布局

概览单页的模块数量、业务内容、断点与局部几何统一由 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 与 `OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md` 负责。本文只要求概览复用通用 `PageLayout`、`Panel`、数据行、按钮、颜色、滚动和可访问性规则，不维护签到、经营摘要数量或订单卡等单页业务副本。玩家商品挂单退役后不得以 UI 兼容理由恢复“当前挂单”、订单列表、管理订单入口或订单专用滚动根。
"""
source = regex_once(source, r'## 10\. 概览布局\n.*?(?=\n## 11\.)', section.rstrip(), path)
write(path, source)

# Overview CSS: two summary columns; remove all order-card-only selectors and responsive spans.
path = 'src/styles/overview.css'
source = read(path)
source = replace_once(source, 'grid-template-columns: repeat(3, minmax(0, 1fr));', 'grid-template-columns: repeat(2, minmax(0, 1fr));', path)
source = regex_once(source, r'\n\.overview-order-summary \{.*?(?=\n/\* Viewport fallbacks)', '\n', path)
source = re.sub(r'\n\s*\.overview-open-orders-card \{[^{}]*\}\n', '\n', source)
source = source.replace('.overview-open-orders-list,\n  .overview-asset-events', '.overview-asset-events')
source = source.replace('a nominal desktop viewport always has enough room for five readable cards.', 'a nominal desktop viewport always has enough room for the summary cards.')
if 'overview-open-order' in source:
    raise RuntimeError(f'{path}: order-card CSS remains')
write(path, source)

# Overview polish: remove order-list density/scroll rules.
path = 'src/styles/overview-polish.css'
source = read(path)
source = source.replace('.overview-asset-events,\n.overview-open-orders-list {', '.overview-asset-events {')
source = re.sub(r'\n\.overview-open-orders-list--scrollable \{.*?\}\n', '\n', source, count=1, flags=re.S)
source = source.replace('.overview-asset-events > div:not(.empty-state),\n.overview-open-order {', '.overview-asset-events > div:not(.empty-state) {')
source = source.replace('\n.overview-open-order-identity small,', '')
source = source.replace('\n.overview-open-order-values small,', '')
if 'overview-open-order' in source:
    raise RuntimeError(f'{path}: order polish remains')
write(path, source)

# Overview verifier: enforce no market slice subscription and no order-card restoration.
path = 'scripts/verify-overview-content.mjs'
source = read(path)
source = replace_once(source, "  \"'player.progression'\",\n  \"'market.orders'\",\n  \"'market.quotes'\",\n  \"'market.calendar'\",", "  \"'player.progression'\",", path)
source = replace_once(source, "forbidAll(paths.router, ['localStorage', 'sessionStorage', 'marketAssetId']);", "forbidAll(paths.router, ['localStorage', 'sessionStorage', 'marketAssetId']);\nconst homeDependencyBlock = read(paths.router).split('home: [')[1]?.split('],\\n  map:')[0] ?? '';\nif (homeDependencyBlock.includes(\"'market.\")) failures.push('OverviewPage 不得再订阅 market.* 切片');", path)
source = source.replace("  'overview-open-orders-list--scrollable',\n", '')
source = source.replace("  'title=\"当前挂单\"',\n", '')
source = replace_once(source, "  '/ 7 天',\n]);", "  '/ 7 天',\n  'title=\"当前挂单\"',\n  '管理订单',\n  'ownOpenOrders',\n  'overview-open-orders-card',\n  'overview-open-orders-list',\n  'overview-open-order',\n  'orderAssetId(',\n  'orderKind(',\n  'orderStatusNames',\n]);", path)
source = replace_once(source, "  '@container overview (max-width: 580px)',\n  'overflow-y: visible;',", "  '@container overview (max-width: 580px)',\n  'grid-template-columns: repeat(2, minmax(0, 1fr));',\n  'overflow-y: visible;',", path)
source = replace_once(source, "forbidAll(paths.overviewStyle, [\n  '384px',", "forbidAll(paths.overviewStyle, [\n  'overview-open-order',\n  'overview-open-orders-card',\n  '384px',", path)
source = replace_once(source, "requireAll(paths.polishStyle, [\n  '--overview-summary-card-height: 330px;',\n  '.overview-open-orders-list--scrollable {',\n  'overflow-y: auto;',\n  '.overview-check-in-day small {',\n]);", "requireAll(paths.polishStyle, [\n  '--overview-summary-card-height: 330px;',\n  '.overview-assets-card .overview-core-data .ui-data-row',\n  '.overview-check-in-day small {',\n]);\nforbidAll(paths.polishStyle, ['overview-open-order', 'overview-open-orders-list']);", path)
source = replace_once(source, "  'overview only scrolls the order list after the visible capacity is exceeded',", "  'overview does not expose retired player resting-order summaries',", path)
source = replace_once(source, "requireAll(paths.uiDesign, ['## 10. 概览布局', '经营决策优先', '签到日历']);", "requireAll(paths.uiDesign, ['## 10. 概览布局', '`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`', '`OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md`', '不得以 UI 兼容理由恢复“当前挂单”']);", path)
source = replace_once(source, "  '资产与银行',\n  '可支配资产、冻结资产和贷款负债',", "  '资产与银行',\n  '两张经营摘要',\n  '玩家商品挂单已经退役',\n  '可支配资产、冻结资产和贷款负债',", path)
source = replace_once(source, "for (const path of [paths.pageDesign, paths.uiDesign, paths.integrityDesign]) forbidText(path, '统一为 `384px` 高');", "for (const path of [paths.pageDesign, paths.integrityDesign]) {\n  forbidText(path, '统一为 `384px` 高');\n  forbidText(path, '当前挂单');\n}\nforbidText(paths.uiDesign, '统一为 `384px` 高');", path)
write(path, source)

# Browser regression: legacy/many-order fixtures must not produce any overview order UI.
path = 'tests/browser/runtime.spec.ts'
source = read(path)
source = replace_once(source, "  await expect(page.getByRole('heading', { name: '当前挂单', exact: true })).toBeVisible();", "  await expect(page.getByRole('heading', { name: '当前挂单', exact: true })).toHaveCount(0);", path)
old_test_pattern = r"test\('overview only scrolls the order list after the visible capacity is exceeded', async \(\{ page \}\) => \{.*?\n\}\);\n\n"
new_test = """test('overview does not expose retired player resting-order summaries', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=many-orders');

  await expect(page.getByRole('heading', { name: '当前挂单', exact: true })).toHaveCount(0);
  await expect(page.getByText('管理订单', { exact: true })).toHaveCount(0);
  await expect(page.locator('.overview-open-orders-card, .overview-open-orders-list, .overview-open-order')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

"""
source = regex_once(source, old_test_pattern, new_test, path)
source = replace_once(source, "  await expect(summaryCards).toHaveCount(3);\n  const summaryBoxes = await Promise.all([0, 1, 2].map((index) => requireBox(summaryCards.nth(index))));\n  expect(Math.max(...summaryBoxes.map((box) => box.width)) - Math.min(...summaryBoxes.map((box) => box.width))).toBeLessThan(2);\n  expect(summaryBoxes[1].y).toBeGreaterThan(summaryBoxes[0].y);\n  expect(summaryBoxes[2].y).toBeGreaterThan(summaryBoxes[1].y);", "  await expect(summaryCards).toHaveCount(2);\n  const summaryBoxes = await Promise.all([0, 1].map((index) => requireBox(summaryCards.nth(index))));\n  expect(Math.max(...summaryBoxes.map((box) => box.width)) - Math.min(...summaryBoxes.map((box) => box.width))).toBeLessThan(2);\n  expect(summaryBoxes[1].y).toBeGreaterThan(summaryBoxes[0].y);", path)
write(path, source)

print('Overview resting-order UI and stale fractional-price design rules removed.')
