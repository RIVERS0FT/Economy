import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

const componentPath = 'src/components/ui/FormControls.tsx';
const pagePath = 'src/pages/MarketPage.tsx';
const stylePath = 'src/styles/market-page-polish.css';
const orderDesignPath = 'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md';
const pageDesignPath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
const uiDesignPath = 'docs/UI_DESIGN_SYSTEM.md';
const browserPath = 'tests/browser/market-order-entry-compact.spec.ts';

[
  componentPath,
  pagePath,
  stylePath,
  orderDesignPath,
  pageDesignPath,
  uiDesignPath,
  browserPath,
].forEach(requireFile);

for (const text of [
  'wheelStep?: number',
  'document.activeElement !== input',
  "input.addEventListener('wheel', handleWheel, { passive: false })",
  'onValueChange(formatMoneyDraft(clampedCents / 100))',
]) requireText(componentPath, text);

for (const text of [
  'wheelStep={0.01}',
  'className="market-submit-order"',
  'const orderActionLabel = orderDisabledReason',
  'aria-label={orderActionLabel}',
  '<section className="market-trade-card">',
]) requireText(pagePath, text);
forbidText(pagePath, '<Panel className="widget market-trade-card">');

for (const text of [
  'grid-template-columns: minmax(320px, 3fr) minmax(240px, 2fr);',
  'grid-template-columns: minmax(0, 3fr) minmax(112px, 2fr);',
  '@container market-page (max-width: 359px)',
  'grid-template-columns: 24px minmax(0, 1fr) 34px;',
  'grid-template-columns: var(--market-stepper-label-width) minmax(0, 1fr);',
  '.market-page-surface .market-stepper__button {',
  "html[data-input-modality='mouse']",
  '@media (hover: hover) and (pointer: fine)',
  'position: absolute;',
  'top: 0;',
  'bottom: 0;',
  'margin-block: auto;',
  '.market-page-surface .market-stepper__button:disabled {',
  'width: 44px;',
  'padding-inline: 52px;',
]) requireText(stylePath, text);

for (const text of [
  '地区商品详情的手动下单与同资产五档订单簿直接排列在页面正文，不使用一级“{资产}交易”卡片底座',
  '字段标签／内嵌减号按钮／共享输入控件／内嵌加号按钮',
  '不再提供“交易资产详情”折叠区',
  '下单与盘口保持约 60%／40% 双列',
  '不大于 `720px` 的移动端始终同时显示下单区和五档盘口',
  '盘口保留不小于 112px 的可读宽度',
  '桌面端和移动端订单簿使用同一信息结构',
  '不渲染“档位／价格／数量”表头或真实最近成交价“最新”分隔行',
  'wheelStep={0.01}',
]) requireText(orderDesignPath, text);

for (const text of [
  '订单摘要中常驻显示按整张订单完全成交估算的“预计到账”',
  '不显示重复的交易资产详情折叠区',
  '主买入／卖出按钮必须直接显示最主要的阻断原因',
]) requireText(pageDesignPath, text);

for (const text of [
  '金额输入默认不响应滚轮',
  '输入框必须已经聚焦才消费纵向滚轮',
  '嵌入输入框的绝对定位操作按钮不得依赖',
]) requireText(uiDesignPath, text);

for (const text of [
  'market order fields keep labels and embedded steppers on one row',
  'focused market price input owns the wheel in 0.01 steps',
  'embedded market steppers keep stable geometry through press and disabled states',
  'market order book yields width to the order entry on desktop and mobile',
]) requireText(browserPath, text);

forbidText(pagePath, 'market-order-details');
forbidText(pagePath, 'compactTradeView');
forbidText(pagePath, 'market-compact-view-switch');
forbidText(pagePath, 'order-book-columns');
forbidText(pagePath, 'order-book-midpoint');
forbidText(pagePath, '交易资产详情');
forbidText(pagePath, 'order-disabled-reason');
forbidText(pagePath, '当前没有可出售的');
forbidText(pagePath, '当前最多可卖');
forbidText(stylePath, '.market-order-details');
forbidText(stylePath, '.order-book-columns');
forbidText(stylePath, '.order-book-midpoint');
forbidText(stylePath, '@container market-page (max-width: 339px)');
forbidText(stylePath, 'grid-template-columns: minmax(0, 2fr) minmax(126px, 1fr);');
forbidText(stylePath, 'minmax(280px, 44fr) minmax(300px, 56fr)');
forbidText(stylePath, 'minmax(0, 3fr) minmax(126px, 2fr)');
forbidText(stylePath, 'transform: translateY(-50%);');

if (failures.length) {
  console.error(`市场紧凑下单区验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('市场同行标签、内嵌步进按钮稳定定位、聚焦金额滚轮、详情移除、正文直排交易、移动端永久双列和极窄盘口验证通过。');
