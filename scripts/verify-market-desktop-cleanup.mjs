import fs from 'node:fs';

const main = fs.readFileSync('src/main.tsx', 'utf8');
const marketRuntimeHtml = fs.readFileSync('market-runtime-test.html', 'utf8');
const marketPage = fs.readFileSync('src/pages/MarketPage.tsx', 'utf8');
const styles = fs.readFileSync('src/styles/market-desktop-cleanup.css', 'utf8');
const marketStyles = fs.readFileSync('src/styles/market-page-polish.css', 'utf8');
const detailStyles = fs.readFileSync('src/styles/market-detail-direct-flow.css', 'utf8');
const design = fs.readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');
const chartDesign = fs.readFileSync('docs/MARKET_CHART_LAYOUT_DESIGN.md', 'utf8');
const browserSpec = fs.readFileSync('tests/browser/market-desktop-cleanup.spec.ts', 'utf8');
const detailBrowserSpec = fs.readFileSync('tests/browser/market-detail-direct-flow.spec.ts', 'utf8');

const failures = [];
const requireText = (source, text, message) => {
  if (!source.includes(text)) failures.push(message);
};
const forbidText = (source, text, message) => {
  if (source.includes(text)) failures.push(message);
};

requireText(
  main,
  "import './styles/form-controls.css';\nimport './styles/market-desktop-cleanup.css';",
  '桌面市场精简样式必须在共享表单样式之后加载。',
);
requireText(
  main,
  "import './styles/mobile-status-layout.css';\nimport './styles/market-detail-direct-flow.css';",
  '商品详情直接内容流样式必须在全部页面和移动样式之后最终加载。',
);
requireText(
  marketRuntimeHtml,
  '<link rel="stylesheet" href="/src/styles/market-desktop-cleanup.css" />',
  '市场浏览器运行时夹具必须加载与生产一致的桌面精简样式。',
);
requireText(styles, '@media (min-width: 721px)', '桌面精简规则必须严格限定在大于 720px。');
for (const selector of [
  '.market-page-surface .market-trade-section-heading small',
]) {
  requireText(styles, selector, `桌面精简样式缺少选择器：${selector}`);
}
requireText(styles, 'display: none !important;', '桌面辅助元素必须使用最终覆盖优先级隐藏。');
forbidText(styles, '.order-book-columns', '桌面精简样式不得保留已删除的订单簿表头规则。');
forbidText(styles, '.order-book-midpoint', '桌面精简样式不得保留已删除的最新价分隔规则。');
forbidText(marketStyles, '.order-book-columns', '市场基础样式不得恢复订单簿表头。');
forbidText(marketStyles, '.order-book-midpoint', '市场基础样式不得恢复最新价分隔行。');
forbidText(styles, '@media (max-width: 720px)', '桌面精简样式不得改写移动端规则。');

for (const token of [
  '.market-detail-surface > .market-detail-hero.ui-primary-surface',
  '.market-detail-surface .market-fundamentals-card.ui-primary-surface',
  '.market-detail-surface .market-inventory-production-card.ui-primary-surface',
  '.market-detail-surface .market-chart-card.ui-primary-surface',
  '.market-detail-surface .market-account-panel.ui-primary-surface',
  'background: transparent !important;',
  '.market-detail-surface .market-fundamentals-metrics > .ui-metric-card:nth-child(-n + 4)',
  '.market-detail-surface .market-fundamentals-metrics > .ui-metric-card:nth-child(8)',
  '.market-detail-surface .market-inventory-production-metrics > .ui-metric-card:not(:first-child)',
  '.market-detail-surface .market-fundamentals-balance',
  '.market-detail-surface .market-trade-summary > span:nth-child(2)',
  '@container market-page (max-width: 720px)',
  '@container market-page (max-width: 420px)',
]) {
  requireText(detailStyles, token, `商品详情直接内容流样式缺少规则：${token}`);
}
forbidText(detailStyles, '.market-detail-surface .market-trade-card.ui-primary-surface', '手动交易卡不得被直接内容流样式去除操作底座。');
forbidText(detailStyles, '.market-detail-surface .market-detail-auto-trade.ui-primary-surface', '自动交易卡不得被直接内容流样式去除操作底座。');

requireText(marketPage, "<small>{readOnly ? '实时五档 · 只读' : '实时五档 · 点击填价'}</small>", '订单簿辅助文案 DOM 必须继续存在并按只读状态切换。');
forbidText(marketPage, 'market-account-view-switch', '订单与成交必须同时纵向显示，不得恢复账户视图切换 DOM。');
requireText(marketPage, '<section>', '本人订单区必须保留普通 section。');
requireText(marketPage, '<section className="local-trades-section">', '本地成交区必须与订单区同时存在。');
forbidText(marketPage, 'order-book-columns', '市场页面不得恢复订单簿表头 DOM。');
forbidText(marketPage, 'order-book-midpoint', '市场页面不得恢复最新价分隔 DOM。');

requireText(design, '桌面端和移动端订单簿使用同一信息结构', '权威设计必须记录全端统一盘口结构。');
requireText(design, '不渲染“档位／价格／数量”表头或真实最近成交价“最新”分隔行', '权威设计必须记录表头和最新价行永久移除。');
requireText(design, '不大于 `720px` 的移动端始终同时显示下单区和五档盘口', '权威设计必须记录移动端永久双列。');
requireText(design, '已有订单在上、本地成交在下', '权威设计必须记录订单与成交全端纵向同时显示。');
requireText(design, '不渲染“挂单／成交”账户视图切换', '权威设计必须记录账户视图切换退役。');
forbidText(marketPage, 'market-compact-view-switch', '市场页面不得恢复下单／盘口切换 DOM。');

for (const token of [
  '基本面条只保留需求满足率、需求参考价、上轮需求（含预算）和当前可用库存',
  '不得在基本面重复',
  '不得在市场详情重复展示',
  '身份区、基本面条、行情图和本人订单／成交直接排列在页面内容区，不使用一级卡片底座',
  '手动交易与自动交易因包含可提交操作继续保留明确主表面',
  '交易卡摘要只显示最近成交和真实 24h 成交量',
]) {
  requireText(chartDesign, token, `市场详情权威设计缺少规则：${token}`);
}

requireText(browserSpec, 'desktop market uses compact order-book rows without duplicate headers', '浏览器测试必须覆盖桌面统一盘口结构。');
requireText(browserSpec, 'mobile market matches desktop order-book structure and keeps side-by-side trade panels', '浏览器测试必须覆盖移动端统一盘口结构与永久双列。');
requireText(browserSpec, "locator('.order-book-columns')).toHaveCount(0)", '浏览器测试必须验证订单簿表头不存在。');
requireText(browserSpec, "locator('.order-book-midpoint')).toHaveCount(0)", '浏览器测试必须验证最新价分隔行不存在。');
requireText(browserSpec, "name: '盘口', exact: true })).toHaveCount(0)", '浏览器测试必须验证移动端不恢复下单／盘口切换。');
requireText(browserSpec, "locator('.market-account-view-switch')).toHaveCount(0)", '浏览器测试必须验证账户视图切换不存在。');
requireText(browserSpec, "locator('.market-account-grid > section')", '浏览器测试必须覆盖订单与成交同时存在。');

for (const token of [
  'regional commodity detail keeps only non-duplicate context in direct page flow',
  "expect(visibleFundamentals).toEqual(['需求满足率', '参考价', '上轮需求', '可用库存'])",
  "expect(visibleTradeSummary).toEqual(['最近成交', '24h 成交量'])",
  "'.market-detail-hero'",
  "'.market-chart-card'",
  "'.market-account-panel'",
  'regional commodity direct detail flow stays readable on mobile',
  'geometry.scrollWidth',
]) {
  requireText(detailBrowserSpec, token, `商品详情直接内容流浏览器回归缺少断言：${token}`);
}

if (failures.length > 0) {
  console.error('市场订单簿与商品详情精简结构验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('市场订单簿保持统一结构；商品详情只保留必要信息并将只读内容直接排列在页面内容区。');
