import fs from 'node:fs';

const main = fs.readFileSync('src/main.tsx', 'utf8');
const marketRuntimeHtml = fs.readFileSync('market-runtime-test.html', 'utf8');
const marketPage = fs.readFileSync('src/pages/MarketPage.tsx', 'utf8');
const styles = fs.readFileSync('src/styles/market-desktop-cleanup.css', 'utf8');
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
  '.market-page-surface .market-account-view-switch',
  '.market-page-surface .market-trade-section-heading small',
  '.market-page-surface .order-book-columns',
  '.market-page-surface .order-book-midpoint',
]) {
  requireText(styles, selector, `桌面精简样式缺少选择器：${selector}`);
}
requireText(styles, 'display: none !important;', '桌面辅助元素必须使用最终覆盖优先级隐藏。');
requireText(styles, 'visibility: hidden !important;', '桌面最新成交分隔必须视觉隐藏并保留既有几何兼容。');
forbidText(styles, '@media (max-width: 720px)', '桌面精简样式不得改写移动端规则。');

for (const text of [
  'className="market-account-view-switch ui-segmented"',
  '<small>实时五档 · 点击填价</small>',
  'className="order-book-columns"',
  'className="order-book-midpoint"',
]) {
  requireText(marketPage, text, `移动端复用的现有 DOM 不得删除：${text}`);
}

requireText(design, '不大于 720px 的移动端保留上述表头和最新成交分隔', '权威设计必须保留移动盘口表头与最新成交行。');
requireText(design, '不大于 `720px` 的移动端始终同时显示下单区和五档盘口', '权威设计必须记录移动端永久双列。');
requireText(design, '桌面端不显示该账户视图切换', '权威设计必须保留桌面账户区域精简。');
forbidText(marketPage, 'market-compact-view-switch', '市场页面不得恢复下单／盘口切换 DOM。');

requireText(browserSpec, 'desktop market hides auxiliary trade switches and order-book rows', '浏览器测试必须覆盖桌面精简。');
requireText(browserSpec, 'mobile market keeps order-book details and side-by-side trade panels', '浏览器测试必须覆盖移动端盘口信息与永久双列。');
requireText(browserSpec, "locator('.order-book-midpoint')).toBeHidden()", '浏览器测试必须验证桌面隐藏最新成交分隔。');
requireText(browserSpec, "locator('.order-book-midpoint')).toBeVisible()", '浏览器测试必须验证移动端保留最新成交分隔。');
requireText(browserSpec, "name: '盘口'", '浏览器测试必须验证移动端下单／盘口切换仍可操作。');
requireText(browserSpec, "name: '成交'", '浏览器测试必须验证移动端挂单／成交切换仍存在。');

if (failures.length > 0) {
  console.error('桌面市场卡片精简验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('桌面市场盘口表头、最新成交分隔与说明文案已隐藏；移动端保留盘口信息并永久双列显示下单与盘口。');
