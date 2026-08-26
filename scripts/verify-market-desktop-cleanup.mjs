import fs from 'node:fs';

const main = fs.readFileSync('src/main.tsx', 'utf8');
const marketRuntimeHtml = fs.readFileSync('market-runtime-test.html', 'utf8');
const marketPage = fs.readFileSync('src/pages/MarketPage.tsx', 'utf8');
const styles = fs.readFileSync('src/styles/market-desktop-cleanup.css', 'utf8');
const marketStyles = fs.readFileSync('src/styles/market-page-polish.css', 'utf8');
const design = fs.readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');
const browserSpec = fs.readFileSync('tests/browser/market-desktop-cleanup.spec.ts', 'utf8');

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
  '桌面市场精简样式必须在全部共享和页面样式之后最终加载。',
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

requireText(marketPage, '<small>实时五档 · 点击填价</small>', '订单簿辅助文案 DOM 必须继续存在以供桌面精简规则处理。');
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

requireText(browserSpec, 'desktop market uses compact order-book rows without duplicate headers', '浏览器测试必须覆盖桌面统一盘口结构。');
requireText(browserSpec, 'mobile market matches desktop order-book structure and keeps side-by-side trade panels', '浏览器测试必须覆盖移动端统一盘口结构与永久双列。');
requireText(browserSpec, "locator('.order-book-columns')).toHaveCount(0)", '浏览器测试必须验证订单簿表头不存在。');
requireText(browserSpec, "locator('.order-book-midpoint')).toHaveCount(0)", '浏览器测试必须验证最新价分隔行不存在。');
requireText(browserSpec, "name: '盘口', exact: true })).toHaveCount(0)", '浏览器测试必须验证移动端不恢复下单／盘口切换。');
requireText(browserSpec, "locator('.market-account-view-switch')).toHaveCount(0)", '浏览器测试必须验证账户视图切换不存在。');
requireText(browserSpec, "locator('.market-account-grid > section')", '浏览器测试必须覆盖订单与成交同时存在。');

if (failures.length > 0) {
  console.error('市场订单簿统一结构验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('桌面与移动端订单簿统一为连续五档行，表头和最新价分隔已从 DOM 与样式中移除。');
