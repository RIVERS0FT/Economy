import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const marketPage = read('src/pages/MarketPage.tsx');
const marketStyles = read('src/styles/market-page-polish.css');
const commodityRow = read('src/components/market/MarketCommodityRow.tsx');
const commodityRowStyles = read('src/styles/market-commodity-row.css');
const autoTradePanel = read('src/components/market/MarketAutoTradePanel.tsx');
const buildingsPage = read('src/pages/BuildingsPage.tsx');
const marketHistory = read('src/utils/marketHistory.ts');
const chartSource = read('src/components/charts/PriceSparkline.tsx');
const chartStyles = read('src/styles/charts.css');
const runtimeHarness = read('tests/browser/market-runtime-harness.tsx');
const runtimeSpec = read('tests/browser/market-runtime.spec.ts');
const marketDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');

const failures = [];
function requireText(source, text, message) {
  if (!source.includes(text)) failures.push(message);
}
function forbidText(source, text, message) {
  if (source.includes(text)) failures.push(message);
}

requireText(marketStyles, '.market-page-surface .unified-market-grid {\n  min-width: 0;\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);', '紧凑市场必须保持单列主网格。');
forbidText(marketStyles, 'grid-template-columns: minmax(560px, 0.82fr) minmax(680px, 1.18fr)', '市场不得恢复行情与交易一级双列。');
requireText(chartSource, 'export function buildMarketChartGeometry', '完整行情图必须继续使用动态几何。');
requireText(chartSource, '(0.22 / 0.78)', '完整行情图成交量绘图区必须保持最低占比。');
forbidText(marketStyles, 'aspect-ratio: 16 / 9', '市场 CSS 不得固定行情图 16:9。');

requireText(marketPage, "type MarketCatalogStatus = 'all' | 'traded' | 'buy' | 'sell' | 'unmet-demand' | 'own-order';", '地区市场必须保留市场状态筛选。');
requireText(marketPage, "type MarketCatalogSort = 'catalog' | 'name' | 'price' | 'trend' | 'buy-volume' | 'sell-volume';", '地区市场排序只保留可见核心指标。');
requireText(marketPage, "if (!facilityAssetId && marketViewMode === 'catalog')", '市场必须区分地区目录与详情。');
requireText(marketPage, 'className="market-catalog-filter-disclosure"', '地区市场筛选必须使用默认折叠 disclosure。');
requireText(marketPage, '<MarketCommodityHeader />', '地区商品目录必须在列表顶部复用共享独立表头。');
requireText(marketPage, '<MarketCommodityRow', '地区商品目录必须复用共享商品数据行。');
requireText(marketPage, "onClick={() => selectMarketAsset(entry.kind, entry.id, !embedded)}", '地区商品行必须打开当前地区商品详情。');
requireText(marketPage, 'embedded?: boolean;', '市场页必须支持州级上下文嵌入。');
requireText(marketPage, 'return embedded', '嵌入市场不得重复 PageLayout。');
requireText(marketPage, 'fixedProductId={selectedProduct.id}', '地区商品详情必须把自动交易锁定到当前商品。');
requireText(marketPage, "<small>{selectedProduct ? '24h 成交量' : availableAssetLabel}</small>", '地区商品详情必须显示真实 24h 成交量。');

const marketCatalogStart = marketPage.indexOf("if (!facilityAssetId && marketViewMode === 'catalog')");
const marketDetailStart = marketPage.indexOf('\n  const detailContent =', marketCatalogStart);
const marketCatalogSource = marketPage.slice(marketCatalogStart, marketDetailStart);
for (const token of [
  'TextInput',
  'catalogQuery',
  '挂单差额',
  '基准偏离',
  '挂单状态',
  "value=\"balance\"",
  'market-catalog-row__balance',
  'market-catalog-row__deviation',
  'market-catalog-row__condition',
  'game.facilityTypes.map',
  '<FacilityIcon',
  'market-workspace-switch',
  'market-overview-metrics',
  'market-catalog-panel',
]) forbidText(marketCatalogSource, token, `地区商品目录不得恢复 ${token}。`);
requireText(commodityRow, 'export function MarketCommodityHeader', '共享商品列表必须导出独立表头。');
const commodityDataRowSource = commodityRow.slice(commodityRow.indexOf('export function MarketCommodityRow'));
forbidText(commodityDataRowSource, 'market-commodity-row-header', '共享商品数据行不得重复渲染列标题。');
for (const token of ['卖单量', '买单量', '市场价', '24h']) requireText(commodityRow, token, `共享商品表头必须显示 ${token}。`);
requireText(commodityRowStyles, 'display: grid;', '共享商品独立表头必须直接显示，不得依赖首行内隐藏副本。');
forbidText(commodityRowStyles, '.market-catalog-list > li:first-child > .market-commodity-row-header', '共享商品表头不得重新塞回首条数据行。');
requireText(commodityRowStyles, 'grid-template-columns: minmax(8rem, 1.45fr) repeat(4, minmax(4.1rem, .68fr)) .8rem;', '共享商品数据行必须保持身份、四项指标和箭头的单行布局。');
requireText(commodityRowStyles, '@container (max-width: 620px)', '共享商品数据行必须提供移动紧凑断点。');
requireText(commodityRowStyles, '@container (max-width: 360px)', '共享商品数据行必须覆盖极窄屏。');
requireText(commodityRowStyles, '.market-catalog-filter-disclosure > .market-catalog-filters', '地区筛选展开区必须复用三项筛选布局。');

requireText(marketPage, '.reduce((sum, order) => sum + Math.max(0, order.remaining), 0)', '地区商品挂单量必须聚合公开订单 remaining。');
requireText(marketPage, "const marketPrice = typeof market?.officialPrice === 'number' ? market.officialPrice : undefined", '地区商品市场价必须读取官方系统价。');
requireText(marketPage, 'realTrades.length > 1', '24h 变化必须至少由两笔真实成交生成。');
requireText(marketPage, '官方系统价', '地区商品详情必须展示官方系统价。');
requireText(marketPage, '基准偏离', '基准偏离必须保留在地区商品详情。');
requireText(marketPage, '挂单差额', '订单簿失衡指标必须保留在地区商品详情。');
requireText(marketPage, 'market-fundamentals-balance', '地区商品详情必须保留订单簿失衡可视化。');
requireText(marketPage, '<WidgetHeading title="库存与生产" />', '地区商品详情必须展示库存与生产。');
requireText(marketPage, 'market-inventory-production-card', '地区商品详情库存与生产必须使用独立信息卡。');
requireText(marketPage, 'productionSummary.unitsPerMinute', '地区商品详情必须展示预计生产速度。');
requireText(marketPage, 'currentFormulaScope(group, now)', '预计生产速度必须复用共享等效产能投影。');
forbidText(marketPage, '生产者与消费者', '地区商品详情不得恢复生产者与消费者关系卡。');
requireText(marketPage, 'market?.demand?.lastQuantity', '商品需求基本面必须读取服务器字段。');

requireText(marketPage, '<Panel className="widget market-trade-card">', '下单与订单簿必须继续共用交易卡。');
requireText(marketPage, 'className="market-trade-layout"', '交易卡必须保持内部双列。');
requireText(marketPage, 'order-entry market-trade-entry', '交易卡必须保留下单区。');
requireText(marketPage, 'order-book single-order-book market-trade-book', '交易卡必须保留五档订单簿。');
forbidText(marketPage, 'order-book-columns', '订单簿不得恢复重复表头。');
forbidText(marketPage, 'order-book-midpoint', '订单簿不得恢复最新价分隔行。');
requireText(marketPage, 'const orderActionLabel = orderDisabledReason', '主交易按钮必须承载阻断原因。');
requireText(marketPage, 'aria-label={orderActionLabel}', '交易按钮可访问名称必须与阻断原因一致。');
requireText(marketPage, '价格减少 0.01', '价格步进必须按 0.01。');
requireText(marketPage, '数量增加 1', '数量步进必须按 1。');
requireText(marketPage, 'const maxBuyByFunds =', '买入快捷数量必须受可用资金约束。');
requireText(marketPage, '>25%</Button>', '快捷数量必须保留 25%。');
requireText(marketPage, '>50%</Button>', '快捷数量必须保留 50%。');
requireText(marketPage, '>最大</Button>', '快捷数量必须保留最大。');
requireText(marketPage, '<VirtualRecordTable', '本地成交必须继续使用虚拟表格。');
requireText(marketPage, "buildOrderBookLevels(selectedOrders, 'sell').reverse()", '卖盘必须先聚合后反向显示。');
requireText(marketPage, "buildOrderBookLevels(selectedOrders, 'buy')", '买盘必须使用共享档位聚合。');
requireText(marketPage, 'onClick={() => fillOrderPrice(level.price)}', '盘口点击只能填价。');
requireText(marketStyles, 'grid-template-columns: minmax(320px, 3fr) minmax(240px, 2fr);', '交易卡桌面必须保持 60/40 双列。');
requireText(marketStyles, '@container market-page (max-width: 819px)', '交易卡必须覆盖中窄宽度。');
requireText(marketStyles, '@container market-page (max-width: 359px)', '交易卡必须覆盖极窄宽度。');
requireText(marketStyles, 'min-height: 44px;', '极窄盘口档位必须保持触控高度。');

requireText(autoTradePanel, '保存自动交易设置', '市场自动交易面板必须保留双向保存动作。');
requireText(buildingsPage, 'facilityAssetId={facilityAssetTradeId}', '建筑详情必须继续打开从属资产交易。');
requireText(buildingsPage, "onBackFromFacilityAsset={() => setFacilityAssetTradeId('')}", '建筑从属资产交易必须返回原建筑详情。');
requireText(marketHistory, 'export function getMarketWindowBounds', '市场窗口边界必须由共享函数生成。');
requireText(chartStyles, 'font-variant-numeric: tabular-nums;', '行情坐标轴必须使用稳定数字宽度。');
requireText(runtimeHarness, "scenario === 'funds-empty'", '浏览器运行时必须覆盖资金不足。');
requireText(runtimeHarness, "scenario === 'sell-empty'", '浏览器运行时必须覆盖无可售库存。');
requireText(runtimeSpec, 'market commodity catalog keeps compact core metrics and opens a focused detail', 'Playwright 必须覆盖折叠筛选、核心指标和详情入口。');
requireText(runtimeSpec, 'mobile market catalog keeps one compact row without horizontal overflow', 'Playwright 必须覆盖移动单行商品目录。');
requireText(runtimeSpec, 'market detail back action restores the filtered catalog', 'Playwright 必须覆盖详情返回后的筛选保留。');
requireText(runtimeSpec, 'market order book keeps sell five to buy five sequence and fills price without submitting', 'Playwright 必须覆盖连续五档与点击填价。');
requireText(runtimeSpec, 'market product artwork keeps compact catalog and detail slots without stretching', 'Playwright 必须覆盖共享商品行插画和详情插画。');

requireText(marketDesign, '商品目录 → 商品全局详情 → 地区商品详情', '订单簿设计必须记录商品优先三级钻取。');
requireText(marketDesign, 'provinceId + assetKind + assetId', '订单簿设计必须保持地区隔离键。');
requireText(pageDesign, '筛选默认折叠且不提供商品名称搜索框', '页面职责设计必须记录市场筛选折叠与无搜索规则。');
requireText(pageDesign, '商品、卖单量、买单量、市场价和 24h 变化', '页面职责设计必须记录商品行核心字段。');
requireText(uiDesign, '`MarketCommodityRow`', 'UI 设计系统必须记录共享市场商品行。');
requireText(uiDesign, '移动端仍保持单行', 'UI 设计系统必须记录移动单行规则。');

if (failures.length > 0) {
  console.error('市场页布局与运行时验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('市场页验证通过：地区目录默认折叠且无搜索，商品行保留核心行情；详情承载基本面、库存与生产、订单簿、下单和自动交易。');
