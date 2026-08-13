from pathlib import Path
import subprocess


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, content):
    Path(path).write_text(content, encoding='utf-8')


conflicts = {
    line.strip()
    for line in subprocess.check_output(
        ['git', 'diff', '--name-only', '--diff-filter=U'], text=True
    ).splitlines()
    if line.strip()
}
expected = {
    'docs/README.md',
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    'docs/WAREHOUSE_EXPANSION_DESIGN.md',
    'src/pages/ProductionPage.tsx',
    'src/pages/production/ProductionFacilityDetail.tsx',
}
unknown = conflicts - expected
if unknown:
    raise SystemExit(f'Unexpected merge conflicts: {sorted(unknown)}')
for path in sorted(conflicts):
    subprocess.run(['git', 'checkout', '--ours', '--', path], check=True)


doc_sections = {
    'docs/README.md': """### 客户端子修订与叶子时钟索引

客户端仍以六个外层完整状态分区为传输边界；`player / market` 的 `sliceRevisions`、结构共享、`useSyncExternalStore` 子切片 React 消费和共享秒级叶子 ticker 以 `AUTHORITATIVE_COUNTDOWN_DESIGN.md` 为准，服务器 envelope 元数据边界以 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` 为准。客户端订单索引分别受 `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` 与 `WAREHOUSE_EXPANSION_DESIGN.md` 约束，只允许作为只读派生加速器。""",
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md': """### 六分区内部子修订元数据

状态交付的六个外层分区保持不变，字段归属仍由 `state-partitions.js` 决定。为允许新客户端在收到完整 `player` / `market` 快照时复用未变化字段引用，服务器可在 envelope 顶层同时返回 `sliceRevisions`。子切片定义唯一维护在 `server/shared/economy-state-slices.js`；服务端与客户端必须共享同一字段归属，禁止各自复制一套映射。

`sliceRevisions` 只是传输元数据，不写入世界 JSON、SQLite 玩家状态或 `EconomyState`，也不参与经济规则。客户端仍只提交六个父分区 revision 作为已知状态，服务器仍以父分区 revision 判断是否需要发送完整父分区 patch；子修订不能让服务器发送字段级 patch。没有父分区 patch 的轻量无变化响应仍可省略子修订。

增加、删除或调整子切片不得修改客户端状态版本或世界状态版本，除非实际 `EconomyState` 字段或持久化结构同时发生了不兼容变化。旧客户端会忽略 `sliceRevisions`；新客户端遇到缺少该元数据的旧响应必须按整个父分区变化处理，因此发布期间不需要双协议切换。""",
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md': """### 客户端订单索引性能边界

客户端允许针对当前收到的 `orders` 数组建立只读派生加速器形式的客户端订单索引，用于市场展示、自己的未完成订单统计和在线自动交易状态判断。该索引可以维护订单 ID 查询、按资产分组的开放订单、自己的开放订单，以及商品自己的／外部的最高买价和最低卖价；只有 `market.orders` 实际变化时才重建。

客户端订单索引只是查询加速器，不是第二套订单簿，不得撮合、冻结、成交、收费、改变 FIFO、决定 maker price 或绕过服务器校验。服务器 `order-book-runtime.js` 与统一撮合内核仍是订单状态和价格时间优先的唯一权威来源。索引中的对象必须直接引用当前权威订单快照，不得复制或持久化可产生另一份订单状态的数据。""",
    'docs/WAREHOUSE_EXPANSION_DESIGN.md': """### 自动交易客户端索引性能边界

在线自动交易维护器只在 `catalog`、`player.assets`、`player.production`、`market.orders` 或 `contract` 变化时重新判断维护需求；纯行情、经济事件、银行、签到、研发计时或排行榜变化不得触发自动交易扫描。维护候选只遍历实际启用采购／出售策略的商品，并复用当前 `market.orders` 对应的客户端订单索引识别托管单、自己的交叉单和可成交外部盘口。

同一权威状态代内重复查询同一商品状态可以缓存，但库存、资金、工厂、合同、策略、托管订单 ID 或 `market.orders` 任一相关来源变化时必须失效。客户端订单索引只负责避免重复线性扫描；自动交易目标数量、冻结资金／库存、自交叉阻断和最终合法性仍由服务器动作再次校验，不能把在线客户端维护器升级为本地权威交易引擎。""",
}
for path, section in doc_sections.items():
    content = read(path)
    heading = section.splitlines()[0]
    if heading not in content:
        content = content.rstrip() + '\n\n' + section.rstrip() + '\n'
        write(path, content)


# Keep #549's leaf-clock performance boundary while preserving #548's research props.
path = 'src/pages/ProductionPage.tsx'
content = read(path)
content = content.replace("import { useNow } from '../hooks/useNow';\n", '')
content = content.replace('  const now = useNow(game.lastProcessedAt);', '  const now = game.lastProcessedAt;')
if '  const now = game.lastProcessedAt;' not in content:
    raise SystemExit(f'{path}: failed to preserve latest-main root clock boundary')
write(path, content)


path = 'src/pages/production/ProductionFacilityDetail.tsx'
content = read(path)
if "import { useNow } from '../../hooks/useNow';" not in content:
    marker = "} from '../../types';\nimport { formatNumber } from '../../utils/formatters';"
    if marker not in content:
        raise SystemExit(f'{path}: import marker missing')
    content = content.replace(
        marker,
        "} from '../../types';\nimport { useNow } from '../../hooks/useNow';\nimport { formatNumber } from '../../utils/formatters';",
        1,
    )
selector_old = "  const { group, type } = entry;\n  const markets = useFacilityRecipeProfitMarkets();\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const profitScope = currentFormulaScope(group, now);"
selector_new = "  const { group, type } = entry;\n  const liveNow = useNow(now, 10_000);\n  const markets = useFacilityRecipeProfitMarkets();\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const profitScope = currentFormulaScope(group, liveNow);"
if selector_old in content:
    content = content.replace(selector_old, selector_new, 1)
info_old = "  const { group, type } = entry;\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const profitScope = currentFormulaScope(group, now);"
info_new = "  const { group, type } = entry;\n  const liveNow = useNow(now);\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const profitScope = currentFormulaScope(group, liveNow);"
if info_old in content:
    content = content.replace(info_old, info_new, 1)
body_old = "  const { group, type } = entry;\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const operatingScope = currentFormulaScope(group, now);"
body_new = "  const { group, type } = entry;\n  const liveNow = useNow(now);\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const operatingScope = currentFormulaScope(group, liveNow);"
if body_old in content:
    content = content.replace(body_old, body_new, 1)
content = content.replace(
    '<FacilityStaffingSummary entry={entry} now={now} />',
    '<FacilityStaffingSummary entry={entry} now={liveNow} />',
    1,
)
formula_old = "        inventories={inventories}\n        now={now}\n        onOpenProductMarket={onOpenProductMarket}"
formula_new = "        inventories={inventories}\n        now={liveNow}\n        onOpenProductMarket={onOpenProductMarket}"
if formula_old in content:
    content = content.replace(formula_old, formula_new, 1)
for required in [
    "import { useNow } from '../../hooks/useNow';",
    'const liveNow = useNow(now, 10_000);',
    'const liveNow = useNow(now);',
    'completedTechnologyIds={completedTechnologyIds}',
    'researchTechnologies={researchTechnologies}',
]:
    if required not in content:
        raise SystemExit(f'{path}: merged requirement missing: {required}')
write(path, content)


# Fix current-version guards that were outside the original C2 changed-file set.
path = 'scripts/verify-money-precision.mjs'
content = read(path)
content = content.replace('MARKET_DEMAND_MODEL_VERSION = 18', 'MARKET_DEMAND_MODEL_VERSION = 19')
content = content.replace(r'world\.version = 26', r'world\.version = 28')
write(path, content)


path = 'server/test/domain.test.js'
content = read(path)
content = content.replace('assert.equal(state.products.length, 36);', 'assert.equal(state.products.length, 38);')
content = content.replace('assert.equal(PRODUCT_CATALOG.length, 36);', 'assert.equal(PRODUCT_CATALOG.length, 38);')
products_marker = "    'plastic', 'fertilizer', 'feed', 'veterinary-medicine', 'textile', 'pulp', 'food', 'beverage',"
products_next = "    'plastic', 'industrial-fuel', 'industrial-chemicals', 'fertilizer', 'feed', 'veterinary-medicine', 'textile', 'pulp', 'food', 'beverage',"
if products_marker in content:
    content = content.replace(products_marker, products_next, 1)
prices_marker = "    flour: 13, sugar: 13, lumber: 17, steel: 29, copper: 29, plastic: 30, fertilizer: 6.76, feed: 5.8,"
prices_next = "    flour: 13, sugar: 13, lumber: 17, steel: 29, copper: 29, plastic: 30, 'industrial-fuel': 4, 'industrial-chemicals': 5, fertilizer: 6.76, feed: 5.8,"
if prices_marker in content:
    content = content.replace(prices_marker, prices_next, 1)
for required in [
    'assert.equal(state.products.length, 38);',
    'assert.equal(PRODUCT_CATALOG.length, 38);',
    "'industrial-fuel'",
    "'industrial-chemicals'",
]:
    if required not in content:
        raise SystemExit(f'{path}: catalog migration assertion missing: {required}')
write(path, content)


unresolved = subprocess.check_output(
    ['git', 'diff', '--name-only', '--diff-filter=U'], text=True
).strip()
if unresolved:
    raise SystemExit(f'Unresolved merge conflicts remain:\n{unresolved}')
