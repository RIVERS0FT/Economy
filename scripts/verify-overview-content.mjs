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

const routerPath = 'src/pages/PageRouter.tsx';
const overviewPath = 'src/pages/OverviewPage.tsx';
const viewModelPath = 'src/app/gameViewModel.ts';
const stylePath = 'src/styles/overview.css';
const mainPath = 'src/main.tsx';
const pageDesignPath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
const uiDesignPath = 'docs/UI_DESIGN_SYSTEM.md';
const packagePath = 'package.json';

[
  routerPath,
  overviewPath,
  viewModelPath,
  stylePath,
  mainPath,
  pageDesignPath,
  uiDesignPath,
  packagePath,
].forEach(requireFile);

for (const text of [
  "import { useEffect, useState } from 'react'",
  "const [overviewProductId, setOverviewProductId] = useState(() => model.game.products[0]?.id ?? '')",
  'model.game.products.some((product) => product.id === overviewProductId)',
  "setOverviewProductId(model.game.products[0]?.id ?? '')",
  'overviewProductId={overviewProductId}',
  'onOverviewProductChange={setOverviewProductId}',
]) requireText(routerPath, text);

for (const text of [
  'localStorage',
  'sessionStorage',
  'marketAssetId',
]) forbidText(routerPath, text);

for (const text of [
  "import { useMemo } from 'react'",
  'function greetingForHour(hour: number)',
  "if (hour < 5) return '凌晨好'",
  "if (hour < 12) return '早上好'",
  "if (hour < 14) return '中午好'",
  "if (hour < 18) return '下午好'",
  "return '晚上好'",
  'new Date(now).getHours()',
  'overviewProductId: string;',
  'onOverviewProductChange: (productId: string) => void;',
  'const overviewMarket = useMemo(() => {',
  "value={overviewMarket?.product.id ?? ''}",
  'onOverviewProductChange(event.target.value)',
  'aria-label="选择概览商品市场"',
  "selectMarketAsset('commodity', overviewMarket.product.id)",
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
  'const [overviewProductId, setOverviewProductId] = useState',
  'setOverviewProductId(',
  'selectedProductId',
  'setSelectedProductId',
  'localStorage',
  'sessionStorage',
  'title={<>早上好',
  'overview-product-strip',
  'localTrades.slice(0, 6)',
  '当前浏览器最近成交',
]) forbidText(overviewPath, text);

for (const text of [
  'function deriveGameData(game: EconomyState): DerivedGameData',
  'const derived = useMemo(() => (game ? deriveGameData(game) : null), [game]);',
  "if (kind === 'facility') setSelectedFacilityTypeId(assetId);",
  'marketAssetKind, marketAssetId, selectMarketAsset',
]) requireText(viewModelPath, text);

for (const text of [
  'selectedProductId',
  'setSelectedProductId',
  'selectedProduct: ProductDefinition',
  'selectedInventory: ProductInventory',
  'selectedMarket: ProductMarketState',
  'ownSelectedOpenOrders',
  'placeCommodityOrder:',
]) forbidText(viewModelPath, text);

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
  '属于 `PageRouter` 当前登录会话的页面级 UI 状态',
  '切换到市场、生产、资产或其他正式页面后再返回概览时必须保留选择',
  '不得写入服务器、`localStorage`、`sessionStorage` 或全局 `LoadedGameViewModel`',
  '刷新整个页面或重新登录后，从服务器目录首项重新初始化',
  '市场中的后续商品切换不得反向覆盖概览选择',
  '让普通页面切换重置仍有效的概览商品选择',
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
  console.error('概览内容、页面导航商品选择与布局验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('概览验证通过：本地时间问候、跨页面保留的路由会话商品选择、当前挂单与三卡等高布局满足设计基线。');
