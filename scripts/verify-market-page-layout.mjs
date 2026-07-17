import fs from 'node:fs';

const marketPage = fs.readFileSync('src/pages/MarketPage.tsx', 'utf8');
const marketHistory = fs.readFileSync('src/utils/marketHistory.ts', 'utf8');
const marketStyles = fs.readFileSync('src/styles/market-page-polish.css', 'utf8');
const runtimeHarness = fs.readFileSync('tests/browser/market-runtime-harness.tsx', 'utf8');
const runtimeSpec = fs.readFileSync('tests/browser/market-runtime.spec.ts', 'utf8');
const marketDesign = fs.readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');
const pageDesign = fs.readFileSync('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', 'utf8');
const uiDesign = fs.readFileSync('docs/UI_DESIGN_SYSTEM.md', 'utf8');

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
requireText(marketStyles, '.single-order-book', '订单簿必须拥有自然高度覆盖。');
requireText(marketStyles, 'grid-template-columns: repeat(2, minmax(0, 1fr))', '图表底部统计必须支持两列重排。');
forbidText(marketPage, 'Math.max(1, maxTradeQuantity)', '数量上限不得伪造最小可交易量 1。');
requireText(marketPage, 'orderDisabledReason', '下单禁用必须提供明确原因。');
requireText(marketPage, 'countMarketHistoryPointsInWindow', '市场页成交笔数必须使用最近 24h 窗口函数。');
requireText(marketPage, "marketTrend > 0 ? 'success' : marketTrend < 0 ? 'danger' : 'neutral'", '零涨跌必须使用中性状态。');
requireText(marketPage, '<div className="order-book-side-label bid-label"', '买盘标题必须位于买单行之前。');
requireText(marketHistory, 'export function getMarketWindowBounds', '市场窗口边界必须由共享函数生成。');
requireText(marketHistory, 'export function countMarketHistoryPointsInWindow', '必须提供最近 24h 成交计数函数。');
requireText(runtimeHarness, "scenario === 'funds-empty'", '浏览器运行时必须覆盖资金不足。');
requireText(runtimeHarness, "scenario === 'warehouse-full'", '浏览器运行时必须覆盖仓库不足。');
requireText(runtimeHarness, "scenario === 'sell-empty'", '浏览器运行时必须覆盖无可卖库存。');
requireText(runtimeSpec, 'market desktop layout gives the full chart the dominant column', 'Playwright 必须覆盖宽屏行情主列。');
requireText(runtimeSpec, '最近 24h 3 笔', 'Playwright 必须验证 24h 成交计数。');
requireText(runtimeSpec, 'status-neutral', 'Playwright 必须验证零涨跌中性状态。');
requireText(runtimeSpec, '向后浏览资产', 'Playwright 必须验证资产目录滚动控制。');
requireText(runtimeSpec, 'askLabel.y', 'Playwright 必须验证订单簿标题顺序。');
requireText(marketDesign, '## 市场页面布局与可用性', '订单簿设计必须记录市场布局与可用性规则。');
requireText(pageDesign, '### 4.1 市场页桌面布局与反馈', '页面职责设计必须记录市场页布局。');
requireText(uiDesign, '## 市场页布局完整性', 'UI 设计系统必须记录市场页布局完整性。');

if (failures.length > 0) {
  console.error('市场页布局与运行时验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('市场页布局、数据口径、禁用反馈与浏览器回归基线验证通过。');
