import fs from 'node:fs';

const marketPage = fs.readFileSync('src/pages/MarketPage.tsx', 'utf8');
const marketHistory = fs.readFileSync('src/utils/marketHistory.ts', 'utf8');
const marketStyles = fs.readFileSync('src/styles/market-page-polish.css', 'utf8');
const sharedMarketStyles = fs.readFileSync('src/styles/unified-market-admin.css', 'utf8');
const runtimeHarness = fs.readFileSync('tests/browser/market-runtime-harness.tsx', 'utf8');
const runtimeSpec = fs.readFileSync('tests/browser/market-runtime.spec.ts', 'utf8');
const scrollInputSpec = fs.readFileSync('tests/browser/scroll-input-modality.spec.ts', 'utf8');
const marketDesign = fs.readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');
const pageDesign = fs.readFileSync('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', 'utf8');
const uiDesign = fs.readFileSync('docs/UI_DESIGN_SYSTEM.md', 'utf8');
const chromeDesign = fs.readFileSync('docs/LIQUID_GLASS_CHROME_DESIGN.md', 'utf8');

const failures = [];
function requireText(source, text, message) {
  if (!source.includes(text)) failures.push(message);
}
function forbidText(source, text, message) {
  if (source.includes(text)) failures.push(message);
}

requireText(marketStyles, 'grid-template-columns: 320px 360px minmax(620px, 1fr)', '宽屏市场必须为固定下单列、订单簿列和宽行情列。');
requireText(marketStyles, 'aspect-ratio: 16 / 9', '完整行情图必须按自身宽度保持 16:9。');
requireText(marketStyles, 'height: auto !important', '完整行情图必须覆盖旧视口高度内联规则。');
requireText(marketStyles, 'grid-template-rows: repeat(2', '资产目录必须使用两行连续目录。');
requireText(marketStyles, 'scroll-snap-type: none', '市场资产目录必须关闭吸附并允许无级滑动。');
forbidText(marketStyles, 'scroll-behavior: smooth', '市场资产目录不得用容器级平滑滚动干扰拖动。');
forbidText(sharedMarketStyles, 'scroll-snap-align: start', '市场资产卡不得恢复吸附锚点。');
requireText(marketStyles, '.single-order-book', '订单簿必须拥有自然高度覆盖。');
requireText(marketStyles, 'grid-template-columns: repeat(2, minmax(0, 1fr))', '图表底部统计必须支持两列重排。');
requireText(marketStyles, '.asset-directory-shell {\n    position: relative;\n    z-index: 0;', '移动市场资产目录必须建立局部堆叠上下文，防止 sticky 分组遮挡状态栏。');
forbidText(marketPage, 'max={Math.max(1, maxTradeQuantity)}', '数量上限不得伪造最小可交易量 1。');
requireText(marketPage, 'max={maxTradeQuantity > 0 ? maxTradeQuantity : undefined}', '零可交易量时必须禁用数量输入而不是伪造上限。');
requireText(marketPage, 'orderDisabledReason', '下单禁用必须提供明确原因。');
requireText(marketPage, 'const maxBuyByFunds =', '买入快捷数量必须先按可用资金和当前价格计算。');
requireText(marketPage, "['1/4 资金', '1/2 资金'", '买入快捷数量必须使用资金语义。');
requireText(marketPage, "['1/4 库存', '1/2 库存', '全部库存']", '商品卖出快捷数量必须使用库存语义。');
requireText(marketPage, "['1/4 持有', '1/2 持有', '全部持有']", '工厂卖出快捷数量必须使用持有语义。');
requireText(marketPage, 'warehouseLimitsBuy', '商品买入必须识别仓库先于资金形成的数量上限。');
requireText(marketPage, '{availabilityReason ? <p id="order-disabled-reason"', '提交区只允许显示字段外阻断原因。');
forbidText(marketPage, "aria-describedby={orderDisabledReason ? 'order-disabled-reason' : undefined}", '数量字段不得重复关联提交区的同一错误。');
requireText(marketPage, '<VirtualRecordTable', '本地成交必须使用单一双轴虚拟表格。');
forbidText(marketPage, 'virtual-record-viewport', '本地成交不得恢复内层纵向视口。');
requireText(marketPage, 'countMarketHistoryPointsInWindow', '市场页成交笔数必须使用最近 24h 窗口函数。');
requireText(marketPage, "marketTrend > 0 ? 'success' : marketTrend < 0 ? 'danger' : 'neutral'", '零涨跌必须使用中性状态。');
requireText(marketPage, '<div className="order-book-side-label bid-label"', '买盘标题必须位于买入档位之前。');
requireText(marketPage, "buildOrderBookLevels(selectedOrders, 'sell').reverse()", '卖盘必须先聚合最优档位，再反向显示使最低卖价靠近中线。');
requireText(marketPage, "buildOrderBookLevels(selectedOrders, 'buy')", '买盘必须使用共享价格档位聚合。');
requireText(marketHistory, 'export function getMarketWindowBounds', '市场窗口边界必须由共享函数生成。');
requireText(marketHistory, 'export function countMarketHistoryPointsInWindow', '必须提供最近 24h 成交计数函数。');
requireText(runtimeHarness, "scenario === 'funds-empty'", '浏览器运行时必须覆盖资金不足。');
requireText(runtimeHarness, "scenario === 'warehouse-full'", '浏览器运行时必须覆盖仓库不足。');
requireText(runtimeHarness, "scenario === 'sell-empty'", '浏览器运行时必须覆盖无可卖库存。');
requireText(runtimeHarness, '...Array.from({ length: 5 }', '浏览器运行时必须提供五张同价买单。');
requireText(runtimeHarness, 'remaining: 1', '同价档位测试必须使用当前剩余数量。');
requireText(runtimeSpec, 'market desktop layout gives the full chart the dominant column', 'Playwright 必须覆盖宽屏行情主列。');
requireText(runtimeSpec, '最近 24h 3 笔', 'Playwright 必须验证 24h 成交计数。');
requireText(runtimeSpec, 'status-neutral', 'Playwright 必须验证零涨跌中性状态。');
requireText(runtimeSpec, 'market quick quantities use funds, inventory and holdings without duplicate quantity errors', 'Playwright 必须覆盖快捷数量语义与错误去重。');
requireText(runtimeSpec, '向后浏览资产', 'Playwright 必须验证资产目录滚动控制。');
requireText(scrollInputSpec, 'desktop market asset directory supports continuous unsnapped scrolling', 'Playwright 必须验证资产目录无级滑动。');
requireText(scrollInputSpec, 'touch input hides horizontal rails while local trade cells keep native two-axis scrolling', 'Playwright 必须验证触控横向轨道隐藏与成交数据横滑。');
requireText(runtimeSpec, 'askLabel.y', 'Playwright 必须验证订单簿标题顺序。');
requireText(runtimeSpec, 'aggregates same-price orders into one price level', 'Playwright 必须验证同价订单聚合为单一价格档位。');
requireText(runtimeSpec, "toHaveAttribute('data-order-count', '5')", 'Playwright 必须验证档位内独立订单笔数。');
requireText(runtimeSpec, '买盘，价格 2，合计剩余 5，包含 5 笔订单', 'Playwright 必须验证价格档位无障碍名称。');
requireText(runtimeSpec, 'mobile market sticky asset divider stays below the status bar chrome', 'Playwright 必须覆盖移动市场 sticky 分组与状态栏的层级。');
requireText(runtimeSpec, 'document.elementFromPoint', '移动市场层级回归必须使用真实命中测试验证状态栏位于最上层。');
requireText(marketDesign, '## 市场页面布局与可用性', '订单簿设计必须记录市场布局与可用性规则。');
requireText(marketDesign, '聚合完成后再按最优价格截取 5 档', '订单簿设计必须记录聚合后截取规则。');
requireText(pageDesign, '### 4.1 市场页桌面布局与反馈', '页面职责设计必须记录市场页布局。');
requireText(pageDesign, '订单簿按价格档位聚合展示', '页面职责设计必须记录价格档位职责。');
requireText(pageDesign, '同一价格或数量输入错误只允许在对应字段下显示一次', '页面职责设计必须记录市场字段错误唯一显示规则。');
requireText(pageDesign, '买入快捷数量以可用资金除以当前价格所得数量为基准', '页面职责设计必须记录买入快捷数量资金语义。');
requireText(uiDesign, '## 市场页布局完整性', 'UI 设计系统必须记录市场页布局完整性。');
requireText(uiDesign, '同价档位聚合及水平溢出', 'UI 设计系统必须要求浏览器验证同价档位聚合。');
requireText(chromeDesign, '页面内部若使用带非 `auto` `z-index` 的 `position: sticky`／定位元素，必须由页面局部堆叠上下文收口', '液态玻璃外壳设计必须记录移动页面 sticky 层级收口规则。');

if (failures.length > 0) {
  console.error('市场页布局与运行时验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('市场页布局、价格档位、数据口径、禁用反馈与共享移动层级浏览器回归基线验证通过。');
