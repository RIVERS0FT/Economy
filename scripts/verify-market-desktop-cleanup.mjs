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
requireText(styles, '.market-page-surface .market-trade-section-heading small', '桌面精简样式必须隐藏非必要盘口辅助文案。');
requireText(styles, 'display: none !important;', '桌面辅助元素必须使用最终覆盖优先级隐藏。');
forbidText(styles, '.order-book-columns', '桌面精简样式不得保留已删除的订单簿表头规则。');
forbidText(styles, '.order-book-midpoint', '桌面精简样式不得保留已删除的最新价分隔规则。');
forbidText(marketStyles, '.order-book-columns', '市场基础样式不得恢复订单簿表头。');
forbidText(marketStyles, '.order-book-midpoint', '市场基础样式不得恢复最新价分隔行。');
forbidText(styles, '@media (max-width: 720px)', '桌面精简样式不得改写移动端规则。');

for (const token of [
  '.market-detail-surface > .market-detail-hero.ui-primary-surface',
  '.market-detail-surface .market-chart-card.ui-primary-surface',
  '.market-detail-surface .market-account-panel.ui-primary-surface',
  'background: transparent !important;',
  '.market-detail-surface > .market-detail-hero--commodity',
  'grid-template-columns: 76px minmax(10rem, 1fr) repeat(2, minmax(6rem, auto));',
  '.market-detail-surface .market-trade-card {',
  'border: 0;',
  'background: transparent;',
  '.market-detail-surface .market-trade-summary > span:nth-child(2)',
  '@container market-page (max-width: 720px)',
  'grid-template-columns: 64px repeat(2, minmax(0, 1fr));',
  '@container market-page (max-width: 420px)',
]) {
  requireText(detailStyles, token, `商品详情直接内容流样式缺少规则：${token}`);
}
for (const token of [
  'market-fundamentals',
  'market-inventory-production',
  'market-detail-auto-trade',
]) forbidText(detailStyles, token, `商品详情最终样式不得恢复已删除区域：${token}`);

requireText(marketPage, "<small>{readOnly ? '实时五档 · 只读' : '实时五档 · 点击填价'}</small>", '订单簿辅助文案 DOM 必须继续存在并按只读状态切换。');
forbidText(marketPage, 'market-account-view-switch', '订单与成交必须同时纵向显示，不得恢复账户视图切换 DOM。');
requireText(marketPage, '<section>', '本人订单区必须保留普通 section。');
requireText(marketPage, '<section className="local-trades-section">', '本地成交区必须与订单区同时存在。');
requireText(marketPage, '<section className="market-trade-card">', '手动交易区必须直接排列在内容区。');
forbidText(marketPage, '<Panel className="widget market-trade-card">', '手动交易区不得恢复一级卡片底座。');
forbidText(marketPage, '<MarketAutoTradePanel', '地区商品详情不得恢复自动经营执行卡。');
forbidText(marketPage, 'market-fundamentals-grid', '地区商品详情不得恢复基本面条。');
forbidText(marketPage, 'order-book-columns', '市场页面不得恢复订单簿表头 DOM。');
forbidText(marketPage, 'order-book-midpoint', '市场页面不得恢复最新价分隔 DOM。');

requireText(design, '桌面端和移动端订单簿使用同一信息结构', '权威设计必须记录全端统一盘口结构。');
requireText(design, '不渲染“档位／价格／数量”表头或真实最近成交价“最新”分隔行', '权威设计必须记录表头和最新价行永久移除。');
requireText(design, '不大于 `720px` 的移动端始终同时显示下单区和五档盘口', '权威设计必须记录移动端永久双列。');
requireText(design, '已有订单在上、本地成交在下', '权威设计必须记录订单与成交全端纵向同时显示。');
requireText(design, '不渲染“挂单／成交”账户视图切换', '权威设计必须记录账户视图切换退役。');
forbidText(marketPage, 'market-compact-view-switch', '市场页面不得恢复下单／盘口切换 DOM。');

for (const token of [
  '地区商品详情顶部只保留商品身份、真实 24h 变化和当前可用库存',
  '地区商品详情不再渲染基本面条或商品基本面卡',
  '手动交易区不使用一级卡片底座',
  '地区商品详情不得渲染自动经营执行卡',
  '交易区摘要只显示最近成交和真实 24h 成交量',
  '成交趋势详情接口只下发当前时刻向前 24h 内带真实',
  '不依赖 `game.orders` 或市场对象引用变化',
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
  'regional commodity detail keeps only compact market facts in direct page flow',
  "expect(visibleHeroMetrics).toEqual(['24h 变化', '可用库存'])",
  "'市场价'",
  "'基准偏离'",
  "'需求满足率'",
  "'参考价'",
  "'上轮需求'",
  "'.market-auto-trade-execution'",
  "expect(visibleTradeSummary).toEqual(['最近成交', '24h 成交量'])",
  "'.market-detail-hero'",
  "'.market-chart-card'",
  "'.market-trade-card'",
  "'.market-account-panel'",
  'regional commodity direct detail flow stays readable on mobile',
  'widthGeometry.scrollWidth',
  'readDetailGeometry',
  'geometry.heroMetrics',
]) {
  requireText(detailBrowserSpec, token, `商品详情直接内容流浏览器回归缺少断言：${token}`);
}

if (failures.length > 0) {
  console.error('市场订单簿与商品详情精简结构验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('市场订单簿保持统一结构；地区商品详情只保留两项事实，行情使用 24h 真实成交加载，手动交易直接排列且自动经营执行不再渲染。');
