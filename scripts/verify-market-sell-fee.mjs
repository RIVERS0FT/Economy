import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

for (const text of [
  'MARKET_SELL_FEE_RATE_BPS = 100',
  'MARKET_SELL_FEE_MINIMUM = 0',
  'calculateCumulativeMarketSellFee',
  'MARKET_SELL_FEE_VERSION = 4',
  'applyMarketSellFee',
]) requireText('server/src/market-sell-fee.js', text);

for (const text of [
  "import { applyMarketSellFee } from './market-sell-fee.js';",
  "const settlement = applyMarketSellFee({ ownerType: 'player', side: 'sell', fills: [] }, total);",
  "creditPopulationEmployment(world, fee, 'marketService')",
  'fee = settlement.fee;',
  'netTotal = settlement.netTotal;',
  'recordSystemAudit(world, market, product, { side, quantity: normalizedQuantity, total, netTotal });',
]) requireText('server/src/system-market.js', text);

for (const text of [
  'const estimatedFee = orderSide === \'sell\'',
  'const estimatedNet = Math.max(0, total - estimatedFee);',
  '预计到账',
  '<small>手续费</small>',
  '手续费 / 实收',
]) requireText('src/pages/MarketPage.tsx', text);
for (const text of ['fee: Number(fill.fee || 0)', 'netTotal: Number(fill.netTotal ?? fill.total)']) requireText('src/utils/localActivityStore.ts', text);

for (const text of [
  '商品卖出继续收取累计口径等价 1% 的市场服务费',
  '费用进入人口市场服务就业收入',
]) requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', text);
requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '不设最低手续费');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '预计到账');
requireText('docs/LOCAL_ACTIVITY_LOG_DESIGN.md', 'fee');

forbidText('src/pages/MarketPage.tsx', 'market-order-price');
forbidText('src/pages/MarketPage.tsx', '已有订单');

if (failures.length) {
  console.error(`玩家即时市场卖出手续费验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('玩家即时卖出手续费验证通过：服务器按实际当日价成交额精确收取 1%，费用进入人口就业收入，客户端仅展示预计到账并在本地成交中保留 fee/netTotal。');
