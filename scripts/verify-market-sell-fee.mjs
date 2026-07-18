import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };

[
  'server/src/market-sell-fee.js',
  'server/src/balanced-market.js',
  'server/src/domain-core.js',
  'server/src/facility-groups.js',
  'server/test/market-sell-fee.test.js',
  'src/types.ts',
  'src/utils/localActivityStore.ts',
  'src/pages/MarketPage.tsx',
  'README.md',
  'docs/README.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'MARKET_SELL_FEE_RATE_BPS = 100',
  'MARKET_SELL_FEE_MINIMUM = 1',
  'calculateCumulativeMarketSellFee',
  'Math.ceil(normalizedGross * MARKET_SELL_FEE_RATE_BPS / BASIS_POINTS)',
  'marketSellFeeGross',
  'marketSellFeeCharged',
]) requireText('server/src/market-sell-fee.js', text);

for (const path of ['server/src/balanced-market.js', 'server/src/domain-core.js', 'server/src/facility-groups.js']) {
  for (const text of ['applyMarketSellFee', 'fee: 0', 'netTotal']) requireText(path, text);
}
for (const text of [
  'delete normalized.marketSellFeeVersion',
  'delete normalized.marketSellFeeGross',
  'delete normalized.marketSellFeeCharged',
]) requireText('server/src/facility-groups.js', text);

for (const text of ['fee?: number', 'netTotal?: number']) requireText('src/types.ts', text);
for (const text of ['fee: Number(fill.fee || 0)', 'netTotal: Number(fill.netTotal ?? fill.total)']) {
  requireText('src/utils/localActivityStore.ts', text);
}
for (const text of ['预计手续费（1%，最低 1）', '预计到账', '手续费 / 实收']) {
  requireText('src/pages/MarketPage.tsx', text);
}

for (const [path, text] of [
  ['README.md', '按单张卖单累计成交总额收取 1% 手续费'],
  ['docs/README.md', '统一订单簿玩家卖出手续费'],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '玩家卖出手续费'],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '单张卖单自规则启用后的累计成交总额'],
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', 'fee'],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '预计手续费'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'market-sell-fee.js'],
  ['docs/GIFT_CODE_AND_ADMIN_DESIGN.md', '不收取统一订单簿玩家卖出手续费'],
]) requireText(path, text);

if (failures.length) {
  console.error(`玩家市场卖出手续费验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('玩家商品与工厂卖出手续费、累计部分成交、匿名公开字段、前端展示和拍卖隔离验证通过。');
