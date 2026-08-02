import fs from 'node:fs';

const main = fs.readFileSync('src/main.tsx', 'utf8');
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
requireText(styles, '@media (min-width: 721px)', '桌面精简规则必须严格限定在大于 720px。');
for (const selector of [
  '.market-page-surface .market-compact-view-switch',
  '.market-page-surface .market-account-view-switch',
  '.market-page-surface .market-trade-section-heading > small',
  '.market-page-surface .order-book-columns',
  '.market-page-surface .order-book-midpoint',
]) {
  requireText(styles, selector, `桌面精简样式缺少选择器：${selector}`);
}
requireText(styles, 'display: none;', '桌面辅助元素必须隐藏。');
requireText(styles, 'visibility: hidden;', '桌面最新成交分隔必须视觉隐藏并保留既有几何兼容。');
requireText(styles, '@container market-page (max-width: 339px)', '桌面超窄内容必须覆盖移动分段切换隐藏规则。');
requireText(styles, 'display: block;', '桌面超窄内容必须同时显示下单区和订单簿。');
forbidText(styles, '@media (max-width: 720px)', '桌面精简样式不得改写移动端规则。');

for (const text of [
  'className="market-compact-view-switch ui-segmented"',
  'className="market-account-view-switch ui-segmented"',
  '<small>实时五档 · 点击填价</small>',
  'className="order-book-columns"',
  'className="order-book-midpoint"',
]) {
  requireText(marketPage, text, `移动端复用的现有 DOM 不得删除：${text}`);
}

requireText(design, '大于 `720px` 时隐藏交易卡“下单／盘口”', '权威设计必须记录桌面隐藏辅助切换。');
requireText(design, '同时隐藏订单簿表头、最新成交分隔和“实时五档 · 点击填价”辅助文案', '权威设计必须记录桌面订单簿精简范围。');
requireText(design, '不大于 `720px` 时账户记录使用“挂单／成交”切换', '权威设计必须保留移动端挂单／成交切换。');
requireText(design, '浏览器视口不大于 `720px`', '权威设计必须把超窄下单／盘口切换限定在移动端。');

requireText(browserSpec, 'desktop market hides auxiliary trade switches and order-book rows', '浏览器测试必须覆盖桌面精简。');
requireText(browserSpec, 'mobile market keeps existing switches, order-book header and latest-trade row', '浏览器测试必须覆盖移动端不变。');
requireText(browserSpec, "locator('.order-book-midpoint')).toBeHidden()", '浏览器测试必须验证桌面隐藏最新成交分隔。');
requireText(browserSpec, "locator('.order-book-midpoint')).toBeVisible()", '浏览器测试必须验证移动端保留最新成交分隔。');
requireText(browserSpec, "name: '盘口'", '浏览器测试必须验证移动端下单／盘口切换仍可操作。');
requireText(browserSpec, "name: '成交'", '浏览器测试必须验证移动端挂单／成交切换仍存在。');

if (failures.length > 0) {
  console.error('桌面市场卡片精简验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('桌面市场辅助切换、盘口表头、最新成交分隔与说明文案已隐藏；移动端既有交互保持不变。');
