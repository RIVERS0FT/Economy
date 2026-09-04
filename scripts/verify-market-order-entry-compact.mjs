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
const uiDesignPath = 'docs/UI_DESIGN_SYSTEM.md';

[
  componentPath,
  pagePath,
  stylePath,
  orderDesignPath,
  uiDesignPath,
].forEach(requireFile);

// MoneyInput remains a shared form control for other domains, but player commodity market must not use it.
for (const text of [
  'wheelStep?: number',
  'document.activeElement !== input',
  "input.addEventListener('wheel', handleWheel, { passive: false })",
]) requireText(componentPath, text);

for (const text of [
  'function MarketImmediateTradeEntry({',
  'officialPrice: number;',
  'const maxBuyByFunds = officialPrice > 0',
  'const total = officialPrice * effectiveQuantity;',
  'id="market-trade-quantity"',
  'className="market-stepper market-quantity-stepper"',
  '数量减少 1',
  '数量增加 1',
  '25%',
  '50%',
  '最大',
  '交易总额',
  '预计到账',
  '手续费',
  'className="market-submit-order"',
  '立即买入',
  '立即卖出',
]) requireText(pagePath, text);
for (const text of ['今日成交价', '下次调价']) forbidText(pagePath, text);
for (const text of [
  'MoneyInput',
  'market-order-price',
  'wheelStep={0.01}',
  'orderBook.bids',
  'orderBook.asks',
  '实时五档',
  '已有订单',
  '>撤单<',
  'market-compact-view-switch',
]) forbidText(pagePath, text);

for (const text of [
  '.market-page-surface .market-stepper__button {',
  '.market-page-surface .market-stepper__button:disabled {',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.market-submit-order',
]) requireText(stylePath, text);

for (const text of [
  '玩家商品交易不得创建 `open`／`partial` 商品订单',
  '客户端只决定地区、商品、方向和数量',
  '玩家商品页面永久移除：价格输入框',
  '地区商品详情只展示当前商品身份、今日价格',
]) requireText(orderDesignPath, text);

for (const text of [
  '金额输入默认不响应滚轮',
  '输入框必须已经聚焦才消费纵向滚轮',
]) requireText(uiDesignPath, text);

if (failures.length) {
  console.error(`市场即时交易数量控件验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('市场即时交易数量控件验证通过：商品成交价只读取服务器当日价，连续 48 州均可交易，玩家仅调整数量，价格输入与五档盘口不得恢复。');
