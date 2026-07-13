import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

const overviewPath = 'src/pages/OverviewPage.tsx';
const stylePath = 'src/styles/overview.css';
const mainPath = 'src/main.tsx';
const pageDesignPath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
const uiDesignPath = 'docs/UI_DESIGN_SYSTEM.md';
const packagePath = 'package.json';

[
  overviewPath,
  stylePath,
  mainPath,
  pageDesignPath,
  uiDesignPath,
  packagePath,
].forEach(requireFile);

for (const text of [
  'function greetingForHour(hour: number)',
  "if (hour < 5) return '凌晨好'",
  "if (hour < 12) return '早上好'",
  "if (hour < 14) return '中午好'",
  "if (hour < 18) return '下午好'",
  "return '晚上好'",
  'new Date(now).getHours()',
  'value={selectedProductId}',
  'setSelectedProductId(event.target.value)',
  'aria-label="选择概览商品市场"',
  "selectMarketAsset('commodity', derived.selectedProduct.id)",
  'derived.ownOpenOrders',
  'orderKind(order)',
  'orderAssetId(order)',
  'orderStatusNames[order.status]',
  'title="当前挂单"',
  'overview-summary-row span-3',
  'overview-summary-card',
  'label="停止工厂"',
  '当前没有未完成订单。',
  '管理订单 →',
]) requireText(overviewPath, text);

for (const text of [
  'title={<>早上好',
  'overview-product-strip',
  'localTrades.slice(0, 6)',
  '当前浏览器最近成交',
]) forbidText(overviewPath, text);

for (const text of [
  '--overview-summary-card-height: 384px;',
  '.overview-summary-row {',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  'height: var(--overview-summary-card-height);',
  '.overview-open-orders-list {',
  'overflow-y: auto;',
  '@media (max-width: 960px)',
  'grid-template-columns: 1fr;',
  'height: auto;',
]) requireText(stylePath, text);

requireText(mainPath, "import './styles/overview.css'");
const main = read(mainPath);
const overviewStyleIndex = main.indexOf("import './styles/overview.css'");
const designSystemIndex = main.indexOf("import './styles/design-system.css'");
if (overviewStyleIndex < 0 || designSystemIndex < 0 || overviewStyleIndex > designSystemIndex) {
  failures.push('overview.css 必须在 design-system.css 之前加载');
}

for (const text of [
  '浏览器本地系统时间',
  '商品下拉框',
  '当前玩家所有等待成交或部分成交的商品与工厂挂单摘要',
  '三张卡片统一为 `384px` 高',
  '不得包含当前浏览器最近成交',
  '不得恢复全部商品快捷切换条',
]) requireText(pageDesignPath, text);

for (const text of [
  '`src/styles/overview.css`',
  '## 10. 概览布局',
  '切换选择器只更新概览数据，不触发页面跳转',
  '卡片高度统一为 `384px`',
  '概览不提供撤单按钮',
  '不超过 `960px` 时三张摘要卡改为单列并恢复自然高度',
]) requireText(uiDesignPath, text);

requireText(packagePath, 'node scripts/verify-overview-content.mjs');

if (failures.length > 0) {
  console.error('概览内容与布局验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('概览验证通过：本地时间问候、商品下拉框、当前挂单与三卡等高布局满足设计基线。');
